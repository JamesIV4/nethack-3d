import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties
} from "react";
import {
  createPortal
} from "react-dom";
import {
  Nh3dIcon,
  Nh3dIconInfo
} from "../../icons";

/** Option labels and accessible description popovers. */
export function OptionDescriptionInfo({
  label,
  description,
}: {
  label: string;
  description: string;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") {
      return;
    }
    const rect = button.getBoundingClientRect();
    const viewportInset = 8;
    const gap = 7;
    const width = Math.min(310, window.innerWidth - viewportInset * 2);
    const height = popoverRef.current?.offsetHeight ?? 96;
    const left = Math.max(
      viewportInset,
      Math.min(window.innerWidth - width - viewportInset, rect.left - 8),
    );
    const fitsBelow = rect.bottom + gap + height <= window.innerHeight - 8;
    const top = fitsBelow
      ? rect.bottom + gap
      : Math.max(viewportInset, rect.top - height - gap);
    setPopoverStyle({ left, top, width });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !buttonRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  const popover = isOpen ? (
    <div
      className="nh3d-option-info-popover"
      ref={popoverRef}
      role="tooltip"
      style={popoverStyle}
    >
      {description}
    </div>
  ) : null;

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={`${label}: information`}
        className="nh3d-option-info-button"
        onClick={() => setIsOpen((previous) => !previous)}
        ref={buttonRef}
        type="button"
      >
        <Nh3dIcon icon={Nh3dIconInfo} size={18} strokeWidth={2.4} />
      </button>
      {typeof document !== "undefined" && popover
        ? createPortal(popover, document.body)
        : popover}
    </>
  );
}

export function OptionLabelWithInfo({
  label,
  description,
}: {
  label: string;
  description: string;
}): JSX.Element {
  return (
    <div className="nh3d-option-label-with-info">
      <div className="nh3d-option-label">{label}</div>
      <OptionDescriptionInfo label={label} description={description} />
    </div>
  );
}
