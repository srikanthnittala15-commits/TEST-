/** Months are strings "YYYY-MM-01" so they compare and sort as text and avoid timezone drift. */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function parseMonth(value: string | null | undefined, fallback = currentMonth()): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])/.exec(value ?? "");
  return m ? `${m[1]}-${m[2]}-01` : fallback;
}

export function previousMonth(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

const NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatMonth(month: string): string {
  return `${NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}
