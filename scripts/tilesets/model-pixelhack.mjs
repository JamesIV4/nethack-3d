import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, createWriteStream, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const candidates = [process.env.BLENDER_PATH,
  'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe',
  '/Applications/Blender.app/Contents/MacOS/Blender', '/usr/bin/blender'].filter(Boolean);
const blender = candidates.find(existsSync) ?? 'blender';
const logDir = path.join(root, 'tools/pixelhack-reference/exports');
mkdirSync(logDir, { recursive: true });
const logPath = path.join(logDir, 'model-run.log');
const log = createWriteStream(logPath);
console.log('Generating PixelHack asset and review renders. Full log:', logPath);
const processHandle = spawn(blender, ['--background', '--factory-startup', '--python-exit-code', '1',
  '--python', path.join(root, 'scripts/tilesets/pixelhack-model.py'), '--', ...args], { cwd: root, windowsHide: true });
processHandle.stdout.pipe(log, { end: false });
processHandle.stderr.pipe(log, { end: false });
processHandle.on('error', (error) => { console.error(`${error.message}. Set BLENDER_PATH to your Blender executable.`); process.exitCode = 1; });
processHandle.on('close', (code) => {
  log.end(async () => {
    const lines = readFileSync(logPath, 'utf8').split(/\r?\n/);
    const result = lines.find((line) => line.startsWith('PIXELHACK_RESULT='));
    if (code !== 0 || !result) {
      console.error(lines.slice(-25).join('\n'));
      process.exitCode = code || 1;
    } else {
      const asset = JSON.parse(result.slice('PIXELHACK_RESULT='.length));
      try {
        await run(process.execPath, [path.join(root, 'scripts/tilesets/verify-pixelhack-model.mjs'), asset.directory]);
        await run(process.platform === 'win32' ? 'py' : 'python3', [path.join(root, 'scripts/tilesets/review-pixelhack-model.py'),
          '--directory', asset.directory, '--tile', String(asset.tileIds[0])]);
        console.log(JSON.stringify(asset, null, 2));
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
      }
    }
  });
});

function run(executable, argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argv, { cwd: root, windowsHide: true, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${executable} exited with ${code}`)));
  });
}
