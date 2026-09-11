import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import type {
  PlayerStatsSnapshot
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import type * as React from "react";
import type {
  CoreStatKey,
  CoreStatSnapshot
} from "./core-stats";
import {
  getCoreStatValuesFromSnapshot,
  isBootstrapCoreStatSnapshot,
  trackedCoreStatKeys
} from "./core-stats";
import {
  buildPlayerStatusBadges,
  resolveCharacterStatusLineSeverity
} from "./conditions";
import type {
  PlayerStatusBadge
} from "./conditions";
import {
  t
} from "../shared/translations";

/** Stat changes, highlights, HP and power percentages, status panel renderers */
export function usePlayerStatusState() {
  const [statsBarHeight, setStatsBarHeight] = useState(0);

  const [coreStatBoldUntilTurn, setCoreStatBoldUntilTurn] = useState<
    Partial<Record<CoreStatKey, number>>
  >({});

  const previousCoreStatSnapshotRef = useRef<CoreStatSnapshot | null>(null);
  return {
    statsBarHeight,
    setStatsBarHeight,
    coreStatBoldUntilTurn,
    setCoreStatBoldUntilTurn,
    previousCoreStatSnapshotRef,
  } as const;
}

export interface UsePlayerStatusPresentationDependencies {
  readonly setCoreStatBoldUntilTurn: React.Dispatch<React.SetStateAction<Partial<Record<CoreStatKey, number>>>>;
  readonly isMobileGameRunning: boolean;
  readonly isDesktopGameRunning: boolean;
  readonly previousCoreStatSnapshotRef: React.MutableRefObject<CoreStatSnapshot | null>;
  readonly playerStats: PlayerStatsSnapshot;
  readonly coreStatBoldUntilTurn: Partial<Record<CoreStatKey, number>>;
  readonly activeRuntimeVersion: NethackRuntimeVersion;
  readonly refreshMobileStatsCoreRowScaleRef: React.MutableRefObject<(() => void) | null>;
  readonly isMobileViewport: boolean;
  readonly startup: boolean;
}

/** Stat changes, highlights, HP and power percentages, status panel renderers */
export function usePlayerStatusPresentation(dependencies: UsePlayerStatusPresentationDependencies) {
  const {
    setCoreStatBoldUntilTurn,
    isMobileGameRunning,
    isDesktopGameRunning,
    previousCoreStatSnapshotRef,
    playerStats,
    coreStatBoldUntilTurn,
    activeRuntimeVersion,
    refreshMobileStatsCoreRowScaleRef,
    isMobileViewport,
    startup,
  } = dependencies;

  useEffect(() => {
    const clearCoreStatHighlights = (): void => {
      setCoreStatBoldUntilTurn((current) =>
        Object.keys(current).length > 0 ? {} : current,
      );
    };
    if (!isMobileGameRunning && !isDesktopGameRunning) {
      previousCoreStatSnapshotRef.current = null;
      clearCoreStatHighlights();
      return;
    }

    const currentTurn = Number.isFinite(playerStats.time)
      ? Math.trunc(playerStats.time)
      : 0;
    const nextSnapshot: CoreStatSnapshot = {
      turn: currentTurn,
      playerName: String(playerStats.name || ""),
      values: getCoreStatValuesFromSnapshot(playerStats),
    };
    if (isBootstrapCoreStatSnapshot(nextSnapshot)) {
      previousCoreStatSnapshotRef.current = null;
      clearCoreStatHighlights();
      return;
    }

    const previousSnapshot = previousCoreStatSnapshotRef.current;
    if (
      !previousSnapshot ||
      nextSnapshot.turn < previousSnapshot.turn ||
      nextSnapshot.playerName !== previousSnapshot.playerName
    ) {
      previousCoreStatSnapshotRef.current = nextSnapshot;
      clearCoreStatHighlights();
      return;
    }

    const changedKeys = trackedCoreStatKeys.filter(
      (key) => nextSnapshot.values[key] !== previousSnapshot.values[key],
    );
    if (changedKeys.length > 0) {
      const highlightUntilTurn = nextSnapshot.turn + 20;
      setCoreStatBoldUntilTurn((current) => {
        const next = { ...current };
        for (const key of changedKeys) {
          next[key] = highlightUntilTurn;
        }
        return next;
      });
    }

    previousCoreStatSnapshotRef.current = nextSnapshot;
  }, [isDesktopGameRunning, isMobileGameRunning, playerStats]);

  useEffect(() => {
    const currentTurn = Number.isFinite(playerStats.time)
      ? Math.trunc(playerStats.time)
      : 0;
    setCoreStatBoldUntilTurn((current) => {
      let changed = false;
      const next: Partial<Record<CoreStatKey, number>> = {};
      for (const key of trackedCoreStatKeys) {
        const untilTurn = current[key];
        if (typeof untilTurn !== "number") {
          continue;
        }
        if (currentTurn < untilTurn) {
          next[key] = untilTurn;
          continue;
        }
        changed = true;
      }
      return changed ? next : current;
    });
  }, [playerStats.time]);

  const hpPercentage =
    playerStats.maxHp > 0
      ? Math.max(0, Math.min(100, (playerStats.hp / playerStats.maxHp) * 100))
      : 0;

  const hpColor =
    hpPercentage > 60 ? "#00ff00" : hpPercentage > 30 ? "#ffaa00" : "#ff0000";

  const powerPercentage =
    playerStats.maxPower > 0
      ? Math.max(
        0,
        Math.min(100, (playerStats.power / playerStats.maxPower) * 100),
      )
      : 0;

  const highlightedCoreStatStyle = useMemo<CSSProperties>(
    () => ({
      fontWeight: 700,
    }),
    [],
  );

  const currentStatsTurn = Number.isFinite(playerStats.time)
    ? Math.trunc(playerStats.time)
    : 0;

  const resolveCoreStatStyle = useCallback(
    (key: CoreStatKey): CSSProperties | undefined => {
      const untilTurn = coreStatBoldUntilTurn[key];
      if (typeof untilTurn !== "number" || currentStatsTurn >= untilTurn) {
        return undefined;
      }
      return highlightedCoreStatStyle;
    },
    [coreStatBoldUntilTurn, currentStatsTurn, highlightedCoreStatStyle],
  );

  const playerStatusBadges = useMemo(
    () => buildPlayerStatusBadges(playerStats, activeRuntimeVersion),
    [activeRuntimeVersion, playerStats],
  );

  const locationLabel = String(playerStats.locationLabel || "").trim();

  const fallbackLocationLabel = Number.isFinite(playerStats.dlevel)
    ? `${playerStats.dungeon} ${Math.trunc(playerStats.dlevel)}`.trim()
    : String(playerStats.dungeon || "").trim();

  const visibleLocationLabel = locationLabel || fallbackLocationLabel;

  const renderCharacterCurrentStatusPanel = (
    statusLines: readonly string[],
    fallbackBadges: readonly PlayerStatusBadge[] = [],
  ): JSX.Element => {
    const normalizedStatusLines = Array.isArray(statusLines) ? statusLines : [];
    const normalizedFallbackBadges = Array.isArray(fallbackBadges)
      ? fallbackBadges
      : [];
    return (
      <section className="nh3d-character-panel">
        <div className="nh3d-character-panel-title">
          {t.dialogs.info.currentStatus}
        </div>
        {normalizedStatusLines.length > 0 ? (
          <div className="nh3d-character-chip-list">
            {normalizedStatusLines.map((line, index) => {
              const severity = resolveCharacterStatusLineSeverity(
                line,
                playerStats,
                activeRuntimeVersion,
              );
              return (
                <div
                  className={`nh3d-character-chip${severity ? ` is-${severity}` : ""
                    }`}
                  key={`character-status-${index}`}
                >
                  {line}
                </div>
              );
            })}
          </div>
        ) : normalizedFallbackBadges.length > 0 ? (
          <div className="nh3d-character-chip-list">
            {normalizedFallbackBadges.map((status) => (
              <div
                className={`nh3d-character-chip is-${status.severity}`}
                key={`character-status-badge-${status.label}`}
              >
                {status.label}
              </div>
            ))}
          </div>
        ) : (
          <div className="nh3d-character-line">
            {t.dialogs.info.noActiveStatus}
          </div>
        )}
      </section>
    );
  };

  const renderCharacterCurrentAttributesPanel = (
    attributeLines: readonly string[],
  ): JSX.Element => {
    const normalizedAttributeLines = Array.isArray(attributeLines)
      ? attributeLines
      : [];
    return (
      <section className="nh3d-character-panel">
        <div className="nh3d-character-panel-title">
          {t.dialogs.info.currentAttributes}
        </div>
        <div className="nh3d-character-chip-list">
          {normalizedAttributeLines.length > 0 ? (
            normalizedAttributeLines.map((line, index) => (
              <div
                className="nh3d-character-chip"
                key={`character-attributes-${index}`}
              >
                {line}
              </div>
            ))
          ) : (
            <div className="nh3d-character-line">
              {t.dialogs.info.noTemporaryAttributes}
            </div>
          )}
        </div>
      </section>
    );
  };

  useLayoutEffect(() => {
    refreshMobileStatsCoreRowScaleRef.current?.();
  }, [
    isMobileViewport,
    startup,
    playerStats.strength,
    playerStats.dexterity,
    playerStats.constitution,
    playerStats.intelligence,
    playerStats.wisdom,
    playerStats.charisma,
    playerStats.armor,
    playerStats.experience,
    playerStats.time,
    playerStats.gold,
    playerStatusBadges,
  ]);
  return {
    hpPercentage,
    hpColor,
    powerPercentage,
    resolveCoreStatStyle,
    playerStatusBadges,
    visibleLocationLabel,
    renderCharacterCurrentStatusPanel,
    renderCharacterCurrentAttributesPanel,
  } as const;
}
