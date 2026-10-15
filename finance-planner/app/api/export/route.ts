import { NextResponse } from "next/server";
import { sectionsToCsv } from "@/lib/export";
import { createClient } from "@/lib/supabase/server";

const TABLES = ["profiles", "consents", "goals", "budget_items", "net_worth_items", "client_summaries"] as const;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // RLS limits every select to the signed-in user's own rows. Explicit filter keeps this true
  // even for an admin, who can also read other clients' profile and summary rows.
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES) {
    const column = table === "profiles" ? "id" : "user_id";
    const { data: rows, error } = await supabase.from(table).select("*").eq(column, user.id);
    if (error) return NextResponse.json({ error: `Could not read ${table}` }, { status: 500 });
    data[table] = rows ?? [];
  }

  const format = new URL(request.url).searchParams.get("format");
  if (format === "csv") {
    return new NextResponse(sectionsToCsv(data), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="my-finance-data.csv"',
      },
    });
  }
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="my-finance-data.json"',
    },
  });
}
