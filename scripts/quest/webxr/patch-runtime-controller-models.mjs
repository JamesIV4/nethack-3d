import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchRuntimeControllerModels(checkout) {
  const edit = (file, marker, apply) => {
    const name = path.join(checkout, file), source = readFileSync(name, "utf8").replaceAll("\r\n", "\n");
    if (!source.includes(marker)) writeFileSync(name, apply(source));
  };
  copyFileSync(fileURLToPath(new URL("../../../quest/webxr/host/RuntimeControllerModels.h", import.meta.url)), path.join(checkout, "app/src/openxr/cpp/RuntimeControllerModels.h"));
  edit("app/src/openxr/cpp/OpenXRInput.h", "mGameControllerModels", source => {
    source = replaceOnce(source, "class OpenXRInputSource;", "class RuntimeControllerModels;\nclass OpenXRInputSource;", "controller provider declaration");
    return replaceOnce(source, "  XrInstance mInstance", "  std::unique_ptr<RuntimeControllerModels> mGameControllerModels;\n  XrInstance mInstance", "controller provider owner");
  });
  edit("app/src/openxr/cpp/OpenXRInput.cpp", "NH3D runtime controller IO", source => {
    source = replaceOnce(source, '#include "OpenXRInput.h"', '#include "OpenXRInput.h"\n#include "RuntimeControllerModels.h"\n#include "VRBrowser.h"', "controller provider includes");
    source = replaceOnce(source, "  XrActiveActionSet activeActionSet {", `  // NH3D runtime controller IO: frame thread publishes completed loads only.
  if (!mGameControllerModels) {
    RuntimeControllerModels::Api api{OpenXRExtensions::sXrEnumerateRenderModelPathsFB,
      OpenXRExtensions::sXrGetRenderModelPropertiesFB, OpenXRExtensions::sXrLoadRenderModelFB, xrPathToString};
    mGameControllerModels = std::make_unique<RuntimeControllerModels>(mInstance, mSession, api,
      [](int hand, const RuntimeControllerModels::Model& model) {
        const std::string tag = model.status + ":" + std::to_string(model.key) + ":" + std::to_string(model.version);
        VRBrowser::PublishGameControllerModel(hand, model.bytes, tag);
      });
  }
  mGameControllerModels->Poll();
  XrActiveActionSet activeActionSet {`, "controller provider polling");
    return replaceOnce(source, "OpenXRInput::~OpenXRInput() {", "OpenXRInput::~OpenXRInput() {\n  mGameControllerModels.reset(); // Join IO before the session is destroyed.", "controller provider lifetime");
  });
  edit("app/src/main/cpp/VRBrowser.h", "PublishGameControllerModel", source => replaceOnce(source,
    "JNIEnv * Env();", "JNIEnv * Env();\nvoid PublishGameControllerModel(int hand, const std::vector<uint8_t>& data, const std::string& tag);", "controller JNI declaration"));
  edit("app/src/main/cpp/VRBrowser.cpp", "PublishGameControllerModel", source => {
    source = replaceOnce(source, "jmethodID sGetPointerColor = nullptr;", "jmethodID sGetPointerColor = nullptr;\njmethodID sPublishGameControllerModel = nullptr;", "controller JNI method");
    source = replaceOnce(source, "  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);",
      '  sPublishGameControllerModel = FindJNIMethodID(sEnv, sBrowserClass, "publishGameControllerModel", "(I[BLjava/lang/String;)V");\n  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);', "controller JNI binding");
    return source + `
void crow::VRBrowser::PublishGameControllerModel(int hand, const std::vector<uint8_t>& data, const std::string& tag) {
  if (!sEnv || !sActivity || !sPublishGameControllerModel) return;
  jbyteArray bytes = data.empty() ? nullptr : sEnv->NewByteArray(static_cast<jsize>(data.size()));
  if (!data.empty() && !bytes) return;
  if (bytes) sEnv->SetByteArrayRegion(bytes, 0, static_cast<jsize>(data.size()), reinterpret_cast<const jbyte*>(data.data()));
  jstring state = sEnv->NewStringUTF(tag.c_str());
  if (state) sEnv->CallVoidMethod(sActivity, sPublishGameControllerModel, hand, bytes, state);
  if (state) sEnv->DeleteLocalRef(state);
  if (bytes) sEnv->DeleteLocalRef(bytes);
}
`;
  });
  edit("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java", "publishGameControllerModel", source => replaceOnce(source,
    "    final Object mCompositorLock = new Object();", `    @Keep
    public void publishGameControllerModel(int hand, byte[] bytes, String tag) {
        if (BuildConfig.NH3D_GAME_HOST) BundledGameServer.setControllerModel(hand, bytes, tag);
    }

    final Object mCompositorLock = new Object();`, "controller model publication"));
  // The Three.js controller pass replaces OBJ models during immersive game
  // sessions. Flat native browser/keyboard handling and pointers are retained.
  edit("app/src/main/cpp/BrowserWorld.cpp", "NH3D WebXR owns articulated controller visuals", source => replaceOnce(source,
    "      controller.modelToggle->ToggleAll(controller.mode == ControllerMode::Device);",
    "      controller.modelToggle->ToggleAll(controller.mode == ControllerMode::Device && !externalVR->IsPresenting()); // NH3D WebXR owns articulated controller visuals", "native controller ownership"));
}
