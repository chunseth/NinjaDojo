"use client";

import { createClient } from "@supabase/supabase-js";

let singleton: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (singleton) {
    return singleton;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  singleton = createClient(url, anon);
  return singleton;
}
