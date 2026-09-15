import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
export function patchUiLayout(checkout) {
  const file = path.join(checkout,"app/src/main/cpp/BrowserWorld.cpp");
  const source = readFileSync(file,"utf8").replaceAll("\r\n","\n");
  writeFileSync(file, source.replace("3.0f*gamePointerState[19]/width, 3.0f*gamePointerState[19]/width, 3.0f*gamePointerState[19]/width", "3.0f/width, 3.0f/width, 3.0f/width"));
}
