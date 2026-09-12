package com.nethack3d.quest.stereo

import org.json.JSONArray
import org.json.JSONObject

internal fun JSONArray.floats(expected: Int? = null): FloatArray {
    require(expected == null || length() == expected) { "Unexpected vector length" }
    return FloatArray(length()) { index ->
        getDouble(index).toFloat().also { require(it.isFinite()) { "Non-finite scene number" } }
    }
}

internal fun JSONArray.float3(): Float3 = floats(3).let { Float3(it[0], it[1], it[2]) }
internal fun JSONArray.strings(): List<String> = List(length()) { getString(it) }
internal fun JSONObject.items(name: String): List<JSONObject> = optJSONArray(name)?.let { array ->
    List(array.length()) { array.getJSONObject(it) }
} ?: emptyList()

internal data class GeometryResource(
    val id: String,
    val positions: FloatArray,
    val normals: FloatArray,
    val uvs: FloatArray,
    val colors: FloatArray,
    val indices: IntArray,
) {
    companion object {
        fun parse(json: JSONObject): GeometryResource {
            val positions = json.getJSONArray("positions").floats()
            require(positions.isNotEmpty() && positions.size % 3 == 0 && positions.size <= 3_000_000)
            val vertexCount = positions.size / 3
            val normals = json.optJSONArray("normals")?.floats() ?: FloatArray(0)
            val uvs = json.optJSONArray("uvs")?.floats() ?: FloatArray(0)
            val colors = json.optJSONArray("colors")?.floats() ?: FloatArray(0)
            require(normals.isEmpty() || normals.size == positions.size)
            require(uvs.isEmpty() || uvs.size == vertexCount * 2)
            require(colors.isEmpty() || colors.size == vertexCount * 4)
            val sourceIndices = json.optJSONArray("indices")
            val indices = sourceIndices?.let { values -> IntArray(values.length()) { values.getInt(it) } }
                ?: IntArray(vertexCount) { it }
            require(indices.size % 3 == 0 && indices.all { it in 0 until vertexCount })
            return GeometryResource(json.getString("id"), positions, normals, uvs, colors, indices)
        }
    }
}

internal data class MaterialResource(
    val id: String,
    val color: FloatArray,
    val opacity: Float,
    val texture: String?,
    val transparent: Boolean,
    val alphaTest: Float,
    val side: Int,
    val unlit: Boolean,
    val depthWrite: Boolean,
    val depthTest: Boolean,
    val vertexColors: Boolean,
    val additive: Boolean,
    val uvTransform: FloatArray,
) {
    companion object {
        fun parse(json: JSONObject) = MaterialResource(
            id = json.getString("id"),
            color = json.optJSONArray("color")?.floats(3) ?: floatArrayOf(1f, 1f, 1f),
            opacity = json.optDouble("opacity", 1.0).toFloat().coerceIn(0f, 1f),
            texture = if (json.has("map") && !json.isNull("map")) json.getString("map") else null,
            transparent = json.optBoolean("transparent", false),
            alphaTest = json.optDouble("alphaTest", 0.0).toFloat(),
            side = json.optInt("side", 0),
            unlit = json.optBoolean("unlit", false),
            depthWrite = json.optBoolean("depthWrite", true),
            depthTest = json.optBoolean("depthTest", true),
            vertexColors = json.optBoolean("vertexColors", false),
            additive = json.optBoolean("additive", false),
            uvTransform = json.optJSONArray("uvTransform")?.floats(9)
                ?: floatArrayOf(1f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 1f),
        )
    }
}

internal data class MaterialGroup(val material: String, val start: Int, val count: Int)
internal data class ObjectResource(
    val id: String,
    val geometry: String,
    val matrix: FloatArray,
    val groups: List<MaterialGroup>,
    val billboard: Boolean,
    val upright: Boolean,
    val center: FloatArray,
    val rotation: Float,
    val renderOrder: Int,
    val tile: IntArray?,
) {
    companion object {
        fun parse(json: JSONObject): ObjectResource = ObjectResource(
            json.getString("id"),
            json.getString("geometry"),
            json.getJSONArray("matrix").floats(16),
            json.items("materials").map {
                MaterialGroup(it.getString("material"), it.getInt("start"), it.getInt("count"))
            },
            json.optBoolean("billboard", false),
            json.optBoolean("upright", false),
            json.optJSONArray("center")?.floats(2) ?: floatArrayOf(0.5f, 0.5f),
            json.optDouble("rotation", 0.0).toFloat(),
            json.optInt("renderOrder", 0),
            json.optJSONArray("tile")?.let { intArrayOf(it.getInt(0), it.getInt(1)) },
        )
    }
}

internal data class CameraResource(val position: Float3, val quaternion: FloatArray) {
    companion object {
        fun parse(json: JSONObject) = CameraResource(
            json.getJSONArray("position").float3(), json.getJSONArray("quaternion").floats(4),
        )
    }
}

