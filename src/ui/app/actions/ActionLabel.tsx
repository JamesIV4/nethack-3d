import { useLayoutEffect, useRef } from "react";

/** Wrap at spaces normally; shrink unbroken words before allowing emergency wrapping. */
export function ActionLabel({ children }: { children: string }): JSX.Element {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const label = ref.current, button = label?.closest("button");
    if (!label || !button) return;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      const style = getComputedStyle(button);
      const size = parseFloat(style.fontSize), minimum = Math.min(size, 8);
      const available = button.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (available <= 0) return;
      const words = children.split(/\s+/);
      const width = (fontSize: number) => {
        context.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
        const spacing = parseFloat(style.letterSpacing) || 0;
        return Math.max(...words.map(word => context.measureText(word).width + Math.max(0, word.length - 1) * spacing));
      };
      let fitted = size;
      while (fitted > minimum && width(fitted) > available) fitted = Math.max(minimum, fitted - .25);
      label.style.fontSize = `${fitted}px`;
      label.style.overflowWrap = width(fitted) > available ? "anywhere" : "normal";
    };
    const observer = new ResizeObserver(fit);
    observer.observe(button); fit();
    void document.fonts?.ready.then(fit);
    return () => { disposed = true; observer.disconnect(); };
  }, [children]);
  return <span className="nh3d-action-label" ref={ref}>{children}</span>;
}
