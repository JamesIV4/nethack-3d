import {
  useRef,
  useState
} from "react";
import {
  type StoredUserTilesetRecord,
  type StoredUserTilesetTileLayoutVersion
} from "../../../game/user-tileset-storage";
import {
  defaultUserTilesetTileLayoutVersion
} from "../tilesets/user-tilesets";
import type {
  TileAtlasState
} from "../tilesets/atlas";
import {
  createDefaultTileAtlasState
} from "../tilesets/atlas";

/** Owns uploaded tilesets, editor fields and loaded atlas state. */
export function useTilesetState() {
  const [userTilesets, setUserTilesets] = useState<StoredUserTilesetRecord[]>(
    [],
  );

  const [tilesetManagerMode, setTilesetManagerMode] = useState<"edit" | "new">(
    "edit",
  );

  const [tilesetManagerName, setTilesetManagerName] = useState("");
  const [tilesetManagerTileHeight, setTilesetManagerTileHeight] = useState("");
  const [tilesetManagerTileDimensions, setTilesetManagerTileDimensions] =
    useState<{ tileWidth: number; tileHeight: number } | null>(null);

  const [tilesetManagerTileLayoutVersion, setTilesetManagerTileLayoutVersion] =
    useState<StoredUserTilesetTileLayoutVersion>(
      defaultUserTilesetTileLayoutVersion,
    );

  const [tilesetManagerEditPath, setTilesetManagerEditPath] = useState("");

  const [tilesetManagerFile, setTilesetManagerFile] = useState<File | null>(
    null,
  );

  const [tilesetManagerError, setTilesetManagerError] = useState("");

  const [tilesetManagerBusy, setTilesetManagerBusy] = useState(false);

  const tilesetManagerFileInputRef = useRef<HTMLInputElement | null>(null);

  const [tileAtlasImage, setTileAtlasImage] = useState<HTMLImageElement | null>(
    null,
  );

  const [tileAtlasState, setTileAtlasState] = useState<TileAtlasState>(() =>
    createDefaultTileAtlasState(),
  );

  const [tilesetManagerAtlasImage, setTilesetManagerAtlasImage] =
    useState<HTMLImageElement | null>(null);

  const [tilesetManagerAtlasState, setTilesetManagerAtlasState] =
    useState<TileAtlasState>(() => createDefaultTileAtlasState());
  return {
    userTilesets,
    setUserTilesets,
    tilesetManagerMode,
    setTilesetManagerMode,
    tilesetManagerName,
    setTilesetManagerName,
    tilesetManagerTileHeight,
    setTilesetManagerTileHeight,
    tilesetManagerTileDimensions,
    setTilesetManagerTileDimensions,
    tilesetManagerTileLayoutVersion,
    setTilesetManagerTileLayoutVersion,
    tilesetManagerEditPath,
    setTilesetManagerEditPath,
    tilesetManagerFile,
    setTilesetManagerFile,
    tilesetManagerError,
    setTilesetManagerError,
    tilesetManagerBusy,
    setTilesetManagerBusy,
    tilesetManagerFileInputRef,
    tileAtlasImage,
    setTileAtlasImage,
    tileAtlasState,
    setTileAtlasState,
    tilesetManagerAtlasImage,
    setTilesetManagerAtlasImage,
    tilesetManagerAtlasState,
    setTilesetManagerAtlasState,
  } as const;
}
