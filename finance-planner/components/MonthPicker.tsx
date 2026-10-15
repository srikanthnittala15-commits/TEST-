export function MonthPicker({ month }: { month: string }) {
  return (
    <form className="flex items-end gap-2 text-sm">
      <label className="flex flex-col gap-1">
        Month
        <input type="month" name="month" defaultValue={month.slice(0, 7)} className="rounded-lg border border-stone-300 px-3 py-2" />
      </label>
      <button className="rounded-lg border border-stone-300 px-3 py-2 hover:bg-stone-100">Show</button>
    </form>
  );
}
