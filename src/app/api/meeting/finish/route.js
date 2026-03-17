import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAudit } from "@/lib/audit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getLeader(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!employee || !["super_admin", "scrum_master"].includes(employee.role))
    return null;

  return user;
}

export async function POST(req) {
  const user = await getLeader(req);
  if (!user)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body = {};
  try { body = await req.json(); } catch {}

  const { memberCount, team } = body;
  const actorName = user.user_metadata?.name || user.email;

  await logAudit({
    entityType: "meeting",
    entityId: new Date().toISOString().slice(0, 10),
    action: "completed",
    actorId: user.id,
    actorName,
    newData: { memberCount, team, finishedAt: new Date().toISOString() },
    metadata: { memberCount, team },
  });

  return NextResponse.json({ success: true });
}
