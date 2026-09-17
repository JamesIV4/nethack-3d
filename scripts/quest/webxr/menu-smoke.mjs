/** Real DOM layout and GPU coverage; run wired-host.mjs --menu-smoke. */
async function waitForSelector(cdp, selector) {
  const result = await cdp("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `new Promise((resolve, reject) => {
      const find = () => document.querySelector(${JSON.stringify(selector)});
      if (find()) { resolve(true); return; }
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error("Timed out waiting for ${selector}")); }, 3000);
      const observer = new MutationObserver(() => { if (find()) { clearTimeout(timer); observer.disconnect(); resolve(true); } });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    })`,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
}

async function clickSelector(cdp, selector) {
  const result = await cdp("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    })()`,
  });
  const point = result.result?.value;
  if (!point) throw new Error(`Cannot click ${selector}: no rendered element`);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function enterStartupName(cdp, selector, value) {
  await clickSelector(cdp, selector);
  const focused = await cdp("Runtime.evaluate", {
    returnByValue: true,
    expression: `document.activeElement === document.querySelector(${JSON.stringify(selector)})`,
  });
  if (focused.result?.value !== true) throw new Error(`Pointer click did not focus ${selector}`);
  await cdp("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
  await cdp("Input.insertText", { text: value });
  const edited = await cdp("Runtime.evaluate", {
    returnByValue: true,
    expression: `document.querySelector(${JSON.stringify(selector)})?.value`,
  });
  if (edited.result?.value !== value) throw new Error(`Text entry did not update ${selector}`);
}

async function smokeStartupNameInputs(cdp) {
  await clickSelector(cdp, "#character-setup-dialog-variant .nh3d-choice-button");
  await waitForSelector(cdp, "#character-setup-dialog-choose.is-visible");
  await clickSelector(cdp, "#character-setup-dialog-choose .nh3d-choice-button:nth-of-type(2)");
  await waitForSelector(cdp, "#character-setup-dialog-create.is-visible .nh3d-startup-config-input");
  await enterStartupName(cdp, "#character-setup-dialog-create .nh3d-startup-config-input", "VR Create");
  await clickSelector(cdp, "#character-setup-dialog-create .nh3d-menu-action-cancel");
  await waitForSelector(cdp, "#character-setup-dialog-choose.is-visible");
  await clickSelector(cdp, "#character-setup-dialog-choose .nh3d-choice-button:nth-of-type(1)");
  await waitForSelector(cdp, "#character-setup-dialog-random.is-visible .nh3d-startup-config-input");
  await enterStartupName(cdp, "#character-setup-dialog-random .nh3d-startup-config-input", "VR Random");
}

export async function menuSmoke(cdp) {
  const evaluated = await cdp("Runtime.evaluate", {
    awaitPromise: true, returnByValue: true,
    expression: ` (async () => {
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      const game = window.nethackGame;
      check(game && game.systems.engineState.session === null, "The XR menu must exist before a game worker starts");
      check(innerWidth === 1920 && innerHeight === 1080, "Expected 1080p flat viewport");
      const waitForViewport = (width, height) => new Promise(resolve => {
        const ready = () => { if (innerWidth === width && innerHeight === height) { window.removeEventListener('resize', ready); resolve(); } };
        window.addEventListener('resize', ready); ready();
      });
      const root = document.documentElement;
      await document.fonts.ready;
      const inkBounds = () => {
        const rects = [...document.querySelector('.nethack-ascii-logo').querySelectorAll('.nh3d-logo-row')]
          .filter(row => row.textContent.trim()).map(row => {
            const text = row.firstChild, value = text.textContent, range = document.createRange();
            range.setStart(text, value.length - value.trimStart().length);
            range.setEnd(text, value.trimEnd().length);
            return range.getBoundingClientRect();
          });
        return { left: Math.min(...rects.map(r=>r.left)), right: Math.max(...rects.map(r=>r.right)),
          top: Math.min(...rects.map(r=>r.top)), bottom: Math.max(...rects.map(r=>r.bottom)) };
      };
      const stopLogo = () => document.querySelectorAll('.nh3d-logo-row').forEach(row => row.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }));
      stopLogo();
      const desktopInk = inkBounds();
      const desktopAspect = (desktopInk.right-desktopInk.left)/(desktopInk.bottom-desktopInk.top);
      root.classList.add("nh3d-webxr-active", "nh3d-xr-native-ui", "nh3d-xr-menu");
      await waitForViewport(2560, 1440);
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const { tableUiPanes } = await import('/src/quest/webxr/table-ui-layout.ts');
      const { isVisibleUi } = await import('/src/quest/webxr/visibility.ts');
      const baselinePanes = tableUiPanes(false, []);
      const ghost = document.createElement('div'); ghost.className='nh3d-dialog is-visible'; ghost.textContent='Hidden dialog';
      ghost.style.opacity='0'; document.body.append(ghost);
      check(!isVisibleUi(ghost) && JSON.stringify(tableUiPanes(false,[]))===JSON.stringify(baselinePanes), 'Hidden dialog still owns a native pane');
      ghost.style.opacity='1'; ghost.setAttribute('inert','');
      check(!isVisibleUi(ghost), 'Inactive dialog still receives input'); ghost.remove();
      const panes = tableUiPanes(false, []);
      const logo = panes.find(p => p[0] === 12), menu = panes.find(p => p[0] === 13);
      check(logo && menu, "Missing native logo/menu crop: " + JSON.stringify({panes, logo: document.querySelector(".logo-container")?.outerHTML.slice(0,200), classes: root.className, dialogs: [...document.querySelectorAll(".nh3d-dialog")].map(e=>({id:e.id,opacity:getComputedStyle(e).opacity,display:getComputedStyle(e).display,rect:e.getBoundingClientRect().toJSON()}))}));
      check(logo[4] < menu[2], "Logo and menu source pixels overlap");
      const pre = document.querySelector('.nethack-ascii-logo').getBoundingClientRect();
      check(pre.left >= 0 && pre.right <= innerWidth && pre.top >= 0 && pre.bottom <= innerHeight, "ASCII logo clipped by viewport");
      const logoElement = document.querySelector('.logo-container');
      stopLogo();
      const vrInk = inkBounds();
      const vrAspect = (vrInk.right-vrInk.left)/(vrInk.bottom-vrInk.top);
      check(Math.abs(vrAspect / desktopAspect - 1) < .01, 'VR logo aspect differs from desktop: ' + JSON.stringify({desktopAspect,vrAspect}));
      check(Math.abs((vrInk.left+vrInk.right)/2-innerWidth/2) < 1, 'Visible ASCII logo is off center');
      const logoRows = [...document.querySelector('.nethack-ascii-logo').querySelectorAll('.nh3d-logo-row')];
      check(logoRows.length > 20, "ASCII logo was not split into animated rows");
      const waveAnimations = logoRows.map(row => row.getAnimations()[0]);
      waveAnimations.forEach(animation => { check(animation, "Missing cross-platform logo wave"); animation.pause(); });
      check(waveAnimations.every(a => a.effect.getTiming().duration === 12000), 'Logo wave frequency was not halved');
      for (let time = 0; time <= 12000; time += 250) {
        waveAnimations.forEach(animation => { animation.currentTime = time; });
        const crop = logoElement.getBoundingClientRect();
        for (const row of logoRows) {
          const r = row.getBoundingClientRect();
          check(r.left >= crop.left && r.right <= crop.right && r.top >= crop.top && r.bottom <= crop.bottom, "Depth wave exceeds its padded VR crop");
        }
      }
      const middle = Math.floor(logoRows.length / 2);
      const peakTime = middle * 4500 / (logoRows.length - 1) + 750;
      waveAnimations.forEach(animation => { animation.currentTime = peakTime; });
      check(new DOMMatrix(getComputedStyle(logoRows[middle]).transform).m43 > 30, "Logo wave has no depth lift");
      const lifted = logoRows.filter(row => new DOMMatrix(getComputedStyle(row).transform).m43 > .01).length;
      check(lifted >= logoRows.length / 3 - 2 && lifted <= logoRows.length / 3 + 2, "Wave band is not one-third of the logo height");
      waveAnimations.forEach(animation => animation.play());
      const dialog = [...document.querySelectorAll('.nh3d-dialog.is-visible')].find(e => e.getBoundingClientRect().width > 0);
      check(dialog && dialog.getBoundingClientRect().bottom < innerHeight * .9, "Menu clipped or overlaps footer");
      check(Number(getComputedStyle(dialog).zoom) === 1, "Main-menu dialog content is still scaled down");
      const previousHeight = dialog.style.height;
      dialog.style.height = '100vh';
      const tallPanes = tableUiPanes(false, []), tallMenu = tallPanes.find(p=>p[0]===13), footer = tallPanes.find(p=>p[0]===14);
      check(tallPanes.find(p=>p[0]===12)[4] < tallMenu[2] && tallMenu[4] < footer[2], 'A tall menu overlaps the full-height logo or footer crop');
      dialog.style.height = previousHeight;
      const dropdownInput = document.createElement('select');
      dropdownInput.innerHTML = '<option value="a">Alpha</option><option value="b">Beta</option>';
      dialog.append(dropdownInput);
      const beforeDropdown = tableUiPanes(false, []).find(p=>p[0]===13);
      dropdownInput.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,pointerType:'touch'}));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const listbox = document.querySelector('.nh3d-select-menu');
      check(listbox, 'Dropdown did not open its input-anchored list');
      const inputBox = dropdownInput.getBoundingClientRect(), listBox = listbox.getBoundingClientRect();
      check(Math.abs(listBox.left-inputBox.left)<2 && Math.abs(listBox.top-inputBox.bottom)<2, 'Dropdown does not start at its input');
      const dropdownPanes = tableUiPanes(false, []);
      check(dropdownPanes.some(p=>p[0]===15) && JSON.stringify(dropdownPanes.find(p=>p[0]===13))===JSON.stringify(beforeDropdown), 'Dropdown moved or expanded its parent pane');
      listbox.querySelectorAll('button')[1].click();
      check(dropdownInput.value==='b' && !document.querySelector('.nh3d-select-menu'), 'Dropdown selection did not commit');
      dropdownInput.remove();
      const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      document.querySelector('#character-setup-dialog-variant .nh3d-choice-button')?.click();
      await nextFrame();
      check(document.querySelector('#character-setup-dialog-choose.is-visible'), "Native menu click did not navigate");
      check(!document.querySelector('#character-setup-dialog-variant'), "Previous dialog did not unmount in VR");
      const { dispatchQuestKey } = await import('/src/quest/native/bootstrap.ts');
      dispatchQuestKey('Escape'); await nextFrame();
      check(document.querySelector('#character-setup-dialog-variant.is-visible'), "Controller Back did not return to variants");
      check(game.systems.engineState.session === null, "Menu navigation started a worker");
      const stats = document.createElement('div'); stats.id = 'stats-bar';
      stats.innerHTML = '<div>Adventurer</div><div class="nh3d-stats-meter">HP</div><div class="nh3d-stats-meter">Pw</div><div class="nh3d-stats-location">Dungeon</div>';
      document.body.append(stats);
      root.classList.remove('nh3d-xr-menu');
      const meter = stats.querySelector('.nh3d-stats-meter');
      const immersiveMeter = parseFloat(getComputedStyle(meter).minWidth);
      check(getComputedStyle(stats).justifyContent === 'center' && getComputedStyle(stats.lastElementChild).flexGrow === '0', 'Immersive stats are not centered');
      const statsRect = stats.getBoundingClientRect();
      check(Math.abs(statsRect.width - innerWidth * 2 / 3) < 1 && Math.abs((statsRect.left+statsRect.right)/2-innerWidth/2) < 1, 'Immersive stats width/alignment is not two-thirds');
      check(Math.abs((stats.firstElementChild.getBoundingClientRect().left + stats.lastElementChild.getBoundingClientRect().right)/2-innerWidth/2) < 1, 'Stats contents retain right-side empty space');
      const actionBar=document.createElement('div'); actionBar.className='nh3d-mobile-bottom-bar'; actionBar.textContent='Actions'; document.body.append(actionBar);
      const { updateWebXrState }=await import('/src/quest/webxr/presentation.ts');
      const { useGameStore }=await import('/src/state/gameStore.ts');
      const oldRepeat=useGameStore.getState().repeatActionVisible;
      updateWebXrState({active:true}); useGameStore.setState({repeatActionVisible:true});
      await nextFrame();
      const repeat=document.querySelector('.nh3d-mobile-repeat-button');
      check(repeat && repeat.getBoundingClientRect().bottom <= actionBar.getBoundingClientRect().top-7, 'Repeat is not above the action bar');
      useGameStore.setState({repeatActionVisible:oldRepeat}); updateWebXrState({active:false}); await nextFrame(); actionBar.remove();
      const popup = document.createElement('div'); popup.className = 'nh3d-context-menu nh3d-tile-context-menu is-visible'; popup.setAttribute('role','dialog'); popup.textContent = 'Context actions'; document.body.append(popup);
      check(Number(getComputedStyle(popup).zoom) === 1, 'Contextual action popup is still scaled down');
      root.classList.add('nh3d-xr-first-person');
      const popupRect = popup.getBoundingClientRect();
      check(popupRect.left > statsRect.right && popupRect.right <= innerWidth, 'FPS context source overlaps the central HUD');
      root.classList.remove('nh3d-xr-first-person');
      popup.remove();
      const gameplayModal = document.createElement('div'); gameplayModal.className = 'nh3d-dialog is-visible'; gameplayModal.textContent = 'Inventory'; document.body.append(gameplayModal);
      check(Number(getComputedStyle(gameplayModal).zoom)===1, 'Gameplay modals are still scaled down'); gameplayModal.remove();
      root.classList.remove('nh3d-webxr-active');
      await waitForViewport(1920, 1080);
      check(parseFloat(getComputedStyle(meter).minWidth) * 2 === immersiveMeter, 'Flat HP/Pw sizes changed or immersive width is not doubled');
      check(getComputedStyle(stats).justifyContent !== 'center', 'Flat status-bar alignment changed');
      check(logoRows[0].getAnimations().length > 0, 'Logo wave is missing outside immersive mode');
      stats.remove();
      root.classList.add('nh3d-webxr-active', 'nh3d-xr-menu');
      await waitForViewport(2560, 1440);
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { MenuRain } = await import('/src/quest/webxr/menu-rain.ts');
      const { setXrSettings } = await import('/src/quest/webxr/settings.ts');
      const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
      renderer.setSize(640, 640);
      let shaderError = false;
      renderer.debug.onShaderError = () => { shaderError = true; };
      const rain = new MenuRain();
      const atlas = rain.scene.children[0].material.uniforms.atlas.value.image;
      const halo = atlas.getContext('2d').getImageData(0,0,128,128).data;
      const sharp = document.createElement('canvas'); sharp.width = sharp.height = 128;
      const sharpContext = sharp.getContext('2d');
      sharpContext.font = '48px monospace'; sharpContext.textAlign = 'center'; sharpContext.textBaseline = 'middle';
      sharpContext.fillText('@',64,64);
      const core = sharpContext.getImageData(0,0,128,128).data;
      let haloPixels = 0, maximumAlpha = 0;
      for(let i=3;i<halo.length;i+=4) {
        if(core[i] === 0 && halo[i] > 1) haloPixels++;
        maximumAlpha = Math.max(maximumAlpha,halo[i]);
      }
      check(haloPixels > 100 && maximumAlpha < 180, 'Rain atlas lacks a faint core and soft surrounding glow');
      const camera = new THREE.PerspectiveCamera(90, 1, .03, 150);
      camera.position.set(0, 1.6, 0); rain.recenter(camera.position);
      setXrSettings({ rainCount: 1000, rainFallSpeed: 1.5, rainChangeRate: .3 });
      for (let time = 0; time <= 3000; time += 50) rain.update(time);
      const gl = renderer.getContext(), pixels = new Uint8Array(640 * 640 * 4);
      const directions = [[0,0,-1], [1,0,0], [0,0,1], [-1,0,0], [0,1,-.2], [0,-1,-.2]];
      const counts = directions.map(([x,y,z]) => {
        camera.lookAt(x, y + 1.6, z);
        renderer.render(rain.scene, camera);
        gl.readPixels(0,0,640,640,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let count = 0;
        for(let i=0;i<pixels.length;i+=4) if(pixels[i+1] > 3) count++;
        check(count > 100, "No rain pixels in direction " + [x,y,z]);
        return count;
      });
      check(!shaderError, "Rain shader failed to compile");
      check(renderer.info.render.calls === 1, "Rain must stay a single instanced draw");
      setXrSettings({ rainCount: 0 });
      rain.update(3100);
      check(rain.scene.children[0].geometry.instanceCount === 1000, "Removed letters vanished before fading");
      for (let time = 3200; time <= 5200; time += 100) rain.update(time);
      check(rain.scene.children[0].geometry.instanceCount === 0, "Removed letters did not retire after fade");
      setXrSettings({ rainCount: 1000 });
      // Freeze one front-facing glyph and compare actual GPU pixels through a
      // change boundary. A hard character swap would fail the continuity check.
      const mesh = rain.scene.children[0], geometry = mesh.geometry;
      geometry.instanceCount = 1;
      geometry.attributes.rainPosition.setXYZ(0, 0, 45, -3);
      geometry.attributes.variation.setXYZ(0, 1, 1, .125);
      geometry.attributes.visibility.setX(0, 1);
      for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
      mesh.material.uniforms.travel.value = 0;
      camera.lookAt(0, 1.6, -3);
      const sample = changes => {
        mesh.material.uniforms.changes.value = changes;
        renderer.render(rain.scene, camera);
        const image = new Uint8Array(pixels.length);
        gl.readPixels(0,0,640,640,gl.RGBA,gl.UNSIGNED_BYTE,image); return image;
      };
      const difference = (a,b) => a.reduce((total,value,i) => total + Math.abs(value-b[i]),0);
      const oldGlyph = sample(.65), blended = sample(.775), newGlyph = sample(.9);
      check(difference(oldGlyph,blended) > 100 && difference(blended,newGlyph) > 100, 'Glyph change does not crossfade');
      check(difference(sample(.87499),sample(.87501)) < difference(oldGlyph,newGlyph) * .01, 'Glyph pops at a change boundary');
      rain.dispose();
      const { TableMoveHandle } = await import('/src/quest/webxr/table-move-handle.ts');
      const handleScene = new THREE.Scene(), handleRoot = new THREE.Group(); handleScene.add(handleRoot);
      const tableHandle = new TableMoveHandle(handleRoot);
      tableHandle.place(new THREE.Vector3(0,1,-1.55),new THREE.Quaternion(),Math.PI/3,true);
      const handleMesh = handleRoot.children[0]; camera.lookAt(handleMesh.position); renderer.render(handleScene,camera);
      gl.readPixels(0,0,640,640,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let handlePixels=0; for(let i=0;i<pixels.length;i+=4) if(pixels[i+2]>15 && pixels[i+1]>10) handlePixels++;
      check(handlePixels>100 && tableHandle.hit(new THREE.Ray(camera.position.clone(),handleMesh.position.clone().sub(camera.position).normalize())), 'Table capsule is not visible/pickable');
      tableHandle.dispose(); renderer.dispose();
      // Exercise the real engine's promotion/reset without launching a worker
      // from this layout fixture. Session ownership is covered by XR unit tests.
      const liveRenderer = game.systems.renderPipeline.renderer;
      const connect = game.connectToRuntime;
      let starts = 0;
      game.connectToRuntime = async () => { starts++; };
      try {
        const config = { mode: "create", playMode: "normal", runtimeVersion: "3.6.7" };
        game.startGame(config, game.systems.engineState.clientOptions);
        check(starts === 1 && !game.startupOnly, "Selected game was not started exactly once");
        check(game.systems.engineState.characterCreationConfig === config, "Character selection was lost");
        check(game.systems.renderPipeline.renderer === liveRenderer, "Menu promotion replaced the renderer");
        game.systems.playerStatus.playerStats.hp = 1;
        game.systems.engineMessages.gameMessages = ['previous game'];
        game.returnToStartupMenu();
        check(game.startupOnly && game.systems.engineState.session === null, "Return did not restore the front end");
        check(game.systems.renderPipeline.renderer === liveRenderer, "Return replaced the renderer");
        check(game.systems.playerStatus.playerStats.hp === 10 && !game.systems.engineMessages.gameMessages.length, "Previous character state leaked into the next game");
      } finally { game.connectToRuntime = connect; }
      return { panes, rainPixels: counts, viewport: [innerWidth,innerHeight] };
    })()`,
  });
  if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description ?? evaluated.exceptionDetails.text);
  await smokeStartupNameInputs(cdp);
  console.log("VR menu DOM/GPU smoke:", JSON.stringify(evaluated.result.value));
}
