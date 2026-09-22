#pragma once
#include "Quad.h"
#include "Widget.h"
#include "WidgetPlacement.h"
#include "vrb/Group.h"
#include "vrb/Transform.h"
#include "vrb/TextureSurface.h"
#include "vrb/Color.h"
#include "vrb/RenderState.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <unordered_map>
#include <utility>
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
    vrb::Matrix pose, base, local;
    int group = -1;
    float width = 1, height = 1;
    float facingCenterY = 0;
    bool masked = false;
    std::vector<float> maskKey;
    std::vector<std::array<float,4>> maskRects;
    std::vector<Piece> pieces;
    vrb::TextureSurfacePtr maskTexture;
  };
  vrb::CreationContextPtr context;
  std::vector<Pane> panes;
  WidgetPtr window;
  int32_t textureWidth = 0, textureHeight = 0;
  std::unordered_map<int, int> selected;
  std::unordered_map<int, bool> lootHits;
  std::unordered_map<int, std::pair<float, float>> pixels;
  bool hasModal = false;
  std::array<float, 4> modal{};
  bool hasDropdown = false;
  std::array<float, 4> dropdown{};
  float anchorRevision = -1;
  static bool IsModal(int id) { return id == 4 || id == 13 || id == 15; }
  bool resourcesChanged = false;
  bool menuButtonActive = false;
  std::array<float,3> menuButtonKey{};
  vrb::Vector menuButtonPoint;
  bool firstPerson = false;
  vrb::Vector viewerPosition;
  std::unordered_map<int, vrb::Vector> placements;
  static vrb::Vector DefaultPlacement(int group) {
    // Captured from the user's live immersive FPS layout. Table groups (0-15)
    // retain their existing defaults. Offsets are in each pane's yaw frame.
    if (group == 16) return vrb::Vector(.0597635992f, -.141145647f, -.298724353f);
    if (group == 21) return vrb::Vector(-.00567860529f, -.309029520f, -.123058677f);
    return vrb::Vector(0,0,0);
  }
  int gripOwner = -1, gripGroup = -1;
  vrb::Matrix gripInverse;
  vrb::Vector gripStart, gripPlacement;
  std::vector<float> hitState;
  bool SourceIsActive(const WidgetPtr& source) const {
    const auto& placement = source ? source->GetPlacement() : nullptr;
    // DrawImmersive temporarily ToggleWidget(false)s every Window while it
    // composites the replacement panes. Placement visibility is the native UI
    // lifecycle state and remains true during that draw-only suppression.
    return placement && placement->visible;
  }
  void ClearInput() {
    selected.clear(); pixels.clear(); gripOwner = gripGroup = -1;
  }
  static bool MaskedAt(const Pane& pane, float x, float y) {
    return pane.masked && std::any_of(pane.maskRects.begin(),pane.maskRects.end(),[x,y](const std::array<float,4>& rect) {
      return x >= rect[0] && x <= rect[2] && y >= rect[1] && y <= rect[3];
    });
  }
  static bool InteractiveAt(const std::vector<float>& state, float x, float y) {
    for (size_t i = 29; i + 3 < 29 + size_t(state[1]) * 4; i += 4)
      if (x >= state[i] && y >= state[i+1] && x <= state[i+2] && y <= state[i+3]) return true;
    return false;
  }
  void ClearMissingPaneInput() {
    for (auto it = selected.begin(); it != selected.end();) {
      const bool present = std::any_of(panes.begin(), panes.end(), [id = it->second](const Pane& pane) { return pane.id == id; });
      if (present) { ++it; continue; }
      pixels.erase(it->first);
      it = selected.erase(it);
    }
    if (gripGroup >= 0 && std::none_of(panes.begin(), panes.end(), [this](const Pane& pane) { return pane.group == gripGroup; })) {
      gripOwner = gripGroup = -1;
    }
  }
 public:
  void SetLootHit(int controller, bool value) { lootHits[controller] = value; }
  bool ConsumeResourceChanges() { return std::exchange(resourcesChanged, false); }
  explicit GameUiPanels(vrb::CreationContextPtr value) : context(value) {}
  bool Owns(const WidgetPtr& widget) const { return window == widget && SourceIsActive(window) && !panes.empty(); }
  bool HasCapture(int controller) const {
    const auto selectedPane = selected.find(controller);
    return selectedPane != selected.end() && std::any_of(panes.begin(), panes.end(), [id = selectedPane->second](const Pane& pane) { return pane.id == id; });
  }
  void Update(const WidgetPtr& source, const std::vector<float>& state,
              const vrb::Matrix& board, const vrb::Matrix& center, const vrb::Vector& viewer, const vrb::Matrix& hud) {
    if (state.size() < 29 || !SourceIsActive(source) || !source->GetSurfaceTexture()) {
      panes.clear(); window.reset(); ClearInput(); return;
    }
    if (state[20] != 2 || window != source || anchorRevision != state[0]) {
      if (menuButtonActive) { placements.erase(4); placements.erase(20); }
      menuButtonActive = false;
    }
    if (state[20] == 2) {
      const std::array<float,3> key{state[21],state[22],state[23]};
      if (!menuButtonActive || menuButtonKey != key) {
        const auto parent = std::find_if(panes.begin(),panes.end(),[&](const Pane& pane) { return pane.id == int(state[23]); });
        if (parent != panes.end()) {
          const float x = parent->width * ((state[21]-parent->crop[0])/(parent->crop[2]-parent->crop[0])-.5f);
          const float y = parent->height * (.5f-(state[22]-parent->crop[1])/(parent->crop[3]-parent->crop[1]));
          menuButtonPoint = parent->pose.MultiplyPosition(vrb::Vector(x,y,0));
          menuButtonKey = key; menuButtonActive = true;
          placements.erase((state[10] == 1 ? 16 : 0) + 4);
        }
      }
    }
    if (window != source) ClearInput();
    if (anchorRevision != state[0]) {
      anchorRevision = state[0]; placements.clear(); gripOwner = gripGroup = -1;
    }
    window = source;
    source->GetSurfaceTextureSize(textureWidth, textureHeight);
    if (textureWidth <= 0 || textureHeight <= 0) { panes.clear(); ClearInput(); return; }
    const size_t start = 29 + size_t(state[1]) * 4;
    const size_t count = size_t(state[13]);
    if (count > 9 || state.size() != start + count * 5) { panes.clear(); ClearInput(); return; }
    const float worldScale = state[10] == 1 ? 1 : state[19];
    const float extent = state[18] * worldScale;
    const float scale = 1; // UI dimensions are independent of game-world scale.
    const bool nextFirstPerson = state[10] == 1;
    if (firstPerson != nextFirstPerson) { gripOwner = -1; gripGroup = -1; }
    firstPerson = nextFirstPerson; viewerPosition = viewer; hitState = state;
    hasModal = false; hasDropdown = false;
    for (size_t i = start; i < state.size(); i += 5) if (IsModal(int(state[i]))) {
      const std::array<float,4> rect{state[i+1],state[i+2],state[i+3],state[i+4]};
      if (int(state[i]) == 15) { hasDropdown = true; dropdown = rect; }
      if (!hasModal) modal = rect;
      else { modal[0] = std::min(modal[0],rect[0]); modal[1] = std::min(modal[1],rect[1]); modal[2] = std::max(modal[2],rect[2]); modal[3] = std::max(modal[3],rect[3]); }
      hasModal = true;
    }
    panes.resize(count);
    for (size_t i = 0; i < count; ++i) {
      auto& p = panes[i]; const size_t at = start + i * 5;
      const std::array<float, 4> crop{state[at+1], state[at+2], state[at+3], state[at+4]};
      // 2560px logical width; preserve the existing pixels-to-metres ratio.
      const float paneScale = scale * 1.6f;
      const float width = 3.0f * paneScale * (crop[2] - crop[0]);
      const float height = 3.0f * paneScale * float(textureHeight) / textureWidth * (crop[3] - crop[1]);
      if (!p.quad) { p.quad = Quad::Create(context, width, height); resourcesChanged = true; }
      if (p.crop != crop || p.width != width || p.height != height || p.texture != source->GetSurfaceTexture() || p.textureWidth != textureWidth || p.textureHeight != textureHeight) {
        resourcesChanged = true;
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
      // Startup logo, menu and footer share a vertical plane 2.5 m from the
      // default anchor (center is already 0.95 m forward).
      if (p.id >= 12) p.pose = center.PostMultiply(vrb::Matrix::Translation(vrb::Vector(
          0, p.id == 12 ? 1.0f : p.id == 14 ? -0.7f : 0.0f, p.id <= 14 ? -1.55f : -0.8f)));
      // Fallback until the minimap/status parent below has been resolved.
      else if (p.id == 1) p.pose = hud.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, -.15f - height / 2, -.45f)));
      else if (p.id == 0 && firstPerson) p.pose = hud.PostMultiply(vrb::Matrix::Translation(vrb::Vector(
          4.8f * ((crop[0] + crop[2]) / 2 - 0.5f),
          4.8f * float(textureHeight) / textureWidth * (0.5f - (crop[1] + crop[3]) / 2) - .25f, 0)));
      else if (p.id == 2 && firstPerson) p.pose = hud.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0,-0.85f,0)));
      else if (p.id >= 7) p.pose = hud.PostMultiply(vrb::Matrix::Translation(vrb::Vector(
          4.8f * ((crop[0] + crop[2]) / 2 - 0.5f),
          4.8f * float(textureHeight) / textureWidth * (0.5f - (crop[1] + crop[3]) / 2), 0)));
      // The upright board plane is 1.55 m from its anchor; modals sit 15 cm in front.
      else if (p.id == 4) p.pose = state[20] == 1 ? center.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, height / 2, 0))) : center.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0,0,-0.45f)));
      else if (p.id == 5) {
        const auto status = std::find_if(panes.begin(), panes.begin() + i, [](const Pane& pane) { return pane.id == 0; });
        if (status != panes.begin() + i) {
          // Keep the interactive minimap centered over the actual status pane
          // in both table and first-person presentation modes.
          p.pose = status->pose.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, status->height / 2 + height / 2 + .06f, 0)));
        } else {
          const vrb::Vector offset(1.44f * extent + width / 2, 0.012f * scale, -0.9f * extent - height / 2);
          p.pose = board.PostMultiply(vrb::Matrix::Translation(offset))
              .PostMultiply(vrb::Matrix::Rotation(vrb::Vector(1,0,0), -vrb::PI_FLOAT / 2));
        }
      }
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
      // Source HUD slices are one logical pane, not four independently tilted fragments.
      const bool hudSlice = p.id >= 7 && p.id <= 10;
      p.group = (firstPerson ? 16 : 0) + (hudSlice ? 7 : p.id);
      const auto yaw = firstPerson ? hud : vrb::Matrix::Rotation(vrb::Vector(0,1,0), state[17]);
      p.base = yaw.Translate(-yaw.GetTranslation());
      p.base = vrb::Matrix::Translation(hudSlice ? hud.GetTranslation() : p.pose.GetTranslation()).PostMultiply(p.base);
      p.local = hudSlice ? hud.AfineInverse().PostMultiply(p.pose) : vrb::Matrix::Identity();
      p.facingCenterY = 0;
      if (p.id == 1) {
        // Instructions follow the actual moved/tilted panel, not a screen edge:
        // minimap in immersive FPS, status in tabletop. Keep a 6 cm gap.
        const int parentId = firstPerson ? 5 : 0;
        auto parent = std::find_if(panes.begin(),panes.begin()+i,[parentId](const Pane& pane) { return pane.id == parentId; });
        if (firstPerson && parent == panes.begin()+i) parent = std::find_if(panes.begin(),panes.begin()+i,[](const Pane& pane) { return pane.id == 0; });
        if (parent != panes.begin()+i) {
          p.base = parent->pose.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0,-parent->height/2-.06f,0)));
          p.local = vrb::Matrix::Translation(vrb::Vector(0,-height/2,0));
          p.facingCenterY = -height/2;
        }
      }
      if (p.id == 4 && state[20] == 1) {
        // Preserve the hit's screen direction even when looking straight down
        // or away from the HUD. A fixed forward plane loses those directions.
        // Both immersive modes use the same 1.4m modal viewing distance.
        auto direction = center.GetTranslation() - viewer;
        if (direction.Magnitude() < .001f) direction = yaw.MultiplyDirection(vrb::Vector(0,0,-1));
        direction = direction.Normalize();
        const auto projected = viewer + direction * 1.4f;
        const auto facing = std::hypot(direction.x(), direction.z()) > .001f
            ? vrb::Matrix::Rotation(vrb::Vector(0,1,0), std::atan2(-direction.x(),-direction.z()))
            : yaw.Translate(-yaw.GetTranslation());
        p.base = vrb::Matrix::Translation(projected).PostMultiply(facing);
        // UpdatePose faces the pane toward the eye, so this raises its bottom
        // edge in screen space, rather than lifting it to ordinary modal height.
        p.local = vrb::Matrix::Translation(vrb::Vector(0,height/2+.04f,0));
      }
      if (p.id == 4 && state[20] == 2 && menuButtonActive) {
        p.base = vrb::Matrix::Translation(menuButtonPoint + vrb::Vector(0,.04f,0)).PostMultiply(yaw.Translate(-yaw.GetTranslation()));
        p.local = vrb::Matrix::Translation(vrb::Vector(0,height/2,0));
        p.facingCenterY = height/2;
      }
      if (p.id == 15) {
        // The dropdown is a child of the already-placed dialog. Expanding the
        // list must not recenter or move its originating select in the world.
        const auto parent = std::find_if(panes.begin(), panes.begin() + i, [](const Pane& pane) { return pane.id == 4 || pane.id == 13; });
        if (parent != panes.begin() + i) {
          const float x = parent->width * (((crop[0]+crop[2])/2-parent->crop[0])/(parent->crop[2]-parent->crop[0])-.5f);
          const float y = parent->height * (.5f-((crop[1]+crop[3])/2-parent->crop[1])/(parent->crop[3]-parent->crop[1]));
          p.group = parent->group; p.base = parent->base;
          p.facingCenterY = parent->facingCenterY;
          p.local = parent->local.PostMultiply(vrb::Matrix::Translation(vrb::Vector(x,y,.004f)));
        }
      }
      UpdatePose(p);
    }
    // All crop IDs must be current before subtracting overlapping source pixels.
    for (auto& pane : panes) UpdateMask(pane);
    // A DOM pane can vanish between native controller frames. Its old selected
    // ID must not keep the shared Window captured or dispatch another click.
    ClearMissingPaneInput();
  }
 private:
  void UpdatePose(Pane& p) {
    const auto placement = placements.find(p.group);
    const auto offset = placement == placements.end() ? DefaultPlacement(p.group) : placement->second;
    const auto anchor = p.base.PostMultiply(vrb::Matrix::Translation(offset));
    const auto toward = anchor.AfineInverse().MultiplyPosition(viewerPosition);
    const int paneGroup = p.group % 16;
    const bool startupPlane = paneGroup >= 12 && paneGroup <= 14;
    // Keep the logo and menu coplanar instead of independently tilting toward
    // the eye. Dropdowns inherit the menu group and retain their tiny front offset.
    // Keep the bottom pivot fixed, but aim the panel's center at the viewer.
    // Facing from the low button alone would copy the hotbar's steep pitch.
    const float distance = std::max(.001f, std::hypot(toward.y(), toward.z()));
    const float centerAngle = std::asin(std::max(-.99f,std::min(.99f, p.facingCenterY / distance)));
    const float pitch = startupPlane ? 0 : centerAngle - std::atan2(toward.y(), std::max(.001f, std::fabs(toward.z())));
    p.pose = anchor.PostMultiply(vrb::Matrix::Rotation(vrb::Vector(1,0,0), pitch)).PostMultiply(p.local);
    p.quad->GetTransformNode()->SetTransform(p.pose);
    p.quad->GetRenderState()->SetTintColor(p.group == gripGroup && gripOwner >= 0 ? vrb::Color(.65f,1,1,1) : vrb::Color(1,1,1,1));
  }
  void UpdateMask(Pane& p) {
    std::vector<std::array<float,4>> holes;
    if (p.id == 0) {
      for (const auto& pane : panes) if (pane.id == 5) holes.push_back(pane.crop);
    }
    if (firstPerson && p.id >= 7 && p.id <= 10) {
      // The first-person HUD keeps its full source crop so ordinary messages
      // remain visible. Subtract only panes that the host renders separately.
      for (const auto& pane : panes) if (pane.id == 0 || pane.id == 1 || pane.id == 2 || pane.id == 5) holes.push_back(pane.crop);
      if (hasModal) holes.push_back(modal);
    } else if (hasModal && p.id != 15) {
      if (IsModal(p.id)) {
        if (hasDropdown) holes.push_back(dropdown);
      } else holes.push_back(modal);
    }
    std::vector<std::array<float,4>> cuts;
    for (const auto& hole : holes) {
      const float l = std::max(p.crop[0], hole[0]), t = std::max(p.crop[1], hole[1]);
      const float r = std::min(p.crop[2], hole[2]), b = std::min(p.crop[3], hole[3]);
      if (r > l && b > t) cuts.push_back({l,t,r,b});
    }
    p.maskRects = cuts;
    if (cuts.empty()) { p.masked = false; p.pieces.clear(); p.maskTexture.reset(); return; }
    std::vector<float> key{p.crop[0],p.crop[1],p.crop[2],p.crop[3],p.width,p.height};
    for (const auto& cut : cuts) key.insert(key.end(), cut.begin(), cut.end());
    if (!p.masked || p.maskKey != key || p.maskTexture != p.texture) {
      resourcesChanged = true;
      p.maskKey = key; p.maskTexture = p.texture; p.pieces.clear();
      std::vector<std::array<float,4>> regions{p.crop};
      for (const auto& cut : cuts) {
        std::vector<std::array<float,4>> remaining;
        for (const auto& region : regions) {
          const float l = std::max(region[0],cut[0]), t = std::max(region[1],cut[1]);
          const float r = std::min(region[2],cut[2]), b = std::min(region[3],cut[3]);
          if (r <= l || b <= t) { remaining.push_back(region); continue; }
          const std::array<std::array<float,4>,4> pieces{{
            {region[0],region[1],region[2],t}, {region[0],b,region[2],region[3]},
            {region[0],t,l,b}, {r,t,region[2],b}}};
          for (const auto& piece : pieces) if (piece[2] > piece[0] && piece[3] > piece[1]) remaining.push_back(piece);
        }
        regions = std::move(remaining);
      }
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
  void EndGrip(int controller) { if (gripOwner == controller) { gripOwner = -1; gripGroup = -1; } }
  bool Grip(int controller, bool pressed, bool wasPressed, const vrb::Vector& hand,
            const vrb::Vector& rayOrigin, const vrb::Vector& rayDirection) {
    if (!SourceIsActive(window)) { ClearInput(); return false; }
    if (!pressed) { EndGrip(controller); return false; }
    if (gripOwner < 0 && !wasPressed) {
      vrb::Vector point, normal; float distance;
      bool found = Hit(controller, false, rayOrigin, rayDirection, hitState, point, normal, distance);
      int id = found ? selected[controller] : -1;
      // Grip may grab a non-clickable log or pane padding; ordinary laser hits
      // still use only the interactive regions and pass through empty space.
      for (const auto& p : panes) {
        if (p.id >= 7 && p.id <= 10) continue;
        if (p.id == 2 && lootHits[controller]) continue;
        if (IsModal(id) && !IsModal(p.id)) continue;
        const auto inverse = p.pose.AfineInverse();
        const auto o = inverse.MultiplyPosition(rayOrigin), d = inverse.MultiplyDirection(rayDirection);
        if (std::fabs(d.z()) < .00001f) continue;
        const float t = -o.z()/d.z(); const auto hit = o+d*t;
        if (t < 0 || std::fabs(hit.x()) > p.width/2 || std::fabs(hit.y()) > p.height/2) continue;
        const float x = p.crop[0] + (hit.x()/p.width+.5f)*(p.crop[2]-p.crop[0]);
        const float y = p.crop[1] + (.5f-hit.y()/p.height)*(p.crop[3]-p.crop[1]);
        if (MaskedAt(p,x,y)) continue;
        if (p.id == 2 && !InteractiveAt(hitState,x,y)) continue;
        const float length = (p.pose.MultiplyPosition(hit)-rayOrigin).Magnitude();
        if (length < distance || IsModal(p.id)) { found = true; id = p.id; distance = length; }
      }
      if (!found) return false;
      auto it = std::find_if(panes.begin(), panes.end(), [id](const Pane& p){ return p.id == id; });
      if (it == panes.end()) return false;
      gripOwner = controller; gripGroup = it->group;
      gripInverse = it->base.AfineInverse(); gripStart = gripInverse.MultiplyPosition(hand);
      gripPlacement = placements.count(gripGroup) ? placements[gripGroup] : DefaultPlacement(gripGroup);
    }
    if (gripOwner != controller) return false;
    if (std::none_of(panes.begin(),panes.end(),[this](const Pane& p){ return p.group == gripGroup; })) { EndGrip(controller); return false; }
    const auto delta = gripInverse.MultiplyPosition(hand) - gripStart;
    placements[gripGroup] = vrb::Vector(std::max(-3.0f,std::min(3.0f,gripPlacement.x()+delta.x())),
        std::max(-2.0f,std::min(2.0f,gripPlacement.y()+delta.y())),
        std::max(-2.0f,std::min(1.0f,gripPlacement.z()+delta.z())));
    for (auto& p : panes) if (p.group == gripGroup) { UpdatePose(p); UpdateMask(p); }
    return true;
  }
  bool Hit(int controller, bool captured, const vrb::Vector& origin, const vrb::Vector& direction,
           const std::vector<float>& state, vrb::Vector& point, vrb::Vector& normal, float& distance) {
    if (!SourceIsActive(window)) { ClearInput(); distance = 10000; return false; }
    bool found = false, modalHit = false;
    distance = 10000;
    for (const auto& p : panes) {
      if (captured && selected.count(controller) && selected[controller] != p.id) continue;
      if (!captured && p.id == 2 && lootHits[controller]) continue;
      const auto inverse = p.pose.AfineInverse();
      const auto o = inverse.MultiplyPosition(origin), d = inverse.MultiplyDirection(direction);
      if (std::fabs(d.z()) < 0.00001f) continue;
      const float t = -o.z() / d.z(); if (t < 0) continue;
      const auto local = o + d * t;
      const float u = local.x() / p.width + 0.5f, v = 0.5f - local.y() / p.height;
      if (!captured && (u < 0 || u > 1 || v < 0 || v > 1)) continue;
      const float x = p.crop[0] + u * (p.crop[2] - p.crop[0]);
      const float y = p.crop[1] + v * (p.crop[3] - p.crop[1]);
      if (!captured && MaskedAt(p,x,y)) continue;
      if (!captured && p.id != 15 && hasDropdown && x >= dropdown[0] && x <= dropdown[2] && y >= dropdown[1] && y <= dropdown[3]) continue;
      if (!captured && !IsModal(p.id) && hasModal && x >= modal[0] && x <= modal[2] && y >= modal[1] && y <= modal[3]) continue;
      bool interactive = captured || InteractiveAt(state,x,y);
      if (!interactive) continue;
      const auto hit = p.pose.MultiplyPosition(local);
      const float length = (hit - origin).Magnitude();
      if (modalHit && !IsModal(p.id)) continue;
      if (length >= distance && !IsModal(p.id)) continue;
      modalHit = IsModal(p.id);
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
  void Cull(vrb::CullVisitor& visitor, vrb::DrawableList& list, bool modalPass = false, bool actionsPass = false) {
    if (!SourceIsActive(window)) return;
    for (const auto& p : panes) {
      if (IsModal(p.id) != modalPass) continue;
      if (!modalPass && (p.id == 2) != actionsPass) continue;
      if (p.masked) { for (const auto& piece : p.pieces) piece.quad->GetRoot()->Cull(visitor,list); }
      else p.quad->GetRoot()->Cull(visitor, list);
    }
  }
  WidgetPtr Source() const { return panes.empty() ? nullptr : window; }
};
}
