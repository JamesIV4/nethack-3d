/** Small display text normalization. */
export function capitalizeFirstLetter(text: string): string {
  const normalized = String(text || "");
  if (!normalized) {
    return normalized;
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
