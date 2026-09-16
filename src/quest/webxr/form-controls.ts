/** Keep select choices on the live HTML surface instead of Wolvic's native prompt layer. */
export function selectMenuPosition(
  select: Pick<DOMRect, "left" | "top" | "bottom" | "width">,
  menu: Pick<DOMRect, "width" | "height">,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number; minWidth: number; maxWidth: number; maxHeight: number } {
  const margin = 8;
  const maxWidth = Math.max(0, viewportWidth - margin * 2);
  const minWidth = Math.min(select.width, maxWidth);
  const below = viewportHeight - select.bottom - margin, above = select.top - margin;
  const maxHeight = Math.max(80, Math.max(above, below));
  return {
    minWidth, maxWidth, maxHeight,
    left: Math.max(margin, Math.min(select.left, viewportWidth - menu.width - margin)),
    top: below >= menu.height || below >= above ? select.bottom : Math.max(margin, select.top - menu.height),
  };
}

export function initializeQuestFormControls(): () => void {
  const host = new URLSearchParams(location.search).get("xrHost");
  if (host !== "native" && host !== "wired" && location.origin !== "http://127.0.0.1:18973") return () => {};
  const abort = new AbortController();
  let popupId = 0, prefix = "", typedAt = 0;
  let active: {
    select: HTMLSelectElement;
    menu: HTMLDivElement;
    buttons: HTMLButtonElement[];
    close: () => void;
    position: () => void;
  } | null = null;

  const open = (select: HTMLSelectElement): void => {
    if (active?.select === select) return;
    active?.close();
    const menu = document.createElement("div");
    const id = `nh3d-select-menu-${++popupId}`;
    const previousExpanded = select.getAttribute("aria-expanded");
    const previousControls = select.getAttribute("aria-controls");
    menu.id = id; menu.className = "nh3d-select-menu";
    menu.setAttribute("role", "listbox"); menu.setAttribute("aria-label", select.getAttribute("aria-label") || "Choose an option");
    if (select.multiple) menu.setAttribute("aria-multiselectable", "true");
    select.setAttribute("aria-expanded", "true"); select.setAttribute("aria-controls", id);
    const list = document.createElement("div"); list.className = "nh3d-select-choices";
    const buttons: HTMLButtonElement[] = [], options = Array.from(select.options);
    const selected = new Set(options.filter(option => option.selected));
    const initial = new Set(selected);
    const disabled = (option: HTMLOptionElement) => option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled);
    let observer: ResizeObserver | null = null;
    const close = (): void => {
      if (active?.menu !== menu) return;
      active = null; observer?.disconnect(); menu.remove(); prefix = "";
      if (previousExpanded === null) select.removeAttribute("aria-expanded"); else select.setAttribute("aria-expanded", previousExpanded);
      if (previousControls === null) select.removeAttribute("aria-controls"); else select.setAttribute("aria-controls", previousControls);
      if (select.isConnected) select.focus({ preventScroll: true });
    };
    const commit = (): void => {
      if (!select.isConnected || select.disabled) { close(); return; }
      const current = Array.from(select.options);
      if ([...selected].some(option => !current.includes(option) || (disabled(option) && !initial.has(option)))) { close(); return; }
      const changed = current.some(option => option.selected !== selected.has(option));
      if (select.multiple) current.forEach(option => { option.selected = selected.has(option); });
      else select.selectedIndex = current.findIndex(option => selected.has(option));
      close();
      if (changed) {
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    let group: Element | null = null;
    for (const option of options) {
      if (option.hidden || option.parentElement?.hidden) continue;
      if (option.parentElement instanceof HTMLOptGroupElement && option.parentElement !== group) {
        group = option.parentElement; const heading = document.createElement("div");
        heading.className = "nh3d-select-group"; heading.textContent = option.parentElement.label; list.append(heading);
      }
      const button = document.createElement("button"); button.type = "button"; button.className = "nh3d-select-choice nh3d-choice-button";
      button.textContent = option.label; button.disabled = disabled(option); button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(selected.has(option)));
      button.onclick = event => {
        event.stopPropagation();
        if (disabled(option)) return;
        if (select.multiple) {
          if (selected.has(option)) selected.delete(option); else selected.add(option);
          button.setAttribute("aria-selected", String(selected.has(option)));
        } else { selected.clear(); selected.add(option); commit(); }
      };
      buttons.push(button); list.append(button);
    }
    const actions = document.createElement("div"); actions.className = "nh3d-select-actions";
    if (select.multiple) {
      const confirm = document.createElement("button"); confirm.type = "button"; confirm.className = "nh3d-choice-button"; confirm.textContent = "Apply"; confirm.onclick = commit; actions.append(confirm);
      const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "nh3d-choice-button"; cancel.textContent = "Cancel"; cancel.onclick = close; actions.append(cancel);
    }
    menu.append(list); if (select.multiple) menu.append(actions); document.body.append(menu);
    const position = (): void => {
      if (!select.isConnected || !menu.isConnected) return;
      const rect = select.getBoundingClientRect();
      const initial = selectMenuPosition(rect, menu.getBoundingClientRect(), innerWidth, innerHeight);
      menu.style.minWidth = `${initial.minWidth}px`; menu.style.maxWidth = `${initial.maxWidth}px`; menu.style.maxHeight = `${initial.maxHeight}px`;
      const positioned = selectMenuPosition(rect, menu.getBoundingClientRect(), innerWidth, innerHeight);
      menu.style.left = `${positioned.left}px`; menu.style.top = `${positioned.top}px`;
    };
    active = { select, menu, buttons, close, position };
    observer = new ResizeObserver(position); observer.observe(select); observer.observe(menu); position();
    (buttons.find(button => !button.disabled && button.getAttribute("aria-selected") === "true") ?? buttons.find(button => !button.disabled) ?? select).focus({ preventScroll: true });
  };
  const pointer = (event: Event): void => {
    const element = event.target instanceof Element ? event.target : null;
    const target = element?.closest("select");
    if (active && !active.menu.contains(element) && target !== active.select) active.close();
    if (!(target instanceof HTMLSelectElement) || target.disabled || target.size > 1) return;
    if (event instanceof MouseEvent && event.button !== 0) return;
    event.preventDefault(); event.stopImmediatePropagation(); open(target);
  };
  for (const type of ["pointerdown", "mousedown", "touchstart", "click"]) document.addEventListener(type, pointer, { capture: true, passive: false, signal: abort.signal });
  window.addEventListener("resize", () => active?.position(), { signal: abort.signal });
  document.addEventListener("scroll", () => active?.position(), { capture: true, signal: abort.signal });
  window.addEventListener("keydown", event => {
    if (!active) {
      const target = event.target;
      if (target instanceof HTMLSelectElement && !target.disabled && target.size <= 1 &&
          (event.key === "Enter" || event.key === " " || event.key === "F4" || (event.altKey && event.key === "ArrowDown"))) {
        event.preventDefault(); event.stopImmediatePropagation(); open(target);
      }
      return;
    }
    event.stopImmediatePropagation();
    const popup = active, enabled = popup.buttons.filter(button => !button.disabled);
    if (event.key === "Escape") { event.preventDefault(); popup.close(); return; }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); if (document.activeElement instanceof HTMLButtonElement && popup.menu.contains(document.activeElement)) document.activeElement.click(); return;
    }
    if (event.key === "Tab") {
      event.preventDefault(); const controls = Array.from(popup.menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const index = controls.indexOf(document.activeElement as HTMLButtonElement);
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus(); return;
    }
    let next: HTMLButtonElement | undefined;
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") next = enabled[(index + 1) % enabled.length];
    if (event.key === "ArrowUp") next = enabled[(index - 1 + enabled.length) % enabled.length];
    if (event.key === "Home") next = enabled[0];
    if (event.key === "End") next = enabled[enabled.length - 1];
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = performance.now(); prefix = now - typedAt > 700 ? event.key : prefix + event.key; typedAt = now;
      next = enabled.find(button => button.textContent?.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()));
    }
    if (next) { event.preventDefault(); next.focus(); next.scrollIntoView({ block: "nearest" }); }
  }, { capture: true, signal: abort.signal });
  return () => { active?.close(); abort.abort(); };
}
