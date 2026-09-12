package com.nethack3d.quest

import android.net.Uri
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.nio.charset.StandardCharsets

/** Origin-scoped, bounded transport between the existing game and its stereo renderer. */
internal class QuestWebBridge(
    private val view: WebView,
    private val mode: () -> String,
    private val acceptScene: (JSONObject) -> Unit,
    private val clearScene: () -> Unit,
    private val status: (String) -> Unit,
    private val availabilityChanged: () -> Unit,
) {
    private var reply: JavaScriptReplyProxy? = null
    private var installed = false
    private var disposed = false
    private var pageReady = false
    private var sceneReady = false
    private var sceneSession: String? = null
    private var commandSequence = 0L
    private var transfer: Transfer? = null
    val canSendCommands: Boolean get() = pageReady && !disposed && reply != null

    private class Transfer(val session: String, val sequence: Long, val count: Int) {
        var index = 0
        var bytes = 0
        val data = StringBuilder()
    }

    init {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(view, "nh3dQuest", setOf(BundledGameContent.ORIGIN)) {
                    _, message, origin, isMainFrame, proxy ->
                if (!disposed && isMainFrame && isTrustedOrigin(origin)) {
                    reply = proxy
                    val data = message.data
                    if (data != null) receive(data)
                }
            }
            installed = true
        } else {
            status("This WebView cannot connect the stereo view. The game panel is still available.")
        }
    }

    fun resetForNavigation() {
        transfer = null
        pageReady = false
        sceneReady = false
        sceneSession = null
        reply = null
        clearScene()
        availabilityChanged()
    }

    fun sendState() {
        send(JSONObject().put("type", "state").put("mode", mode()).put("ready", sceneReady))
    }

    fun sendCommand(command: JSONObject) {
        if (!canSendCommands) return
        send(JSONObject().put("type", "command").put("id", "native-${++commandSequence}").put("command", command))
    }

    fun useFlatPresentation() {
        transfer = null
        sceneSession = null
        sceneReady = false
        clearScene()
        send(JSONObject().put("type", "reset"))
        sendState()
    }

    fun rendererFailed(message: String) {
        transfer = null
        sceneSession = null
        sceneReady = false
        clearScene()
        send(JSONObject().put("type", "reset"))
        sendState()
        status("Stereo view unavailable: $message")
    }

    fun dispose() {
        if (disposed) return
        disposed = true
        transfer = null
        reply = null
        if (installed) WebViewCompat.removeWebMessageListener(view, "nh3dQuest")
    }

    private fun receive(serialized: String) {
        var message: JSONObject? = null
        try {
            require(serialized.toByteArray(StandardCharsets.UTF_8).size <= MAX_CHUNK_BYTES) { "Scene message is too large." }
            message = JSONObject(serialized)
            require(message.optInt("version") == 1) { "Unsupported scene protocol." }
            when (message.optString("type")) {
                "ready" -> {
                    require(message.optString("page") == "game") { "Unsupported game page." }
                    pageReady = true
                    sendState()
                    availabilityChanged()
                }
                "scene-chunk" -> receiveChunk(message)
                "scene-clear" -> {
                    val session = message.getString("session")
                    if (transfer?.session == session) transfer = null
                    if (sceneSession == null || sceneSession == session) {
                        sceneReady = false
                        sceneSession = null
                        clearScene()
                        sendState()
                    }
                }
                "command-result" -> {
                    if (!message.optBoolean("accepted", true)) {
                        val reason = message.optString("reason").take(160)
                        if (reason.isNotBlank()) status(reason)
                    }
                }
                else -> error("Unsupported scene message.")
            }
        } catch (error: Exception) {
            transfer = null
            sceneReady = false
            sceneSession = null
            clearScene()
            val response = JSONObject().put("type", "scene-error")
                .put("session", message?.optString("session") ?: "")
                .put("sequence", message?.optLong("sequence", -1) ?: -1)
                .put("error", error.message ?: "Could not display the stereo scene.")
            send(response)
            sendState()
            status("Stereo view unavailable: ${error.message ?: "invalid scene"}")
        }
    }

    private fun receiveChunk(message: JSONObject) {
        require(pageReady) { "Game has not connected yet." }
        val session = message.getString("session")
        require(session.isNotBlank() && session.length <= 128) { "Invalid scene session." }
        val sequence = exactInteger(message, "sequence", 0, 9_007_199_254_740_991)
        val index = exactInteger(message, "index", 0, 511).toInt()
        val count = exactInteger(message, "count", 1, 512).toInt()
        require(index < count) { "Invalid chunk index." }
        // Drain an already-posted chunk after switching back to the original
        // view, without retaining or rebuilding native scene resources.
        if (mode() == "flat") {
            send(JSONObject().put("type", "scene-ack").put("session", session).put("sequence", sequence).put("index", index))
            return
        }
        val data = message.getString("data")
        if (index == 0) {
            require(transfer == null) { "Previous scene transfer has not finished." }
            transfer = Transfer(session, sequence, count)
        }
        val pending = checkNotNull(transfer) { "Scene transfer did not start at chunk zero." }
        require(pending.session == session && pending.sequence == sequence && pending.count == count && pending.index == index) {
            "Scene chunks arrived out of order."
        }
        pending.bytes += data.toByteArray(StandardCharsets.UTF_8).size
        require(pending.bytes <= MAX_FRAME_BYTES) { "Scene exceeds the resource budget." }
        pending.data.append(data)
        pending.index += 1
        if (pending.index == count) {
            val frame = JSONObject(pending.data.toString())
            require(frame.optString("session") == session && frame.optLong("sequence", -1) == sequence) { "Scene envelope mismatch." }
            acceptScene(frame)
            transfer = null
            val firstScene = !sceneReady
            sceneReady = true
            sceneSession = session
            if (firstScene) sendState()
        }
        send(JSONObject().put("type", "scene-ack").put("session", session).put("sequence", sequence).put("index", index))
    }

    private fun exactInteger(value: JSONObject, key: String, min: Long, max: Long): Long {
        val number = value.getDouble(key)
        val integer = number.toLong()
        require(number.isFinite() && number == integer.toDouble() && integer in min..max) { "Invalid $key." }
        return integer
    }

    private fun send(message: JSONObject) {
        if (!disposed) {
            try { reply?.postMessage(message.put("version", 1).toString()) }
            catch (_: IllegalStateException) { reply = null; pageReady = false; availabilityChanged() }
        }
    }

    private fun isTrustedOrigin(origin: Uri): Boolean = origin.scheme == "https" &&
        origin.host == BundledGameContent.HOST && (origin.port == -1 || origin.port == 443)

    companion object {
        private const val MAX_CHUNK_BYTES = 128 * 1024
        private const val MAX_FRAME_BYTES = 32 * 1024 * 1024
    }
}
