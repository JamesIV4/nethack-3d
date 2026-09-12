package com.nethack3d.quest

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView
import com.meta.spatial.core.Entity
import com.meta.spatial.core.Pose
import com.meta.spatial.core.SpatialFeature
import com.meta.spatial.core.Vector3
import com.meta.spatial.runtime.PanelShapeLayerBlendType
import com.meta.spatial.runtime.ReferenceSpace
import com.meta.spatial.runtime.SessionState
import com.meta.spatial.toolkit.AppSystemActivity
import com.meta.spatial.toolkit.DpDisplayOptions
import com.meta.spatial.toolkit.LayoutXMLPanelRegistration
import com.meta.spatial.toolkit.Panel
import com.meta.spatial.toolkit.PanelRegistration
import com.meta.spatial.toolkit.PanelRenderMode
import com.meta.spatial.toolkit.PanelStyleOptions
import com.meta.spatial.toolkit.QuadShapeOptions
import com.meta.spatial.toolkit.Transform
import com.meta.spatial.toolkit.UIPanelRenderOptions
import com.meta.spatial.toolkit.UIPanelSettings
import com.meta.spatial.vr.LocomotionSystem
import com.meta.spatial.vr.VRFeature
import com.nethack3d.quest.stereo.QuestStereoScene
import org.json.JSONObject

/** Shared HTML UI and runtime with native stereo windowed/MR and immersive views. */
class QuestUiProofActivity : AppSystemActivity() {
    private var webView: WebView? = null
    private var panelEntity: Entity? = null
    private var stereo: QuestStereoScene? = null
    private var webBridge: QuestWebBridge? = null
    private var panelRoot: View? = null
    private var presentationMode = "windowed"
    private var stereoError: String? = null
    private var activityResumed = false
    private var sessionFocused = false
    private val bundledContent by lazy { BundledGameContent(applicationContext) }

    override fun registerFeatures(): List<SpatialFeature> = listOf(VRFeature(this))

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        presentationMode = getPreferences(MODE_PRIVATE).getString("presentationMode", "windowed")
            ?.takeIf { it == "flat" || it == "windowed" || it == "immersive" } ?: "windowed"
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        Log.i(TAG, "WebView provider: ${WebView.getCurrentWebViewPackage()}")
    }

    override fun registerPanels(): List<PanelRegistration> = listOf(
        LayoutXMLPanelRegistration(
            R.id.game_panel,
            layoutIdCreator = { R.layout.game_panel },
            settingsCreator = {
                UIPanelSettings(
                    shape = QuadShapeOptions(width = 1.6f, height = 1.0f),
                    display = DpDisplayOptions(width = 1600f, height = 1000f, dpi = 160),
                    rendering = UIPanelRenderOptions(
                        renderMode = PanelRenderMode.Layer(layerBlendType = PanelShapeLayerBlendType.ALPHA_BLEND),
                    ),
                    style = PanelStyleOptions(themeResourceId = R.style.QuestPanelTheme),
                )
            },
            panelSetupWithRootView = { root, _, _ -> configurePanel(root) },
        ),
    )

    override fun onSceneReady() {
        super.onSceneReady()
        scene.setReferenceSpace(ReferenceSpace.LOCAL_FLOOR)
        scene.setViewOrigin(0f, 0f, 0f, 0f)
        systemManager.findSystem<LocomotionSystem>().enableLocomotion(false)
        stereo?.dispose()
        stereo = QuestStereoScene(applicationContext, scene, onError = { message -> webBridge?.rendererFailed(message) }) { x, y ->
            runOnUiThread { webBridge?.sendCommand(JSONObject().put("type", "tile").put("x", x).put("y", y)) }
        }.also { it.setMode(presentationMode); it.setActive(activityResumed && sessionFocused) }
        if (panelEntity == null) {
            // Spatial SDK is left handed: +Z is in front of the default view origin.
            panelEntity = Entity.create(
                Panel(R.id.game_panel),
                Transform(Pose(Vector3(0f, 1.4f, 2f))),
            )
        }
        recenterPresentation()
        updateModeControls()
        Log.i(TAG, "Stereo $presentationMode with floating alpha UI panel")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configurePanel(root: View) {
        disposeWebView()
        val status = root.findViewById<TextView>(R.id.page_status)
        val view = root.findViewById<WebView>(R.id.game_webview)
        val content = bundledContent
        webView = view
        panelRoot = root
        webBridge = QuestWebBridge(
            view,
            mode = { presentationMode },
            acceptScene = { frame ->
                checkNotNull(stereo) { "Stereo scene is not ready." }.acceptFrame(frame)
                stereo?.setActive(activityResumed && sessionFocused)
                if (BuildConfig.DEBUG && frame.optBoolean("reset")) Log.i(TAG, "Stereo snapshot: mode=$presentationMode objects=${stereo?.objectCount} textures=${stereo?.textureCount} materials=${stereo?.materialCount}")
                if (stereoError != null) { stereoError = null; updateModeControls() }
            },
            clearScene = { stereo?.clear() },
            status = { message ->
                if (message.startsWith("Stereo view unavailable:")) stereoError = message
                status.text = message
                Log.i(TAG, message)
            },
            availabilityChanged = { updateModeControls() },
        )
        view.setBackgroundColor(Color.TRANSPARENT)
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = true
            mediaPlaybackRequiresUserGesture = true
            allowFileAccess = false
            allowContentAccess = false
            blockNetworkLoads = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(true)
            setSupportZoom(false)
        }
        // Service-worker fetches have a separate interception callback. Dedicated workers
        // use the WebView's resource loader; both must resolve from the same APK origin.
        ServiceWorkerController.getInstance().apply {
            serviceWorkerWebSettings.apply {
                allowFileAccess = false
                allowContentAccess = false
                blockNetworkLoads = true
            }
            setServiceWorkerClient(object : ServiceWorkerClient() {
                override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse =
                    content.intercept(request)
            })
        }
        view.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                webBridge?.resetForNavigation()
            }

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
                bundledContent.intercept(request)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val blocked = !bundledContent.isLocal(request.url)
                if (blocked) {
                    status.text = "External navigation blocked: ${request.url.scheme}"
                    Log.w(TAG, "Blocked navigation: ${request.url}")
                }
                return blocked
            }

            override fun onPageFinished(view: WebView, url: String) {
                status.text = if (url.startsWith(BundledGameContent.PROBE_URL)) {
                    "UI probe"
                } else {
                    when (presentationMode) { "flat" -> "Flat | Original Three.js view"; "windowed" -> "Windowed | Mixed reality"; else -> "Immersive VR" }
                }
                Log.i(TAG, "Page loaded: $url")
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                Log.e(TAG, "WebView error ${error.errorCode}: ${request.url}: ${error.description}")
                if (request.isForMainFrame) status.text = "Load failed: ${error.description}"
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                Log.e(TAG, "Asset HTTP ${response.statusCode}: ${request.url}")
                if (request.isForMainFrame) status.text = "Bundled page missing (${response.statusCode})"
            }
        }
        view.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                Log.println(
                    if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.ERROR else Log.INFO,
                    TAG,
                    "JS ${message.sourceId()}:${message.lineNumber()}: ${message.message()}",
                )
                return true
            }

            override fun onPermissionRequest(request: PermissionRequest) = request.deny()
            // Default onCreateWindow=false intentionally rejects target=_blank/popups.
        }
        view.setDownloadListener { _, _, _, _, _ -> status.text = "Downloads are outside this UI proof." }
        val confirmation = root.findViewById<View>(R.id.navigation_confirmation)
        var pendingUrl: String? = null
        fun requestNavigation(url: String) {
            pendingUrl = url
            confirmation.visibility = View.VISIBLE
        }
        root.findViewById<Button>(R.id.confirm_navigation).setOnClickListener {
            val url = pendingUrl
            pendingUrl = null
            confirmation.visibility = View.GONE
            if (url != null && webView === view) view.loadUrl(url)
        }
        root.findViewById<Button>(R.id.cancel_navigation).setOnClickListener {
            pendingUrl = null
            confirmation.visibility = View.GONE
        }
        root.findViewById<Button>(R.id.open_probe).setOnClickListener {
            requestNavigation(BundledGameContent.PROBE_URL)
        }
        root.findViewById<Button>(R.id.open_game).setOnClickListener {
            requestNavigation(BundledGameContent.GAME_URL)
        }
        root.findViewById<Button>(R.id.reload_page).setOnClickListener {
            requestNavigation(view.url ?: BundledGameContent.PROBE_URL)
        }
        root.findViewById<Button>(R.id.mode_flat).setOnClickListener { setPresentationMode("flat") }
        root.findViewById<Button>(R.id.mode_windowed).setOnClickListener { setPresentationMode("windowed") }
        root.findViewById<Button>(R.id.mode_immersive).setOnClickListener { setPresentationMode("immersive") }
        root.findViewById<Button>(R.id.recenter_view).setOnClickListener { recenterPresentation() }
        val directions = listOf(
            Triple(R.id.move_nw, -1, -1), Triple(R.id.move_n, 0, -1), Triple(R.id.move_ne, 1, -1),
            Triple(R.id.move_w, -1, 0), Triple(R.id.move_e, 1, 0),
            Triple(R.id.move_sw, -1, 1), Triple(R.id.move_s, 0, 1), Triple(R.id.move_se, 1, 1),
        )
        directions.forEach { (id, dx, dy) ->
            root.findViewById<Button>(id).setOnClickListener {
                webBridge?.sendCommand(JSONObject().put("type", "move").put("dx", dx).put("dy", dy))
            }
        }
        root.findViewById<Button>(R.id.game_inventory).setOnClickListener {
            webBridge?.sendCommand(JSONObject().put("type", "inventory"))
        }
        root.findViewById<Button>(R.id.game_escape).setOnClickListener {
            webBridge?.sendCommand(JSONObject().put("type", "key").put("key", "Escape"))
        }
        root.findViewById<Button>(R.id.game_confirm).setOnClickListener {
            webBridge?.sendCommand(JSONObject().put("type", "key").put("key", "Enter"))
        }
        root.findViewById<Button>(R.id.game_wait).setOnClickListener {
            webBridge?.sendCommand(JSONObject().put("type", "wait"))
        }
        view.loadUrl(BundledGameContent.GAME_URL)
        applyWebViewLifecycle()
    }

    override fun onResume() {
        super.onResume()
        activityResumed = true
        applyWebViewLifecycle()
    }

    override fun onPause() {
        activityResumed = false
        applyWebViewLifecycle()
        super.onPause()
    }

    override fun onSessionStateChanged(state: SessionState) {
        super.onSessionStateChanged(state)
        sessionFocused = state == SessionState.FOCUSED
        // Opening Quest's universal menu changes XR focus without necessarily pausing Activity.
        runOnUiThread { applyWebViewLifecycle() }
    }

    private fun setPresentationMode(mode: String) {
        if (mode == presentationMode) return
        presentationMode = mode
        stereoError = null
        getPreferences(MODE_PRIVATE).edit().putString("presentationMode", mode).apply()
        try { stereo?.setMode(mode) }
        catch (error: Exception) { webBridge?.rendererFailed(error.message ?: "Could not change view mode.") }
        recenterPresentation()
        if (mode == "flat") webBridge?.useFlatPresentation() else webBridge?.sendState()
        updateModeControls()
        Log.i(TAG, "Presentation changed: $mode; objects=${stereo?.objectCount}; textures=${stereo?.textureCount}")
    }

    private fun recenterPresentation() {
        try {
            stereo?.recenter()
            stereo?.panelPose(1.8f)?.let { panelEntity?.setComponent(Transform(it)) }
        } catch (error: Exception) {
            webBridge?.rendererFailed(error.message ?: "Could not recenter the view.")
        }
    }

    private fun updateModeControls() {
        panelRoot?.let { root ->
            root.findViewById<Button>(R.id.mode_flat).isSelected = presentationMode == "flat"
            root.findViewById<Button>(R.id.mode_flat).alpha = if (presentationMode == "flat") 1f else 0.65f
            root.findViewById<Button>(R.id.mode_windowed).isSelected = presentationMode == "windowed"
            root.findViewById<Button>(R.id.mode_immersive).isSelected = presentationMode == "immersive"
            root.findViewById<Button>(R.id.mode_windowed).alpha = if (presentationMode == "windowed") 1f else 0.65f
            root.findViewById<Button>(R.id.mode_immersive).alpha = if (presentationMode == "immersive") 1f else 0.65f
            val enabled = webBridge?.canSendCommands == true && activityResumed && sessionFocused
            listOf(R.id.move_nw, R.id.move_n, R.id.move_ne, R.id.move_w, R.id.move_e,
                R.id.move_sw, R.id.move_s, R.id.move_se, R.id.game_inventory, R.id.game_escape,
                R.id.game_confirm, R.id.game_wait).forEach { root.findViewById<Button>(it).isEnabled = enabled }
            root.findViewById<TextView>(R.id.page_status).text = stereoError ?: when (presentationMode) { "flat" -> "Flat | Original Three.js view"; "windowed" -> "Windowed | Mixed reality"; else -> "Immersive VR" }
        }
    }

    private fun applyWebViewLifecycle() {
        stereo?.setActive(activityResumed && sessionFocused)
        updateModeControls()
        webView?.let { view ->
            if (activityResumed && sessionFocused) {
                view.onResume()
                view.resumeTimers()
            } else {
                view.onPause()
                view.pauseTimers()
            }
        }
    }

    private fun disposeWebView() {
        webBridge?.dispose()
        webBridge = null
        panelRoot = null
        stereo?.clear()
        webView?.let { view ->
            view.stopLoading()
            view.onPause()
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
        }
        webView = null
    }

    override fun onSpatialShutdown() {
        disposeWebView()
        stereo?.dispose()
        stereo = null
        panelEntity = null
        super.onSpatialShutdown()
    }

    override fun onDestroy() {
        disposeWebView()
        stereo?.dispose()
        stereo = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "QuestUiProof"
    }
}
