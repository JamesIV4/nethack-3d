/** Keep select choices on the live HTML surface instead of Wolvic's native prompt layer. */
export function initializeQuestFormControls(): () => void {
  const host = new URLSearchParams(location.search).get("xrHost");
  if (host !== "native" && host !== "wired" && location.origin !== "http://127.0.0.1:18973") return () => {};
  const abort = new AbortController();
  let active: { select: HTMLSelectElement; backdrop: HTMLDivElement; dialog: HTMLDivElement; buttons: HTMLButtonElement[]; close: () => void } | null = null;
  let prefix = "", typedAt = 0;
  const open = (select: HTMLSelectElement): void => {
    if (active?.select === select) return;
    active?.close();
    const backdrop = document.createElement("div"); backdrop.className = "nh3d-select-backdrop";
    const dialog = document.createElement("div"); dialog.className = "nh3d-dialog is-visible nh3d-select-dialog";
    dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-label", "Choose an option");
    const heading = document.createElement("h2");
    const label = select.labels?.[0]?.cloneNode(true) as HTMLElement | undefined;
    label?.querySelectorAll("select,button,svg").forEach(node => node.remove());
    heading.textContent = select.getAttribute("aria-label") || label?.textContent?.trim().slice(0, 160) || "Choose an option";
    const list = document.createElement("div"); list.className = "nh3d-select-choices"; list.setAttribute("role", "listbox");
    if (select.multiple) list.setAttribute("aria-multiselectable", "true");
    const buttons: HTMLButtonElement[] = [], options = Array.from(select.options);
    const selected = new Set(options.filter(o => o.selected));
    const initial = new Set(selected);
    const disabled = (o: HTMLOptionElement) => o.disabled || (o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled);
    const close = (): void => {
      if (active?.backdrop !== backdrop) return;
      active = null; backdrop.remove(); prefix = "";
      if (select.isConnected) select.focus({ preventScroll: true });
    };
    const commit = (): void => {
      if (!select.isConnected || select.disabled) { close(); return; }
      const current = Array.from(select.options);
      if ([...selected].some(o => !current.includes(o) || (disabled(o) && !initial.has(o)))) { close(); return; }
      const changed = current.some(o => o.selected !== selected.has(o));
      if (select.multiple) current.forEach(o => { o.selected = selected.has(o); });
      else select.selectedIndex = current.findIndex(o => selected.has(o));
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
        group = option.parentElement; const label = document.createElement("div");
        label.className = "nh3d-select-group"; label.textContent = option.parentElement.label; list.append(label);
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
    if (select.multiple) { const confirm = document.createElement("button"); confirm.type = "button"; confirm.className = "nh3d-choice-button"; confirm.textContent = "Apply"; confirm.onclick = commit; actions.append(confirm); }
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "nh3d-choice-button"; cancel.textContent = "Cancel"; cancel.onclick = close; actions.append(cancel);
    dialog.append(heading, list, actions); backdrop.append(dialog); document.body.append(backdrop);
    active = { select, backdrop, dialog, buttons, close };
    backdrop.onclick = event => { if (event.target === backdrop) { event.preventDefault(); event.stopPropagation(); close(); } };
    (buttons.find(b => !b.disabled && b.getAttribute("aria-selected") === "true") ?? buttons.find(b => !b.disabled) ?? cancel).focus({ preventScroll: true });
  };
  const pointer = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest("select") : null;
    if (!(target instanceof HTMLSelectElement) || target.disabled || target.size > 1) return;
    if (event instanceof MouseEvent && event.button !== 0) return;
    event.preventDefault(); event.stopImmediatePropagation(); open(target);
  };
  for (const type of ["pointerdown", "mousedown", "touchstart", "click"]) document.addEventListener(type, pointer, { capture: true, passive: false, signal: abort.signal });
  document.addEventListener("keydown", event => {
    if (!active) {
      const target = event.target;
      if (target instanceof HTMLSelectElement && !target.disabled && target.size <= 1 &&
          (event.key === "Enter" || event.key === " " || event.key === "F4" || (event.altKey && event.key === "ArrowDown"))) {
        event.preventDefault(); event.stopImmediatePropagation(); open(target);
      }
      return;
    }
    event.stopImmediatePropagation();
    const popup = active, enabled = popup.buttons.filter(b => !b.disabled);
    if (event.key === "Escape") { event.preventDefault(); popup.close(); return; }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); if (document.activeElement instanceof HTMLButtonElement && popup.dialog.contains(document.activeElement)) document.activeElement.click(); return;
    }
    if (event.key === "Tab") {
      event.preventDefault(); const controls = Array.from(popup.dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
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
      next = enabled.find(b => b.textContent?.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()));
    }
    if (next) { event.preventDefault(); next.focus(); next.scrollIntoView({ block: "nearest" }); }
  }, { capture: true, signal: abort.signal });
  return () => { active?.close(); abort.abort(); };
}
