// Test the async approach with automated input
const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:3002");

const inputSequence = [
  "James", // Player name
  "a", // Archeologist
  "h", // Human
  "m", // Male
  "y", // Continue
  ".", // Wait/rest
  "h", // Move left
  "h", // Move left again
  "l", // Move right
  "j", // Move down
  "k", // Move up
  ".", // Wait
  "q", // Quit
  "y", // Yes, quit
];

let inputIndex = 0;

ws.on("open", function open() {
  console.log("Connected to NetHack server");

  // Send first input after a delay
  setTimeout(() => {
    sendNextInput();
  }, 2000);
});

function sendNextInput() {
  if (inputIndex < inputSequence.length) {
    const input = inputSequence[inputIndex++];
    console.log(`Sending input: ${input}`);
    ws.send(JSON.stringify({ type: "input", input: input }));

    // Send next input after delay
    setTimeout(() => {
      sendNextInput();
    }, 1000);
  } else {
    console.log("All inputs sent");
    setTimeout(() => {
      ws.close();
    }, 5000);
  }
}

ws.on("message", function message(data) {
  try {
    const msg = JSON.parse(data);
    console.log("Received:", msg.type, msg.text || "");

    // If we get a question, send appropriate response
    if (msg.type === "question") {
      console.log(`Question: ${msg.text}`);
      if (msg.choices && msg.choices.includes("y")) {
        setTimeout(() => {
          console.log("Auto-responding with y");
          ws.send(JSON.stringify({ type: "input", input: "y" }));
        }, 500);
      }
    }
  } catch (e) {
    console.log("Raw message:", data.toString());
  }
});

ws.on("close", function close() {
  console.log("Disconnected from server");
  process.exit(0);
});

ws.on("error", function error(err) {
  console.error("WebSocket error:", err);
});
