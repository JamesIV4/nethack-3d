import { afterAll, expect, it, vi } from 'vitest';
import * as THREE from 'three';
vi.hoisted(() => vi.stubGlobal('window', { location: new URL('http://localhost'), matchMedia: () => ({ matches: false, addEventListener() {} }) }));
vi.mock('./held-weapon-flip-defaults', () => ({ authoredHeldWeaponTileFlips: {
  'assets/test.png': { '42': { flipX: false, flipY: true, flipDiagonal: true } },
} }));
import { HeldWeapon } from './held-weapon';
import { resolveHeldWeaponTileFlips } from './held-weapon-flips';
import { DEFAULT_FPS_HELD_WEAPON_TILE_FLIP_OVERRIDES_BY_TILESET } from '../shared/constants';
afterAll(() => vi.unstubAllGlobals());

it('respects explicit false corrections over built-in flips without changing other sprites', () => {
  const [path, entries] = Object.entries(DEFAULT_FPS_HELD_WEAPON_TILE_FLIP_OVERRIDES_BY_TILESET)[0];
  const [tile, builtin] = Object.entries(entries).find(([, flip]) => flip.flipX || flip.flipY || flip.flipDiagonal)!;
  const corrected = { flipX: false, flipY: false, flipDiagonal: false };
  expect(resolveHeldWeaponTileFlips(path, Number(tile), { [path]: { [tile]: corrected } })).toEqual(corrected);
  expect(resolveHeldWeaponTileFlips(path, Number(tile), {})).toEqual(builtin);
  expect(resolveHeldWeaponTileFlips('assets/test.png', 42)).toEqual({ flipX: false, flipY: true, flipDiagonal: true });
});

it('uses shared authored defaults for held weapons and VR textures while keeping session edits authoritative', () => {
  const texture = new THREE.CanvasTexture();
  const flipTexture = vi.fn(() => texture);
  const held = Object.create(HeldWeapon.prototype);
  held.dependencies = { engineState: { clientOptions: { tilesetPath: 'assets/test.png' } },
    glyphTextures: { createTileTexture: () => texture } };
  held.fpsHeldWeaponTileFlipOverridesByTileset = {};
  held.createFpsHeldWeaponFlippedTexture = flipTexture;
  const authored = { flipX: false, flipY: true, flipDiagonal: true };
  expect(held.resolveFpsHeldWeaponTileFlipState(42)).toEqual(authored);
  held.createQuestWeaponTexture({ tileIndex: 42, sourceGlyph: 1, signature: 'test', tilesetPath: 'assets/test.png' });
  expect(flipTexture).toHaveBeenCalledWith(texture, authored);
  held.setFpsHeldWeaponTileFlipOverride(42, { flipX: true, flipY: false, flipDiagonal: false });
  expect(held.resolveFpsHeldWeaponTileFlipState(42)).toEqual({ flipX: true, flipY: false, flipDiagonal: false });
  held.setFpsHeldWeaponTileFlipOverride(42, authored);
  expect(held.fpsHeldWeaponTileFlipOverridesByTileset).toEqual({});
  expect(held.resolveFpsHeldWeaponTileFlipState(42)).toEqual(authored);
  texture.dispose();
});
