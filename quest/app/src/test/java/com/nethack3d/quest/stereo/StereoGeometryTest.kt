package com.nethack3d.quest.stereo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.sqrt

class StereoGeometryTest {
    private val bounds = ClipBox(Float3(-1f, -1f, -1f), Float3(1f, 1f, 1f))
    private fun vertex(x: Float, y: Float, z: Float, u: Float = 0f) =
        ClipVertex(Float3(x, y, z), Float3(0f, 0f, 1f), u, 0f, floatArrayOf(u, 1f, 1f, 1f))

    @Test fun immersiveRigSurroundsPlayerOnTheFloorWithoutAWindowCamera() {
        val player = Float3(10f, -20f, 0f)
        val scale = 2f
        fun placed(point: Float3) = gameToSpatial(point) * scale + immersivePlayerOffset(player, scale)
        assertEquals(Float3(0f, 0f, 0f), placed(player))
        assertEquals(Float3(0f, 2f, 0f), placed(player + Float3(0f, 0f, 1f)))
        assertEquals(Float3(0f, 0f, 2f), placed(player + Float3(0f, 1f, 0f)))
        assertEquals(Float3(0f, 0f, -2f), placed(player + Float3(0f, -1f, 0f)))
        assertEquals(Float3(2f, 0f, 0f), placed(player + Float3(1f, 0f, 0f)))
        assertEquals(Float3(-2f, 0f, 0f), placed(player + Float3(-1f, 0f, 0f)))
    }
    @Test fun clipsEveryBoundaryIncludingNearAndFarPlanes() {
        for (axis in 0..2) for (sign in listOf(-1f, 1f)) {
            fun point(a: Float, b: Float, c: Float): ClipVertex = when (axis) {
                0 -> vertex(a, b, c)
                1 -> vertex(b, a, c)
                else -> vertex(b, c, a)
            }
            val polygon = clipTriangleToBox(listOf(point(2f * sign, 0f, 0f), point(0f, 0.8f, 0f), point(0f, 0f, 0.8f)), bounds)
            assertTrue("Triangle should survive plane $axis / $sign", polygon.size >= 3)
            polygon.forEach { clipped ->
                for (component in 0..2) assertTrue(abs(clipped.position.component(component)) <= 1.000001f)
            }
            assertTrue(polygon.any { abs(it.position.component(axis) - sign) < 0.000001f })
        }
    }

    @Test fun rejectsTrianglesEntirelyOutsideTheWindow() {
        assertTrue(clipTriangleToBox(listOf(vertex(2f, 0f, 0f), vertex(3f, 0f, 0f), vertex(2f, 1f, 0f)), bounds).isEmpty())
    }

    @Test fun interpolatesTextureAndColorAtCutEdges() {
        val polygon = clipTriangleToBox(listOf(vertex(-2f, 0f, 0f, 0f), vertex(0f, 0f, 0f, 1f), vertex(0f, 1f, 0f, 1f)), bounds)
        val intersections = polygon.filter { abs(it.position.x + 1f) < 0.000001f }
        assertEquals(2, intersections.size)
        intersections.forEach {
            assertEquals(0.5f, it.u, 0.000001f)
            assertEquals(0.5f, it.color[0], 0.000001f)
        }
    }

    @Test fun readsThreeColumnMajorMatricesAndPreservesNormalUnderNonuniformScale() {
        val matrix = floatArrayOf(2f, 0f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 0f, 0.5f, 0f, 4f, 5f, 6f, 1f)
        assertEquals(Float3(6f, 7f, 7.5f), transformPoint(matrix, Float3(1f, 2f, 3f)))
        val expected = Float3(0.5f, 1f, 2f).normalized()
        val actual = transformNormal(matrix, Float3(1f, 1f, 1f).normalized())
        assertEquals(expected.x, actual.x, 0.000001f)
        assertEquals(expected.y, actual.y, 0.000001f)
        assertEquals(expected.z, actual.z, 0.000001f)
        assertTrue(matrixDeterminant(matrix) > 0f)
        matrix[0] = -2f
        assertTrue(matrixDeterminant(matrix) < 0f)
    }

    @Test fun quaternionWireOrderAndInverseRecoverWorldCoordinates() {
        val halfAngle = sqrt(0.5f)
        val quaternion = floatArrayOf(0f, 0f, halfAngle, halfAngle)
        val rotated = rotateVector(quaternion, Float3(1f, 0f, 0f))
        assertEquals(0f, rotated.x, 0.000001f)
        assertEquals(1f, rotated.y, 0.000001f)
        val restored = inverseRotateVector(quaternion, rotated)
        assertEquals(1f, restored.x, 0.000001f)
        assertEquals(0f, restored.y, 0.000001f)
    }
}
