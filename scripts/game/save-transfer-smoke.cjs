// Run with: npx electron scripts/game/save-transfer-smoke.cjs
// Requires the Vite dev server at http://127.0.0.1:5178 (or NH3D_SMOKE_URL).
// Uses a disposable profile; never reads or modifies the player's saves.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "nh3d-save-transfer-"));
app.setPath("userData", path.join(evidenceDir, "profile"));

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { backgroundThrottling: false } });
  const run = fn => window.webContents.executeJavaScript(`(${fn.toString()})()`);
  try {
    await window.loadURL(process.env.NH3D_SMOKE_URL || "http://127.0.0.1:5178");
    const results = await run(async () => {
      document.documentElement.classList.add("nh3d-disable-animated-transitions");
      const { importSavedGame, exportSavedGame, SaveTransferError } = await import("/src/ui/app/startup/save-transfer.ts");
      const { fetchSavedGames, deleteSavedGame } = await import("/src/ui/app/startup/saved-games.ts");
      const { getRuntimeSaveCompatTag, getRuntimeSaveDbName } = await import("/src/runtime/save-storage.ts");
      const assert = (condition, message) => { if (!condition) throw new Error(message); };
      const results = [];
      for (const runtimeVersion of ["3.6.7", "5.0", "slashem"]) {
        for (const category of ["manual", "autosave"]) {
          const name = category === "manual" ? "TransferTest" : "CheckpointTest";
          const contents = btoa(String.fromCharCode(...Array.from({ length: 256 }, (_, i) => i)));
          const archive = {
            format: "nh3d-save", version: 1, runtimeVersion,
            compatTag: getRuntimeSaveCompatTag(runtimeVersion), dbName: getRuntimeSaveDbName(runtimeVersion),
            name, category, displayName: `${name} display`, playMode: "explore", initOptions: ["!autopickup"],
            files: (category === "manual" ? [""] : [".0", ".1", ".2"]).map(suffix => ({
              key: `/save/0${name}${suffix}`, timestamp: "2026-10-04T12:00:00.000Z", contents,
            })),
          };
          const text = JSON.stringify(archive);
          await importSavedGame(text, runtimeVersion);
          let save = (await fetchSavedGames(runtimeVersion)).find(save => save.name === name);
          assert(save && save.displayName === archive.displayName, "Imported character metadata missing");
          assert(save.displayPlayMode === "explore" && save.initOptions.includes("!autopickup"), "Character settings lost");
          let exported = JSON.parse(await exportSavedGame(save, runtimeVersion));
          assert(JSON.stringify(exported.files) === JSON.stringify(archive.files), "File bytes, paths or timestamps changed");
          try { await importSavedGame(text, runtimeVersion); throw new Error("Duplicate import accepted"); }
          catch (error) { assert(error instanceof SaveTransferError && error.code === "exists", "Wrong duplicate error"); }
          await deleteSavedGame(save);
          await importSavedGame(JSON.stringify(exported), runtimeVersion);
          save = (await fetchSavedGames(runtimeVersion)).find(save => save.name === name);
          exported = JSON.parse(await exportSavedGame(save, runtimeVersion));
          assert(JSON.stringify(exported.files) === JSON.stringify(archive.files), "Round-trip bytes changed");
          results.push(`${runtimeVersion} ${category}: bytes, timestamps, metadata, duplicate protection and round trip passed`);
        }
      }
      // A storage collision must roll back every shard, even when discovery
      // ignores the pre-existing record because it lacks a timestamp.
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(getRuntimeSaveDbName("3.6.7"));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const read = key => new Promise((resolve, reject) => {
        const request = db.transaction("FILE_DATA").objectStore("FILE_DATA").get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("FILE_DATA", "readwrite");
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
        tx.objectStore("FILE_DATA").add({ contents: new Uint8Array([42]) }, "/save/0AbortTest.1");
      });
      const rollbackArchive = {
        format: "nh3d-save", version: 1, runtimeVersion: "3.6.7",
        compatTag: getRuntimeSaveCompatTag("3.6.7"), dbName: getRuntimeSaveDbName("3.6.7"),
        name: "AbortTest", category: "autosave", displayName: "AbortTest", playMode: null, initOptions: [],
        files: [0, 1].map(level => ({ key: `/save/0AbortTest.${level}`, timestamp: new Date().toISOString(), contents: "AAEC" })),
      };
      let rejected = false;
      try { await importSavedGame(JSON.stringify(rollbackArchive), "3.6.7"); } catch { rejected = true; }
      assert(rejected, "Storage collision was not rejected");
      assert(await read("/save/0AbortTest.0") === undefined, "Partial checkpoint survived failed import");
      assert((await read("/save/0AbortTest.1")).contents[0] === 42, "Existing bytes overwritten");
      const controller = new AbortController();
      controller.abort();
      try { await importSavedGame(JSON.stringify(rollbackArchive), "3.6.7", controller.signal); throw new Error("Cancelled import ran"); }
      catch (error) { assert(error.name === "AbortError", "Cancelled import was not aborted"); }
      db.close();
      results.push("Failed imports roll back all files; cancelled imports leave storage untouched");
      return results;
    });
    for (const result of results) console.log(result);
    // Allow startup presentation to finish, then use the actual options pane.
    await run(async () => {
      const waitFor = async find => {
        for (let i = 0; i < 200; i++) { const element = find(); if (element) return element; await new Promise(r => setTimeout(r, 100)); }
        throw new Error("Timed out waiting for startup controls: " + document.body.innerText.slice(-1500));
      };
      const buttons = () => [...document.querySelectorAll("button")].filter(button => button.getBoundingClientRect().height > 0);
      (await waitFor(() => buttons().find(button => button.textContent.includes("NetHack 3.6.7")))).click();
      (await waitFor(() => buttons().find(button => button.textContent.trim().endsWith("Options")))).click();
      (await waitFor(() => document.getElementById("nh3d-client-options-tab-saves"))).click();
      await waitFor(() => document.querySelector('[aria-label="Export save: TransferTest display"]'));
    });
    await run(async () => {
      const { exportSavedGame } = await import("/src/ui/app/startup/save-transfer.ts");
      const { fetchSavedGames } = await import("/src/ui/app/startup/saved-games.ts");
      const save = (await fetchSavedGames("3.6.7")).find(save => save.name === "TransferTest");
      const archive = JSON.parse(await exportSavedGame(save, "3.6.7"));
      archive.name = "ImportedFromUi";
      archive.displayName = "Imported from file";
      archive.files[0].key = "/save/0ImportedFromUi";
      const transfer = new DataTransfer();
      transfer.items.add(new File([JSON.stringify(archive)], "test.nh3dsave", { type: "application/json" }));
      const input = document.querySelector('#nh3d-client-options-panel input[type="file"]');
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      for (let i = 0; i < 100; i++) {
        if (document.querySelector('[aria-label="Export save: Imported from file"]')) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error("Imported save did not appear in options");
    });
    const downloaded = new Promise((resolve, reject) => {
      window.webContents.session.once("will-download", (_event, item) => {
        item.setSavePath(path.join(evidenceDir, item.getFilename()));
        item.once("done", (_event, state) => state === "completed" ? resolve() : reject(new Error(state)));
      });
    });
    await run(() => document.querySelector('[aria-label="Export save: Imported from file"]').click());
    await downloaded;
    console.log("Options file import and export download passed");
    window.setSize(1281, 900);
    await new Promise(resolve => setTimeout(resolve, 1500));
    fs.writeFileSync(path.join(evidenceDir, "saves-desktop.png"), (await window.webContents.capturePage()).toPNG());
    window.setSize(430, 850);
    await new Promise(resolve => setTimeout(resolve, 500));
    fs.writeFileSync(path.join(evidenceDir, "saves-mobile.png"), (await window.webContents.capturePage()).toPNG());
    console.log(`Screenshots: ${evidenceDir}`);
    app.exit(0);
  } catch (error) {
    console.error(error);
    console.log(`Evidence: ${evidenceDir}`);
    fs.writeFileSync(path.join(evidenceDir, "failure.png"), (await window.webContents.capturePage()).toPNG());
    app.exit(1);
  }
});
