import { useEffect, useId, useRef, type ReactNode, type Ref } from "react";
import AnimatedDialog from "./AnimatedDialog";

export interface TextEntryDialogProps {
  open: boolean;
  id: string;
  prompt: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  confirmLabel: string;
  cancelLabel: string;
  placeholder?: string;
  maxLength?: number;
  inputRef?: Ref<HTMLInputElement>;
  /** A new request can arrive while the dialog is already open. */
  focusKey?: unknown;
  context?: ReactNode;
  closeButton?: ReactNode;
  className?: string;
  inputClassName?: string;
}

function TextEntryContents({ prompt, value, onChange, onSubmit, onCancel,
  confirmLabel, cancelLabel, placeholder, maxLength, inputRef, focusKey,
  context, closeButton, inputClassName,
}: TextEntryDialogProps) {
  const ref = useRef<HTMLInputElement | null>(null);
  const labelId = useId();

  // This effect belongs to the mounted contents: AnimatedDialog may defer its
  // first mount. Never try to focus an input from a parent timer before it exists.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const input = ref.current;
      if (input?.isConnected && input.closest(".is-visible") && document.activeElement !== input) {
        input.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [focusKey]);

  return <>
    {closeButton}
    {context}
    <div className="nh3d-question-text" id={labelId}>{prompt}</div>
    <input
      aria-labelledby={labelId}
      autoCapitalize="none"
      autoComplete="off"
      autoCorrect="off"
      className={`nh3d-text-input ${inputClassName ?? ""}`.trim()}
      inputMode="text"
      maxLength={maxLength ?? 256}
      onChange={event => onChange(event.target.value)}
      onPointerDown={event => event.currentTarget.focus({ preventScroll: true })}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit(event.currentTarget.value);
        } else if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      placeholder={placeholder}
      ref={node => {
        ref.current = node;
        if (typeof inputRef === "function") inputRef(node);
        else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = node;
      }}
      spellCheck={false}
      type="text"
      value={value}
    />
    <div className="nh3d-menu-actions">
      <button className="nh3d-menu-action-button nh3d-menu-action-confirm" onClick={() => onSubmit(value)} type="button">{confirmLabel}</button>
      <button className="nh3d-menu-action-button nh3d-menu-action-cancel" onClick={onCancel} type="button">{cancelLabel}</button>
    </div>
  </>;
}

/** Shared modal for runtime getlin and single-symbol prompts, in flat and VR UI. */
export function TextEntryDialog(props: TextEntryDialogProps) {
  return <AnimatedDialog
    open={props.open}
    id={props.id}
    role="dialog"
    aria-modal="true"
    aria-label={props.prompt}
    data-nh3d-text-entry
    className={`nh3d-dialog nh3d-dialog-fixed-actions ${props.className ?? "nh3d-dialog-text"}`}
  >
    {props.open ? <TextEntryContents {...props} /> : null}
  </AnimatedDialog>;
}
