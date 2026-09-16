import * as THREE from "three";

/** A single draw call of colored cubes, each one source pixel thick. */
export function createWeaponVoxelMesh(texture: THREE.Texture): { mesh: THREE.InstancedMesh; aspect: number; pixelSize: number } {
  const image = texture.image as CanvasImageSource | undefined;
  const width = image && "width" in image ? Number(image.width) : 0;
  const height = image && "height" in image ? Number(image.height) : 0;
  const canvas = image && width && height && typeof document !== "undefined" &&
    typeof document.createElement === "function" ? document.createElement("canvas") : null;
  if (canvas) { canvas.width = width; canvas.height = height; }
  const context = canvas?.getContext("2d", { willReadFrequently: true });
  if (context && image && width && height) {
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;
    let minX = width, maxX = -1, minY = height, maxY = -1, count = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] <= 4) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y); count++;
    }
    if (count) {
      const rows = maxY - minY + 1, columns = maxX - minX + 1;
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ toneMapped: false }), count);
      const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(),
        rotation = new THREE.Quaternion(), color = new THREE.Color();
      const pixelSize = 1 / rows;
      scale.set(pixelSize * .96, pixelSize * .96, pixelSize);
      let index = 0;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const pixel = (y * width + x) * 4;
        if (pixels[pixel + 3] <= 4) continue;
        position.set((x - minX + .5 - columns / 2) * pixelSize,
          (maxY - y + .5 - rows / 2) * pixelSize, 0);
        mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
        color.setRGB(pixels[pixel] / 255, pixels[pixel + 1] / 255, pixels[pixel + 2] / 255, THREE.SRGBColorSpace);
        mesh.setColorAt(index, color);
        index++;
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return { mesh, aspect: columns / rows, pixelSize };
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ toneMapped: false }), 0);
  return { mesh, aspect: 1, pixelSize: 1 };
}
