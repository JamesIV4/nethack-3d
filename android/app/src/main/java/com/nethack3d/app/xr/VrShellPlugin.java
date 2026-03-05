package com.nethack3d.app.xr;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VrShell")
public class VrShellPlugin extends Plugin {
    private static final String QUEST_BROWSER_PACKAGE = "com.oculus.browser";

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        String manufacturer = valueOrEmpty(Build.MANUFACTURER);
        String model = valueOrEmpty(Build.MODEL);
        String brand = valueOrEmpty(Build.BRAND);
        String normalizedDevice =
            (manufacturer + " " + brand + " " + model).toLowerCase();
        boolean isMetaQuest =
            normalizedDevice.contains("quest") ||
            normalizedDevice.contains("oculus") ||
            normalizedDevice.contains("meta");

        JSObject result = new JSObject();
        result.put("isNativePlatform", true);
        result.put("manufacturer", manufacturer);
        result.put("model", model);
        result.put("isMetaQuest", isMetaQuest);
        result.put("hasQuestBrowser", hasQuestBrowser());
        call.resolve(result);
    }

    @PluginMethod
    public void launchVrBrowser(PluginCall call) {
        String rawUrl = call.getString("url");
        String url = rawUrl == null ? "" : rawUrl.trim();
        if (url.isEmpty()) {
            call.reject("A VR launch URL is required.");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (hasQuestBrowser()) {
                intent.setPackage(QUEST_BROWSER_PACKAGE);
            }

            if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                JSObject result = new JSObject();
                result.put("launched", false);
                call.resolve(result);
                return;
            }

            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("launched", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Failed to launch VR browser.", error);
        }
    }

    private boolean hasQuestBrowser() {
        return getContext().getPackageManager().getLaunchIntentForPackage(
            QUEST_BROWSER_PACKAGE
        ) != null;
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }
}
