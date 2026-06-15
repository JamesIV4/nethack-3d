import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

const TILESET_MANIFEST_SOURCES = [
  {
    sourceDir: resolve(PROJECT_ROOT, "public/assets/slashem"),
    assetPrefix: "assets/slashem",
    tileLayoutVersion: "slashem",
  },
  {
    sourceDir: resolve(PROJECT_ROOT, "public/assets/3.6"),
    assetPrefix: "assets/3.6",
    tileLayoutVersion: "3.6.7",
  },
  {
    sourceDir: resolve(PROJECT_ROOT, "public/assets/5.0"),
    assetPrefix: "assets/5.0",
    tileLayoutVersion: "5.0",
  },
  {
    sourceDir: resolve(PROJECT_ROOT, "public/assets/evilhack"),
    assetPrefix: "assets/evilhack",
    tileLayoutVersion: "evilhack",
  },
];

export const TILESET_MANIFEST_SOURCE_DIRS = TILESET_MANIFEST_SOURCES.map(
  (source) => source.sourceDir,
);
const TILESET_MANIFEST_OUTPUT_FILE = resolve(
  PROJECT_ROOT,
  "src/game/tilesets.generated.ts",
);

const supportedImageExtensions = new Set([
  ".png",
  ".bmp",
  ".gif",
  ".jpg",
  ".jpeg",
  ".webp",
]);

const tilesetAtlasTileColumnsPresetByPath = {
  "assets/slashem/Abigaba.bmp": 38,
  "assets/slashem/Absurd.png": 38,
};

function inferTileSizeFromFileName(fileName) {
  const name = parse(fileName).name;
  const numericTokens = name.match(/\d{1,3}/g) ?? [];
  for (const token of numericTokens) {
    const parsed = Number.parseInt(token, 10);
    if (Number.isFinite(parsed) && parsed >= 8 && parsed <= 128) {
      return parsed;
    }
  }
  return 32;
}

function getPngImageSize(bytes) {
  if (bytes.length < 24) {
    return null;
  }
  const pngSignature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function getBmpImageSize(bytes) {
  if (bytes.length < 26 || bytes.toString("ascii", 0, 2) !== "BM") {
    return null;
  }
  return {
    width: Math.abs(bytes.readInt32LE(18)),
    height: Math.abs(bytes.readInt32LE(22)),
  };
}

function getGifImageSize(bytes) {
  if (
    bytes.length < 10 ||
    (bytes.toString("ascii", 0, 6) !== "GIF87a" &&
      bytes.toString("ascii", 0, 6) !== "GIF89a")
  ) {
    return null;
  }
  return {
    width: bytes.readUInt16LE(6),
    height: bytes.readUInt16LE(8),
  };
}

function getJpegImageSize(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (offset + 4 > bytes.length) {
      break;
    }
    const segmentLength = bytes.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      break;
    }
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && offset + 9 < bytes.length) {
      return {
        width: bytes.readUInt16BE(offset + 7),
        height: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function getWebpImageSize(bytes) {
  if (
    bytes.length < 30 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }
  const chunkType = bytes.toString("ascii", 12, 16);
  if (chunkType === "VP8 ") {
    if (bytes.length < 30) {
      return null;
    }
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunkType === "VP8L") {
    if (bytes.length < 25) {
      return null;
    }
    const bits = bytes.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunkType === "VP8X") {
    if (bytes.length < 30) {
      return null;
    }
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }
  return null;
}

function readImageSize(filePath) {
  const bytes = readFileSync(filePath);
  return (
    getPngImageSize(bytes) ??
    getBmpImageSize(bytes) ??
    getGifImageSize(bytes) ??
    getJpegImageSize(bytes) ??
    getWebpImageSize(bytes)
  );
}

function inferTileSizeFromFile(filePath, assetPath) {
  const imageSize = readImageSize(filePath);
  const columns = tilesetAtlasTileColumnsPresetByPath[assetPath] ?? 40;
  if (imageSize?.width && imageSize.width >= columns) {
    const inferred = Math.trunc(imageSize.width / columns);
    if (Number.isFinite(inferred) && inferred >= 8 && inferred <= 512) {
      return inferred;
    }
  }
  return inferTileSizeFromFileName(parse(filePath).base);
}

function toDisplayLabel(fileName) {
  const raw = parse(fileName).name.replace(/[_-]+/g, " ").trim();
  return raw.length > 0 ? raw : fileName;
}

function listTilesetFiles(sourceDir) {
  if (!existsSync(sourceDir)) {
    return [];
  }
  return readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) =>
      supportedImageExtensions.has(extname(fileName).toLowerCase()),
    )
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
}

function buildManifestSource() {
  const entries = TILESET_MANIFEST_SOURCES.flatMap((source) =>
    listTilesetFiles(source.sourceDir).map((fileName) => {
      const assetPath = join(source.assetPrefix, fileName).replace(/\\/g, "/");
      const filePath = join(source.sourceDir, fileName);
      return {
        label: toDisplayLabel(fileName),
        path: assetPath,
        tileSize: inferTileSizeFromFile(filePath, assetPath),
        tileLayoutVersion: source.tileLayoutVersion,
      };
    }),
  );

  const serializedEntries = JSON.stringify(entries, null, 2);
  return `/* AUTO-GENERATED FILE. DO NOT EDIT.
 *
 * Generated by scripts/tilesets/generate-tileset-manifest.mjs
 */

export type GeneratedTilesetManifestEntry = {
  readonly label: string;
  readonly path: string;
  readonly tileSize: number;
  readonly tileLayoutVersion: "slashem" | "3.4.3" | "3.6.7" | "5.0" | "evilhack";
};

export const GENERATED_TILESET_MANIFEST: ReadonlyArray<GeneratedTilesetManifestEntry> =
  ${serializedEntries} as const;
`;
}

export function generateTilesetManifest() {
  mkdirSync(dirname(TILESET_MANIFEST_OUTPUT_FILE), { recursive: true });
  const nextSource = buildManifestSource();
  const previousSource = existsSync(TILESET_MANIFEST_OUTPUT_FILE)
    ? readFileSync(TILESET_MANIFEST_OUTPUT_FILE, "utf8")
    : "";
  if (nextSource === previousSource) {
    return;
  }
  writeFileSync(TILESET_MANIFEST_OUTPUT_FILE, nextSource, "utf8");
}

