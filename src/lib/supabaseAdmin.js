import { createClient } from "@supabase/supabase-js";

let _supabaseAdmin;

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

export const supabaseAdmin = new Proxy(
  {},
  {
    get(_, prop) {
      return getSupabaseAdmin()[prop];
    },
  }
);
