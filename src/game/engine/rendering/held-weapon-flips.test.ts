import { afterAll, expect, it, vi } from 'vitest';
import * as THREE from 'three';
vi.hoisted(() => vi.stubGlobal('window', { location: new URL('http://localhost'), matchMedia: () => ({ matches: false, addEventListener() {} }) }));
vi.mock('./held-weapon-flip-defaults', () => ({ authoredHeldWeaponTileFlips: {
  'assets/test.png': { '42': { flipX: false, flipY: true, flipDiagonal: true } },
  'assets/legacy.png': { '450': { flipX: true, flipY: true, flipDiagonal: true } },
} }));
import { HeldWeapon } from './held-weapon';
import { resolveHeldWeaponTileFlips } from './held-weapon-flips';
import { DEFAULT_FPS_HELD_WEAPON_TILE_FLIP_OVERRIDES_BY_TILESET } from '../shared/constants';
import { TilesetAssets, type TilesetAssetsDependencies } from './tileset-assets';
import { nh5ExpectedTileCount, translateNh367TileIndexToNh5 } from '../../tileset-367-to-5-translation';
afterAll(() => vi.unstubAllGlobals());

it.each(['raw','compiled'] as const)('uses source-pack flips for NetHack 5 with a %s 3.6.7 atlas in both weapon views',layout=>{
  const assets=new TilesetAssets({} as TilesetAssetsDependencies);
  assets.resolveRuntimeVersion=()=>"5.0";
  assets.loadedTilesetSourceLayoutVersion="3.6.7";
  assets.loadedTilesetTileLayoutVersion=layout==='compiled'?"5.0":"3.6.7";
  assets.resolveLoadedAtlasTileCount=()=>layout==='compiled'?nh5ExpectedTileCount:1082;
  const runtimeTile=translateNh367TileIndexToNh5(450);
  expect(runtimeTile).not.toBe(450);
  expect(assets.resolveSourceTileIndexForRuntime(runtimeTile)).toBe(450);
  const texture=new THREE.CanvasTexture(),flip=vi.fn(()=>texture),create=vi.fn(()=>texture);
  const held=Object.create(HeldWeapon.prototype);
  held.dependencies={engineState:{clientOptions:{tilesetPath:'assets/legacy.png'}},tilesetAssets:assets,glyphTextures:{createTileTexture:create}};
  held.fpsHeldWeaponTileFlipOverridesByTileset={};held.createFpsHeldWeaponFlippedTexture=flip;
  const expected={flipX:true,flipY:true,flipDiagonal:true};
  expect(held.resolveFpsHeldWeaponTileFlipState(runtimeTile)).toEqual(expected);
  held.createQuestWeaponTexture({tileIndex:runtimeTile,sourceGlyph:123,tilesetPath:'assets/legacy.png',signature:'translated'});
  expect(create).toHaveBeenCalledWith(runtimeTile,1,true,{sourceGlyph:123});
  expect(flip).toHaveBeenCalledWith(texture,expected);
  const edited={flipX:false,flipY:false,flipDiagonal:false};
  held.setFpsHeldWeaponTileFlipOverride(runtimeTile,edited);
  expect(held.resolveFpsHeldWeaponTileFlipState(runtimeTile)).toEqual(edited);
  texture.dispose();
});

it.each(['3.6.7','5.0','slashem'] as const)('preserves native tile IDs for %s packs',version=>{
  const assets=new TilesetAssets({} as TilesetAssetsDependencies);
  assets.resolveRuntimeVersion=()=>version;
  assets.loadedTilesetSourceLayoutVersion=version;
  assets.loadedTilesetTileLayoutVersion=assets.loadedTilesetSourceLayoutVersion;
  assets.resolveLoadedAtlasTileCount=()=>nh5ExpectedTileCount;
  expect(assets.resolveSourceTileIndexForRuntime(450)).toBe(450);
});

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
    tilesetAssets: { resolveSourceTileIndexForRuntime: (tile: number) => tile },
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
