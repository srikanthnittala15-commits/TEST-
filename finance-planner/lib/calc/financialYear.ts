/** Indian financial year runs April to March. Returns e.g. "2026-27". */
export function financialYearOf(date: Date): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
