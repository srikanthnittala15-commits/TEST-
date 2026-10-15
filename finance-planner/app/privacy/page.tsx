export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold">Privacy policy</h1>
      <p className="text-sm text-stone-600">Draft for review by the practice before launch.</p>
      <h2 className="font-medium">What we store</h2>
      <p className="text-stone-700">
        Name and email from Google sign-in, your consent record, and the goals, budget, asset and liability entries
        you make.
      </p>
      <h2 className="font-medium">Who can see it</h2>
      <p className="text-stone-700">
        You see all of your own data. The practice admin sees summary numbers only and never your individual entries.
        This is enforced in the database, not only in the app.
      </p>
      <h2 className="font-medium">Your rights (DPDP Act 2023)</h2>
      <p className="text-stone-700">
        You may withdraw consent, download your data as JSON or CSV, and delete your account and all data from
        Settings at any time.
      </p>
      <h2 className="font-medium">Not advice</h2>
      <p className="text-stone-700">
        This is a planning tool, not investment advice. It does not recommend any product.
      </p>
    </article>
  );
}
