// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.
import {
  appendRequiredStartupInitOptionTokens,
  getAutomaticRuntimeInitOptionTokens,
  sanitizeStartupInitOptionTokens,
} from "../../startup-init-options";
import { supportsRuntimeCheckpointRecovery } from "../../runtime-capabilities";
import type { RuntimeGameOver } from "../lifecycle/game-over";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeTextInput } from "../input/text-input";
import type { RuntimeInputRequests } from "../input/input-requests";

export interface RuntimeStartupConfigurationDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "runtimeVersion"
    | "startupOptions"
  >;
  readonly gameOver: Pick<
    RuntimeGameOver,
    "lastKnownPlayerName"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "activeInputRequest"
    | "awaitingQuestionInput"
  >;
  readonly textInput: Pick<
    RuntimeTextInput,
    "pendingTextResponses"
  >;
}

/** Character initialization, runtime option tokens and name callbacks. */
export class RuntimeStartupConfiguration {
  declare nameRequestDebugCounter: number;
  declare nameInitDebugCounter: number;
  declare lastConfiguredNethackOptions: string;

  constructor(private readonly deps: RuntimeStartupConfigurationDependencies) {
    this.nameRequestDebugCounter = 0;
    this.nameInitDebugCounter = 0;
    this.lastConfiguredNethackOptions = "";
  }

  normalizeCharacterOptionValue(value) {
    if (typeof value !== "string") {
      return "";
    }
    const normalized = value.trim();
    if (!normalized) {
      return "";
    }
    return normalized;
  }

  normalizeCharacterNameValue(value) {
    if (typeof value !== "string") {
      return "";
    }
    const normalized = value.replace(/,/g, " ").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "";
    }
    return normalized.slice(0, 30);
  }

  isWizardDebugStartupRequested() {
    const startupTokens = this.buildStartupInitRuntimeOptions().map((token) =>
      String(token || "")
        .trim()
        .toLowerCase(),
    );
    return startupTokens.includes("playmode:debug");
  }

  setRuntimePlayerName(name) {
    const normalized = this.normalizeCharacterNameValue(name);
    if (!normalized) {
      return false;
    }

    const globals =
      globalThis.nethackGlobal &&
        globalThis.nethackGlobal.globals &&
        typeof globalThis.nethackGlobal.globals === "object"
        ? globalThis.nethackGlobal.globals
        : null;
    if (!globals) {
      return false;
    }

    try {
      if (Object.prototype.hasOwnProperty.call(globals, "plname")) {
        globals.plname = normalized;
        this.deps.gameOver.lastKnownPlayerName = normalized;
        return true;
      }
      if (
        globals.g &&
        typeof globals.g === "object" &&
        Object.prototype.hasOwnProperty.call(globals.g, "plname")
      ) {
        globals.g.plname = normalized;
        this.deps.gameOver.lastKnownPlayerName = normalized;
        return true;
      }
    } catch (error) {
      console.log("Failed to write runtime player name:", error);
    }

    return false;
  }

  buildCharacterCreationRuntimeOptions() {
    const config =
      this.deps.coordinator.startupOptions &&
        this.deps.coordinator.startupOptions.characterCreation &&
        typeof this.deps.coordinator.startupOptions.characterCreation === "object"
        ? this.deps.coordinator.startupOptions.characterCreation
        : null;

    if (!config) {
      return [];
    }

    const name = this.normalizeCharacterNameValue(config.name);

    // If we're resuming, omit role/race/gender/align.
    // Supplying just the name instructs NetHack to bypass character creation
    // and seamlessly load the matching save file from the virtual file system.
    if (config.mode === "resume") {
      return name ? [`name:${name}`] : [];
    }

    const role = this.normalizeCharacterOptionValue(config.role);
    const race = this.normalizeCharacterOptionValue(config.race);
    const gender = this.normalizeCharacterOptionValue(config.gender);
    const align = this.normalizeCharacterOptionValue(config.align);

    if (config.mode === "random") {
      const randomOptions = [
        role ? `role:${role}` : "role:random",
        race ? `race:${race}` : "race:random",
        gender ? `gender:${gender}` : "gender:random",
        align ? `align:${align}` : "align:random",
      ];
      if (name) {
        randomOptions.push(`name:${name}`);
      }
      return randomOptions;
    }

    const options = [];
    if (role) {
      options.push(`role:${role}`);
    }
    if (race) {
      options.push(`race:${race}`);
    }
    if (gender) {
      options.push(`gender:${gender}`);
    }
    if (align) {
      options.push(`align:${align}`);
    }
    if (name) {
      options.push(`name:${name}`);
    }
    return options;
  }

  buildStartupInitRuntimeOptions() {
    const tokens = appendRequiredStartupInitOptionTokens(
      this.deps.coordinator.startupOptions?.initOptions,
      this.deps.coordinator.runtimeVersion,
    );
    if (
      this.deps.coordinator.runtimeVersion !== "3.6.7" &&
      !supportsRuntimeCheckpointRecovery(this.deps.coordinator.runtimeVersion)
    ) {
      return tokens.filter((token) => !/^!?checkpoint(?:$|:)/i.test(token));
    }
    return tokens;
  }

  resolveStartupExtmenuEnabled(rawTokens) {
    const tokens = sanitizeStartupInitOptionTokens(
      rawTokens,
      this.deps.coordinator.runtimeVersion,
    );
    return tokens.includes("extmenu");
  }

  buildRuntimeModuleStartupOptions(runtimeVersion) {

    const runtimeOptions = getAutomaticRuntimeInitOptionTokens(runtimeVersion);
    const characterRuntimeOptions =
      this.buildCharacterCreationRuntimeOptions();
    if (characterRuntimeOptions.length > 0) {
      runtimeOptions.push(...characterRuntimeOptions);
    }
    const startupInitRuntimeOptions = this.buildStartupInitRuntimeOptions();
    if (startupInitRuntimeOptions.length > 0) {
      runtimeOptions.push(...startupInitRuntimeOptions);
    }
    // NetHack parses NETHACKOPTIONS right-to-left, so put windowtype last
    // to ensure it is applied first.
    runtimeOptions.push("windowtype:shim");
    const checkpointStartupOptionEnabled = runtimeOptions.includes("checkpoint");
    if (runtimeOptions.includes("checkpoint")) {
      console.log("Checkpoint startup option is enabled.");
    }
    return { runtimeOptions, checkpointStartupOptionEnabled };
  }

  handleShimInitNhwindows(args) {
    this.nameInitDebugCounter += 1;
    console.log("[NAME_DEBUG] shim_init_nhwindows", {
      callId: this.nameInitDebugCounter,
      args,
      pendingTextResponses: this.deps.textInput.pendingTextResponses.length,
      configuredName: this.normalizeCharacterNameValue(
        this.deps.coordinator.startupOptions?.characterCreation?.name,
      ),
    });
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "name_request",
        text: "What is your name, adventurer?",
        maxLength: 30,
        source: "init_nhwindows",
        callId: this.nameInitDebugCounter,
      });
    }
    return 1;
  }

  handleShimAskname(args) {
    this.nameRequestDebugCounter += 1;
    const askNameCallId = this.nameRequestDebugCounter;
    const configuredName = this.normalizeCharacterNameValue(
      this.deps.coordinator.startupOptions?.characterCreation?.name,
    );
    console.log("[NAME_DEBUG] shim_askname entered", {
      callId: askNameCallId,
      args,
      pendingTextResponses: this.deps.textInput.pendingTextResponses.length,
      configuredName,
      awaitingQuestionInput: this.deps.inputRequests.awaitingQuestionInput,
      activeInputRequestType: this.deps.inputRequests.activeInputRequest?.kind || null,
    });
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "name_request",
        text: "What is your name?",
        maxLength: 30,
        source: "askname",
        callId: askNameCallId,
        pendingTextResponses: this.deps.textInput.pendingTextResponses.length,
      });
    }

    let resolvedName = "";
    if (this.deps.textInput.pendingTextResponses.length > 0) {
      const queueBefore = this.deps.textInput.pendingTextResponses.length;
      const queuedName = this.normalizeCharacterNameValue(
        String(this.deps.textInput.pendingTextResponses.shift() || ""),
      );
      console.log("[NAME_DEBUG] shim_askname consumed queued input", {
        callId: askNameCallId,
        name: queuedName,
        queueBefore,
        queueAfter: this.deps.textInput.pendingTextResponses.length,
      });
      if (queuedName.length > 0) {
        resolvedName = queuedName;
      }
    }

    if (!resolvedName && configuredName.length > 0) {
      console.log("[NAME_DEBUG] shim_askname using configured name", {
        callId: askNameCallId,
        configuredName,
      });
      resolvedName = configuredName;
    }

    if (!resolvedName) {
      console.log(
        "[NAME_DEBUG] shim_askname falling back to default Web_user",
        {
          callId: askNameCallId,
        },
      );
      resolvedName = "Web_user";
    }

    const wrotePlayerName = this.setRuntimePlayerName(resolvedName);
    if (!wrotePlayerName) {
      console.log(
        "[NAME_DEBUG] shim_askname could not write player name to runtime globals",
        {
          callId: askNameCallId,
          resolvedName,
        },
      );
    }
    return resolvedName;
  }
}
