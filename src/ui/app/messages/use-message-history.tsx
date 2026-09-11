import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import type {
  InfoMenuState
} from "../../../game/ui-types";
import type * as React from "react";
import type {
  MessageInfoMenuHistoryState
} from "../menus/message-history";
import {
  getInfoMenuHistoryEntryKey,
  isNetHackMessageInfoMenuTitle,
  messageInfoMenuCacheLimit
} from "../menus/message-history";

/** Cached NetHack message menu navigation */
export function useMessageHistoryState() {
  const [messageInfoMenuHistory, setMessageInfoMenuHistory] =
    useState<MessageInfoMenuHistoryState>({
      entries: [],
      index: 0,
    });
  return {
    messageInfoMenuHistory,
    setMessageInfoMenuHistory,
  } as const;
}

export interface UseMessageHistoryViewDependencies {
  readonly infoMenu: InfoMenuState | null;
  readonly setMessageInfoMenuHistory: React.Dispatch<React.SetStateAction<MessageInfoMenuHistoryState>>;
  readonly messageInfoMenuHistory: MessageInfoMenuHistoryState;
}

/** Cached NetHack message menu navigation */
export function useMessageHistoryView(dependencies: UseMessageHistoryViewDependencies) {
  const {
    infoMenu,
    setMessageInfoMenuHistory,
    messageInfoMenuHistory,
  } = dependencies;

  useEffect(() => {
    if (!infoMenu || !isNetHackMessageInfoMenuTitle(infoMenu.title)) {
      return;
    }

    const normalizedMessageInfoMenu: InfoMenuState = {
      title: String(infoMenu.title || "NetHack Message").trim(),
      lines: Array.isArray(infoMenu.lines)
        ? infoMenu.lines.map((line) => String(line ?? ""))
        : [],
    };
    const nextEntryKey = getInfoMenuHistoryEntryKey(normalizedMessageInfoMenu);

    setMessageInfoMenuHistory((previous) => {
      const latestEntry = previous.entries[previous.entries.length - 1];
      if (
        latestEntry &&
        getInfoMenuHistoryEntryKey(latestEntry) === nextEntryKey
      ) {
        const latestIndex = previous.entries.length - 1;
        return previous.index === latestIndex
          ? previous
          : {
            ...previous,
            index: latestIndex,
          };
      }

      const nextEntries = [
        ...previous.entries,
        normalizedMessageInfoMenu,
      ].slice(-messageInfoMenuCacheLimit);
      return {
        entries: nextEntries,
        index: nextEntries.length - 1,
      };
    });
  }, [infoMenu]);

  const displayedInfoMenu = useMemo<InfoMenuState | null>(() => {
    if (!infoMenu) {
      return null;
    }
    if (!isNetHackMessageInfoMenuTitle(infoMenu.title)) {
      return infoMenu;
    }
    return (
      messageInfoMenuHistory.entries[messageInfoMenuHistory.index] ?? infoMenu
    );
  }, [infoMenu, messageInfoMenuHistory]);
  return {
    displayedInfoMenu,
  } as const;
}

export interface UseMessageHistoryNavigationDependencies {
  readonly setMessageInfoMenuHistory: React.Dispatch<React.SetStateAction<MessageInfoMenuHistoryState>>;
  readonly displayedInfoMenu: InfoMenuState | null;
  readonly messageInfoMenuHistory: MessageInfoMenuHistoryState;
}

/** Cached NetHack message menu navigation */
export function useMessageHistoryNavigation(dependencies: UseMessageHistoryNavigationDependencies) {
  const {
    setMessageInfoMenuHistory,
    displayedInfoMenu,
    messageInfoMenuHistory,
  } = dependencies;

  const showPreviousCachedMessageInfoMenu = useCallback((): void => {
    setMessageInfoMenuHistory((previous) =>
      previous.index <= 0
        ? previous
        : {
          ...previous,
          index: previous.index - 1,
        },
    );
  }, []);

  const showEarliestCachedMessageInfoMenu = useCallback((): void => {
    setMessageInfoMenuHistory((previous) =>
      previous.index <= 0
        ? previous
        : {
          ...previous,
          index: 0,
        },
    );
  }, []);

  const showNextCachedMessageInfoMenu = useCallback((): void => {
    setMessageInfoMenuHistory((previous) => {
      const lastIndex = previous.entries.length - 1;
      return previous.index >= lastIndex
        ? previous
        : {
          ...previous,
          index: previous.index + 1,
        };
    });
  }, []);

  const showLatestCachedMessageInfoMenu = useCallback((): void => {
    setMessageInfoMenuHistory((previous) => {
      const lastIndex = previous.entries.length - 1;
      return previous.index >= lastIndex
        ? previous
        : {
          ...previous,
          index: lastIndex,
        };
    });
  }, []);

  const showMessageHistoryNavigation = Boolean(
    displayedInfoMenu &&
    isNetHackMessageInfoMenuTitle(displayedInfoMenu.title) &&
    messageInfoMenuHistory.entries.length > 1,
  );

  const canShowPreviousCachedMessage = messageInfoMenuHistory.index > 0;

  const canShowNextCachedMessage =
    messageInfoMenuHistory.index < messageInfoMenuHistory.entries.length - 1;
  return {
    showPreviousCachedMessageInfoMenu,
    showEarliestCachedMessageInfoMenu,
    showNextCachedMessageInfoMenu,
    showLatestCachedMessageInfoMenu,
    showMessageHistoryNavigation,
    canShowPreviousCachedMessage,
    canShowNextCachedMessage,
  } as const;
}
