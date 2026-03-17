import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getUser(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * GET /api/retro/votes/summary?session_id=...
 * Returns vote count per employee for the given session.
 * Only accessible by scrum_master and super_admin.
 */
export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!emp || !["scrum_master", "super_admin"].includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  const { data: votes, error } = await supabaseAdmin
    .from("retro_votes")
    .select("user_id")
    .eq("session_id", session_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const countByUser = {};
  for (const v of (votes || [])) {
    countByUser[v.user_id] = (countByUser[v.user_id] || 0) + 1;
  }

  return NextResponse.json({ voteSummary: countByUser, totalVotes: (votes || []).length });
}
