export function SetupNotice() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="font-medium">Setup needed</p>
      <p className="mt-1">
        Supabase is not configured yet. Copy <code>.env.example</code> to <code>.env.local</code>, fill in your
        project URL and keys, and restart. See the README.
      </p>
    </div>
  );
}
