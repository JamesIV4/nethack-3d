import {
  t
} from "../shared/translations";

/** Mobile quick-action catalog and action sheet contracts. */
export type MobileActionEntry = {
  id: string;
  label: string;
  kind: "quick" | "extended";
  value: string;
};

export type MobileActionSheetMode = "quick" | "extended";

export const mobileActions: MobileActionEntry[] = [
  { id: "wait", label: t.mobileActions.wait, kind: "quick", value: "wait" },
  { id: "zap", label: t.mobileActions.zap, kind: "extended", value: "zap" },
  { id: "cast", label: t.mobileActions.cast, kind: "extended", value: "cast" },
  { id: "kick", label: t.mobileActions.kick, kind: "extended", value: "kick" },
  { id: "read", label: t.mobileActions.read, kind: "extended", value: "read" },
  {
    id: "quaff",
    label: t.mobileActions.quaff,
    kind: "extended",
    value: "quaff",
  },
  { id: "eat", label: t.mobileActions.eat, kind: "extended", value: "eat" },
  {
    id: "glance",
    label: t.mobileActions.glance,
    kind: "extended",
    value: "glance",
  },
  { id: "loot", label: t.mobileActions.loot, kind: "quick", value: "loot" },
  { id: "open", label: t.mobileActions.open, kind: "quick", value: "open" },
  {
    id: "wield",
    label: t.mobileActions.wield,
    kind: "extended",
    value: "wield",
  },
  { id: "wear", label: t.mobileActions.wear, kind: "extended", value: "wear" },
  {
    id: "put-on",
    label: t.mobileActions.putOn,
    kind: "extended",
    value: "puton",
  },
  {
    id: "take-off",
    label: t.mobileActions.takeOff,
    kind: "extended",
    value: "takeoff",
  },
  {
    id: "extended",
    label: t.mobileActions.extended,
    kind: "quick",
    value: "extended",
  },
];
