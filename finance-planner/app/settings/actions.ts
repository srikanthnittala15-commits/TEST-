"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function deleteAccount(formData: FormData) {
  if (formData.get("confirm") !== "DELETE") redirect("/settings?error=confirm");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Deleting the auth user cascades to every table that references it.
  const { error } = await createServiceClient().auth.admin.deleteUser(user.id);
  if (error) redirect("/settings?error=delete");

  await supabase.auth.signOut();
  redirect("/login");
}
