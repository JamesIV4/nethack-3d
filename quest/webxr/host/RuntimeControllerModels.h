#pragma once

#include <openxr/openxr.h>
#include <array>
#include <chrono>
#include <future>
#include <functional>
#include <string>
#include <vector>

namespace crow {
// Owns no GL resources. Runtime model IO runs outside the frame thread. The
// owner must destroy this before xrDestroySession; destruction joins pending IO.
class RuntimeControllerModels {
public:
  struct Model {
    XrRenderModelKeyFB key = XR_NULL_RENDER_MODEL_KEY_FB;
    uint32_t version = 0;
    std::string status = "pending";
    std::vector<uint8_t> bytes;
    bool unchanged = false;
  };
  using Models = std::array<Model, 2>; // Explicit left, right; not device indices.
  using Publish = std::function<void(int, const Model&)>;
  struct Api {
    PFN_xrEnumerateRenderModelPathsFB enumerate;
    PFN_xrGetRenderModelPropertiesFB properties;
    PFN_xrLoadRenderModelFB load;
    PFN_xrPathToString pathToString;
  };
  RuntimeControllerModels(XrInstance instance, XrSession session, Api api, Publish publish)
      : instance_(instance), session_(session), api_(api), publish_(std::move(publish)) {}
  ~RuntimeControllerModels() {
    if (job_.valid()) job_.wait();
    Model ended; ended.status = "session-ended";
    for (int hand = 0; hand < 2; ++hand) publish_(hand, ended);
  }
  void Poll() {
    if (job_.valid()) {
      if (job_.wait_for(std::chrono::seconds(0)) != std::future_status::ready) return;
      Models result;
      try { result = job_.get(); }
      catch (...) { for (auto& model : result) model.status = "load-error"; }
      for (int hand = 0; hand < 2; ++hand) {
        const auto& next = result[hand];
        if (!next.unchanged && (next.status == "ready" || next.status != known_[hand].status)) publish_(hand, next);
        known_[hand].key = next.key; known_[hand].version = next.version; known_[hand].status = next.status;
      }
    }
    const auto now = std::chrono::steady_clock::now();
    if (now < nextPoll_) return;
    nextPoll_ = now + std::chrono::seconds(2);
    const auto known = known_;
    // Capture handles by value. This object's destructor keeps them alive until
    // completion and never invokes Java from this worker thread.
    const auto instance = instance_; const auto session = session_; const auto api = api_;
    job_ = std::async(std::launch::async, [instance, session, api, known] { return Load(instance, session, api, known); });
  }
  static Models Load(XrInstance instance, XrSession session, Api api, const Models& known) {
    Models result;
    for (auto& model : result) model.status = "unavailable";
    if (!api.enumerate || !api.properties || !api.load || !api.pathToString) {
      for (auto& model : result) model.status = "unsupported";
      return result;
    }
    uint32_t count = 0;
    if (XR_FAILED(api.enumerate(session, 0, &count, nullptr)) || count > 64) return result;
    std::vector<XrRenderModelPathInfoFB> paths(count, {XR_TYPE_RENDER_MODEL_PATH_INFO_FB});
    if (count && XR_FAILED(api.enumerate(session, count, &count, paths.data()))) return result;
    for (const auto& path : paths) {
      char name[XR_MAX_PATH_LENGTH] = {}; uint32_t length = 0;
      if (XR_FAILED(api.pathToString(instance, path.path, sizeof(name), &length, name))) continue;
      const std::string modelPath(name);
      const int hand = modelPath == "/model_fb/controller/left" ? 0 : modelPath == "/model_fb/controller/right" ? 1 : -1;
      if (hand < 0) continue;
      XrRenderModelCapabilitiesRequestFB capabilities{XR_TYPE_RENDER_MODEL_CAPABILITIES_REQUEST_FB};
      capabilities.flags = XR_RENDER_MODEL_SUPPORTS_GLTF_2_0_SUBSET_1_BIT_FB | XR_RENDER_MODEL_SUPPORTS_GLTF_2_0_SUBSET_2_BIT_FB;
      XrRenderModelPropertiesFB properties{XR_TYPE_RENDER_MODEL_PROPERTIES_FB}; properties.next = &capabilities;
      if (XR_FAILED(api.properties(session, path.path, &properties)) || properties.modelKey == XR_NULL_RENDER_MODEL_KEY_FB) continue;
      auto& model = result[hand]; model.key = properties.modelKey; model.version = properties.modelVersion;
      if (known[hand].status == "ready" && model.key == known[hand].key && model.version == known[hand].version) {
        model.status = "ready"; model.unchanged = true; continue;
      }
      XrRenderModelLoadInfoFB info{XR_TYPE_RENDER_MODEL_LOAD_INFO_FB}; info.modelKey = model.key;
      XrRenderModelBufferFB buffer{XR_TYPE_RENDER_MODEL_BUFFER_FB};
      if (api.load(session, &info, &buffer) != XR_SUCCESS || buffer.bufferCountOutput < 12 || buffer.bufferCountOutput > 16 * 1024 * 1024) continue;
      model.bytes.resize(buffer.bufferCountOutput); buffer.bufferCapacityInput = static_cast<uint32_t>(model.bytes.size()); buffer.buffer = model.bytes.data();
      if (api.load(session, &info, &buffer) != XR_SUCCESS || buffer.bufferCountOutput > model.bytes.size()) { model.bytes.clear(); continue; }
      model.bytes.resize(buffer.bufferCountOutput);
      if (model.bytes.size() < 12 || model.bytes[0] != 'g' || model.bytes[1] != 'l' || model.bytes[2] != 'T' || model.bytes[3] != 'F') {
        model.bytes.clear(); model.status = "invalid-glb"; continue;
      }
      model.status = "ready";
    }
    return result;
  }
private:
  XrInstance instance_; XrSession session_; Api api_; Publish publish_;
  Models known_;
  std::future<Models> job_;
  std::chrono::steady_clock::time_point nextPoll_{};
};
}
