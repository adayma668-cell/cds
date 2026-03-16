import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const VALID_PHASES = ["went_well", "didnt_go_well", "should_try", "puzzles_us", "action_items", "appreciation"];

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

  const { searchParams } = new URL(req.url);
  const phase = searchParams.get("phase");
  const all = searchParams.get("all") === "true";
  const session_id = searchParams.get("session_id");

  let query = supabaseAdmin
    .from("retro_items")
    .select("*")
    .order("created_at", { ascending: true });

  if (!all && session_id) {
    query = query.eq("session_id", session_id);
  }

  if (phase === "all_board") {
    query = query.in("phase", ["went_well", "didnt_go_well", "should_try", "puzzles_us"]);
  } else if (phase && VALID_PHASES.includes(phase)) {
    query = query.eq("phase", phase);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phase, content, assignee, due_date, session_id } = await req.json();

  if (!phase || !VALID_PHASES.includes(phase))
    return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
  if (!content?.trim())
    return NextResponse.json({ error: "Content is required" }, { status: 400 });

  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "Unknown";

  const today = new Date().toISOString().slice(0, 10);

  const row = {
    phase,
    user_id: user.id,
    user_name: userName,
    avatar_url: user.user_metadata?.avatar_url || null,
    content: content.trim(),
    assignee: assignee?.trim() || null,
    due_date: due_date || null,
    session_date: today,
  };

  if (session_id) row.session_id = session_id;

  const { data, error } = await supabaseAdmin.from("retro_items").insert(row).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    entityType: "retro_item",
    entityId: data.id,
    action: "created",
    actorId: user.id,
    actorName: userName,
    newData: data,
    metadata: { phase, session_id: data.session_id },
  });

  return NextResponse.json({ item: data });
}

export async function PATCH(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, done } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: oldItem } = await supabaseAdmin
    .from("retro_items")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabaseAdmin
    .from("retro_items")
    .update({ done })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_item",
    entityId: id,
    action: done ? "completed" : "reopened",
    actorId: user.id,
    actorName,
    oldData: oldItem,
    newData: { ...oldItem, done },
    metadata: { session_id: oldItem?.session_id },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: oldItem } = await supabaseAdmin
    .from("retro_items")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabaseAdmin
    .from("retro_items")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_item",
    entityId: id,
    action: "deleted",
    actorId: user.id,
    actorName,
    oldData: oldItem,
    metadata: { phase: oldItem?.phase, session_id: oldItem?.session_id },
  });

  return NextResponse.json({ success: true });
}
