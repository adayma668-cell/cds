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

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mood, session_id } = await req.json();
  if (!mood) return NextResponse.json({ error: "mood is required" }, { status: 400 });
  if (!session_id) return NextResponse.json({ error: "session_id is required" }, { status: 400 });

  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "Unknown";
  const today = new Date().toISOString().slice(0, 10);

  const { data: existingMood } = await supabaseAdmin
    .from("retro_moods")
    .select("mood")
    .eq("user_id", user.id)
    .eq("session_id", session_id)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("retro_moods").upsert(
    {
      user_id: user.id,
      user_name: userName,
      mood,
      session_id,
      session_date: today,
      avatar_url: user.user_metadata?.avatar_url || null,
    },
    { onConflict: "user_id,session_id" }
  );

  if (error) {
    console.error("Failed to save mood:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const isChange = existingMood && existingMood.mood !== mood;
  await logAudit({
    entityType: "retro_mood",
    entityId: `${user.id}_${session_id}`,
    action: isChange ? "changed" : "submitted",
    actorId: user.id,
    actorName: userName,
    oldData: existingMood ? { mood: existingMood.mood } : null,
    newData: { mood },
    metadata: { session_id },
  });

  return NextResponse.json({ success: true });
}

export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  const { data: moods, error } = await supabaseAdmin
    .from("retro_moods")
    .select("*")
    .eq("session_id", session_id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch moods:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: myMood } = await supabaseAdmin
    .from("retro_moods")
    .select("mood")
    .eq("user_id", user.id)
    .eq("session_id", session_id)
    .maybeSingle();

  return NextResponse.json({
    moods: moods || [],
    myMood: myMood?.mood || null,
  });
}

export async function DELETE(req) {
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

  const { session_id } = await req.json();
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  await supabaseAdmin.from("retro_moods").delete().eq("session_id", session_id);

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_mood",
    entityId: session_id,
    action: "cleared_all",
    actorId: user.id,
    actorName,
    metadata: { session_id },
  });

  return NextResponse.json({ success: true });
}
