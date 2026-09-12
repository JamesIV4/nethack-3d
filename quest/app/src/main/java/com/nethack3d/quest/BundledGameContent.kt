package com.nethack3d.quest

import android.content.Context
import android.net.Uri
import android.util.Log
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.IOException

/** A real HTTPS origin backed exclusively by this APK's assets, including worker requests. */
internal class BundledGameContent(context: Context) {
    private val assets = context.applicationContext.assets
    private val loader = WebViewAssetLoader.Builder()
        .addPathHandler("/", WebViewAssetLoader.PathHandler(::openAsset))
        .build()

    fun isLocal(url: Uri): Boolean =
        url.scheme == "https" && url.host == HOST &&
            (url.port == -1 || url.port == 443) && url.userInfo == null

    fun intercept(request: WebResourceRequest): WebResourceResponse {
        if (!isLocal(request.url)) {
            Log.w(TAG, "Blocked non-bundled request: ${request.url}")
            return errorResponse(403, "Forbidden", "This Quest proof loads bundled content only.")
        }
        if (request.method != "GET") {
            return errorResponse(405, "Method Not Allowed", "Bundled assets support GET only.")
        }
        // A non-null error is essential: AssetLoader's null fallback would try the network.
        return loader.shouldInterceptRequest(request.url)
            ?: errorResponse(404, "Not Found", "Bundled asset not found: ${request.url.path}")
    }

    private fun openAsset(path: String): WebResourceResponse {
        val relative = path.ifEmpty { "index.html" }
        if (relative.startsWith('/') || relative.contains('\\') || relative.contains('\u0000') ||
            relative.split('/').any { it == "." || it == ".." }
        ) {
            return errorResponse(400, "Bad Request", "Invalid bundled path.")
        }
        return try {
            val mime = mimeType(relative)
            WebResourceResponse(
                mime,
                if (mime.startsWith("text/") || mime == "application/json" ||
                    mime == "application/javascript" || mime == "image/svg+xml"
                ) "UTF-8" else null,
                200,
                "OK",
                mapOf("Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff"),
                assets.open("game/$relative"),
            )
        } catch (_: IOException) {
            Log.e(TAG, "Missing bundled asset: $relative")
            errorResponse(404, "Not Found", "Bundled asset not found: $relative")
        }
    }

    private fun mimeType(path: String): String = when (val extension = path.substringAfterLast('.', "").lowercase()) {
        "wasm" -> "application/wasm"
        "js", "mjs", "cjs" -> "application/javascript"
        "json", "map" -> "application/json"
        "html" -> "text/html"
        "css" -> "text/css"
        "svg" -> "image/svg+xml"
        "woff" -> "font/woff"
        "woff2" -> "font/woff2"
        "data", "bank", "bin" -> "application/octet-stream"
        else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
    }

    private fun errorResponse(status: Int, reason: String, message: String): WebResourceResponse =
        WebResourceResponse(
            "text/plain", "UTF-8", status, reason,
            mapOf("Cache-Control" to "no-store"),
            ByteArrayInputStream(message.toByteArray(Charsets.UTF_8)),
        )

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val ORIGIN = "https://$HOST"
        const val PROBE_URL = "$ORIGIN/quest-ui-probe.html"
        const val GAME_URL = "$ORIGIN/index.html"
        private const val TAG = "QuestAssets"
    }
}
