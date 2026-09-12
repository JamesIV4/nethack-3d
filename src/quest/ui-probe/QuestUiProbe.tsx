import { useCallback, useEffect, useRef, useState } from "react";
import { TextInputDialog } from "../../ui/app/prompts/TextInputDialog";
import { OptionDescriptionInfo } from "../../ui/app/settings/OptionLabelWithInfo";
import AnimatedDialog from "../../ui/modals/AnimatedDialog";
import { Nh3dIcon, Nh3dIconInfo } from "../../ui/icons";

const itemNames = [
  "a blessed +1 long sword",
  "an uncursed leather armor",
  "a potion of healing",
  "a scroll of identify",
  "a wand of light",
  "an uncursed food ration",
];
const inventoryRows = Array.from({ length: 30 }, (_, index) => ({
  id: index + 1,
  label: itemNames[index % itemNames.length],
}));

type ProbeEvent = { sequence: number; description: string };

/** Real app components in a runtime-free fixture, for testing the native VR panel. */
export function QuestUiProbe(): JSX.Element {
  const [events, setEvents] = useState<ProbeEvent[]>([]);
  const eventSequence = useRef(0);
  const [textOpen, setTextOpen] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rangeValue, setRangeValue] = useState(50);
  const [checked, setChecked] = useState(false);
  const [selectValue, setSelectValue] = useState("NetHack 3.6.7");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [animationRunning, setAnimationRunning] = useState(true);
  const [viewport, setViewport] = useState(() => `${window.innerWidth} × ${window.innerHeight}`);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const textButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeDialogRef = useRef<HTMLButtonElement | null>(null);

  const record = useCallback((description: string): void => {
    const sequence = ++eventSequence.current;
    setEvents((previous) => [{ sequence, description }, ...previous].slice(0, 8));
  }, []);

  useEffect(() => {
    const updateViewport = (): void => setViewport(`${window.innerWidth} × ${window.innerHeight}`);
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!textOpen && !dialogOpen) {
      return;
    }
    // AnimatedDialog mounts after its open-state effect. Wait for that mount,
    // rather than assuming its input exists on the next animation frame.
    const focusMountedDialog = (): void => {
      const target = textOpen ? textInputRef.current : closeDialogRef.current;
      if (target) {
        target.focus();
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(focusMountedDialog);
    observer.observe(document.body, { childList: true, subtree: true });
    focusMountedDialog();
    return () => observer.disconnect();
  }, [textOpen, dialogOpen]);

  const closeDialog = useCallback((): void => {
    setDialogOpen(false);
    record("Animated dialog closed");
    dialogButtonRef.current?.focus();
  }, [record]);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDialog, dialogOpen]);

  const submitText = (value: string): void => {
    setSubmittedText(value);
    setTextOpen(false);
    record(value ? `Text submitted: ${value}` : "Text dialog closed with an empty result");
    textButtonRef.current?.focus();
  };

  return (
    <main className="quest-probe">
      <header className="quest-probe-header">
        <div>
          <span className="quest-probe-eyebrow">NetHack 3D / Quest experiment</span>
          <h1>Can the real UI work in VR?</h1>
          <p>Exercise the controls in the headset, then open the bundled game.</p>
        </div>
        <a className="quest-probe-primary" href="/">Open full game →</a>
      </header>

      <div className="quest-probe-notice">
        <Nh3dIcon icon={Nh3dIconInfo} size={22} />
        <p>
          <strong>UI fixture · no game runtime.</strong> The text dialog, animated dialog,
          and information popover below use the game's existing components and styles.
          A working desktop preview does not prove headset rendering or input.
        </p>
      </div>

      <div className="quest-probe-grid">
        <section className="quest-probe-card" aria-labelledby="probe-controls-title">
          <span className="quest-probe-step">01 / Input & focus</span>
          <h2 id="probe-controls-title">Operate the controls</h2>
          <p>Try ray clicks, a trigger drag, scrolling, and the headset keyboard.</p>

          <button
            className="quest-probe-button"
            onClick={() => {
              setTextOpen(true);
              record("Opened real TextInputDialog");
            }}
            ref={textButtonRef}
            type="button"
          >Open game text prompt</button>
          <output className="quest-probe-result">Last text: {submittedText || "(empty)"}</output>

          <label className="quest-probe-field" htmlFor="probe-range">
            <span>Range drag <strong>{rangeValue}%</strong></span>
            <input
              id="probe-range"
              max={100}
              min={0}
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                setRangeValue(value);
                record(`Range: ${value}%`);
              }}
              step={1}
              type="range"
              value={rangeValue}
            />
          </label>
          <label className="quest-probe-checkbox">
            <input
              checked={checked}
              onChange={(event) => {
                setChecked(event.currentTarget.checked);
                record(`Checkbox: ${event.currentTarget.checked ? "on" : "off"}`);
              }}
              type="checkbox"
            />
            Checkbox target {checked ? "✓" : ""}
          </label>
          <label className="quest-probe-field" htmlFor="probe-select">
            <span>Native HTML select</span>
            <select
              id="probe-select"
              onChange={(event) => {
                setSelectValue(event.currentTarget.value);
                record(`Select: ${event.currentTarget.value}`);
              }}
              value={selectValue}
            >
              <option>NetHack 3.6.7</option>
              <option>NetHack 5.0</option>
              <option>SLASH'EM</option>
            </select>
          </label>
          <p className="quest-probe-small">The popup must be visible and selectable inside VR.</p>
        </section>

        <section className="quest-probe-card" aria-labelledby="probe-scroll-title">
          <span className="quest-probe-step">02 / Scroll & selection</span>
          <h2 id="probe-scroll-title">Reach the last row</h2>
          <p>This is a fixture list with nested scrolling, focus, and long labels.</p>
          <div
            aria-label="Fixture inventory"
            className="quest-probe-inventory"
            onScroll={(event) => {
              const element = event.currentTarget;
              const maximum = element.scrollHeight - element.clientHeight;
              setScrollPercent(maximum > 0 ? Math.round(element.scrollTop / maximum * 100) : 0);
            }}
            tabIndex={0}
          >
            {inventoryRows.map((item) => (
              <button
                aria-pressed={selectedRow === item.id}
                className={selectedRow === item.id ? "is-selected" : ""}
                key={item.id}
                onClick={() => {
                  setSelectedRow(item.id);
                  record(`Selected fixture row ${item.id}`);
                }}
                type="button"
              >
                <span>{String(item.id).padStart(2, "0")}</span>
                {item.label}
              </button>
            ))}
          </div>
          <output className="quest-probe-result">
            Scroll {scrollPercent}% · selected {selectedRow === null ? "none" : `row ${selectedRow}`}
          </output>
          <details className="quest-probe-details">
            <summary>Expand native details</summary>
            <p>Closing and reopening this section should keep list selection and scroll position.</p>
            <button className="quest-probe-button" onClick={() => record("Clicked inside expanded details")} type="button">
              Click inside details
            </button>
          </details>
        </section>

        <section className="quest-probe-card" aria-labelledby="probe-render-title">
          <span className="quest-probe-step">03 / Fidelity & layering</span>
          <h2 id="probe-render-title">Inspect the browser output</h2>
          <div className="quest-probe-popover-row">
            <span>Open the game's SVG info button</span>
            <OptionDescriptionInfo
              label="Quest portal test"
              description="This is the game's real information popover. React mounts it on document.body, outside the probe root. It must remain visible above the cards and close when you click elsewhere."
            />
          </div>
          <div className="quest-probe-visual" data-animating={animationRunning}>
            <span className="quest-probe-orb" />
            <div className="quest-probe-glass">
              <span>Gradients · blur · transparency</span>
              <strong>@ <span aria-hidden="true">✦</span> # &amp;</strong>
            </div>
          </div>
          <button className="quest-probe-button" onClick={() => setAnimationRunning((value) => !value)} type="button">
            {animationRunning ? "Pause" : "Resume"} CSS animation
          </button>
          <div className="quest-probe-type-samples">
            <span>14 px · a scroll of identify</span>
            <span>18 px · HP: 18 / 24</span>
            <span>24 px · Dungeon level 1</span>
          </div>
          <button
            className="quest-probe-button"
            onClick={() => {
              setDialogOpen(true);
              record("Opened real AnimatedDialog");
            }}
            ref={dialogButtonRef}
            type="button"
          >Open animated modal</button>
        </section>
      </div>

      <section className="quest-probe-footer" aria-labelledby="probe-results-title">
        <div>
          <h2 id="probe-results-title">Interaction log</h2>
          <p>These entries confirm UI events only. Judge readability, stereo placement,
            keyboard visibility, and responsiveness in the headset.</p>
          <details className="quest-probe-details">
            <summary>Browser environment</summary>
            <dl className="quest-probe-environment">
              <dt>Origin</dt><dd>{window.location.origin}</dd>
              <dt>Viewport</dt><dd>{viewport} CSS px · DPR {window.devicePixelRatio}</dd>
              <dt>Secure context</dt><dd>{window.isSecureContext ? "yes" : "no"}</dd>
              <dt>Pointer</dt><dd>{window.matchMedia("(pointer: coarse)").matches ? "coarse" : "fine / none"}</dd>
              <dt>Browser</dt><dd>{navigator.userAgent}</dd>
            </dl>
          </details>
        </div>
        <ol className="quest-probe-events" aria-label="Recent interaction events" aria-live="polite">
          {events.length === 0 ? <li>No interactions recorded yet.</li> : events.map((event) => (
            <li key={event.sequence}><span>{event.sequence}</span> {event.description}</li>
          ))}
        </ol>
      </section>

      <TextInputDialog
        renderMobileDialogCloseButton={() => null}
        setTextInputValue={setTextValue}
        submitTextInput={submitText}
        textInputRef={textInputRef}
        textInputRequest={textOpen ? {
          text: "What do you want to call this item?",
          contextMessage: "UI probe: enter text with the headset keyboard, then select OK.",
          maxLength: 64,
          placeholder: "Quest test",
        } : null}
        textInputValue={textValue}
      />
      <AnimatedDialog
        aria-labelledby="probe-modal-title"
        className="nh3d-dialog nh3d-dialog-text"
        id="probe-animated-dialog"
        open={dialogOpen}
        role="dialog"
      >
        <h2 id="probe-modal-title">The game's animated dialog</h2>
        <p>Check the rounded border, shadow, text, and opening and closing animation.</p>
        <p>This uses the existing AnimatedDialog lifecycle and global game styles.</p>
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-confirm"
            onClick={closeDialog}
            ref={closeDialogRef}
            type="button"
          >Close dialog</button>
        </div>
      </AnimatedDialog>
    </main>
  );
}
