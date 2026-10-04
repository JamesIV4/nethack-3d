/** Empty means the original UI fonts. Persist one family name, not CSS. */
export function normalizeUiFontFamily(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 200)
    : "";
}

export function getUiFontFamilyCss(value: string): string | undefined {
  const family = normalizeUiFontFamily(value);
  if (!family) return undefined;
  return `"${family.replace(/["\\]/g, "\\$&")}", "Courier New", monospace`;
}
