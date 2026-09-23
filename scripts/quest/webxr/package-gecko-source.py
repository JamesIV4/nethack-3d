#!/usr/bin/env python3
"""Package exact modified Gecko sources, notices, and the reproducible patch recipe."""
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

source = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
scripts = Path(__file__).resolve().parent
revision = "dc6d11938934f4490158a1334dda9d143dffab46"

def git(*args):
    return subprocess.check_output(["git", "-C", str(source), *args])

if git("rev-parse", "HEAD").decode().strip() != revision:
    raise SystemExit("Unexpected Gecko revision")
changed = git("diff", "HEAD", "--name-only").decode().splitlines()
expected = {
    "dom/vr/XRNativeOriginLocalFloor.cpp", "gfx/layers/ipc/CompositorVsyncScheduler.cpp",
    "layout/base/PresShell.cpp", "layout/base/nsRefreshDriver.cpp", "modules/libpref/init/StaticPrefList.yaml",
}
if set(changed) != expected:
    raise SystemExit("Gecko source changes differ from the five published patch targets")
if output.exists():
    raise SystemExit("Refusing to overwrite source archive: " + str(output))

with tempfile.TemporaryDirectory(prefix="nh3d-gecko-source-") as temporary:
    root = Path(temporary)
    check = root / "check"
    check.mkdir()
    # The patcher's only Git operation checks HEAD. This temporary worktree shares
    # objects but never invokes checkout or changes the original index/worktree.
    git_dir = git("rev-parse", "--absolute-git-dir").decode().strip()
    (check / ".git").write_text("gitdir: " + git_dir + "\n")
    for name in changed:
        target = check / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(git("show", "HEAD:" + name))
    subprocess.run([sys.executable, str(scripts / "patch-gecko-paint.py"), str(check)], check=True)
    for name in changed:
        if (check / name).read_bytes() != (source / name).read_bytes():
            raise SystemExit("Source is not reproduced by the published patch: " + name)

    package = root / "source"
    package.mkdir()
    for name in changed + ["LICENSE", "toolkit/content/license.html"]:
        target = package / "firefox" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((source / name).read_bytes())
    (package / "gecko.patch").write_bytes(git("diff", "HEAD", "--binary"))
    for name in ["patch-gecko-paint.py", "build-gecko-runtime.sh", "stage-gecko-runtime.py", "package-gecko-source.py"]:
        (package / name).write_bytes((scripts / name).read_bytes())
    (package / "README.md").write_text(
        "# NetHack 3D patched GeckoView source\n\n"
        "Upstream source (all unmodified files and third-party notices):\n"
        f"https://github.com/mozilla-firefox/firefox/tree/{revision}\n\n"
        f"Pinned revision: `{revision}`. The firefox/ directory contains the complete modified files; "
        "gecko.patch contains the corresponding changes. Firefox source retains its original MPL 2.0 "
        "and third-party licenses; see firefox/LICENSE and firefox/toolkit/content/license.html.\n\n"
        "To reconstruct the source, clone the upstream repository, check out the pinned revision, "
        "then run `git apply /path/to/gecko.patch`. To build from the NetHack 3D checkout, "
        "run `bash scripts/quest/webxr/build-gecko-runtime.sh` on Linux/WSL. "
        "The included scripts document bootstrap, mozconfig, build, and Maven packaging.\n",
        encoding="utf-8",
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output, "w:gz") as archive:
        for item in sorted(package.rglob("*")):
            if item.is_file():
                archive.add(item, arcname=item.relative_to(package), recursive=False)
print("Verified and packaged corresponding Gecko sources: " + str(output))
