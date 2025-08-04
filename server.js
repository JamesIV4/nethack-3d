const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

class NetHackSession {
  constructor(ws) {
    this.ws = ws;
    this.nethackInstance = null;
    this.gameMap = new Map();
    this.playerPosition = { x: 0, y: 0 };
    this.gameMessages = [];
    this.currentMenuItems = [];
    this.pendingMenuItems = []; // Store menu items from shim_end_menu for shim_yn_function
    this.currentWindow = null;
    this.hasShownCharacterSelection = false;
    this.lastQuestionText = null; // Store the last question for menu expansion

    // Menu accelerator mapping for fixing pointer values
    this.menuAcceleratorMap = null;
    this.menuAcceleratorCounter = 0;

    // Simplified input handling with async support
    this.latestInput = null;
    this.waitingForInput = false;
    this.waitingForPosition = false;
    this.inputResolver = null;
    this.positionResolver = null;

    // Add cooldown for position requests
    this.lastInputTime = 0;
    this.inputCooldown = 100; // 100ms cooldown

    this.initializeNetHack();
  }

  // Handle incoming input from the client
  handleClientInput(input) {
    console.log("🎮 Received client input:", input);

    // Store the input for potential reuse
    this.latestInput = input;
    this.lastInputTime = Date.now();

    // If we're waiting for general input, resolve the promise immediately
    if (this.waitingForInput && this.inputResolver) {
      console.log("🎮 Resolving waiting input promise with:", input);
      this.waitingForInput = false;
      const resolver = this.inputResolver;
      this.inputResolver = null;
      resolver(this.processKey(input));
      return;
    }

    // If we're waiting for position input, resolve that promise
    if (this.waitingForPosition && this.positionResolver) {
      console.log("🎮 Resolving waiting position promise with:", input);
      this.waitingForPosition = false;
      const resolver = this.positionResolver;
      this.positionResolver = null;
      resolver(this.processKey(input));
      return;
    }

    // Otherwise, just store for later use (for synchronous phases like character creation)
    console.log("🎮 Storing input for later use:", input);
  }

  // Handle request for tile update from client
  handleTileUpdateRequest(x, y) {
    console.log(`🔄 Client requested tile update for (${x}, ${y})`);

    const key = `${x},${y}`;
    const tileData = this.gameMap.get(key);

    if (tileData) {
      console.log(`📤 Resending tile data for (${x}, ${y}):`, tileData);

      if (this.ws && this.ws.readyState === 1) {
        this.ws.send(
          JSON.stringify({
            type: "map_glyph",
            x: tileData.x,
            y: tileData.y,
            glyph: tileData.glyph,
            char: tileData.char,
            color: tileData.color,
            window: 2, // WIN_MAP
            isRefresh: true, // Mark this as a refresh to distinguish from new data
          })
        );
      }
    } else {
      console.log(
        `⚠️ No tile data found for (${x}, ${y}) - tile may not be explored yet`
      );

      // Optionally, we could send a "blank" tile or request NetHack to redraw the area
      if (this.ws && this.ws.readyState === 1) {
        this.ws.send(
          JSON.stringify({
            type: "tile_not_found",
            x: x,
            y: y,
            message: "Tile data not available - may not be explored yet",
          })
        );
      }
    }
  }

  // Handle request for area update from client
  handleAreaUpdateRequest(centerX, centerY, radius = 3) {
    console.log(
      `🔄 Client requested area update centered at (${centerX}, ${centerY}) with radius ${radius}`
    );

    let tilesRefreshed = 0;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const key = `${x},${y}`;
        const tileData = this.gameMap.get(key);

        if (tileData) {
          if (this.ws && this.ws.readyState === 1) {
            this.ws.send(
              JSON.stringify({
                type: "map_glyph",
                x: tileData.x,
                y: tileData.y,
                glyph: tileData.glyph,
                char: tileData.char,
                color: tileData.color,
                window: 2, // WIN_MAP
                isRefresh: true,
                isAreaRefresh: true,
              })
            );
          }
          tilesRefreshed++;
        }
      }
    }

    console.log(
      `📤 Refreshed ${tilesRefreshed} tiles in area around (${centerX}, ${centerY})`
    );

    // Send completion message
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(
        JSON.stringify({
          type: "area_refresh_complete",
          centerX: centerX,
          centerY: centerY,
          radius: radius,
          tilesRefreshed: tilesRefreshed,
        })
      );
    }
  }

  // Helper method for key processing
  processKey(key) {
    // With number_pad:1 option, translate arrow keys to numpad equivalents
    if (key === "ArrowLeft") return "4".charCodeAt(0);
    if (key === "ArrowRight") return "6".charCodeAt(0);
    if (key === "ArrowUp") return "8".charCodeAt(0);
    if (key === "ArrowDown") return "2".charCodeAt(0);
    if (key === "Escape") return 27;
    if (key.length > 0) return key.charCodeAt(0);
    return 0; // Default for empty/unknown input
  }

  async initializeNetHack() {
    try {
      console.log("Starting NetHack session...");
      const factory = require("./public/nethack.js");
      const wasmPath = path.join(__dirname, "public", "nethack.wasm");
      console.log("Loading WASM from:", wasmPath);
      const wasmBinary = fs.readFileSync(wasmPath);
      console.log("WASM binary loaded, size:", wasmBinary.length);

      globalThis.nethackCallback = (name, ...args) => {
        return this.handleUICallback(name, args);
      };

      if (!globalThis.nethackGlobal) {
        console.log("🌐 Setting up globalThis.nethackGlobal...");
        globalThis.nethackGlobal = {
          constants: {
            WIN_TYPE: {
              1: "WIN_MESSAGE",
              2: "WIN_MAP",
              3: "WIN_STATUS",
              4: "WIN_INVEN",
            },
            STATUS_FIELD: {},
            MENU_SELECT: { PICK_NONE: 0, PICK_ONE: 1, PICK_ANY: 2 },
          },
          helpers: {
            getPointerValue: (name, ptr, type) => {
              if (type === "s" && this.nethackModule) {
                return this.nethackModule.UTF8ToString(ptr);
              }
              return ptr;
            },
          },
          globals: { WIN_MAP: 2, WIN_INVEN: 4, WIN_STATUS: 3, WIN_MESSAGE: 1 },
        };
        console.log("✅ globalThis.nethackGlobal set up");
      }

      const Module = {
        wasmBinary: wasmBinary,
        locateFile: (path, scriptDirectory) => {
          console.log(
            "locateFile called with:",
            path,
            "scriptDirectory:",
            scriptDirectory
          );
          if (path.endsWith(".wasm")) {
            return wasmPath;
          }
          return path;
        },
        preRun: [
          () => {
            console.log("PreRun: Setting up NETHACKOPTIONS");
            Module.ENV.NETHACKOPTIONS = "pickup_types:$,number_pad:1";
          },
        ],
        onRuntimeInitialized: async () => {
          console.log("NetHack WASM runtime initialized!");
          this.nethackModule = Module;
          try {
            console.log("Setting up graphics callback...");
            await Module.ccall(
              "shim_graphics_set_callback",
              null,
              ["string"],
              ["nethackCallback"],
              { async: true }
            );
            console.log("Graphics callback set up successfully");

            // Initialize JS helpers to make mapglyphHelper available
            if (Module.js_helpers_init) {
              console.log("Initializing JS helpers...");
              Module.js_helpers_init();
              console.log("JS helpers initialized");

              // Verify mapglyphHelper is available
              if (
                globalThis.nethackGlobal &&
                globalThis.nethackGlobal.helpers &&
                globalThis.nethackGlobal.helpers.mapglyphHelper
              ) {
                console.log("✅ mapglyphHelper is available");
              } else {
                console.log("⚠️ mapglyphHelper not found in global helpers");
              }
            } else {
              console.log("⚠️ js_helpers_init function not found");
            }

            // Don't call main() automatically - wait for it to be called naturally
            console.log("Waiting for NetHack to start naturally...");
          } catch (error) {
            console.error("Error setting up NetHack:", error);
          }
        },
      };

      console.log("Starting NetHack with original factory...");
      this.nethackInstance = await factory(Module);
      console.log(
        "NetHack factory completed, instance:",
        typeof this.nethackInstance
      );
    } catch (error) {
      console.error("Error initializing NetHack:", error);
    }
  }

  handleUICallback(name, args) {
    console.log(`🎮 UI Callback: ${name}`, args);

    const processKey = (key) => {
      return this.processKey(key);
    };

    switch (name) {
      case "shim_get_nh_event":
        // Check if we have recent input available (within input window)
        const timeSinceInput = Date.now() - this.lastInputTime;
        if (this.latestInput && timeSinceInput < this.inputCooldown) {
          const input = this.latestInput;
          this.latestInput = null; // Clear it after use
          console.log(
            `🎮 Reusing recent input for event: ${input} (${timeSinceInput}ms ago)`
          );
          return processKey(input);
        }

        // We're now in gameplay mode - use Asyncify to wait for real user input
        console.log("🎮 Waiting for player input (async)...");
        return new Promise((resolve) => {
          this.inputResolver = resolve;
          this.waitingForInput = true;
          // No timeout - wait for real user input via WebSocket
        });

      case "shim_yn_function":
        const [question, choices, defaultChoice] = args;
        console.log(
          `🤔 Y/N Question: "${question}" choices: "${choices}" default: ${defaultChoice}`
        );
        
        // Full data dump for debugging Y/N questions
        console.log(`🤔 === FULL Y/N QUESTION DATA DUMP ===`);
        console.log(`🤔 Question: "${question}"`);
        console.log(`🤔 Choices: "${choices}"`);
        console.log(`🤔 Default Choice: "${defaultChoice}"`);
        console.log(`🤔 Current Menu Items (${this.currentMenuItems.length}):`);
        this.currentMenuItems.forEach((item, index) => {
          console.log(`🤔   [${index}] "${item.text}" (key: "${item.accelerator}", category: ${item.isCategory})`);
        });
        console.log(`🤔 Pending Menu Items (${this.pendingMenuItems.length}):`);
        this.pendingMenuItems.forEach((item, index) => {
          console.log(`🤔   [${index}] "${item.text}" (key: "${item.accelerator}", category: ${item.isCategory})`);
        });
        console.log(`🤔 === END Y/N QUESTION DATA DUMP ===`);

        // Store the question text for potential menu expansion
        this.lastQuestionText = question;

        // Check if this is a direction question that needs special handling
        if (question && question.toLowerCase().includes("direction")) {
          console.log(
            "🧭 Direction question detected - waiting for user input"
          );

          const directionData = {
            type: "direction_question",
            text: question,
            choices: choices,
            default: defaultChoice,
          };
          
          console.log(`🧭 Sending direction question data to client:`, JSON.stringify(directionData, null, 2));

          // Send direction question to web client
          if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify(directionData));
          }

          // Wait for actual user input for direction questions
          console.log("🧭 Waiting for direction input (async)...");
          return new Promise((resolve) => {
            this.inputResolver = resolve;
            this.waitingForInput = true;
            // No timeout - wait for real user input via WebSocket
          });
        }

        // For non-direction questions, send question to web client 
        // Note: Menu-based questions are handled by shim_select_menu instead
        const questionData = {
          type: "question",
          text: question,
          choices: choices || "", // Use the actual choices parameter
          default: defaultChoice || "",
          menuItems: [], // shim_select_menu handles menu items
        };
        
        console.log(`🤔 Sending Y/N question data to client:`, JSON.stringify(questionData, null, 2));
        
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(JSON.stringify(questionData));
        }

        // Wait for actual user input instead of returning default choice automatically
        console.log("🤔 Y/N Question - waiting for user input (async)...");
        return new Promise((resolve) => {
          this.inputResolver = resolve;
          this.waitingForInput = true;
          // No timeout - wait for real user input via WebSocket
        });

      case "shim_nh_poskey":
        const [xPtr, yPtr, modPtr] = args;
        console.log("🎮 NetHack requesting position key");

        // Check if we have recent input available (within input window)
        const timeSincePositionInput = Date.now() - this.lastInputTime;
        if (this.latestInput && timeSincePositionInput < this.inputCooldown) {
          const input = this.latestInput;
          // Don't clear it yet - let shim_get_nh_event potentially reuse it
          console.log(
            `🎮 Using recent input for position: ${input} (${timeSincePositionInput}ms ago)`
          );
          return processKey(input);
        }

        // We're now in gameplay mode - use Asyncify to wait for real user input
        console.log("🎮 Waiting for position input (async)...");
        return new Promise((resolve) => {
          this.positionResolver = resolve;
          this.waitingForPosition = true;
          // No timeout - wait for real user input via WebSocket
        });

      case "shim_init_nhwindows":
        console.log("Initializing NetHack windows");
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "name_request",
              text: "What is your name, adventurer?",
              maxLength: 30,
            })
          );
        }
        return 1;
      case "shim_create_nhwindow":
        const [windowType] = args;
        console.log(
          `Creating window [ ${windowType} ] returning ${windowType}`
        );
        return windowType;
      case "shim_status_init":
        console.log("Initializing status display");
        return 0;
      case "shim_start_menu":
        const [menuWinId, menuOptions] = args;
        console.log("NetHack starting menu:", args);
        this.currentMenuItems = []; // Clear previous menu items
        this.currentWindow = menuWinId;
        this.lastQuestionText = null; // Clear any previous question text when starting new menu

        // Reset accelerator mapping for each new menu
        this.menuAcceleratorMap = new Map();
        this.menuAcceleratorCounter = 0;

        // Log window type for debugging
        const windowTypes = {
          1: "WIN_MESSAGE",
          2: "WIN_MAP",
          3: "WIN_STATUS",
          4: "WIN_INVEN",
        };
        console.log(
          `📋 Starting menu for window ${menuWinId} (${
            windowTypes[menuWinId] || "UNKNOWN"
          })`
        );
        return 0;
      case "shim_end_menu":
        const [endMenuWinid, menuQuestion] = args;
        console.log("NetHack ending menu:", args);
        
        // Full data dump for debugging menu end
        console.log(`📋 === FULL END MENU DATA DUMP ===`);
        console.log(`📋 Window ID: ${endMenuWinid}`);
        console.log(`📋 Menu Question: "${menuQuestion}"`);
        console.log(`📋 Current Menu Items (${this.currentMenuItems.length}):`);
        this.currentMenuItems.forEach((item, index) => {
          console.log(`📋   [${index}] "${item.text}" (key: "${item.accelerator}", category: ${item.isCategory}, glyph: ${item.glyph})`);
        });
        console.log(`📋 === END MENU DATA DUMP ===`);

        // Check if this is just an inventory update vs an actual question
        const isInventoryWindow = endMenuWinid === 4; // WIN_INVEN = 4
        const hasMenuQuestion = menuQuestion && menuQuestion.trim();

        // If this is an inventory window without a question, it's just an inventory update
        if (isInventoryWindow && !hasMenuQuestion) {
          console.log(
            `📦 Inventory update detected (${this.currentMenuItems.length} total items) - not showing dialog`
          );

          // Count actual items vs category headers for better logging
          const actualItems = this.currentMenuItems.filter(
            (item) => !item.isCategory
          );
          const categoryHeaders = this.currentMenuItems.filter(
            (item) => item.isCategory
          );
          console.log(
            `📦 -> ${actualItems.length} actual items, ${categoryHeaders.length} category headers`
          );

          // Send inventory update to client as informational only
          if (this.ws && this.ws.readyState === 1) {
            this.ws.send(
              JSON.stringify({
                type: "inventory_update",
                items: this.currentMenuItems,
                window: endMenuWinid,
              })
            );
          }

          return 0; // Don't wait for input - this is just informational
        }

        // Store the menu question and items for potential use by shim_select_menu
        if (hasMenuQuestion && this.currentMenuItems.length > 0) {
          console.log(
            `📋 Menu question detected: "${menuQuestion}" with ${this.currentMenuItems.length} items`
          );

          // Store this for shim_select_menu to use
          this.lastQuestionText = menuQuestion;
          this.pendingMenuItems = [...this.currentMenuItems]; // Copy the array

          console.log(
            "📋 Stored menu question and items for shim_select_menu to handle"
          );
          console.log(`📋 Pending items now contains ${this.pendingMenuItems.length} items`);
          return 0; // Let shim_select_menu handle the UI
        }

        // Check if we have menu items but no explicit question - could be a pickup or action menu
        if (
          this.currentMenuItems.length > 0 &&
          !hasMenuQuestion &&
          !isInventoryWindow
        ) {
          console.log(
            `📋 Menu expansion detected with ${this.currentMenuItems.length} items (window ${endMenuWinid})`
          );

          // Store menu items for potential shim_yn_function call
          this.pendingMenuItems = [...this.currentMenuItems];
          console.log(`📋 Stored ${this.pendingMenuItems.length} items for potential shim_yn_function call`);
          return 0; // Let shim_yn_function handle it if it comes
        }

        console.log(`📋 No special handling needed for this menu end`);
        return 0;
      case "shim_display_nhwindow":
        const [winid, blocking] = args;
        console.log(`🖥️ DISPLAY WINDOW [Win ${winid}], blocking: ${blocking}`);
        return 0;
      case "shim_add_menu":
        // Log the raw arguments to understand the structure
        console.log(`📋 Raw shim_add_menu args:`, args);

        const [
          menuWinid,
          menuGlyph,
          accelerator,
          groupacc,
          menuAttr,
          menuColor,
          menuStr,
          preselected,
        ] = args;

        // Use the properly destructured menuStr
        const menuText = String(menuStr || "");

        console.log(
          `📋 Parsed: winid=${menuWinid}, glyph=${menuGlyph}, accelerator=${accelerator}, text="${menuText}"`
        );

        // Determine if this is a category header and the correct accelerator
        const isCategory =
          !accelerator || accelerator === 0 || accelerator === 32; // 32 is space character
        let menuChar = "";

        if (!isCategory && accelerator > 0) {
          // Handle large pointer values that should be ASCII character codes
          if (accelerator > 255) {
            // This appears to be a pointer value instead of an ASCII code
            // We need to map these to sequential letters for menu items
            if (!this.menuAcceleratorMap) {
              this.menuAcceleratorMap = new Map();
              this.menuAcceleratorCounter = 0;
            }

            if (!this.menuAcceleratorMap.has(accelerator)) {
              // Assign sequential letters starting from 'a'
              const charCode = 97 + (this.menuAcceleratorCounter % 26); // 'a' to 'z'
              this.menuAcceleratorMap.set(
                accelerator,
                String.fromCharCode(charCode)
              );
              this.menuAcceleratorCounter++;
            }

            menuChar = this.menuAcceleratorMap.get(accelerator);
            console.log(
              `📋 MENU ITEM: "${menuText}" (key: ${menuChar}) - normalized from pointer ${accelerator}`
            );
          } else {
            // Normal ASCII character code
            menuChar = String.fromCharCode(accelerator);
            console.log(
              `📋 MENU ITEM: "${menuText}" (key: ${menuChar}) - accelerator code: ${accelerator}`
            );
          }
        } else {
          console.log(
            `📋 CATEGORY HEADER: "${menuText}" - accelerator code: ${accelerator}`
          );
        }

        // Store menu item for current question (only store non-category items or all items for display)
        if (this.currentWindow === menuWinid && menuText) {
          this.currentMenuItems.push({
            text: menuText,
            accelerator: menuChar,
            window: menuWinid,
            glyph: menuGlyph,
            isCategory: isCategory,
          });
        }

        // Send menu item to web client
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "menu_item",
              text: menuText,
              accelerator: menuChar,
              window: menuWinid,
              glyph: menuGlyph,
              isCategory: isCategory,
              menuItems: this.currentMenuItems,
            })
          );
        }

        return 0;
      case "shim_putstr":
        const [win, textAttr, textStr] = args;
        console.log(`💬 TEXT [Win ${win}]: "${textStr}"`);
        this.gameMessages.push({
          text: textStr,
          window: win,
          timestamp: Date.now(),
          attr: textAttr,
        });
        if (this.gameMessages.length > 100) {
          this.gameMessages.shift();
        }
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "text",
              text: textStr,
              window: win,
              attr: textAttr,
            })
          );
        }
        return 0;
      case "shim_print_glyph":
        const [printWin, x, y, printGlyph] = args;
        console.log(`🎨 GLYPH [Win ${printWin}] at (${x},${y}): ${printGlyph}`);
        if (printWin === 3) {
          const key = `${x},${y}`;

          // Use NetHack's mapglyph function to get the proper ASCII character
          let glyphChar = null;
          let glyphColor = null;
          if (
            globalThis.nethackGlobal &&
            globalThis.nethackGlobal.helpers &&
            globalThis.nethackGlobal.helpers.mapglyphHelper
          ) {
            try {
              const glyphInfo = globalThis.nethackGlobal.helpers.mapglyphHelper(
                printGlyph,
                x,
                y,
                0
              );
              console.log(
                `🔍 Raw glyphInfo for glyph ${printGlyph}:`,
                glyphInfo
              );
              if (glyphInfo && glyphInfo.ch !== undefined) {
                glyphChar = String.fromCharCode(glyphInfo.ch);
                glyphColor = glyphInfo.color;
                console.log(
                  `🔤 Glyph ${printGlyph} -> "${glyphChar}" (ASCII ${glyphInfo.ch}) color ${glyphColor}`
                );
              } else {
                console.log(
                  `⚠️ No character info for glyph ${printGlyph}, glyphInfo:`,
                  glyphInfo
                );
              }
            } catch (error) {
              console.log(
                `⚠️ Error getting glyph info for ${printGlyph}:`,
                error
              );
            }
          } else {
            console.log(`⚠️ mapglyphHelper not available`);
          }

          this.gameMap.set(key, {
            x: x,
            y: y,
            glyph: printGlyph,
            char: glyphChar,
            color: glyphColor,
            timestamp: Date.now(),
          });
          if (this.ws && this.ws.readyState === 1) {
            this.ws.send(
              JSON.stringify({
                type: "map_glyph",
                x: x,
                y: y,
                glyph: printGlyph,
                char: glyphChar,
                color: glyphColor,
                window: printWin,
              })
            );
          }
          // Comment out automatic character selection prompts for now
          // if (!this.hasShownCharacterSelection) {
          //   this.hasShownCharacterSelection = true;
          //   console.log(
          //     "🎯 Game started - showing interactive character selection"
          //   );
          //   if (this.ws && this.ws.readyState === 1) {
          //     this.ws.send(
          //       JSON.stringify({
          //         type: "question",
          //         text: "Welcome to NetHack! Would you like to create a new character?",
          //         choices: "yn",
          //         default: "y",
          //         menuItems: [
          //           {
          //             accelerator: "y",
          //             text: "Yes - Choose character class and race",
          //           },
          //           {
          //             accelerator: "n",
          //             text: "No - Continue with current character",
          //           },
          //         ],
          //       })
          //     );
          //   }
          // }
        }
        return 0;
      case "shim_player_selection":
        console.log("NetHack player selection started");
        // Comment out character selection UI for automatic play
        // if (this.ws && this.ws.readyState === 1) {
        //   this.ws.send(
        //     JSON.stringify({
        //       type: "question",
        //       text: "Choose your character class:",
        //       choices: "",
        //       default: "",
        //       menuItems: [
        //         { accelerator: "a", text: "Archeologist" },
        //         { accelerator: "b", text: "Barbarian" },
        //         { accelerator: "c", text: "Caveman" },
        //         { accelerator: "h", text: "Healer" },
        //         { accelerator: "k", text: "Knight" },
        //         { accelerator: "m", text: "Monk" },
        //         { accelerator: "p", text: "Priest" },
        //         { accelerator: "r", text: "Rogue" },
        //         { accelerator: "s", text: "Samurai" },
        //         { accelerator: "t", text: "Tourist" },
        //         { accelerator: "v", text: "Valkyrie" },
        //         { accelerator: "w", text: "Wizard" },
        //       ],
        //     })
        //   );
        // }
        return 0;
      case "shim_raw_print":
        const [rawText] = args;
        console.log(`📢 RAW PRINT: "${rawText}"`);

        // Send raw print messages to the UI log
        if (this.ws && this.ws.readyState === 1 && rawText && rawText.trim()) {
          this.ws.send(
            JSON.stringify({
              type: "raw_print",
              text: rawText.trim(),
            })
          );
        }
        return 0;
      case "shim_wait_synch":
        console.log("NetHack waiting for synchronization");
        return 0;
      case "shim_select_menu":
        const [menuSelectWinid, menuSelectHow, menuPtr] = args;
        console.log(
          `📋 Menu selection request for window ${menuSelectWinid}, how: ${menuSelectHow}, ptr: ${menuPtr}`
        );
        
        // Full data dump for debugging
        console.log(`📋 === FULL QUESTION DATA DUMP ===`);
        console.log(`📋 Window ID: ${menuSelectWinid}`);
        console.log(`📋 Selection How: ${menuSelectHow}`);
        console.log(`📋 Menu Pointer: ${menuPtr}`);
        console.log(`📋 Last Question Text: "${this.lastQuestionText}"`);
        console.log(`📋 Current Menu Items (${this.currentMenuItems.length}):`);
        this.currentMenuItems.forEach((item, index) => {
          console.log(`📋   [${index}] "${item.text}" (key: "${item.accelerator}", category: ${item.isCategory})`);
        });
        console.log(`📋 Pending Menu Items (${this.pendingMenuItems.length}):`);
        this.pendingMenuItems.forEach((item, index) => {
          console.log(`📋   [${index}] "${item.text}" (key: "${item.accelerator}", category: ${item.isCategory})`);
        });
        console.log(`📋 === END QUESTION DATA DUMP ===`);

        // Check if this is just an inventory display (how=0) vs actual selection request
        if (menuSelectHow === 0) {
          console.log(`📋 Inventory display only (how=0) - returning 0 immediately`);
          return 0;
        }

        // For actual selection requests (how > 0), check if we have menu items to show
        if (this.pendingMenuItems.length > 0 || this.currentMenuItems.length > 0) {
          const menuItemsToShow = this.pendingMenuItems.length > 0 ? this.pendingMenuItems : this.currentMenuItems;
          
          console.log(`📋 Showing menu selection dialog with ${menuItemsToShow.length} items (how=${menuSelectHow})`);
          
          // Send the menu question to the client with proper context
          const questionText = this.lastQuestionText || "What would you like to select?";
          
          // Build choices string from menu items for better debugging
          const nonCategoryItems = menuItemsToShow.filter(item => !item.isCategory);
          const choicesString = nonCategoryItems.map(item => item.accelerator).join('');
          console.log(`📋 Generated choices string: "${choicesString}"`);
          
          if (this.ws && this.ws.readyState === 1) {
            const questionData = {
              type: "question",
              text: questionText,
              choices: choicesString, // Use generated choices from menu items
              default: "",
              menuItems: menuItemsToShow,
            };
            
            console.log(`📋 Sending question data to client:`, JSON.stringify(questionData, null, 2));
            
            this.ws.send(JSON.stringify(questionData));
          }

          // Clear pending items since we're using them now
          this.pendingMenuItems = [];

          // Wait for actual user input for menu selection
          console.log("📋 Waiting for menu selection (async)...");
          return new Promise((resolve) => {
            this.inputResolver = resolve;
            this.waitingForInput = true;
            // No timeout - wait for real user input via WebSocket
          });
        }

        // If no menu items, return 0 (no selection)
        console.log("📋 No menu items available, returning 0 (no selection)");
        return 0;

      case "shim_askname":
        console.log("NetHack is asking for player name, args:", args);
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "name_request",
              text: "What is your name?",
              maxLength: 30,
            })
          );
        }

        if (this.latestInput) {
          const name = this.latestInput;
          this.latestInput = null;
          console.log(`Using player name from input: ${name}`);
          return name;
        }

        console.log("No name provided, using default");
        return "Player";
      case "shim_mark_synch":
        console.log("NetHack marking synchronization");
        return 0;

      case "shim_cliparound":
        const [clipX, clipY] = args;
        console.log(
          `🎯 Cliparound request for position (${clipX}, ${clipY}) - updating player position`
        );

        // Update player position when NetHack requests clipping around a position
        const oldPlayerPos = { ...this.playerPos };
        this.playerPos = { x: clipX, y: clipY };

        // Send updated player position to client
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "player_position",
              x: clipX,
              y: clipY,
            })
          );

          // Also send a map update to clear the old player position and show new one
          // This helps when NetHack doesn't send explicit glyph updates
          this.ws.send(
            JSON.stringify({
              type: "force_player_redraw",
              oldPosition: oldPlayerPos,
              newPosition: { x: clipX, y: clipY },
            })
          );
        }
        return 0;

      case "shim_clear_nhwindow":
        const [clearWindowId] = args;
        console.log(`🗑️ Clearing window ${clearWindowId}`);

        // If clearing the map window, we might need to refresh the display
        if (clearWindowId === 2) {
          // WIN_MAP = 2
          console.log("Map window cleared - preparing for redraw");
        }

        // Send clear window message to client to dismiss relevant dialogs
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "clear_window",
              windowId: clearWindowId,
            })
          );
        }
        return 0;

      case "shim_getmsghistory":
        const [init] = args;
        console.log(`Getting message history, init: ${init}`);
        // Return empty string for message history
        return "";

      case "shim_putmsghistory":
        const [msg, is_restoring] = args;
        console.log(
          `Putting message history: "${msg}", restoring: ${is_restoring}`
        );
        return 0;

      case "shim_exit_nhwindows":
        console.log("Exiting NetHack windows");
        return 0;

      case "shim_destroy_nhwindow":
        const [destroyWindowId] = args;
        console.log(`🗑️ Destroying window ${destroyWindowId}`);

        // Send destroy window message to client to dismiss relevant dialogs
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "destroy_window",
              windowId: destroyWindowId,
            })
          );
        }
        return 0;

      default:
        console.log(`Unknown callback: ${name}`, args);
        return 0;
    }
  }
}

// HTTP Server for serving static files
const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  const extname = path.extname(filePath);

  let contentType = "text/html";
  switch (extname) {
    case ".js":
      contentType = "text/javascript";
      break;
    case ".css":
      contentType = "text/css";
      break;
    case ".json":
      contentType = "application/json";
      break;
    case ".png":
      contentType = "image/png";
      break;
    case ".jpg":
      contentType = "image/jpg";
      break;
    case ".wav":
      contentType = "audio/wav";
      break;
  }

  const fullPath = path.join(__dirname, "public", filePath);

  fs.readFile(fullPath, (error, content) => {
    if (error) {
      if (error.code == "ENOENT") {
        res.writeHead(404);
        res.end("404 - File Not Found");
      } else {
        res.writeHead(500);
        res.end("500 - Internal Server Error");
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

// WebSocket Server
const wss = new WebSocket.Server({ server });
let sessionCount = 0;

wss.on("connection", (ws) => {
  console.log("New WebSocket connection");
  sessionCount++;

  const session = new NetHackSession(ws);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received:", data);

      if (data.type === "input") {
        session.handleClientInput(data.input);
      } else if (data.type === "request_tile_update") {
        session.handleTileUpdateRequest(data.x, data.y);
      } else if (data.type === "request_area_update") {
        session.handleAreaUpdateRequest(
          data.centerX,
          data.centerY,
          data.radius
        );
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
    sessionCount--;
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`NetHack 3D Server running on http://localhost:${PORT}`);
  console.log(`Game sessions: ${sessionCount}`);
});
