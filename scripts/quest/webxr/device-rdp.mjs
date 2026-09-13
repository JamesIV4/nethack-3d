import net from "node:net";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const adb = path.join(process.env.LOCALAPPDATA, "Android/Sdk/platform-tools/adb.exe");
const serial = process.env.QUEST_SERIAL ?? "2G0YC5ZF9J05S8";
const socketName = "com.nethack3d.quest.webxrproof/firefox-debugger-socket";
const port = Number(execFileSync(adb, ["-s", serial, "forward", "tcp:0", "localabstract:" + socketName], { encoding: "utf8", windowsHide: true }).trim());
let connection;
try {
  connection = net.createConnection({ host: "127.0.0.1", port });
  let buffer = Buffer.alloc(0), messages = [], waiters = [];
  connection.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const colon = buffer.indexOf(58);
      if (colon < 0) break;
      const length = Number(buffer.subarray(0, colon).toString());
      if (!Number.isSafeInteger(length) || length > 20_000_000) throw new Error("Invalid debugger packet.");
      if (buffer.length < colon + 1 + length) break;
      const message = JSON.parse(buffer.subarray(colon + 1, colon + 1 + length).toString());
      buffer = buffer.subarray(colon + 1 + length);
      const waiter = waiters.find((entry) => entry.test(message));
      if (waiter) { waiters = waiters.filter((entry) => entry !== waiter); waiter.resolve(message); }
      else messages.push(message);
    }
  });
  function receive(test) {
    const ready = messages.find(test);
    if (ready) { messages = messages.filter((message) => message !== ready); return Promise.resolve(ready); }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Debugger response timed out.")), 15000);
      waiters.push({ test, resolve: (value) => { clearTimeout(timeout); resolve(value); } });
    });
  }
  function send(value) {
    const json = JSON.stringify(value);
    connection.write(Buffer.byteLength(json) + ":" + json);
  }
  const hello = await receive((message) => message.from === "root");
  send({ to: "root", type: "listTabs" });
  const list = await receive((message) => Array.isArray(message.tabs) || message.error);
  if (process.argv[2] !== "--eval-file" && process.argv[2] !== "--console") {
    console.log(JSON.stringify({ hello, list }, null, 2));
  } else {
    const tab = list.tabs?.find((entry) => entry.url?.startsWith("http://127.0.0.1:18973/"));
    if (!tab) throw new Error("The bundled game tab is not available: " + JSON.stringify(list));
    send({ to: tab.actor, type: "getTarget" });
    const target = await receive((message) => message.from === tab.actor && (message.frame || message.target || message.error));
    if (target.error) throw new Error(JSON.stringify(target));
    const form = target.frame ?? target.target;
    const consoleActor = form.consoleActor;
    if (!consoleActor) throw new Error("No console actor: " + JSON.stringify(target));
    if (process.argv[2] === "--console") {
      send({ to: consoleActor, type: "getCachedMessages", messageTypes: ["PageError", "ConsoleAPI"] });
      const cached = await receive((message) => message.from === consoleActor && (message.messages || message.error));
      console.log(JSON.stringify(cached, null, 2));
    } else {
    const expression = readFileSync(process.argv[3], "utf8");
    send({ to: consoleActor, type: "evaluateJSAsync", text: expression, options: {} });
    const started = await receive((message) => message.from === consoleActor && (message.resultID || message.error));
    if (started.error) throw new Error(JSON.stringify(started));
    const result = await receive((message) => message.type === "evaluationResult" && message.resultID === started.resultID);
    console.log(JSON.stringify(result, null, 2));
    }
  }
} finally {
  connection?.destroy();
  execFileSync(adb, ["-s", serial, "forward", "--remove", "tcp:" + port], { windowsHide: true });
}
