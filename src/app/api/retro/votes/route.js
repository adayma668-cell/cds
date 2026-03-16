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

  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("retro_votes")
    .select("item_id")
    .eq("session_id", session_id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ votes: (data || []).map((v) => v.item_id) });
}

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { item_id, session_id } = await req.json();
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("retro_votes")
    .select("id")
    .eq("session_id", session_id)
    .eq("user_id", user.id);

  if ((existing || []).length >= 5) {
    return NextResponse.json({ error: "Maximum 5 votes reached" }, { status: 400 });
  }

  const { data: dupe } = await supabaseAdmin
    .from("retro_votes")
    .select("id")
    .eq("session_id", session_id)
    .eq("user_id", user.id)
    .eq("item_id", item_id)
    .maybeSingle();

  if (dupe) return NextResponse.json({ error: "Already voted" }, { status: 400 });

  const { error: insertErr } = await supabaseAdmin.from("retro_votes").insert({
    session_id,
    user_id: user.id,
    item_id,
  });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  await supabaseAdmin.rpc("increment_votes", { row_id: item_id });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_vote",
    entityId: `${user.id}_${item_id}`,
    action: "cast",
    actorId: user.id,
    actorName,
    newData: { item_id, session_id },
    metadata: { session_id },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { item_id, session_id } = await req.json();
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  const { error: delErr } = await supabaseAdmin
    .from("retro_votes")
    .delete()
    .eq("session_id", session_id)
    .eq("user_id", user.id)
    .eq("item_id", item_id);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  await supabaseAdmin.rpc("decrement_votes", { row_id: item_id });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_vote",
    entityId: `${user.id}_${item_id}`,
    action: "removed",
    actorId: user.id,
    actorName,
    oldData: { item_id, session_id },
    metadata: { session_id },
  });

  return NextResponse.json({ success: true });
}
