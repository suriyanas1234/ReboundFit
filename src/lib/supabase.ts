import { createBrowserSupabaseClient } from "./supabase/client";

export const isSupabaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");

export const supabase = createBrowserSupabaseClient();

export { createBrowserSupabaseClient } from "./supabase/client";
