import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function getUser(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("retro_sessions")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ session: data || null });
}

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabaseAdmin
    .from("retro_sessions")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ session: existing });
  }

  const { data, error } = await supabaseAdmin
    .from("retro_sessions")
    .insert({
      created_by: user.id,
      status: "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_session",
    entityId: data.id,
    action: "started",
    actorId: user.id,
    actorName,
    newData: data,
  });

  return NextResponse.json({ session: data });
}

export async function PUT(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { session_id, current_phase } = await req.json();
  if (!session_id || current_phase === undefined) {
    return NextResponse.json({ error: "session_id and current_phase required" }, { status: 400 });
  }

  const { data: oldSession } = await supabaseAdmin
    .from("retro_sessions")
    .select("*")
    .eq("id", session_id)
    .single();

  const { error } = await supabaseAdmin
    .from("retro_sessions")
    .update({ current_phase })
    .eq("id", session_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_session",
    entityId: session_id,
    action: "phase_changed",
    actorId: user.id,
    actorName,
    oldData: oldSession,
    newData: { ...oldSession, current_phase },
    metadata: { from_phase: oldSession?.current_phase, to_phase: current_phase },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { session_id } = await req.json();
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  const { data: oldSession } = await supabaseAdmin
    .from("retro_sessions")
    .select("*")
    .eq("id", session_id)
    .single();

  const finishedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("retro_sessions")
    .update({ status: "finished", finished_at: finishedAt })
    .eq("id", session_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_session",
    entityId: session_id,
    action: "finished",
    actorId: user.id,
    actorName,
    oldData: oldSession,
    newData: { ...oldSession, status: "finished", finished_at: finishedAt },
  });

  return NextResponse.json({ success: true });
}
