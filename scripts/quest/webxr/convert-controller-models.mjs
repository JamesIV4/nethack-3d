// Offline asset conversion only; APK preparation copies the checked-in outputs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const assets = path.join(root, "quest/webxr/controllers/meta-touch-plus");
const source = path.join(assets, "source");
const output = path.join(assets, "native");
mkdirSync(output, { recursive: true });
const originalLoad = THREE.TextureLoader.prototype.load;
// Texture pixels are converted separately, without a DOM or GPU dependency.
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture(); texture.name = url; return texture;
};
const receipt = { sdk: "com.meta.xr.sdk.core@205.0.0", hands: {} };
try {
  for (const hand of ["left", "right"]) {
    const title = hand[0].toUpperCase() + hand.slice(1);
    const bytes = readFileSync(path.join(source, `MetaQuestTouchPlus_${title}.fbx`));
    const scene = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    scene.updateMatrixWorld(true);
    const meshes = [];
    scene.traverse(node => { if (node.isMesh && /^oculus_controller_[lr]_MeshX$/.test(node.name)) meshes.push(node); });
    if (meshes.length !== 1) throw new Error(`${hand}: expected exactly one controller body`);
    const mesh = meshes[0], position = mesh.geometry.getAttribute("position"), normal = mesh.geometry.getAttribute("normal"), uv = mesh.geometry.getAttribute("uv");
    if (!normal || !uv || position.count !== normal.count || position.count !== uv.count) throw new Error("Incomplete controller attributes");
    const stem = `vr_controller_metaquest3_${hand}`;
    const obj = [`# Meta Platforms Touch Plus; source license: ../LICENSE.md`, `mtllib ${stem}.mtl`, `o ${stem}`];
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const v = new THREE.Vector3(), n = new THREE.Vector3(), bounds = new THREE.Box3();
    const format = value => Number(value.toFixed(8)).toString();
    for (let index = 0; index < position.count; index++) {
      // Export the authored bind geometry and its matching bind normals.
      // Native OBJ controllers are static: do not bake a trigger animation or
      // an arbitrary skeleton's currently evaluated pose into the surface.
      v.fromBufferAttribute(position, index);
      v.applyMatrix4(mesh.matrixWorld); bounds.expandByPoint(v);
      obj.push(`v ${v.toArray().map(format).join(" ")}`);
    }
    for (let index = 0; index < normal.count; index++) {
      n.fromBufferAttribute(normal, index).applyNormalMatrix(normalMatrix);
      obj.push(`vn ${n.toArray().map(format).join(" ")}`);
    }
    for (let index = 0; index < uv.count; index++) obj.push(`vt ${format(uv.getX(index))} ${format(uv.getY(index))}`);
    obj.push(`usemtl meta_touch_plus_${hand}`);
    const indices = mesh.geometry.index;
    const count = indices?.count ?? position.count;
    if (count % 3 || position.count >= 65536 || mesh.matrixWorld.determinant() <= 0) throw new Error("Unsupported controller topology");
    for (let offset = 0; offset < count; offset += 3) {
      obj.push("f " + [0, 1, 2].map(corner => {
        const index = (indices ? indices.getX(offset + corner) : offset + corner) + 1;
        return `${index}/${index}/${index}`;
      }).join(" "));
    }
    writeFileSync(path.join(output, `${stem}.obj`), obj.join("\n") + "\n");
    writeFileSync(path.join(output, `${stem}.mtl`), `# Meta Platforms Touch Plus\nnewmtl meta_touch_plus_${hand}\nKa 1 1 1\nKd 1 1 1\nKs 0 0 0\nd 1\nillum 1\nmap_Kd ${stem}.ktx\n`);
    execFileSync("python", ["-c", "from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert('RGB'); im.resize((512,512),Image.Resampling.LANCZOS).save(sys.argv[2],optimize=True)",
      path.join(source, `MetaQuestTouchPlus_${title}_BaseColor_AO_AlphaRoughness.png`), path.join(output, `${stem}.png`)], { windowsHide: true });
    // Keep runtime textures on the host's native KTX path. Explicit RGBA bytes
    // avoid Android Bitmap configuration/premultiplication conversions.
    const rgba = execFileSync("python", ["-c", "from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').tobytes())", path.join(output, `${stem}.png`)], { windowsHide: true, maxBuffer: 2_000_000 });
    const header = Buffer.alloc(68);
    Buffer.from([0xAB,0x4B,0x54,0x58,0x20,0x31,0x31,0xBB,0x0D,0x0A,0x1A,0x0A]).copy(header);
    [0x04030201,0x1401,1,0x1908,0x1908,0x1908,512,512,0,0,1,1,0,rgba.length].forEach((value,index) => header.writeUInt32LE(value,12+index*4));
    writeFileSync(path.join(output, `${stem}.ktx`), Buffer.concat([header, rgba]));
    receipt.hands[hand] = { sourceSha256: createHash("sha256").update(bytes).digest("hex"), vertices: position.count, triangles: count / 3, boundsMeters: { min: bounds.min.toArray(), max: bounds.max.toArray() } };
  }
} finally { THREE.TextureLoader.prototype.load = originalLoad; }
writeFileSync(path.join(assets, "conversion.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("Converted Meta Touch Plus controllers in their original meter-scale grip coordinates.");
