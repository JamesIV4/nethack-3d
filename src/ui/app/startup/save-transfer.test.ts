import { describe, expect, it } from "vitest";
import { parseSaveArchive, SaveTransferError } from "./save-transfer";
import { getRuntimeSaveCompatTag, getRuntimeSaveDbName } from "../../../runtime/save-storage";
import type { NethackRuntimeVersion } from "../../../runtime/types";

function archive(runtimeVersion: NethackRuntimeVersion = "3.6.7") {
  return {
    format: "nh3d-save", version: 1, runtimeVersion,
    compatTag: getRuntimeSaveCompatTag(runtimeVersion), dbName: getRuntimeSaveDbName(runtimeVersion),
    name: "Test", category: "manual", displayName: "Test", playMode: "normal", initOptions: [],
    files: [{ key: "/save/0Test", timestamp: "2026-10-04T12:00:00.000Z", contents: "AAEC/w==" }],
  };
}

describe("save backup validation", () => {
  it.each(["3.6.7", "5.0", "slashem"] as const)("accepts a backup for %s", runtime => {
    expect(parseSaveArchive(JSON.stringify(archive(runtime)), runtime).files[0].contents).toBe("AAEC/w==");
  });

  it("rejects a different runtime or incompatible build", () => {
    expect(() => parseSaveArchive(JSON.stringify(archive()), "5.0")).toThrow(new SaveTransferError("incompatible"));
    expect(() => parseSaveArchive(JSON.stringify({ ...archive(), compatTag: "obsolete" }), "3.6.7")).toThrow(new SaveTransferError("incompatible"));
  });

  it.each(["/save/../0Test", "/save/record", "/save/0Other", "/save/0Test.0", "/0Test", "/save/0Test/child", "/save/0Test\u0000"])("rejects unsafe or unrelated path %s", key => {
    const data = archive();
    data.files[0].key = key;
    expect(() => parseSaveArchive(JSON.stringify(data), "3.6.7")).toThrow(new SaveTransferError("invalid"));
  });

  it("rejects duplicate paths and arbitrary databases", () => {
    const data = archive();
    data.files.push(data.files[0]);
    expect(() => parseSaveArchive(JSON.stringify(data), "3.6.7")).toThrow();
    expect(() => parseSaveArchive(JSON.stringify({ ...archive(), dbName: "client-settings" }), "3.6.7")).toThrow();
  });

  it.each(["", "%%%?", "AA=A", "AAAA===", "AAA", "AA\nA"])("rejects damaged binary encoding %j", contents => {
    const data = archive();
    data.files[0].contents = contents;
    expect(() => parseSaveArchive(JSON.stringify(data), "3.6.7")).toThrow();
  });

  it("accepts large save payloads without regex stack overflow", () => {
    const data = archive();
    data.files[0].contents = "AAAA".repeat(500_000);
    expect(parseSaveArchive(JSON.stringify(data), "3.6.7").files).toHaveLength(1);
  });

  it("keeps every checkpoint shard in an autosave archive", () => {
    const data = archive();
    data.category = "autosave";
    data.files = [0, 1, 2].map(level => ({ ...data.files[0], key: `/save/0Test.${level}` }));
    expect(parseSaveArchive(JSON.stringify(data), "3.6.7").files).toHaveLength(3);
  });

  it.each(["{}", "null", "[]", "not JSON"])("rejects invalid archive %s", text => {
    expect(() => parseSaveArchive(text, "3.6.7")).toThrow(new SaveTransferError("invalid"));
  });
});
