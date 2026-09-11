import {
  type CSSProperties
} from "react";
import type {
  PlayerStatsSnapshot
} from "../../../game/ui-types";
import type * as React from "react";
import type {
  CoreStatKey
} from "./core-stats";
import type {
  PlayerStatusBadge
} from "./conditions";

export interface StatusBarProps {
  startup: boolean;
  gameOverDialogShowsTombstone: boolean;
  playerStats: PlayerStatsSnapshot;
  hpPercentage: number;
  hpColor: "#00ff00" | "#ffaa00" | "#ff0000";
  powerPercentage: number;
  resolveCoreStatStyle: (key: CoreStatKey) => React.CSSProperties | undefined;
  playerStatusBadges: PlayerStatusBadge[];
  visibleLocationLabel: string;
}

export function StatusBar({
  startup,
  gameOverDialogShowsTombstone,
  playerStats,
  hpPercentage,
  hpColor,
  powerPercentage,
  resolveCoreStatStyle,
  playerStatusBadges,
  visibleLocationLabel,
}: StatusBarProps) {
  return (
    !startup && !gameOverDialogShowsTombstone && (
      <div id="stats-bar">
        <div className="nh3d-stats-name">
          {playerStats.name}
          <span className="nh3d-stats-name-level">
            {" "}
            (Lvl {playerStats.level})
          </span>
        </div>
        <div className="nh3d-stats-meter">
          <div className="nh3d-stats-meter-label nh3d-stats-meter-label-hp">
            HP: {playerStats.hp}/{playerStats.maxHp}
          </div>
          <div className="nh3d-stats-meter-track">
            <div
              className="nh3d-stats-meter-fill"
              style={{
                width: `${hpPercentage}%`,
                backgroundColor: hpColor,
              }}
            />
          </div>
        </div>
        {playerStats.maxPower > 0 ? (
          <div className="nh3d-stats-meter">
            <div className="nh3d-stats-meter-label nh3d-stats-meter-label-pw">
              Pw: {playerStats.power}/{playerStats.maxPower}
            </div>
            <div className="nh3d-stats-meter-track">
              <div
                className="nh3d-stats-meter-fill nh3d-stats-meter-fill-pw"
                style={{ width: `${powerPercentage}%` }}
              />
            </div>
          </div>
        ) : null}
        <div className="nh3d-stats-group nh3d-stats-group-core">
          <div className="nh3d-stats-core-row nh3d-stats-core-row-primary">
            <div
              className="nh3d-stats-core"
              style={resolveCoreStatStyle("strength")}
            >
              St:{playerStats.strength}
            </div>
            <div
              className="nh3d-stats-core"
              style={resolveCoreStatStyle("dexterity")}
            >
              Dx:{playerStats.dexterity}
            </div>
            <div
              className="nh3d-stats-core"
              style={resolveCoreStatStyle("constitution")}
            >
              Co:{playerStats.constitution}
            </div>
            <div
              className="nh3d-stats-core"
              style={resolveCoreStatStyle("intelligence")}
            >
              In:{playerStats.intelligence}
            </div>
            <div
              className="nh3d-stats-core"
              style={resolveCoreStatStyle("wisdom")}
            >
              Wi:{playerStats.wisdom}
            </div>
          </div>
          <div className="nh3d-stats-core-row nh3d-stats-core-row-secondary">
            <div
              className="nh3d-stats-core"
              style={resolveCoreStatStyle("charisma")}
            >
              Ch:{playerStats.charisma}
            </div>
            <div
              className="nh3d-stats-secondary-ac nh3d-stats-mobile-inline-secondary"
              style={resolveCoreStatStyle("armor")}
            >
              AC:{playerStats.armor}
            </div>
            <div className="nh3d-stats-secondary-exp nh3d-stats-mobile-inline-secondary">
              Exp:{playerStats.experience}
            </div>
            <div className="nh3d-stats-secondary-time nh3d-stats-mobile-inline-secondary">
              T:{playerStats.time}
            </div>
            <div className="nh3d-stats-secondary-gold nh3d-stats-mobile-inline-secondary">
              $:{playerStats.gold}
            </div>
          </div>
        </div>
        <div className="nh3d-stats-group nh3d-stats-group-secondary">
          <div
            className="nh3d-stats-secondary-ac nh3d-stats-desktop-secondary"
            style={resolveCoreStatStyle("armor")}
          >
            AC:{playerStats.armor}
          </div>
          <div className="nh3d-stats-secondary-exp nh3d-stats-desktop-secondary">
            Exp:{playerStats.experience}
          </div>
          <div className="nh3d-stats-secondary-gold nh3d-stats-desktop-secondary">
            $:{playerStats.gold}
          </div>
          <div className="nh3d-stats-secondary-time nh3d-stats-desktop-secondary">
            T:{playerStats.time}
          </div>
          <div className="nh3d-stats-hunger nh3d-stats-desktop-secondary">
            <span className="nh3d-stats-status-list">
              {playerStatusBadges.map((status) => (
                <span
                  className={`nh3d-stats-status-badge is-${status.severity}`}
                  key={`desktop-status-${status.label}`}
                >
                  {status.label}
                </span>
              ))}
            </span>
          </div>
        </div>
        <div className="nh3d-stats-location">
          <div className="nh3d-stats-dungeon">
            {visibleLocationLabel}
            {playerStatusBadges.length > 0 ? (
              <span className="nh3d-stats-mobile-location-status">
                <span className="nh3d-stats-status-list">
                  {playerStatusBadges.map((status) => (
                    <span
                      className={`nh3d-stats-status-badge is-${status.severity}`}
                      key={`mobile-status-${status.label}`}
                    >
                      {status.label}
                    </span>
                  ))}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    )
  );
}
