/** Bump when what is stored, who can see it, or how to delete it changes. Users are asked again. */
export const CONSENT_VERSION = "2026-10-v1";

export const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
