import * as THREE from "three";
import type { FpsHeldWeaponTileFlipOverride } from "../shared/types";

/** Shared by flat FPS, VR and the standalone calibration preview. */
export function flipHeldWeaponTexture(
  texture: THREE.CanvasTexture,
  flipState: FpsHeldWeaponTileFlipOverride,
  sourceInfo: { source: CanvasImageSource; width: number; height: number } | null,
): THREE.CanvasTexture {
    if (!flipState.flipX && !flipState.flipY && !flipState.flipDiagonal) {
      return texture;
    }

    if (!sourceInfo || typeof document === "undefined") {
      return texture;
    }

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = sourceInfo.width;
    sourceCanvas.height = sourceInfo.height;
    const sourceContext = sourceCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!sourceContext) {
      return texture;
    }

    sourceContext.imageSmoothingEnabled = false;
    sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceContext.drawImage(
      sourceInfo.source,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
    );

    const destinationWidth = flipState.flipDiagonal
      ? sourceCanvas.height
      : sourceCanvas.width;
    const destinationHeight = flipState.flipDiagonal
      ? sourceCanvas.width
      : sourceCanvas.height;
    const destinationCanvas = document.createElement("canvas");
    destinationCanvas.width = destinationWidth;
    destinationCanvas.height = destinationHeight;
    const destinationContext = destinationCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!destinationContext) {
      return texture;
    }

    const sourceImageData = sourceContext.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
    );
    const destinationImageData = destinationContext.createImageData(
      destinationWidth,
      destinationHeight,
    );
    const sourceData = sourceImageData.data;
    const destinationData = destinationImageData.data;

    for (let sourceY = 0; sourceY < sourceCanvas.height; sourceY += 1) {
      for (let sourceX = 0; sourceX < sourceCanvas.width; sourceX += 1) {
        let destinationX = sourceX;
        let destinationY = sourceY;
        let transformedWidth = sourceCanvas.width;
        let transformedHeight = sourceCanvas.height;

        if (flipState.flipDiagonal) {
          destinationX = sourceY;
          destinationY = sourceX;
          transformedWidth = sourceCanvas.height;
          transformedHeight = sourceCanvas.width;
        }

        if (flipState.flipX) {
          destinationX = transformedWidth - 1 - destinationX;
        }
        if (flipState.flipY) {
          destinationY = transformedHeight - 1 - destinationY;
        }

        const sourceIndex = (sourceY * sourceCanvas.width + sourceX) * 4;
        const destinationIndex =
          (destinationY * destinationWidth + destinationX) * 4;
        destinationData[destinationIndex] = sourceData[sourceIndex];
        destinationData[destinationIndex + 1] = sourceData[sourceIndex + 1];
        destinationData[destinationIndex + 2] = sourceData[sourceIndex + 2];
        destinationData[destinationIndex + 3] = sourceData[sourceIndex + 3];
      }
    }

    destinationContext.putImageData(destinationImageData, 0, 0);

    const flippedTexture = new THREE.CanvasTexture(destinationCanvas);
    flippedTexture.needsUpdate = true;
    flippedTexture.magFilter = texture.magFilter;
    flippedTexture.minFilter = texture.minFilter;
    flippedTexture.generateMipmaps = texture.generateMipmaps;
    flippedTexture.anisotropy = texture.anisotropy;
    flippedTexture.wrapS = texture.wrapS;
    flippedTexture.wrapT = texture.wrapT;
    flippedTexture.flipY = texture.flipY;
    texture.dispose();
    return flippedTexture;
}
