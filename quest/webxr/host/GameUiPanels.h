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
  struct Piece { QuadPtr quad; float x = 0, y = 0; };
  struct Pane {
    int id = -1;
    std::array<float, 4> crop{};
    QuadPtr quad;
    vrb::TextureSurfacePtr texture;
    int32_t textureWidth = 0, textureHeight = 0;
    vrb::Matrix pose;
    float width = 1, height = 1;
    bool masked = false;
    std::array<float, 10> maskKey{};
    std::vector<Piece> pieces;
    vrb::TextureSurfacePtr maskTexture;
  };
  vrb::CreationContextPtr context;
  std::vector<Pane> panes;
  WidgetPtr window;
  int32_t textureWidth = 0, textureHeight = 0;
  std::unordered_map<int, int> selected;
  std::unordered_map<int, std::pair<float, float>> pixels;
  bool hasModal = false;
  std::array<float, 4> modal{};
  bool firstPerson = false;
  vrb::Matrix actionHud;
  vrb::Vector actionViewer;
  float actionY = -0.85f, actionDepth = 0;
  int gripOwner = -1;
  vrb::Matrix gripInverse;
  vrb::Vector gripStart;
  float gripStartY = 0, gripStartDepth = 0;
 public:
  explicit GameUiPanels(vrb::CreationContextPtr value) : context(value) {}
  bool Owns(const WidgetPtr& widget) const { return window == widget && !panes.empty(); }
  void Update(const WidgetPtr& source, const std::vector<float>& state,
              const vrb::Matrix& board, const vrb::Matrix& center, const vrb::Vector& viewer, const vrb::Matrix& hud) {
    if (state.size() < 29 || !source || !source->GetSurfaceTexture()) { panes.clear(); return; }
    window = source;
    source->GetSurfaceTextureSize(textureWidth, textureHeight);
    if (textureWidth <= 0 || textureHeight <= 0) { panes.clear(); return; }
    const size_t start = 29 + size_t(state[1]) * 4;
    const size_t count = size_t(state[13]);
    if (count > 8 || state.size() != start + count * 5) { panes.clear(); return; }
    const float worldScale = state[10] == 1 ? 1 : state[19];
    const float extent = state[18] * worldScale;
    const float scale = 1; // UI dimensions are independent of game-world scale.
    firstPerson = state[10] == 1; actionHud = hud; actionViewer = viewer;
    if (!firstPerson) gripOwner = -1;
    hasModal = false;
    for (size_t i = start; i < state.size(); i += 5) if (int(state[i]) == 4) {
      hasModal = true; modal = {state[i+1], state[i+2], state[i+3], state[i+4]};
    }
    panes.resize(count);
    for (size_t i = 0; i < count; ++i) {
      auto& p = panes[i]; const size_t at = start + i * 5;
      const std::array<float, 4> crop{state[at+1], state[at+2], state[at+3], state[at+4]};
      const float paneScale = scale;
      const float width = 3.0f * paneScale * (crop[2] - crop[0]);
      const float height = 3.0f * paneScale * float(textureHeight) / textureWidth * (crop[3] - crop[1]);
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
      if (p.id == 2 && firstPerson) p.pose = ActionPose();
      else if (p.id >= 7) p.pose = hud.PostMultiply(vrb::Matrix::Translation(vrb::Vector(
          3.0f * ((crop[0] + crop[2]) / 2 - 0.5f),
          3.0f * float(textureHeight) / textureWidth * (0.5f - (crop[1] + crop[3]) / 2), 0)));
      else if (p.id == 4) p.pose = state[20] == 1 ? center.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, height / 2, 0))) : center;
      else {
        vrb::Vector offset(0, 0.012f * scale, 0);
        if (p.id == 0) offset.z() = -0.99f * extent;
        if (p.id == 3 || p.id == 6) offset.z() = 0.99f * extent + height / 2 + (p.id == 6 ? .3f * scale : 0);
        if (p.id == 1) offset.x() = -1.44f * extent - width / 2;
        if (p.id == 5) offset.x() = 1.44f * extent + width / 2;
        if (p.id == 5) offset.z() = -0.9f * extent - height / 2;
        if (p.id == 2) offset.z() = 0.99f * extent - height / 2;
        p.pose = board.PostMultiply(vrb::Matrix::Translation(offset))
            .PostMultiply(vrb::Matrix::Rotation(vrb::Vector(1,0,0), -vrb::PI_FLOAT / 2));
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
      p.quad->GetRenderState()->SetTintColor(p.id == 2 && gripOwner >= 0 ? vrb::Color(.65f,1,1,1) : vrb::Color(1,1,1,1));
      UpdateMask(p);
    }
  }
 private:
  vrb::Matrix ActionPose() const {
    const auto pose = actionHud.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0,actionY,actionDepth)));
    const auto toward = pose.AfineInverse().MultiplyPosition(actionViewer);
    return pose.PostMultiply(vrb::Matrix::Rotation(vrb::Vector(1,0,0), -std::atan2(toward.y(), std::fabs(toward.z()))));
  }
  void UpdateMask(Pane& p) {
    const float l = std::max(p.crop[0], modal[0]), t = std::max(p.crop[1], modal[1]);
    const float r = std::min(p.crop[2], modal[2]), b = std::min(p.crop[3], modal[3]);
    if (!hasModal || p.id == 4 || r <= l || b <= t) { p.masked = false; p.pieces.clear(); p.maskTexture.reset(); return; }
    const std::array<float,10> key{p.crop[0],p.crop[1],p.crop[2],p.crop[3],l,t,r,b,p.width,p.height};
    if (!p.masked || p.maskKey != key || p.maskTexture != p.texture) {
      p.maskKey = key; p.maskTexture = p.texture; p.pieces.clear();
      const std::array<std::array<float,4>,4> regions{{
        {p.crop[0],p.crop[1],p.crop[2],t}, {p.crop[0],b,p.crop[2],p.crop[3]},
        {p.crop[0],t,l,b}, {r,t,p.crop[2],b}}};
      for (const auto& c : regions) {
        if (c[2] <= c[0] || c[3] <= c[1]) continue;
        const float width = p.width * (c[2]-c[0]) / (p.crop[2]-p.crop[0]);
        const float height = p.height * (c[3]-c[1]) / (p.crop[3]-p.crop[1]);
        Piece piece; piece.quad = Quad::Create(context,width,height);
        piece.x = p.width * (((c[0]+c[2])/2-p.crop[0])/(p.crop[2]-p.crop[0])-.5f);
        piece.y = p.height * (.5f-((c[1]+c[3])/2-p.crop[1])/(p.crop[3]-p.crop[1]));
        piece.quad->SetTexture(p.texture, textureWidth, textureHeight);
        piece.quad->SetMaterial(vrb::Color(.4f,.4f,.4f),vrb::Color(1,1,1),vrb::Color(0,0,0),0);
        piece.quad->GetRenderState()->SetTintColor(vrb::Color(1,1,1,1));
        piece.quad->UpdateProgram("");
        piece.quad->SetTextureRect(device::EyeRect(c[0],c[1],c[2]-c[0],c[3]-c[1]));
        p.pieces.push_back(piece);
      }
    }
    p.masked = true;
    for (auto& piece : p.pieces) piece.quad->GetTransformNode()->SetTransform(
      p.pose.PostMultiply(vrb::Matrix::Translation(vrb::Vector(piece.x,piece.y,0))));
  }
 public:
  void EndGrip(int controller) { if (gripOwner == controller) gripOwner = -1; }
  bool Grip(int controller, bool pressed, bool wasPressed, const vrb::Vector& hand,
            const vrb::Vector& rayOrigin, const vrb::Vector& rayDirection) {
    if (!pressed || !firstPerson || hasModal) { EndGrip(controller); return false; }
    auto it = std::find_if(panes.begin(),panes.end(),[](const Pane& p){ return p.id == 2; });
    if (it == panes.end()) { EndGrip(controller); return false; }
    auto& p = *it;
    if (gripOwner < 0 && !wasPressed) {
      const auto inverse = p.pose.AfineInverse();
      const auto o = inverse.MultiplyPosition(rayOrigin), d = inverse.MultiplyDirection(rayDirection);
      if (std::fabs(d.z()) < .00001f) return false;
      const float t = -o.z()/d.z(); const auto hit = o + d*t;
      if (t < 0 || std::fabs(hit.x()) > p.width/2 || std::fabs(hit.y()) > p.height/2) return false;
      gripOwner = controller; gripInverse = actionHud.AfineInverse(); gripStart = gripInverse.MultiplyPosition(hand);
      gripStartY = actionY; gripStartDepth = actionDepth;
    }
    if (gripOwner != controller) return false;
    const auto delta = gripInverse.MultiplyPosition(hand) - gripStart;
    actionY = std::max(-2.0f,std::min(0.6f,gripStartY + delta.y()));
    actionDepth = std::max(-1.5f,std::min(0.6f,gripStartDepth + delta.z()));
    p.pose = ActionPose();
    p.quad->GetTransformNode()->SetTransform(p.pose); UpdateMask(p);
    return true;
  }
  bool Hit(int controller, bool captured, const vrb::Vector& origin, const vrb::Vector& direction,
           const std::vector<float>& state, vrb::Vector& point, vrb::Vector& normal, float& distance) {
    bool found = false, modalHit = false;
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
      if (!captured && p.id != 4 && hasModal && x >= modal[0] && x <= modal[2] && y >= modal[1] && y <= modal[3]) continue;
      bool interactive = captured;
      for (size_t i = 29; !interactive && i + 3 < 29 + size_t(state[1]) * 4; i += 4)
        interactive = x >= state[i] && y >= state[i+1] && x <= state[i+2] && y <= state[i+3];
      if (!interactive) continue;
      const auto hit = p.pose.MultiplyPosition(local);
      const float length = (hit - origin).Magnitude();
      if (modalHit && p.id != 4) continue;
      if (length >= distance && p.id != 4) continue;
      modalHit = p.id == 4;
      found = true; point = hit; distance = length;
      normal = p.pose.MultiplyDirection(vrb::Vector(0,0,1));
      selected[controller] = p.id; pixels[controller] = {x * textureWidth, y * textureHeight};
    }
    return found;
  }
  bool IsAction(int controller) const { auto it = selected.find(controller); return it != selected.end() && it->second == 2; }
  void Coordinates(int controller, float& x, float& y) const {
    auto it = pixels.find(controller); if (it != pixels.end()) { x = it->second.first; y = it->second.second; }
  }
  void Cull(vrb::CullVisitor& visitor, vrb::DrawableList& list, bool modalPass = false) {
    for (const auto& p : panes) {
      if ((p.id == 4) != modalPass) continue;
      if (p.masked) { for (const auto& piece : p.pieces) piece.quad->GetRoot()->Cull(visitor,list); }
      else p.quad->GetRoot()->Cull(visitor, list);
    }
  }
  WidgetPtr Source() const { return panes.empty() ? nullptr : window; }
};
}
