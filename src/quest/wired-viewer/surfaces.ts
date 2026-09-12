import * as THREE from "three";
export type ButtonRegion = { x: number; y: number; width: number; height: number; label: string; action: () => void };
export type Surface = { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; canvas: HTMLCanvasElement; buttons: ButtonRegion[] };
export function createSurface(parent: THREE.Group, width: number, height: number, meters: number, y: number): Surface {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(meters, meters * height / width), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  mesh.position.y = y;
  parent.add(mesh);
  return { canvas, mesh, buttons: [] };
}
function drawButtons(target: Surface, buttons: ButtonRegion[], caption?: string): void {
  const context = target.canvas.getContext("2d")!;
  context.fillStyle = "#101e2d"; context.fillRect(0, 0, target.canvas.width, target.canvas.height);
  context.textAlign = "center"; context.textBaseline = "middle"; context.font = "28px sans-serif";
  for (const button of buttons) {
    context.fillStyle = "#25465f"; context.fillRect(button.x, button.y, button.width, button.height);
    context.strokeStyle = "#69899b"; context.strokeRect(button.x, button.y, button.width, button.height);
    context.fillStyle = "#eff9ff"; context.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2);
  }
  if (caption) { context.font = "22px sans-serif"; context.fillStyle = "#a9c1d0"; context.fillText(caption, target.canvas.width / 2, 25); }
  target.buttons = buttons;
  target.mesh.material.map!.needsUpdate = true;
}
export function createControls(toolbar: Surface, keyboard: Surface, actions: {
  key: (key: string, shift?: boolean) => void;
  navigate: (page: "probe" | "game") => void;
  recenter: () => void;
  exit: () => void;
}): void {
  let shift = false;
  let pendingPage: "probe" | "game" | null = null;
  function drawToolbar(): void {
    const entries: Array<[string, () => void]> = pendingPage ? [
      ["Save before leaving", () => undefined],
      ["Continue", () => { const page = pendingPage; pendingPage = null; if (page) actions.navigate(page); drawToolbar(); }],
      ["Cancel", () => { pendingPage = null; drawToolbar(); }],
    ] : [
      ["UI probe", () => { pendingPage = "probe"; drawToolbar(); }],
      ["Full game", () => { pendingPage = "game"; drawToolbar(); }],
      [keyboard.mesh.visible ? "Hide keyboard" : "Keyboard", () => { keyboard.mesh.visible = !keyboard.mesh.visible; drawToolbar(); }],
      ["Escape / Back", () => actions.key("Escape")],
      ["Recenter", actions.recenter], ["Exit VR", actions.exit],
    ];
    const width = 1580 / entries.length;
    drawButtons(toolbar, entries.map(([label, action], i) => ({ x: 10 + i * width, y: 10, width: width - 10, height: 80, label, action })));
  }
  function drawKeyboard(): void {
    const buttons: ButtonRegion[] = [];
    const rows = shift ? ["!@#$%^&*()", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM<>"] : ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm.,"];
    rows.forEach((row, r) => {
      const width = 122, offset = (1600 - row.length * width) / 2;
      [...row].forEach((label, column) => buttons.push({ x: offset + column * width, y: 50 + r * 78, width: width - 8, height: 66, label, action: () => actions.key(label, shift) }));
    });
    const entries: Array<[string, () => void]> = [
      [shift ? "Shift ON" : "Shift", () => { shift = !shift; drawKeyboard(); }],
      ["Space", () => actions.key(" ")], ["Backspace", () => actions.key("Backspace")], ["Enter", () => actions.key("Enter")],
      ["Close", () => { keyboard.mesh.visible = false; drawToolbar(); }],
    ];
    entries.forEach(([label, action], i) => buttons.push({ x: 15 + i * 316, y: 370, width: 302, height: 80, label, action }));
    drawButtons(keyboard, buttons, "Keyboard controls the focused UI field or game");
  }
  keyboard.mesh.visible = false;
  drawToolbar(); drawKeyboard();
}
