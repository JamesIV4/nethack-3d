#pragma once
#include "Quad.h"
#include "Widget.h"
#include "vrb/Group.h"
#include "vrb/Transform.h"
#include "vrb/TextureSurface.h"
#include "vrb/Color.h"
#include "vrb/RenderState.h"
#include <array>
#include <unordered_map>
#include <vector>

namespace crow {
class GameUiPanels {
  struct Pane {
    int id = -1;
    std::array<float, 4> crop{};
    QuadPtr quad;
    vrb::TextureSurfacePtr texture;
    int32_t textureWidth = 0, textureHeight = 0;
    vrb::Matrix pose;
    float width = 1, height = 1;
  };
  vrb::CreationContextPtr context;
  std::vector<Pane> panes;
  WidgetPtr window;
  int32_t textureWidth = 0, textureHeight = 0;
  std::unordered_map<int, int> selected;
  std::unordered_map<int, std::pair<float, float>> pixels;
 public:
  explicit GameUiPanels(vrb::CreationContextPtr value) : context(value) {}
  bool Owns(const WidgetPtr& widget) const { return window == widget && !panes.empty(); }
  void Update(const WidgetPtr& source, const std::vector<float>& state,
              const vrb::Matrix& board, const vrb::Matrix& center, const vrb::Vector& viewer) {
    if (state.size() < 24 || !source || !source->GetSurfaceTexture()) { panes.clear(); return; }
    window = source;
    source->GetSurfaceTextureSize(textureWidth, textureHeight);
    if (textureWidth <= 0 || textureHeight <= 0) { panes.clear(); return; }
    const size_t start = 24 + size_t(state[1]) * 4;
    const size_t count = size_t(state[13]);
    if (count > 7 || state.size() != start + count * 5) { panes.clear(); return; }
    const float scale = state[10] == 1 ? 1 : state[19];
    const float extent = state[18] * scale;
    panes.resize(count);
    for (size_t i = 0; i < count; ++i) {
      auto& p = panes[i]; const size_t at = start + i * 5;
      const std::array<float, 4> crop{state[at+1], state[at+2], state[at+3], state[at+4]};
      const float width = 3.0f * scale * (crop[2] - crop[0]);
      const float height = 3.0f * scale * float(textureHeight) / textureWidth * (crop[3] - crop[1]);
      if (!p.quad) p.quad = Quad::Create(context, width, height);
      if (p.crop != crop || p.width != width || p.height != height || p.texture != source->GetSurfaceTexture() || p.textureWidth != textureWidth || p.textureHeight != textureHeight) {
        p.quad->SetWorldSize(width, height);
        p.quad->SetScaleMode(Quad::ScaleMode::Fill);
        p.crop = crop; p.width = width; p.height = height;
        p.texture = source->GetSurfaceTexture(); p.textureWidth = textureWidth; p.textureHeight = textureHeight;
        p.quad->SetTexture(p.texture, textureWidth, textureHeight);
        // SetTexture only binds the surface; unlike Widget::UpdateSurface it
        // does not create a shader. Match the browser's textured-quad setup.
        p.quad->SetMaterial(vrb::Color(0.4f, 0.4f, 0.4f), vrb::Color(1, 1, 1), vrb::Color(0, 0, 0), 0);
        p.quad->GetRenderState()->SetTintColor(vrb::Color(1, 1, 1, 1));
        p.quad->UpdateProgram("");
        p.quad->SetTextureRect(device::EyeRect(crop[0], crop[1], crop[2]-crop[0], crop[3]-crop[1]));
      }
      p.id = int(state[at]);
      if (p.id == 4) p.pose = state[20] == 1 ? center.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, height / 2, 0))) : center;
      else {
        vrb::Vector offset(0, 0.012f * scale, 0);
        if (p.id == 0) offset.z() = -0.99f * extent;
        if (p.id == 3 || p.id == 6) offset.z() = 0.99f * extent + height / 2 + (p.id == 6 ? .3f * scale : 0);
        if (p.id == 1) offset.x() = -1.44f * extent - width / 2;
        if (p.id == 2 || p.id == 5) offset.x() = 1.44f * extent + width / 2;
        if (p.id == 5) offset.z() = -0.9f * extent - height / 2;
        p.pose = board.PostMultiply(vrb::Matrix::Translation(offset))
            .PostMultiply(vrb::Matrix::Rotation(vrb::Vector(1,0,0), -vrb::PI_FLOAT / 2));
        if (p.id == 2) {
          // Hang the action strip below the tilt ring's lower rim. Keep its
          // right/left extent outside the board, independent of its height.
          offset.y() = -0.025f * scale;
          offset.z() = 0;
          auto position = board.MultiplyPosition(offset);
          position.y() -= (0.225f + 0.08f) * scale + height / 2;
          p.pose = vrb::Matrix::Translation(position)
              .PostMultiply(vrb::Matrix::Rotation(vrb::Vector(0,1,0), state[17]));
        }
        if (p.id == 0) {
          // Fixed bottom edge at the table's far side; only pitch follows the viewer.
          const auto anchor = board.MultiplyPosition(offset);
          const auto yaw = vrb::Matrix::Rotation(vrb::Vector(0,1,0), state[17]);
          const auto toViewer = yaw.AfineInverse().MultiplyDirection(viewer - anchor);
          const float pitch = -std::atan2(toViewer.y(), std::fabs(toViewer.z()));
          p.pose = vrb::Matrix::Translation(anchor).PostMultiply(yaw)
              .PostMultiply(vrb::Matrix::Rotation(vrb::Vector(1,0,0), pitch))
              .PostMultiply(vrb::Matrix::Translation(vrb::Vector(0,height/2,0)));
        }
      }
      p.quad->GetTransformNode()->SetTransform(p.pose);
    }
  }
  bool Hit(int controller, bool captured, const vrb::Vector& origin, const vrb::Vector& direction,
           const std::vector<float>& state, vrb::Vector& point, vrb::Vector& normal, float& distance) {
    bool found = false;
    distance = 10000;
    for (const auto& p : panes) {
      if (captured && selected.count(controller) && selected[controller] != p.id) continue;
      const auto inverse = p.pose.AfineInverse();
      const auto o = inverse.MultiplyPosition(origin), d = inverse.MultiplyDirection(direction);
      if (std::fabs(d.z()) < 0.00001f) continue;
      const float t = -o.z() / d.z(); if (t < 0) continue;
      const auto local = o + d * t;
      const float u = local.x() / p.width + 0.5f, v = 0.5f - local.y() / p.height;
      if (!captured && (u < 0 || u > 1 || v < 0 || v > 1)) continue;
      const float x = p.crop[0] + u * (p.crop[2] - p.crop[0]);
      const float y = p.crop[1] + v * (p.crop[3] - p.crop[1]);
      bool interactive = captured;
      for (size_t i = 24; !interactive && i + 3 < 24 + size_t(state[1]) * 4; i += 4)
        interactive = x >= state[i] && y >= state[i+1] && x <= state[i+2] && y <= state[i+3];
      if (!interactive) continue;
      const auto hit = p.pose.MultiplyPosition(local);
      const float length = (hit - origin).Magnitude();
      if (length >= distance) continue;
      found = true; point = hit; distance = length;
      normal = p.pose.MultiplyDirection(vrb::Vector(0,0,1));
      selected[controller] = p.id; pixels[controller] = {x * textureWidth, y * textureHeight};
    }
    return found;
  }
  void Coordinates(int controller, float& x, float& y) const {
    auto it = pixels.find(controller); if (it != pixels.end()) { x = it->second.first; y = it->second.second; }
  }
  void Cull(vrb::CullVisitor& visitor, vrb::DrawableList& list) {
    for (const auto& p : panes) p.quad->GetRoot()->Cull(visitor, list);
  }
  WidgetPtr Source() const { return panes.empty() ? nullptr : window; }
};
}
