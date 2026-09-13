#!/usr/bin/env python3
"""Apply the opt-in HTML painting fix to the matching GeckoView source."""
from pathlib import Path
import subprocess
import sys

revision = "dc6d11938934f4490158a1334dda9d143dffab46"
root = Path(sys.argv[1]).resolve()
actual = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
if actual != revision:
    raise SystemExit("Unexpected Gecko source revision: " + actual)
target = root / "layout/base/nsRefreshDriver.cpp"
source = target.read_text()
marker = "dom.vr.webxr.paint-document"
if marker not in source:
    old = "  if (IsPresentingInVR()) {"
    if source.count(old) != 1:
        raise SystemExit("Gecko paint guard changed; inspect before applying.")
    source = source.replace(old, '  if (IsPresentingInVR() &&\n      !mozilla::Preferences::GetBool("dom.vr.webxr.paint-document", false)) {')
    if '#include "mozilla/Preferences.h"' not in source:
        include = '#include "nsRefreshDriver.h"'
        if source.count(include) != 1:
            raise SystemExit("Cannot locate refresh-driver includes.")
        source = source.replace(include, include + '\n#include "mozilla/Preferences.h"')
    target.write_text(source)
print("Gecko HTML painting patch applied at " + str(target))
target = root / "layout/base/PresShell.cpp"
source = target.read_text()
marker = "dom.vr.webxr.transparent-document"
if marker not in source:
    for signature, result in [
        ("bool PresShell::IsTransparentContainerElement() const {", "true"),
        ("nscolor PresShell::ComputeBackstopColor(nsIFrame* aDisplayRoot) {", "NS_RGBA(0, 0, 0, 0)"),
    ]:
        if source.count(signature) != 1:
            raise SystemExit("Gecko document background implementation changed")
        source = source.replace(signature, signature + '\n#ifdef MOZ_WIDGET_ANDROID\n  if (Preferences::GetBool("' + marker + '", false)) {\n    return ' + result + ';\n  }\n#endif')
    target.write_text(source)
print("Gecko transparent document patch applied at " + str(target))
