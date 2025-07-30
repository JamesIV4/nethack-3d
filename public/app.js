"use strict";
/*
 * Main entry point for the NetHack 3D client.  This module is compiled
 * to `public/app.js` and loaded as an ES module by `index.html`.  It
 * relies on the NetHack WASM runtime (nethack.js) having been loaded
 * ahead of time.  NetHack exposes a global function called
 * `nethackStart` which accepts a callback implementing the
 * window‑interface.  When NetHack needs to draw or get input, it calls
 * into this callback with the name of the window function and its
 * arguments.  We implement a minimal subset of those functions here
 * and map glyph updates into a simple 3D representation using Three.js.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Map constants for directional commands.  NetHack uses the rogue‑like
// key bindings: h (left), j (down), k (up), l (right).  We convert
// arrow keys into these letters for convenience.  Additional keys are
// passed through unchanged.
const MOVEMENT_KEYS = {
    ArrowLeft: 'h',
    ArrowDown: 'j',
    ArrowUp: 'k',
    ArrowRight: 'l'
};
// The size of each tile in our 3D world.  A tile spans one unit along
// the x and y axes.  Z coordinates are used for height (walls and
// creatures).  Adjust this if you wish to scale the dungeon.
const TILE_SIZE = 1;
// A lookup from coordinate key ("x,y") to its corresponding mesh in
// Three.js.  This allows us to update existing meshes when a glyph
// changes instead of creating duplicates.  We also track the hero
// separately.
const tileMeshes = new Map();
let heroMesh = null;
let heroPos = { x: 0, y: 0 };
// Queue used to buffer user input.  When NetHack calls
// `shim_nhgetch` we pop a key from this queue.  If it is empty we
// pause until a key is available.  Keys are stored as single
// characters (e.g. 'h', 'j', 'y', 'q', etc.).
const inputQueue = [];
// NetHack window identifiers.  We assign a unique numeric ID to each
// window type when it is created.  NetHack will use these IDs to
// refer back to the windows later.  For our purposes, we only need
// one map window and one message window.
const windowIds = {};
let nextWinId = 1;
// HTML overlay element for displaying messages from NetHack (the
// message window).  This is updated in response to `shim_putstr` and
// cleared by `shim_clear_nhwindow`.
const overlay = document.getElementById('overlay');
// Create the Three.js scene, camera and renderer.  We perform this
// outside of the NetHack callback so that the scene exists before
// NetHack begins sending updates.  The camera is configured to look
// down from above at a slight angle so the player can view the map in
// three dimensions.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
// Position the camera high enough to see the map.  We later update
// this position whenever the hero moves.
camera.position.set(0, -10, 20);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Lighting improves readability of the 3D scene.  Ambient light
// provides overall illumination while a directional light gives some
// contrast and depth.
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);
// Resize handling: adjust the renderer and camera aspect ratio when
// the browser window changes size.
window.addEventListener('resize', () => {
    const { innerWidth, innerHeight } = window;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});
// Keyboard handling: whenever the user presses a key, push a
// corresponding NetHack command character into the input queue.  We
// translate arrow keys to the classic rogue‑like movement commands.
window.addEventListener('keydown', (event) => {
    // Ignore modifier keys
    if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }
    const mapped = MOVEMENT_KEYS[event.key];
    if (mapped) {
        inputQueue.push(mapped);
        event.preventDefault();
        return;
    }
    // Accept single character commands.  For readability we convert
    // uppercase letters to lowercase since NetHack expects lower.
    if (event.key.length === 1) {
        inputQueue.push(event.key.toLowerCase());
        event.preventDefault();
    }
});
/**
 * Convert a glyph from NetHack into a character and colour.  The
 * nethack WASM exposes helper functions on `globalThis.nethackOptions`.
 * The `mapglyphHelper` function returns an array: [char, color,
 * mgflags].  We wrap this in a safe accessor in case the helper
 * isn't yet available.  mgflags are not used in this simple port.
 */
function decodeGlyph(glyph, x, y) {
    try {
        const opts = globalThis.nethackOptions;
        if (opts && typeof opts.mapglyphHelper === 'function') {
            // The helper returns [char, color, mgflags]
            const result = opts.mapglyphHelper(glyph, x, y, 0);
            if (Array.isArray(result) && result.length >= 2) {
                return { ch: result[0], color: result[1] };
            }
        }
    }
    catch (_err) {
        // ignore errors, fall through to default
    }
    // Fallback: unknown glyph represented as '?' with white colour
    return { ch: '?', color: '#ffffff' };
}
/**
 * Create or update a mesh for the given map coordinate.  Different
 * glyph characters map to different basic 3D shapes (floor, wall,
 * hero, monster, item).  If a mesh already exists at this tile we
 * remove it before creating the new one.  The y coordinate is
 * inverted so that NetHack's origin (upper left) maps into Three.js's
 * coordinate system (positive x to the right, positive y forward).
 */
function updateTile(x, y, ch, color) {
    const key = `${x},${y}`;
    // Remove any existing mesh at this location except for the hero.
    const old = tileMeshes.get(key);
    if (old && old !== heroMesh) {
        scene.remove(old);
    }
    let mesh;
    const material = new THREE.MeshLambertMaterial({ color });
    // Determine what sort of object to draw based on the character.
    // Walls are drawn as boxes, floors as flat planes, hero as a box
    // with a distinct colour, monsters as red cubes, items as yellow
    // cubes.  Unknown glyphs default to a grey plane.
    const worldX = x * TILE_SIZE;
    const worldY = -y * TILE_SIZE;
    if (ch === '@') {
        // Hero: store separately so we can move it without recreating
        const geometry = new THREE.BoxGeometry(TILE_SIZE * 0.8, TILE_SIZE * 0.8, TILE_SIZE * 0.8);
        const heroMaterial = new THREE.MeshLambertMaterial({ color: 0x00ffcc });
        mesh = new THREE.Mesh(geometry, heroMaterial);
        mesh.position.set(worldX, worldY, TILE_SIZE * 0.5);
        heroPos = { x, y };
        if (heroMesh) {
            scene.remove(heroMesh);
        }
        heroMesh = mesh;
        scene.add(mesh);
        tileMeshes.set(key, mesh);
        return;
    }
    // Walls: '#' in ascii, '-' and '|' for horizontal/vertical walls
    if (ch === '#' || ch === '-' || ch === '|' || ch === '+') {
        const geometry = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, TILE_SIZE);
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(worldX, worldY, TILE_SIZE * 0.5);
    }
    else if (ch === '.' || ch === ' ') {
        // Floor: flat plane
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(worldX, worldY, 0);
    }
    else if (/[a-zA-Z]/.test(ch)) {
        // Monster: red cube
        const geometry = new THREE.BoxGeometry(TILE_SIZE * 0.8, TILE_SIZE * 0.8, TILE_SIZE * 0.8);
        const monsterMat = new THREE.MeshLambertMaterial({ color: 0xff5555 });
        mesh = new THREE.Mesh(geometry, monsterMat);
        mesh.position.set(worldX, worldY, TILE_SIZE * 0.5);
    }
    else if (/[\$\?%!\/=]/.test(ch)) {
        // Items: yellow cube
        const geometry = new THREE.BoxGeometry(TILE_SIZE * 0.5, TILE_SIZE * 0.5, TILE_SIZE * 0.5);
        const itemMat = new THREE.MeshLambertMaterial({ color: 0xffff88 });
        mesh = new THREE.Mesh(geometry, itemMat);
        mesh.position.set(worldX, worldY, TILE_SIZE * 0.25);
    }
    else {
        // Unknown: draw as floor
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(worldX, worldY, 0);
    }
    scene.add(mesh);
    tileMeshes.set(key, mesh);
}
/**
 * The NetHack callback.  NetHack calls this function by name with
 * various commands indicating window operations or input requests.
 * This implementation handles a minimal subset of calls to get a
 * playable game.  Many other window functions (menus, inventory,
 * status) return default values or are stubbed out.
 */
function uiCallback(name, ...args) {
    return __awaiter(this, void 0, void 0, function* () {
        switch (name) {
            case 'shim_create_nhwindow': {
                const type = args[0];
                const id = nextWinId++;
                windowIds[type] = id;
                return id;
            }
            case 'shim_clear_nhwindow': {
                const win = args[0];
                // Clear the overlay if this is the message window
                if (win === 'WIN_MESSAGE') {
                    overlay.textContent = '';
                }
                return 0;
            }
            case 'shim_putstr': {
                const win = args[0];
                const attr = args[1];
                const str = args[2];
                // Append message to overlay; use newline to separate messages
                if (win === 'WIN_MESSAGE' || win === 'WIN_STATUS') {
                    overlay.textContent += str + '\n';
                }
                return 0;
            }
            case 'shim_print_glyph': {
                // Args: windowId, x, y, glyph
                const win = args[0];
                const x = args[1];
                const y = args[2];
                const glyph = args[3];
                if (win === 'WIN_MAP') {
                    const { ch, color } = decodeGlyph(glyph, x, y);
                    updateTile(x, y, ch, color || '#888888');
                }
                return 0;
            }
            case 'shim_display_nhwindow': {
                // Args: windowId, blocking
                // We don't need to do anything special; messages already updated
                return 0;
            }
            case 'shim_destroy_nhwindow': {
                return 0;
            }
            case 'shim_nhgetch': {
                // Wait for a key to become available
                while (inputQueue.length === 0) {
                    yield new Promise((res) => setTimeout(res, 50));
                }
                const key = inputQueue.shift() || ' ';
                return key.charCodeAt(0);
            }
            case 'shim_nh_poskey': {
                // Similar to nhgetch but returns 0 for poskey pointer.  We'll
                // return the same code for compatibility (character code) and
                // ignore mouse input.
                while (inputQueue.length === 0) {
                    yield new Promise((res) => setTimeout(res, 50));
                }
                const key = inputQueue.shift() || ' ';
                // Return value format: [charCode, x, y, mod]
                return [key.charCodeAt(0), 0, 0, 0];
            }
            case 'shim_yn_function': {
                // NetHack prompts yes/no questions.  Always return 'y' (121) so
                // that the game proceeds without pausing.
                return 121;
            }
            case 'shim_getlin': {
                // Prompt for a line of input.  We return an empty string to
                // satisfy the request.
                return '';
            }
            case 'shim_start_menu':
            case 'shim_add_menu':
            case 'shim_end_menu': {
                // Ignore menu related calls for now.  They are typically used
                // when picking up items or selecting spells.  Returning 0 is
                // acceptable for simple gameplay.
                return 0;
            }
            case 'shim_select_menu': {
                // Always select nothing.  NetHack interprets an empty array as
                // cancel.  This prevents the game from locking up on menus.
                return [];
            }
            default: {
                // For any unhandled callbacks, return 0 or an empty string.  This
                // default case prevents crashes if NetHack calls a function we
                // haven't implemented yet.
                return 0;
            }
        }
    });
}
/**
 * Update the camera position to follow the hero.  Called on each
 * animation frame.  The camera hovers above and slightly behind the
 * hero's position so that the player remains centered in the view.
 */
function updateCamera() {
    const { x, y } = heroPos;
    // Compute world coordinates from grid coordinates
    const targetX = x * TILE_SIZE;
    const targetY = -y * TILE_SIZE;
    // Set camera behind and above the hero
    camera.position.x = targetX;
    camera.position.y = targetY - TILE_SIZE * 4;
    camera.position.z = TILE_SIZE * 8;
    camera.lookAt(targetX, targetY, 0);
}
/**
 * Main render loop.  This function schedules itself via
 * requestAnimationFrame and continuously renders the scene and updates
 * the camera.
 */
function animate() {
    requestAnimationFrame(animate);
    updateCamera();
    renderer.render(scene, camera);
}
// Kick off the animation loop
animate();
// Wait for the NetHack runtime to finish loading and then start the
// game.  The runtime defines `nethackStart` on the global object.
function startNethack() {
    return __awaiter(this, void 0, void 0, function* () {
        // Some browsers may need a microtask delay for the WASM runtime to
        // initialise.  Yield to the event loop once before starting.
        yield new Promise((res) => setTimeout(res, 0));
        if (typeof nethackStart !== 'function') {
            console.error('nethackStart is not available. Make sure nethack.js is loaded.');
            return;
        }
        try {
            nethackStart(uiCallback, {
                // Optionally pass NetHack options here (e.g. character name)
                nethackOptions: {
                    // Display the hero as @ instead of letting the game randomise name
                    name: '3DHero',
                    autoquiver: true
                }
            });
        }
        catch (err) {
            console.error('Failed to start NetHack:', err);
        }
    });
}
// Begin the game after the page has loaded
startNethack().catch((err) => console.error(err));
