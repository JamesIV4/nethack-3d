#!/usr/bin/env python3
"""Stage the locally built Maven module, including its transitive dependency metadata."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

source = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
revision = "dc6d11938934f4490158a1334dda9d143dffab46"
if subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip() != revision:
    raise SystemExit("Unexpected Gecko source revision")
module_root = source / "obj-nh3d/gradle/maven/org/mozilla/geckoview/geckoview-default-omni"
candidates = list(module_root.glob("*/*.aar"))
if not candidates:
    raise SystemExit("No published GeckoView AAR at " + str(module_root))
aar = max(candidates, key=lambda item: item.stat().st_mtime)
with zipfile.ZipFile(aar) as archive:
    library = archive.read("jni/arm64-v8a/libxul.so")
    if b"dom.vr.webxr.paint-document" not in library:
        raise SystemExit("GeckoView binary is missing the HTML painting patch")
    if b"dom.vr.webxr.transparent-document" not in library:
        raise SystemExit("GeckoView binary is missing document transparency")
    if b"dom.vr.webxr.composite-document" not in library:
        raise SystemExit("GeckoView binary is missing immersive HTML composition")
    library_hash = hashlib.sha256(library).hexdigest()
del library
version = aar.parent.name
module = "geckoview-default-omni"
relative = Path("maven/org/mozilla/geckoview") / module / version
destination = output / relative
destination.mkdir(parents=True, exist_ok=True)
for suffix in [".aar", ".pom", ".module"]:
    if not aar.with_suffix(suffix).is_file():
        raise SystemExit("Missing Maven metadata: " + suffix)
files = {}
for item in aar.parent.iterdir():
    if item.is_file():
        target = destination / item.name
        shutil.copy2(item, target)
        with target.open("rb") as data:
            files[(relative / item.name).as_posix()] = hashlib.file_digest(data, "sha256").hexdigest()
receipt = {
    "schema": 1,
    "revision": revision,
    "paintDocument": True,
    "transparentDocument": True,
    "compositeDocument": True,
    "patchSha256": hashlib.sha256(Path(__file__).with_name("patch-gecko-paint.py").read_bytes()).hexdigest(),
    "coordinate": "org.mozilla.geckoview:" + module + ":" + version,
    "aar": (relative / aar.name).as_posix(),
    "libxulSha256": library_hash,
    "files": files,
}
(output / "nh3d-gecko-runtime.json").write_text(json.dumps(receipt, indent=2) + "\n")
print("Staged patched GeckoView at " + str(output))
