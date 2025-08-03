// Test using the original @neth4ck/neth4ck package to see the proper callback sequence
const nethackStart = require("@neth4ck/neth4ck");

console.log("🧪 Testing original @neth4ck/neth4ck package...");

function testCallback(name, ...args) {
  console.log(`🔔 UI Callback: ${name}`, args);

  switch (name) {
    case "shim_create_nhwindow":
      console.log("creating window, returning 1");
      return 1;
    case "shim_yn_function":
    case "shim_message_menu":
      console.log("Yes/no question, returning 'y'");
      return 121; // return 'y' to all questions
    case "shim_nhgetch":
    case "shim_nh_poskey":
      console.log("Getting key, returning space");
      return 32; // space key
    case "shim_player_selection":
      console.log("Player selection, returning 0");
      return 0;
    case "shim_start_menu":
      console.log("Starting menu");
      return 0;
    case "shim_end_menu":
      console.log("Ending menu");
      return 0;
    case "shim_add_menu":
      const [
        winid,
        glyph,
        accelerator,
        groupacc,
        menuAttr,
        menuStr,
        preselected,
      ] = args;
      console.log(
        `📋 MENU ITEM: "${menuStr}" (key: ${String.fromCharCode(
          accelerator || 32
        )})`
      );
      return 0;
    case "shim_select_menu":
      console.log("Menu selection request");
      return 1;
    case "shim_putstr":
      const [win, textAttr, textStr] = args;
      console.log(`💬 TEXT [Win ${win}]: "${textStr}"`);
      return 0;
    case "shim_display_nhwindow":
      console.log(`📺 DISPLAY WINDOW [Win ${args[0]}]`);
      return 0;
    default:
      console.log("Default case, returning 0");
      return 0;
  }
}

try {
  console.log("Starting NetHack with original package...");
  nethackStart(testCallback);
  console.log("NetHack started successfully!");
} catch (error) {
  console.error("Error starting NetHack:", error);
}
