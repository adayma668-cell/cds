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

  if (data && data.created_by) {
    const [{ data: facilitator }, authResult] = await Promise.all([
      supabaseAdmin
        .from("employees")
        .select("name, email")
        .eq("id", data.created_by)
        .single(),
      supabaseAdmin.auth.admin.getUserById(data.created_by),
    ]);

    data.facilitator_id = data.created_by;
    data.facilitator_name =
      facilitator?.name || facilitator?.email?.split("@")[0] || "Unknown";
    data.facilitator_avatar =
      authResult?.data?.user?.user_metadata?.avatar_url || null;
  }

  return NextResponse.json({ session: data || null });
}

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const team_id = body.team_id || null;
  const title = body.title || null;

  const { data: existing } = await supabaseAdmin
    .from("retro_sessions")
    .select("*")
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ session: existing });
  }

  const row = { created_by: user.id, status: "active", team_id };
  if (title) row.title = title;

  let { data, error } = await supabaseAdmin
    .from("retro_sessions")
    .insert(row)
    .select()
    .single();

  if (error && title && error.message?.includes("title")) {
    delete row.title;
    ({ data, error } = await supabaseAdmin
      .from("retro_sessions")
      .insert(row)
      .select()
      .single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_session",
    entityId: data.id,
    action: "started",
    actorId: user.id,
    actorName,
    newData: data,
    metadata: { team_id },
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

  return NextResponse.json({
    success: true,
    changed_by: {
      id: user.id,
      name: actorName,
      avatar: user.user_metadata?.avatar_url || null,
    },
  });
}

export async function PATCH(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { session_id, archive, pdf_url } = await req.json();
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  const { data: oldSession } = await supabaseAdmin
    .from("retro_sessions")
    .select("*")
    .eq("id", session_id)
    .single();

  const newStatus = archive ? "archived" : "finished";
  const finishedAt = new Date().toISOString();
  const updatePayload = { status: newStatus, finished_at: finishedAt };
  if (pdf_url) updatePayload.pdf_url = pdf_url;
  const { error } = await supabaseAdmin
    .from("retro_sessions")
    .update(updatePayload)
    .eq("id", session_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_session",
    entityId: session_id,
    action: newStatus,
    actorId: user.id,
    actorName,
    oldData: oldSession,
    newData: { ...oldSession, status: newStatus, finished_at: finishedAt },
  });

  return NextResponse.json({ success: true });
}
