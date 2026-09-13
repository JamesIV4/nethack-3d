#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/../../.." && pwd)
source_dir=${QUEST_GECKO_SOURCE:-"$HOME/.cache/nethack-quest-gecko/firefox"}
revision=dc6d11938934f4490158a1334dda9d143dffab46
jobs=${QUEST_GECKO_JOBS:-4}

if [[ ! -d "$source_dir/.git" ]]; then
  mkdir -p "$source_dir"
  git -C "$source_dir" init
  git -C "$source_dir" remote add origin https://github.com/mozilla-firefox/firefox.git
  git -C "$source_dir" fetch --depth=1 origin "$revision"
  git -C "$source_dir" checkout --detach FETCH_HEAD
fi
[[ $(git -C "$source_dir" rev-parse HEAD) == "$revision" ]] || { echo "Unexpected Gecko revision"; exit 1; }
cd "$source_dir"
mkdir -p artifacts
if [[ ! -f artifacts/nh3d-bootstrap-complete ]]; then
  ./mach --no-interactive bootstrap --application-choice=mobile_android --no-system-changes > artifacts/nh3d-bootstrap.log 2>&1
  touch artifacts/nh3d-bootstrap-complete
fi
if [[ ! -x "$HOME/.mozbuild/rustc/bin/rustc" ]]; then
  (cd "$HOME/.mozbuild" && "$source_dir/mach" --no-interactive artifact toolchain --from-build linux64-rust-android) > artifacts/nh3d-rust.log 2>&1
fi
export PATH="$HOME/.mozbuild/rustc/bin:$PATH"
python3 "$repo/scripts/quest/webxr/patch-gecko-paint.py" "$source_dir"
cat > mozconfig <<EOF
ac_add_options --enable-project=mobile/android
ac_add_options --target=aarch64
ac_add_options --disable-debug
ac_add_options --enable-debug-symbols=-g1
ac_add_options --disable-tests
mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/obj-nh3d
mk_add_options MOZ_MAKE_FLAGS=-j$jobs
EOF
echo "Building Gecko; progress: $source_dir/artifacts/nh3d-build.log"
./mach --no-interactive build -j"$jobs" > artifacts/nh3d-build.log 2>&1
echo "Publishing the GeckoView AAR; progress: $source_dir/artifacts/nh3d-package.log"
./mach --no-interactive gradle geckoview:publishDebugPublicationToMavenRepository > artifacts/nh3d-package.log 2>&1
python3 "$repo/scripts/quest/webxr/stage-gecko-runtime.py" "$source_dir" "$repo/quest/runtime/gecko"
