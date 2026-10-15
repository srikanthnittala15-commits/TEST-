/** Reads a number from a form field. Returns null when missing, not a number, or out of range. */
export function num(form: FormData, key: string, min = 0, max = 1e12): number | null {
  const raw = String(form.get(key) ?? "").replace(/,/g, "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function text(form: FormData, key: string, max = 80): string | null {
  const s = String(form.get(key) ?? "").trim();
  return s.length > 0 && s.length <= max ? s : null;
}
