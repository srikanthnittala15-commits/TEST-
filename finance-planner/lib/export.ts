export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

/** One CSV text with a titled section per table. */
export function sectionsToCsv(sections: Record<string, Record<string, unknown>[]>): string {
  return Object.entries(sections)
    .map(([name, rows]) => `# ${name}\n${toCsv(rows)}`)
    .join("\n\n");
}
