/** Keeps the existing world canvas out of HTML composition while its renderer owns XR. */
export class XrCanvasPresentation {
  private saved: { display: string; displayPriority: string; visibility: string; visibilityPriority: string } | null = null;
  constructor(private readonly canvas: HTMLCanvasElement) {}
  enter(): void {
    if (this.saved) return;
    const style = this.canvas.style;
    this.saved = { display: style.getPropertyValue("display"), displayPriority: style.getPropertyPriority("display"),
      visibility: style.getPropertyValue("visibility"), visibilityPriority: style.getPropertyPriority("visibility") };
    style.setProperty("display", "none", "important");
    style.setProperty("visibility", "hidden", "important");
  }
  exit(): void {
    if (!this.saved) return;
    const { display, displayPriority, visibility, visibilityPriority } = this.saved;
    this.saved = null;
    const style = this.canvas.style;
    if (display) style.setProperty("display", display, displayPriority); else style.removeProperty("display");
    if (visibility) style.setProperty("visibility", visibility, visibilityPriority); else style.removeProperty("visibility");
  }
}
