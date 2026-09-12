package com.nethack3d.quest.stereo

import kotlin.math.abs
import kotlin.math.sqrt

/** CPU geometry work stays independent of the Spatial runtime and its render thread. */
internal data class Float3(val x: Float, val y: Float, val z: Float) {
    operator fun plus(other: Float3) = Float3(x + other.x, y + other.y, z + other.z)
    operator fun minus(other: Float3) = Float3(x - other.x, y - other.y, z - other.z)
    operator fun times(scale: Float) = Float3(x * scale, y * scale, z * scale)
    fun dot(other: Float3) = x * other.x + y * other.y + z * other.z
    fun cross(other: Float3) = Float3(y * other.z - z * other.y, z * other.x - x * other.z, x * other.y - y * other.x)
    fun length() = sqrt(dot(this))
    fun normalized(): Float3 = length().let { if (it > 0.000001f) this * (1f / it) else Float3(0f, 0f, 1f) }
    fun component(axis: Int) = when (axis) { 0 -> x; 1 -> y; else -> z }
}

internal data class ClipVertex(
    val position: Float3,
    val normal: Float3,
    val u: Float,
    val v: Float,
    val color: FloatArray,
) {
    fun interpolate(other: ClipVertex, amount: Float): ClipVertex {
        val inverse = 1f - amount
        return ClipVertex(
            position * inverse + other.position * amount,
            normal * inverse + other.normal * amount,
            u * inverse + other.u * amount,
            v * inverse + other.v * amount,
            FloatArray(4) { color[it] * inverse + other.color[it] * amount },
        )
    }
}

internal data class ClipBox(val minimum: Float3, val maximum: Float3)

/** Sutherland-Hodgman clips triangles, including texture/color interpolants, to all six faces. */
internal fun clipTriangleToBox(triangle: List<ClipVertex>, box: ClipBox): List<ClipVertex> {
    var polygon = triangle
    for (axis in 0..2) {
        for (upper in listOf(false, true)) {
            if (polygon.isEmpty()) return emptyList()
            val boundary = (if (upper) box.maximum else box.minimum).component(axis)
            fun distance(vertex: ClipVertex): Float =
                if (upper) boundary - vertex.position.component(axis) else vertex.position.component(axis) - boundary
            val result = ArrayList<ClipVertex>(polygon.size + 1)
            var previous = polygon.last()
            var previousDistance = distance(previous)
            for (current in polygon) {
                val currentDistance = distance(current)
                val wasInside = previousDistance >= 0f
                val isInside = currentDistance >= 0f
                if (wasInside != isInside) {
                    val denominator = previousDistance - currentDistance
                    if (abs(denominator) > 0.0000001f) {
                        result.add(previous.interpolate(current, (previousDistance / denominator).coerceIn(0f, 1f)))
                    }
                }
                if (isInside) result.add(current)
                previous = current
                previousDistance = currentDistance
            }
            polygon = result
        }
    }
    return polygon
}

/** Three.js matrices in the bridge are column major, and the game uses +Z as up. */
internal fun transformPoint(matrix: FloatArray, point: Float3): Float3 = Float3(
    matrix[0] * point.x + matrix[4] * point.y + matrix[8] * point.z + matrix[12],
    matrix[1] * point.x + matrix[5] * point.y + matrix[9] * point.z + matrix[13],
    matrix[2] * point.x + matrix[6] * point.y + matrix[10] * point.z + matrix[14],
)

/** Inverse transpose preserves normals under nonuniform object scale. */
internal fun transformNormal(matrix: FloatArray, normal: Float3): Float3 {
    val a = Float3(matrix[0], matrix[1], matrix[2])
    val b = Float3(matrix[4], matrix[5], matrix[6])
    val c = Float3(matrix[8], matrix[9], matrix[10])
    val determinant = a.dot(b.cross(c))
    if (abs(determinant) < 0.0000001f) return normal
    return (b.cross(c) * normal.x + c.cross(a) * normal.y + a.cross(b) * normal.z).times(1f / determinant).normalized()
}

internal fun matrixDeterminant(matrix: FloatArray): Float =
    Float3(matrix[0], matrix[1], matrix[2]).dot(
        Float3(matrix[4], matrix[5], matrix[6]).cross(Float3(matrix[8], matrix[9], matrix[10])),
    )

/** Quaternion order on the wire is x,y,z,w (different from Spatial SDK's constructor). */
internal fun rotateVector(quaternion: FloatArray, vector: Float3): Float3 {
    val axis = Float3(quaternion[0], quaternion[1], quaternion[2])
    val twiceCross = axis.cross(vector) * 2f
    return vector + twiceCross * quaternion[3] + axis.cross(twiceCross)
}

internal fun inverseRotateVector(quaternion: FloatArray, vector: Float3): Float3 =
    rotateVector(floatArrayOf(-quaternion[0], -quaternion[1], -quaternion[2], quaternion[3]), vector)

/** Working VR branch: source +Z is up. Spatial uses +Y up and +Z forward.
 * This rig deliberately has no page-camera parameter: head pose owns the view. */
internal fun gameToSpatial(point: Float3): Float3 = Float3(point.x, point.z, point.y)
internal fun immersivePlayerOffset(player: Float3, scale: Float): Float3 = gameToSpatial(player) * -scale
