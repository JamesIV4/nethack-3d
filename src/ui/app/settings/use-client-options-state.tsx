import {
  useMemo,
  useRef,
  useState
} from "react";
import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import type {
  Nh3dVersionCheckResult
} from "../../../update/types";
import {
  resolveDeviceDefaultClientOptions
} from "./defaults";
import type {
  ClientOptionsTabId,
  ManualSafeZonePreview
} from "./types";
import {
  resolveClientOptionsDefaultTabId
} from "./config";

/** Owns applied options, draft options, hydration and settings dialog state. */
export function useClientOptionsState() {
  const initialPersistedClientOptionsRef =
    useRef<Partial<Nh3dClientOptions> | null>(null);

  const initialClientOptions = useMemo(
    () => resolveDeviceDefaultClientOptions(),
    [],
  );

  const [clientOptions, setClientOptions] = useState<Nh3dClientOptions>(
    () => initialClientOptions,
  );

  const [clientOptionsDraft, setClientOptionsDraft] =
    useState<Nh3dClientOptions>(() => initialClientOptions);

  const [manualSafeZonePreview, setManualSafeZonePreview] =
    useState<ManualSafeZonePreview | null>(null);

  const manualSafeZonePreviewTimerRef = useRef<number | null>(null);

  const [hasHydratedUserTilesets, setHasHydratedUserTilesets] = useState(false);

  const [isClientOptionsVisible, setIsClientOptionsVisible] = useState(false);

  const [activeClientOptionsTab, setActiveClientOptionsTab] =
    useState<ClientOptionsTabId>(resolveClientOptionsDefaultTabId);

  const [optionsUpdateCheckBusy, setOptionsUpdateCheckBusy] = useState(false);

  const [optionsUpdateCheckResult, setOptionsUpdateCheckResult] =
    useState<Nh3dVersionCheckResult | null>(null);

  const [optionsUpdateCheckStatus, setOptionsUpdateCheckStatus] = useState("");
  return {
    initialPersistedClientOptionsRef,
    clientOptions,
    setClientOptions,
    clientOptionsDraft,
    setClientOptionsDraft,
    manualSafeZonePreview,
    setManualSafeZonePreview,
    manualSafeZonePreviewTimerRef,
    hasHydratedUserTilesets,
    setHasHydratedUserTilesets,
    isClientOptionsVisible,
    setIsClientOptionsVisible,
    activeClientOptionsTab,
    setActiveClientOptionsTab,
    optionsUpdateCheckBusy,
    setOptionsUpdateCheckBusy,
    optionsUpdateCheckResult,
    setOptionsUpdateCheckResult,
    optionsUpdateCheckStatus,
    setOptionsUpdateCheckStatus,
  } as const;
}
