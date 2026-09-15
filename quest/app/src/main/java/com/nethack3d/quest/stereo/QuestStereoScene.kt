package com.nethack3d.quest.stereo

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.ColorSpace
import android.os.Looper
import android.util.Base64
import android.view.Choreographer
import com.meta.spatial.core.Color4
import com.meta.spatial.core.Entity
import com.meta.spatial.core.Pose
import com.meta.spatial.core.SpatialSDKExperimentalAPI
import com.meta.spatial.core.Quaternion
import com.meta.spatial.core.Vector3
import com.meta.spatial.runtime.AddressMode
import com.meta.spatial.runtime.AlphaMode
import com.meta.spatial.runtime.DepthTest
import com.meta.spatial.runtime.DepthWrite
import com.meta.spatial.runtime.Filter
import com.meta.spatial.runtime.HitInfo
import com.meta.spatial.runtime.InputListener
import com.meta.spatial.runtime.MaterialSidedness
import com.meta.spatial.runtime.SamplerConfig
import com.meta.spatial.runtime.Scene
import com.meta.spatial.runtime.SceneMaterial
import com.meta.spatial.runtime.SceneMesh
import com.meta.spatial.runtime.SceneObject
import com.meta.spatial.runtime.SceneTexture
import org.json.JSONObject
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Retained native stereo presentation of resolved Three.js geometry. The SDK owns eye rendering,
 * tracking and reprojection; the WebView remains the owner of gameplay, asset resolution and UI.
 * All public methods run on Android's main thread, as do Spatial's native scene mutations.
 */
class QuestStereoScene(
    @Suppress("UNUSED_PARAMETER") context: Context,
    private val scene: Scene,
    private val onError: (String) -> Unit = {},
    private val onTileSelected: (Int, Int) -> Unit = { _, _ -> },
) {
    private data class TextureEntry(val texture: SceneTexture, val flipY: Boolean)
    private data class RenderEntry(val sceneObject: SceneObject, var mesh: SceneMesh)
    private data class MaterialKey(val id: String, val renderOrder: Int)
    private data class MeshData(
        val positions: FloatArray, val normals: FloatArray, val uvs: FloatArray,
        val colors: IntArray, val indices: IntArray, val ranges: IntArray,
        val materials: Array<SceneMaterial>,
    )

    private val geometries = HashMap<String, GeometryResource>()
    private val materialResources = HashMap<String, MaterialResource>()
    private val textures = HashMap<String, TextureEntry>()
    private val materials = HashMap<MaterialKey, SceneMaterial>()
    private val objects = LinkedHashMap<String, ObjectResource>()
    private val rendered = HashMap<String, RenderEntry>()
    private val retiredMaterials = ArrayList<SceneMaterial>()
    private val retiredTextures = ArrayList<SceneTexture>()
    private var whiteTexture: SceneTexture? = null
    private var camera = CameraResource(Float3(0f, -20f, 15f), floatArrayOf(0f, 0f, 0f, 1f))
    private var player = Float3(0f, 0f, 0f)
    private var tileSize = 1f
    private var worldScaleX = 1f
    private var sourceEyeHeight = SOURCE_EYE_HEIGHT_TILES
    private var lighting: JSONObject? = null
    private var session: String? = null
    private var sequence = -1L
    private var anchor = Pose(Vector3(0f, 1.4f, 0f))
    private var commonPose = Pose()
    private var windowScale = 0.1f
    private var windowDepthOffset = 1.2f
    private var active = false
    private var disposed = false
    private var lastBillboardPose: Pose? = null
    var mode: String = "windowed"
        private set
    val objectCount: Int get() = rendered.size
    val textureCount: Int get() = textures.size
    val materialCount: Int get() = materialResources.size
    val hasScene: Boolean get() = session != null

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!active || disposed) return
            try {
                updateBillboards()
            } catch (error: Exception) {
                setActive(false)
                onError(error.message ?: "Unable to update the tracked stereo scene")
            }
            if (active && !disposed) Choreographer.getInstance().postFrameCallback(this)
        }
    }

    init {
        checkMainThread()
        scene.setLightingEnvironment(Vector3(0.7f, 0.7f, 0.7f), Vector3(0.4f, 0.4f, 0.4f), Vector3(-0.3f, -1f, 0.4f))
        scene.setDepthParams(0.03f, 150f)
        recenter()
        applyEnvironment()
    }

    /** A fixed window in front of the recenter pose, never attached to every head movement. */
    fun panelPose(distance: Float = 2f): Pose = anchor * Pose(Vector3(0f, 0f, distance))

    fun recenter() {
        checkMainThread()
        val viewer = scene.getViewerPose().removePitchAndRoll()
        anchor = if (viewer.t.y > 0.35f) viewer else Pose(Vector3(viewer.t.x, 1.6f, viewer.t.z), viewer.q)
        updateCommonPose()
        applyCommonPose()
        lastBillboardPose = null
        updateBillboards()
    }

    fun setMode(value: String) {
        checkMainThread()
        require(value == "windowed" || value == "immersive" || value == "flat")
        if (mode == value) return
        mode = value
        applyEnvironment()
        if (value == "flat") {
            // Recovery must not rebuild the same resource that triggered a stereo error.
            clear()
            return
        }
        updateCommonPose()
        rebuildAll()
    }

    fun setActive(value: Boolean) {
        checkMainThread()
        if (active == value || disposed) return
        active = value
        if (value) Choreographer.getInstance().postFrameCallback(frameCallback)
        else Choreographer.getInstance().removeFrameCallback(frameCallback)
    }

    /** Called only after the trusted WebView bridge has reassembled a complete message. */
    fun acceptFrame(frame: JSONObject) {
        checkMainThread()
        check(!disposed) { "Stereo renderer is disposed" }
        if (mode == "flat") return
        require(frame.getInt("version") == 1 && frame.getString("type") == "scene")
        val nextSession = frame.getString("session")
        val nextSequence = frame.getLong("sequence")
        if (nextSession == session && nextSequence <= sequence) return
        if (frame.optBoolean("reset") || nextSession != session) clear()
        // Parse before touching native resources: malformed vector/index arrays cannot reach JNI.
        val nextGeometries = frame.items("geometries").map { GeometryResource.parse(it) }
        val nextMaterials = frame.items("materials").map { MaterialResource.parse(it) }
        val nextObjects = frame.items("objects").map { ObjectResource.parse(it) }
        val nextCamera = CameraResource.parse(frame.getJSONObject("camera"))
        val nextPlayer = frame.getJSONArray("player").float3()
        val nextTileSize = frame.optDouble("tileSize", 1.0).toFloat()
        require(nextTileSize.isFinite() && nextTileSize > 0f)
        val nextWorldScaleX = frame.optDouble("worldScaleX", 1.0).toFloat()
        require(nextWorldScaleX.isFinite() && nextWorldScaleX > 0f)
        val nextEyeHeight = frame.optDouble("eyeHeight", (nextTileSize * SOURCE_EYE_HEIGHT_TILES).toDouble()).toFloat()
        require(nextEyeHeight.isFinite() && nextEyeHeight > 0f)
        val cameraChanged = nextCamera.position != camera.position || !nextCamera.quaternion.contentEquals(camera.quaternion)
        val nextLighting = frame.optJSONObject("lighting")
        val lightingChanged = nextLighting?.toString() != lighting?.toString() || nextWorldScaleX != worldScaleX
        val previousScale = immersiveScale()
        camera = nextCamera
        player = nextPlayer
        tileSize = nextTileSize
        worldScaleX = nextWorldScaleX
        sourceEyeHeight = nextEyeHeight
        lighting = nextLighting
        val previousCommonPose = commonPose.copy()
        updateCommonPose()
        val commonPoseChanged = commonPose != previousCommonPose || (mode == "immersive" && previousScale != immersiveScale())

        val dirtyGeometries = nextGeometries.mapTo(HashSet()) { it.id }
        val dirtyMaterials = nextMaterials.mapTo(HashSet()) { it.id }
        val dirtyTextures = HashSet<String>()
        frame.items("textures").forEach { descriptor ->
            val id = descriptor.getString("id")
            val replacement = loadTexture(descriptor)
            textures.put(id, replacement)?.let { retiredTextures.add(it.texture) }
            dirtyTextures.add(id)
        }
        nextGeometries.forEach { geometries[it.id] = it }
        nextMaterials.forEach { materialResources[it.id] = it }
        materialResources.values.filter { it.texture in dirtyTextures }.forEach { dirtyMaterials.add(it.id) }
        val iterator = materials.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (entry.key.id in dirtyMaterials) {
                retiredMaterials.add(entry.value)
                iterator.remove()
            }
        }
        frame.optJSONArray("removed")?.strings()?.forEach { removeObject(it) }
        val dirtyObjects = nextObjects.mapTo(HashSet()) { it.id }
        nextObjects.forEach { objects[it.id] = it }
        require(objects.size <= MAX_OBJECTS) { "Too many scene objects" }
        if ((mode == "windowed" && cameraChanged) || lightingChanged) dirtyObjects.addAll(objects.keys)
        objects.values.forEach { descriptor ->
            if (descriptor.geometry in dirtyGeometries || descriptor.groups.any { it.material in dirtyMaterials }) {
                dirtyObjects.add(descriptor.id)
            }
        }
        dirtyObjects.forEach { objects[it]?.let(::rebuildObject) }
        if (commonPoseChanged) applyCommonPose()
        releaseRemovedResources(frame)
        releaseRetiredResources()
        session = nextSession
        sequence = nextSequence
    }

    fun clear() {
        checkMainThread()
        rendered.values.forEach { it.sceneObject.destroy(); it.mesh.destroy() }
        rendered.clear()
        objects.clear()
        geometries.clear()
        materials.values.forEach { it.destroy() }
        materials.clear()
        materialResources.clear()
        textures.values.forEach { it.texture.destroy() }
        textures.clear()
        releaseRetiredResources()
        whiteTexture?.destroy()
        whiteTexture = null
        session = null
        sequence = -1
        lastBillboardPose = null
    }

    fun dispose() {
        if (disposed) return
        setActive(false)
        clear()
        disposed = true
    }

    private fun applyEnvironment() {
        scene.enablePassthrough(mode != "immersive")
        scene.setBackfillColor(if (mode == "immersive") Color4(0.015f, 0.02f, 0.03f, 1f) else Color4(0f, 0f, 0f, 0f))
    }

    private fun updateCommonPose() {
        if (mode == "immersive") {
            // Match the working vr branch's fixed world rig: headset pose owns the
            // view, and player movement translates the world. The flat/FPS page
            // camera must never spin or reframe the surrounding native dungeon.
            val rotation = anchor.q
            val offset = immersivePlayerOffset(player, immersiveScale())
            val translated = rotation * Vector3(offset.x, offset.y, offset.z)
            // LOCAL_FLOOR is already real floor; no extra virtual eye-height offset is introduced.
            commonPose = Pose(Vector3(anchor.t.x + translated.x, translated.y, anchor.t.z + translated.z), rotation)
        } else {
            val distanceToPlayer = (camera.position - player).length().coerceAtLeast(tileSize * 4f)
            windowScale = (1.8f / distanceToPlayer).coerceIn(0.035f / tileSize, 0.35f / tileSize)
            windowDepthOffset = WINDOW_FOCAL_DEPTH - distanceToPlayer * windowScale
            commonPose = anchor.copy()
        }
    }

    private fun immersiveScale() = (anchor.t.y / sourceEyeHeight).coerceIn(1.0f / tileSize, 3.5f / tileSize)

    private fun applyCommonPose() {
        rendered.forEach { (id, entry) -> objects[id]?.let { applyObjectPose(it, entry) } }
    }

    private fun applyObjectPose(source: ObjectResource, entry: RenderEntry) {
        val scale = if (mode == "immersive") immersiveScale() else 1f
        if (source.billboard && mode == "immersive") {
            val center = Vector3(source.matrix[12] * scale, source.matrix[14] * scale, source.matrix[13] * scale)
            entry.sceneObject.setPosition(commonPose * center)
            val viewer = scene.getViewerPose()
            entry.sceneObject.setRotationQuat(if (source.upright) viewer.removePitchAndRoll().q else viewer.q)
        } else {
            entry.sceneObject.setPosition(commonPose.t)
            entry.sceneObject.setRotationQuat(commonPose.q)
        }
        entry.sceneObject.setScale(Vector3(scale, scale, scale))
        entry.sceneObject.setIsVisible(mode != "flat")
    }

    private fun rebuildAll() {
        if (objects.isEmpty() || disposed || mode == "flat") return
        objects.values.forEach(::rebuildObject)
        applyCommonPose()
    }

    private fun removeObject(id: String) {
        objects.remove(id)
        rendered.remove(id)?.let { it.sceneObject.destroy(); it.mesh.destroy() }
    }

    private fun rebuildObject(source: ObjectResource) {
        val geometry = geometries[source.geometry] ?: error("Missing geometry ${source.geometry}")
        val data = makeMesh(source, geometry)
        if (data.indices.isEmpty()) {
            rendered.remove(source.id)?.let { it.sceneObject.destroy(); it.mesh.destroy() }
            return
        }
        val mesh = SceneMesh.meshWithMaterials(
            data.positions, data.normals, data.uvs, data.colors, data.indices,
            data.ranges, data.materials, true,
        )
        val previous = rendered[source.id]
        if (previous != null) {
            previous.sceneObject.setSceneMesh(mesh, source.id)
            previous.mesh.destroy()
            previous.mesh = mesh
        } else {
            // SceneObject's constructor registers it with Scene itself.
            val sceneObject = SceneObject(scene, mesh, "game:${source.id}")
            sceneObject.addInputListener(object : InputListener {
                override fun onClick(receiver: SceneObject, hitInfo: HitInfo, sourceOfInput: Entity) {
                    objects[source.id]?.let { current ->
                        val tile = current.tile ?: pointToTile(hitInfo.point)
                        onTileSelected(tile[0], tile[1])
                    }
                }
            })
            rendered[source.id] = RenderEntry(sceneObject, mesh)
        }
        rendered[source.id]?.let { applyObjectPose(source, it) }
    }

    private fun makeMesh(source: ObjectResource, geometry: GeometryResource): MeshData {
        val positions = ArrayList<Float>()
        val normals = ArrayList<Float>()
        val uvs = ArrayList<Float>()
        val colors = ArrayList<Int>()
        val indices = ArrayList<Int>()
        val ranges = ArrayList<Int>()
        val usedMaterials = ArrayList<SceneMaterial>()
        val mirrored = matrixDeterminant(source.matrix) < 0f
        val scaleX = Float3(source.matrix[0], source.matrix[1], source.matrix[2]).length() * if (mirrored) -1f else 1f
        val scaleY = Float3(source.matrix[4], source.matrix[5], source.matrix[6]).length()
        val centerWorld = Float3(source.matrix[12], source.matrix[13], source.matrix[14])
        val projectedCenter = projectPoint(centerWorld)
        val reflected = !mirrored

        fun vertex(index: Int, material: MaterialResource): ClipVertex {
            val positionOffset = index * 3
            var world = transformPoint(source.matrix, Float3(
                geometry.positions[positionOffset], geometry.positions[positionOffset + 1], geometry.positions[positionOffset + 2],
            ))
            var normal = if (geometry.normals.isNotEmpty()) transformNormal(source.matrix, Float3(
                geometry.normals[positionOffset], geometry.normals[positionOffset + 1], geometry.normals[positionOffset + 2],
            )) else Float3(0f, 0f, 1f)
            val position: Float3
            if (source.billboard) {
                val x = (geometry.positions[positionOffset] + 0.5f - source.center[0]) * scaleX
                val y = (geometry.positions[positionOffset + 1] + 0.5f - source.center[1]) * scaleY
                val cosine = cos(source.rotation)
                val sine = sin(source.rotation)
                if (mode == "immersive") {
                    // Keep the local quad cached: tracked head rotation updates only its native pose.
                    position = Float3(x * cosine - y * sine, x * sine + y * cosine, 0f)
                    normal = Float3(0f, 0f, -1f)
                } else {
                    // Windowed sprites follow the source camera, as in the old VR
                    // tabletop mode. Head motion gives parallax, not geometry rebuilds.
                    position = projectedCenter + Float3((x * cosine - y * sine) * windowScale, (x * sine + y * cosine) * windowScale, 0f)
                    normal = Float3(0f, 0f, -1f)
                }
                world = centerWorld
            } else {
                position = projectPoint(world)
                normal = projectNormal(normal)
            }
            val uvOffset = index * 2
            val u = if (geometry.uvs.isEmpty()) 0f else geometry.uvs[uvOffset]
            val v = if (geometry.uvs.isEmpty()) 0f else geometry.uvs[uvOffset + 1]
            val uv = material.uvTransform
            val textureU = uv[0] * u + uv[3] * v + uv[6]
            var textureV = uv[1] * u + uv[4] * v + uv[7]
            if (textures[material.texture]?.flipY == true) textureV = 1f - textureV
            val colorOffset = index * 4
            val color = if (material.vertexColors && geometry.colors.isNotEmpty()) FloatArray(4) { geometry.colors[colorOffset + it] }
                else floatArrayOf(1f, 1f, 1f, 1f)
            val brightness = lightingBrightness(world)
            for (channel in 0..2) color[channel] *= brightness
            return ClipVertex(position, normal, textureU, textureV, color)
        }

        fun appendVertex(vertex: ClipVertex): Int {
            val index = colors.size
            positions.add(vertex.position.x); positions.add(vertex.position.y); positions.add(vertex.position.z)
            val normal = vertex.normal.normalized()
            normals.add(normal.x); normals.add(normal.y); normals.add(normal.z)
            uvs.add(vertex.u); uvs.add(vertex.v)
            colors.add(Color.argb(
                (vertex.color[3].coerceIn(0f, 1f) * 255f).roundToInt(),
                (vertex.color[0].coerceIn(0f, 1f) * 255f).roundToInt(),
                (vertex.color[1].coerceIn(0f, 1f) * 255f).roundToInt(),
                (vertex.color[2].coerceIn(0f, 1f) * 255f).roundToInt(),
            ))
            return index
        }

        source.groups.forEach { group ->
            require(group.start >= 0 && group.count >= 0 && group.start % 3 == 0 && group.count % 3 == 0)
            require(group.start.toLong() + group.count <= geometry.indices.size.toLong())
            val material = materialResources[group.material] ?: error("Missing material ${group.material}")
            val startIndex = indices.size
            var index = group.start
            while (index < group.start + group.count) {
                val triangle = listOf(
                    vertex(geometry.indices[index], material),
                    vertex(geometry.indices[index + 1], material),
                    vertex(geometry.indices[index + 2], material),
                )
                val polygon = if (mode == "windowed") clipTriangleToBox(triangle, WINDOW_BOUNDS) else triangle
                if (polygon.size >= 3) {
                    val first = appendVertex(polygon[0])
                    var previous = appendVertex(polygon[1])
                    for (triangleIndex in 2 until polygon.size) {
                        val next = appendVertex(polygon[triangleIndex])
                        indices.add(first)
                        // One handedness reflection from Three to Spatial; negative object scale cancels it.
                        indices.add(if (reflected) next else previous)
                        indices.add(if (reflected) previous else next)
                        previous = next
                    }
                }
                index += 3
            }
            if (indices.size > startIndex) {
                ranges.add(startIndex)
                ranges.add(indices.size - startIndex)
                usedMaterials.add(nativeMaterial(material, source.renderOrder))
            }
        }
        return MeshData(positions.toFloatArray(), normals.toFloatArray(), uvs.toFloatArray(), colors.toIntArray(),
            indices.toIntArray(), ranges.toIntArray(), usedMaterials.toTypedArray())
    }

    private fun projectPoint(point: Float3): Float3 {
        if (mode == "immersive") return gameToSpatial(point)
        val local = inverseRotateVector(camera.quaternion, point - camera.position)
        return Float3(local.x * windowScale, local.y * windowScale, -local.z * windowScale + windowDepthOffset)
    }

    private fun projectNormal(normal: Float3): Float3 {
        if (mode == "immersive") return gameToSpatial(normal)
        val local = inverseRotateVector(camera.quaternion, normal)
        return Float3(local.x, local.y, -local.z)
    }

    private fun pointToTile(point: Vector3): IntArray {
        val local = commonPose.inverse() * point
        val world = if (mode == "immersive") {
            Float3(local.x / immersiveScale(), local.z / immersiveScale(), local.y / immersiveScale())
        } else {
            camera.position + rotateVector(camera.quaternion, Float3(
                local.x / windowScale, local.y / windowScale, -(local.z - windowDepthOffset) / windowScale,
            ))
        }
        return intArrayOf((world.x / (tileSize * worldScaleX)).roundToInt(), (-world.y / tileSize).roundToInt())
    }

    private fun lightingBrightness(point: Float3): Float {
        val descriptor = lighting ?: return 1f
        val center = descriptor.optJSONArray("center") ?: return 1f
        val radius = descriptor.optDouble("radius", 0.0).toFloat()
        if (radius <= 0f) return 1f
        val dx = point.x / worldScaleX - center.optDouble(0, 0.0).toFloat()
        val dy = point.y - center.optDouble(1, 0.0).toFloat()
        val distance = kotlin.math.sqrt(dx * dx + dy * dy)
        val falloff = descriptor.optDouble("falloffPower", 1.0).toFloat().coerceAtLeast(0.01f) /
            if (descriptor.optBoolean("isFpsMode")) 2f else 1f
        val darkness = descriptor.optDouble("maxDarkAlpha", 0.0).toFloat().coerceIn(0f, 1f)
        return 1f - (distance / radius).coerceIn(0f, 1f).pow(falloff) * darkness
    }

    // SDK 0.13.2 marks material render ordering experimental; keep the opt-in local.
    @OptIn(SpatialSDKExperimentalAPI::class)
    private fun nativeMaterial(source: MaterialResource, renderOrder: Int): SceneMaterial =
        materials.getOrPut(MaterialKey(source.id, renderOrder.coerceIn(-3, 3))) {
            val texture = source.texture?.let { textures[it]?.texture ?: error("Missing texture $it") }
                ?: whiteTexture ?: SceneTexture(Color.valueOf(Color.WHITE)).also { whiteTexture = it }
            val alpha = when {
                source.additive -> AlphaMode.ADDITIVE
                source.transparent || source.opacity < 1f -> AlphaMode.TRANSLUCENT
                source.alphaTest > 0f -> AlphaMode.MASKED
                else -> AlphaMode.OPAQUE
            }
            SceneMaterial(texture, alpha, if (source.unlit) SceneMaterial.TEXTURED_UNLIT_SHADER else SceneMaterial.PHYSICALLY_BASED_SHADER).apply {
                setAlbedoColor(Color.valueOf(source.color[0], source.color[1], source.color[2], source.opacity,
                    ColorSpace.get(ColorSpace.Named.LINEAR_SRGB)))
                setSidedness(when (source.side) {
                    1 -> MaterialSidedness.BACK_SIDED
                    2 -> MaterialSidedness.DOUBLE_SIDED
                    else -> MaterialSidedness.FRONT_SIDED
                })
                setDepthTest(if (source.depthTest) DepthTest.LESS_OR_EQUAL else DepthTest.ALWAYS)
                setDepthWrite(if (source.depthWrite) DepthWrite.ENABLE else DepthWrite.DISABLE)
                setRenderOrder(renderOrder.coerceIn(-3, 3))
                setRoughnessMetallicness(0.9f, 0f)
                // Both setters write the same native roughness/metallic/unlit vector.
                // Set the unlit bit LAST so sprites and glyphs retain their texture color.
                if (source.unlit) setUnlit(true)
            }
        }

    private fun loadTexture(descriptor: JSONObject): TextureEntry {
        val dataUrl = descriptor.getString("dataUrl")
        require(dataUrl.startsWith("data:image/png;base64,")) { "Scene textures must be bundled PNG pixels" }
        val bytes = Base64.decode(dataUrl.substringAfter(','), Base64.DEFAULT)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        require(bounds.outWidth in 1..8192 && bounds.outHeight in 1..8192 && bounds.outWidth.toLong() * bounds.outHeight <= 16_777_216L) {
            "Scene texture dimensions exceed Quest limits"
        }
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: error("Unable to decode scene texture")
        val filter = if (descriptor.optBoolean("nearest")) Filter.NEAREST else Filter.LINEAR
        fun address(name: String): AddressMode = when (descriptor.optInt(name, 1001)) {
            1000 -> AddressMode.REPEAT
            1002 -> AddressMode.MIRRORED_REPEAT
            else -> AddressMode.CLAMP_TO_EDGE
        }
        val sampler = SamplerConfig(filter, filter, filter, address("wrapS"), address("wrapT"), 0f)
        return try {
            TextureEntry(SceneTexture(bitmap, sampler), descriptor.optBoolean("flipY", true))
        } finally { bitmap.recycle() }
    }

    private fun updateBillboards() {
        if (mode != "immersive" || rendered.isEmpty()) return
        val pose = scene.getViewerPose()
        val last = lastBillboardPose
        if (last != null && pose.isWithinAngleDegrees(last, 0.3f) && pose.isWithinDistance(last, 0.005f)) return
        lastBillboardPose = pose.copy()
        // Update retained poses only. Never allocate meshes/BVHs from a head-tracking callback.
        for ((id, entry) in rendered) {
            val source = objects[id] ?: continue
            if (source.billboard) applyObjectPose(source, entry)
        }
    }

    private fun releaseRemovedResources(frame: JSONObject) {
        frame.optJSONArray("removedGeometries")?.strings()?.forEach { id ->
            if (objects.values.none { it.geometry == id }) geometries.remove(id)
        }
        frame.optJSONArray("removedMaterials")?.strings()?.forEach { id ->
            if (objects.values.none { source -> source.groups.any { it.material == id } }) {
                materialResources.remove(id)
                val iterator = materials.iterator()
                while (iterator.hasNext()) {
                    val entry = iterator.next()
                    if (entry.key.id == id) { retiredMaterials.add(entry.value); iterator.remove() }
                }
            }
        }
        frame.optJSONArray("removedTextures")?.strings()?.forEach { id ->
            if (materialResources.values.none { it.texture == id }) textures.remove(id)?.let { retiredTextures.add(it.texture) }
        }
    }

    private fun releaseRetiredResources() {
        retiredMaterials.forEach { it.destroy() }
        retiredMaterials.clear()
        retiredTextures.forEach { it.destroy() }
        retiredTextures.clear()
    }

    private fun checkMainThread() = check(Looper.myLooper() == Looper.getMainLooper()) { "Stereo scene requires the main thread" }

    companion object {
        private const val MAX_OBJECTS = 20_000
        private const val SOURCE_EYE_HEIGHT_TILES = 0.62f
        private const val WINDOW_FOCAL_DEPTH = 3f
        // The world is geometrically bounded on every side, so MR remains visible around it.
        private val WINDOW_BOUNDS = ClipBox(Float3(-0.8f, -0.5f, 2.015f), Float3(0.8f, 0.5f, 5.5f))
    }
}







