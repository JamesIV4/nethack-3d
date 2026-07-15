import { describe, expect, it } from "vitest";

import {
  augmentRuntimeCommandNames,
  resolveSlashEmCommandInputBinding,
  slashEmKeyboardCommandNames,
} from "./slashem-command-capabilities";

describe("Slash'EM command capabilities", () => {
  it("supplements the exported # command table with regular keyboard commands", () => {
    const commands = augmentRuntimeCommandNames("slashem", [
      "conduct",
      "pray",
      "?",
    ]);

    expect(commands).toContain("conduct");
    expect(commands).toContain("engrave");
    expect(commands).toContain("options");
    expect(commands).toContain("spells");
    expect(commands).toContain("travel");
    expect(commands).not.toContain("?");
    expect(new Set(commands).size).toBe(commands.length);
    expect(commands).toEqual([...commands].sort((a, b) => a.localeCompare(b)));
  });

  it("does not add Slash'EM keyboard commands to other runtimes", () => {
    expect(augmentRuntimeCommandNames("3.6.7", ["conduct", "pray"])).toEqual([
      "conduct",
      "pray",
    ]);
  });

  it("uses the exact Slash'EM source bindings for representative commands", () => {
    expect(resolveSlashEmCommandInputBinding("engrave")).toEqual({ key: "E" });
    expect(resolveSlashEmCommandInputBinding("autopickup")).toEqual({ key: "@" });
    expect(resolveSlashEmCommandInputBinding("attributes")).toEqual({
      key: "x",
      modifier: "ctrl",
    });
    expect(resolveSlashEmCommandInputBinding("spells")).toEqual({ key: "+" });
    expect(resolveSlashEmCommandInputBinding("travel")).toEqual({ key: "_" });
  });

  it("keeps every supplemental name executable", () => {
    for (const commandName of slashEmKeyboardCommandNames) {
      expect(resolveSlashEmCommandInputBinding(commandName)).not.toBeNull();
    }
  });
});
