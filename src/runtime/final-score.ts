/** Read NetHack's computed end-of-run score, never infer it from turns or XP. */
export function parseFinalScoreSummary(lines: readonly string[]): number | null {
  const text = lines.join("\n").replace(/\u0000/g, "");
  const match = text.match(/(?:^|\n)\s*(?:You\b[^\n]*\bwith|(?:went to your reward|escaped from the dungeon)\s+with|with)\s+(\d+(?:,\d{3})*)\s+points?\b/i);
  if (!match) return null;
  const points = Number(match[1].replace(/,/g, ""));
  return Number.isSafeInteger(points) && points >= 0 ? points : null;
}
