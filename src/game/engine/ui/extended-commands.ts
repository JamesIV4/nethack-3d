import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import { sanitizeStartupInitOptionTokens } from "../../../runtime/startup-init-options";
import type { Camera } from "../camera/camera";
import type { DirectionPrompts } from "./direction-prompts";
import type { InputCommands } from "../input/input-commands";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "./prompt-dialogs";
import type { QuestionMenus } from "./question-menus";
import type { RenderPipeline } from "../rendering/render-pipeline";

export interface ExtendedCommandsDependencies {
  readonly camera: Pick<
    Camera,
    "projectWorldToScreen"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly inputCommands: Pick<
    InputCommands,
    "sendInputSequence"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isInfoDialogVisible"
    | "isInventoryDialogVisible"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "isInQuestion"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "renderer"
  >;
}

/** Extended-command palette state, ranking, keyboard editing and runtime command normalization. */
export class ExtendedCommands {
  constructor(private readonly dependencies: ExtendedCommandsDependencies) {}

  altOrMetaHeld: boolean = false;

  metaCommandModeActive: boolean = false;

  metaCommandBuffer: string = "";

  metaCommandModal: HTMLDivElement | null = null;

  metaCommandInputTextElement: HTMLSpanElement | null = null;

  metaCommandInputGhostElement: HTMLSpanElement | null = null;

  metaCommandInputGhostTypedElement: HTMLSpanElement | null = null;

  metaCommandInputGhostSuffixElement: HTMLSpanElement | null = null;

  metaCommandSuggestionsElement: HTMLDivElement | null = null;

  metaCommandSuggestions: string[] = [];

  metaCommandSuggestionIndex: number = 0;

  availableExtendedCommands: string[] = [];

  useNativeExtendedCommandMenu: boolean = false;

  ensureMetaCommandModal(): HTMLDivElement {
    if (this.metaCommandModal) {
      return this.metaCommandModal;
    }

    const modal = document.createElement("div");
    modal.id = "meta-command-modal";
    modal.className = "nh3d-meta-command";
    modal.setAttribute("aria-hidden", "true");

    const inputRow = document.createElement("div");
    inputRow.className = "nh3d-meta-command-input-row";

    const prefix = document.createElement("span");
    prefix.className = "nh3d-meta-command-prefix";
    prefix.textContent = "#";

    const inputShell = document.createElement("div");
    inputShell.className = "nh3d-meta-command-input-shell";

    const inputGhost = document.createElement("span");
    inputGhost.className = "nh3d-meta-command-input-ghost";

    const inputGhostTyped = document.createElement("span");
    inputGhostTyped.className = "nh3d-meta-command-input-ghost-typed";
    inputGhost.appendChild(inputGhostTyped);

    const inputGhostSuffix = document.createElement("span");
    inputGhost.appendChild(inputGhostSuffix);

    const inputText = document.createElement("span");
    inputText.className = "nh3d-meta-command-input-text";

    inputShell.appendChild(inputGhost);
    inputShell.appendChild(inputText);
    inputRow.appendChild(prefix);
    inputRow.appendChild(inputShell);

    const suggestions = document.createElement("div");
    suggestions.className = "nh3d-meta-command-suggestions";

    modal.appendChild(inputRow);
    modal.appendChild(suggestions);
    document.body.appendChild(modal);
    this.metaCommandModal = modal;
    this.metaCommandInputTextElement = inputText;
    this.metaCommandInputGhostElement = inputGhost;
    this.metaCommandInputGhostTypedElement = inputGhostTyped;
    this.metaCommandInputGhostSuffixElement = inputGhostSuffix;
    this.metaCommandSuggestionsElement = suggestions;
    return modal;
  }

  normalizeMetaCommandValue(rawValue: string): string {
    return String(rawValue || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_?-]/g, "");
  }

  computeLevenshteinDistance(left: string, right: string): number {
    if (left === right) {
      return 0;
    }
    if (left.length === 0) {
      return right.length;
    }
    if (right.length === 0) {
      return left.length;
    }

    const previous = new Array<number>(right.length + 1);
    const current = new Array<number>(right.length + 1);
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = j;
    }

    for (let i = 1; i <= left.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + substitutionCost,
        );
      }
      for (let j = 0; j <= right.length; j += 1) {
        previous[j] = current[j];
      }
    }

    return previous[right.length];
  }

  getRankedMetaCommandSuggestions(queryText: string): string[] {
    const normalizedQuery = this.normalizeMetaCommandValue(queryText);
    if (!normalizedQuery) {
      return [];
    }

    const uniqueCommands: string[] = [];
    const seen = new Set<string>();
    for (const rawCommand of this.availableExtendedCommands) {
      const normalizedCommand = this.normalizeMetaCommandValue(rawCommand);
      if (!normalizedCommand || seen.has(normalizedCommand)) {
        continue;
      }
      seen.add(normalizedCommand);
      uniqueCommands.push(normalizedCommand);
    }
    if (uniqueCommands.length === 0) {
      return [];
    }

    const maxDistance = Math.max(1, Math.floor(normalizedQuery.length / 3));
    return uniqueCommands
      .map((command) => {
        if (command.startsWith(normalizedQuery)) {
          return {
            command,
            group: 0,
            containsIndex: 0,
            distance: command.length - normalizedQuery.length,
            lengthDelta: command.length - normalizedQuery.length,
          };
        }
        const containsIndex = command.indexOf(normalizedQuery);
        if (containsIndex >= 0) {
          return {
            command,
            group: 1,
            containsIndex,
            distance: containsIndex,
            lengthDelta: Math.abs(command.length - normalizedQuery.length),
          };
        }
        const distance = this.computeLevenshteinDistance(
          normalizedQuery,
          command,
        );
        if (distance > maxDistance) {
          return null;
        }
        return {
          command,
          group: 2,
          containsIndex: Number.MAX_SAFE_INTEGER,
          distance,
          lengthDelta: Math.abs(command.length - normalizedQuery.length),
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          command: string;
          group: number;
          containsIndex: number;
          distance: number;
          lengthDelta: number;
        } => entry !== null,
      )
      .sort((left, right) => {
        if (left.group !== right.group) {
          return left.group - right.group;
        }
        if (left.containsIndex !== right.containsIndex) {
          return left.containsIndex - right.containsIndex;
        }
        if (left.distance !== right.distance) {
          return left.distance - right.distance;
        }
        if (left.lengthDelta !== right.lengthDelta) {
          return left.lengthDelta - right.lengthDelta;
        }
        return left.command.localeCompare(right.command);
      })
      .slice(0, 6)
      .map((entry) => entry.command);
  }

  updateMetaCommandSuggestionsState(): void {
    this.metaCommandSuggestions = this.getRankedMetaCommandSuggestions(
      this.metaCommandBuffer,
    );
    if (this.metaCommandSuggestions.length === 0) {
      this.metaCommandSuggestionIndex = 0;
      return;
    }
    this.metaCommandSuggestionIndex = Math.min(
      Math.max(this.metaCommandSuggestionIndex, 0),
      this.metaCommandSuggestions.length - 1,
    );
  }

  getActiveMetaCommandSuggestion(): string | null {
    if (this.metaCommandSuggestions.length === 0) {
      return null;
    }
    const index = Math.min(
      Math.max(this.metaCommandSuggestionIndex, 0),
      this.metaCommandSuggestions.length - 1,
    );
    return this.metaCommandSuggestions[index] ?? null;
  }

  applyTopMetaCommandSuggestion(): boolean {
    const topSuggestion = this.metaCommandSuggestions[0];
    if (!topSuggestion) {
      return false;
    }
    this.metaCommandBuffer = topSuggestion;
    this.metaCommandSuggestionIndex = 0;
    this.updateMetaCommandSuggestionsState();
    this.updateMetaCommandModal();
    return true;
  }

  updateMetaCommandModalPosition(): void {
    if (!this.metaCommandModeActive || !this.metaCommandModal) {
      return;
    }

    if (this.dependencies.movementInput.isFpsMode()) {
      const canvasRect = this.dependencies.renderPipeline.renderer.domElement.getBoundingClientRect();
      const anchorX = canvasRect.left + canvasRect.width * 0.5;
      const anchorY = canvasRect.top + Math.max(54, canvasRect.height * 0.2);
      // FPS anchors near the top of the viewport; avoid the normal -30vh lift
      // used in top-down mode or the modal can end up off-screen.
      this.metaCommandModal.style.transform = "translate(-50%, 0)";
      this.metaCommandModal.style.visibility = "visible";
      this.metaCommandModal.style.left = `${Math.round(anchorX)}px`;
      this.metaCommandModal.style.top = `${Math.round(anchorY)}px`;
      return;
    }

    this.metaCommandModal.style.transform = "translate(-50%, -30vh)";

    const projected = this.dependencies.camera.projectWorldToScreen(
      this.dependencies.playerMovement.playerPos.x * TILE_SIZE,
      -this.dependencies.playerMovement.playerPos.y * TILE_SIZE,
      WALL_HEIGHT + 0.3,
    );
    if (!projected.visible) {
      this.metaCommandModal.style.visibility = "hidden";
      return;
    }

    this.metaCommandModal.style.visibility = "visible";
    this.metaCommandModal.style.left = `${Math.round(projected.x)}px`;
    this.metaCommandModal.style.top = `${Math.round(projected.y - 34)}px`;
  }

  updateMetaCommandModal(): void {
    const modal = this.metaCommandModal;
    if (!modal) {
      return;
    }

    if (!this.metaCommandModeActive) {
      modal.classList.remove("is-visible");
      modal.style.visibility = "hidden";
      modal.setAttribute("aria-hidden", "true");
      return;
    }

    const topSuggestion = this.metaCommandSuggestions[0] ?? "";
    const ghostSuffix =
      this.metaCommandBuffer.length > 0 &&
      topSuggestion.startsWith(this.metaCommandBuffer)
        ? topSuggestion.slice(this.metaCommandBuffer.length)
        : "";
    if (this.metaCommandInputTextElement) {
      this.metaCommandInputTextElement.textContent =
        this.metaCommandBuffer || "\u00a0";
    }
    if (this.metaCommandInputGhostElement) {
      this.metaCommandInputGhostElement.style.display =
        ghostSuffix.length > 0 ? "block" : "none";
    }
    if (this.metaCommandInputGhostTypedElement) {
      this.metaCommandInputGhostTypedElement.textContent =
        this.metaCommandBuffer;
    }
    if (this.metaCommandInputGhostSuffixElement) {
      this.metaCommandInputGhostSuffixElement.textContent = ghostSuffix;
    }
    if (this.metaCommandSuggestionsElement) {
      const secondarySuggestions =
        this.metaCommandBuffer.length > 0
          ? this.metaCommandSuggestions.slice(1, 6)
          : [];
      this.metaCommandSuggestionsElement.innerHTML = "";
      if (secondarySuggestions.length > 0) {
        for (let i = 0; i < secondarySuggestions.length; i += 1) {
          const suggestion = secondarySuggestions[i];
          const suggestionElement = document.createElement("div");
          suggestionElement.className = "nh3d-meta-command-suggestion";
          if (this.metaCommandSuggestionIndex === i + 1) {
            suggestionElement.classList.add("is-active");
          }
          suggestionElement.textContent = suggestion;
          this.metaCommandSuggestionsElement.appendChild(suggestionElement);
        }
        this.metaCommandSuggestionsElement.style.display = "flex";
      } else {
        this.metaCommandSuggestionsElement.style.display = "none";
      }
    }
    modal.classList.add("is-visible");
    modal.setAttribute("aria-hidden", "false");
    this.updateMetaCommandModalPosition();
  }

  normalizeRuntimeExtendedCommands(rawCommands: unknown): string[] {
    if (!Array.isArray(rawCommands)) {
      return [];
    }

    const uniqueCommands: string[] = [];
    const seen = new Set<string>();
    for (const raw of rawCommands) {
      const normalized = String(raw || "")
        .trim()
        .toLowerCase();
      if (!normalized || normalized === "#" || normalized === "?") {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      uniqueCommands.push(normalized);
    }
    return uniqueCommands;
  }

  canStartMetaCommandMode(): boolean {
    return (
      !this.metaCommandModeActive &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      !this.dependencies.positionSelection.positionInputModeActive &&
      !this.dependencies.promptDialogs.isInventoryDialogVisible &&
      !this.dependencies.promptDialogs.isInfoDialogVisible
    );
  }

  isMetaCommandTriggerKey(event: KeyboardEvent): boolean {
    if (event.key === "#") {
      return true;
    }
    return event.shiftKey && event.code === "Digit3";
  }

  resolveStartupExtmenuEnabled(rawTokens: unknown): boolean {
    const tokens = sanitizeStartupInitOptionTokens(rawTokens);
    let extmenuEnabled = false;
    for (const token of tokens) {
      if (token === "extmenu") {
        extmenuEnabled = true;
      } else if (token === "!extmenu") {
        extmenuEnabled = false;
      }
    }
    return extmenuEnabled;
  }

  extractNumberPadModeEnabledFromOptionTokens(
    rawTokens: unknown,
  ): boolean | null {
    const tokens = sanitizeStartupInitOptionTokens(rawTokens);
    let numberPadEnabled: boolean | null = null;
    for (const token of tokens) {
      const normalizedToken = String(token || "")
        .trim()
        .toLowerCase();
      if (!normalizedToken.startsWith("number_pad:")) {
        continue;
      }
      const value = normalizedToken.slice("number_pad:".length).trim();
      if (value === "0" || value === "-1") {
        numberPadEnabled = false;
      } else if (value) {
        numberPadEnabled = true;
      }
    }
    return numberPadEnabled;
  }

  resolveStartupNumberPadModeEnabled(rawTokens: unknown): boolean {
    const numberPadEnabled =
      this.extractNumberPadModeEnabledFromOptionTokens(rawTokens);
    if (typeof numberPadEnabled === "boolean") {
      return numberPadEnabled;
    }
    return true;
  }

  startMetaCommandMode(): void {
    if (!this.canStartMetaCommandMode()) {
      return;
    }
    this.metaCommandModeActive = true;
    this.metaCommandBuffer = "";
    this.metaCommandSuggestionIndex = 0;
    this.updateMetaCommandSuggestionsState();
    this.updateMetaCommandModal();
  }

  exitMetaCommandMode(): void {
    if (!this.metaCommandModeActive) {
      return;
    }
    this.metaCommandModeActive = false;
    this.metaCommandBuffer = "";
    this.metaCommandSuggestions = [];
    this.metaCommandSuggestionIndex = 0;
    this.updateMetaCommandModal();
  }

  confirmMetaCommandMode(): void {
    if (!this.metaCommandModeActive) {
      return;
    }
    const normalizedBuffer = this.normalizeMetaCommandValue(
      this.metaCommandBuffer,
    );
    const sequence = ["#", ...normalizedBuffer.split(""), "Enter"];
    this.dependencies.inputCommands.sendInputSequence(sequence);
    this.exitMetaCommandMode();
  }

  getMetaCommandInputCharacter(event: KeyboardEvent): string | null {
    if (event.key.length !== 1) {
      return null;
    }
    if (!/^[A-Za-z0-9_?-]$/.test(event.key)) {
      return null;
    }
    return event.key.toLowerCase();
  }

  handleMetaCommandKeyDown(event: KeyboardEvent): boolean {
    if (!this.metaCommandModeActive) {
      return false;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.exitMetaCommandMode();
      return true;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const activeSuggestion = this.getActiveMetaCommandSuggestion();
      if (
        activeSuggestion &&
        activeSuggestion !==
          this.normalizeMetaCommandValue(this.metaCommandBuffer)
      ) {
        this.metaCommandBuffer = activeSuggestion;
        this.metaCommandSuggestionIndex = 0;
        this.updateMetaCommandSuggestionsState();
        this.updateMetaCommandModal();
        return true;
      }
      this.confirmMetaCommandMode();
      return true;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      this.metaCommandBuffer = this.metaCommandBuffer.slice(0, -1);
      this.metaCommandSuggestionIndex = 0;
      this.updateMetaCommandSuggestionsState();
      this.updateMetaCommandModal();
      return true;
    }

    if (event.key === "Tab" || event.key === "ArrowRight") {
      event.preventDefault();
      this.applyTopMetaCommandSuggestion();
      return true;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (this.metaCommandSuggestions.length > 0) {
        this.metaCommandSuggestionIndex = Math.min(
          this.metaCommandSuggestionIndex + 1,
          this.metaCommandSuggestions.length - 1,
        );
        this.updateMetaCommandModal();
      }
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (this.metaCommandSuggestions.length > 0) {
        this.metaCommandSuggestionIndex = Math.max(
          0,
          this.metaCommandSuggestionIndex - 1,
        );
        this.updateMetaCommandModal();
      }
      return true;
    }

    const typedCharacter = this.getMetaCommandInputCharacter(event);
    if (typedCharacter) {
      event.preventDefault();
      this.metaCommandBuffer = this.normalizeMetaCommandValue(
        `${this.metaCommandBuffer}${typedCharacter}`,
      );
      this.metaCommandSuggestionIndex = 0;
      this.updateMetaCommandSuggestionsState();
      this.updateMetaCommandModal();
      return true;
    }

    event.preventDefault();
    return true;
  }
}
