import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";

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

  try {
    const existingMood = await prisma.retroMood.findFirst({
      where: { user_id: user.id, session_id },
      select: { mood: true },
    });

    const data = {
      user_id: user.id,
      user_name: userName,
      mood,
      session_id,
      session_date: today,
      avatar_url: user.user_metadata?.avatar_url || null,
    };

    await prisma.retroMood.upsert({
      where: { user_id_session_id: { user_id: user.id, session_id } },
      create: data,
      update: { user_name: userName, mood, session_date: today, avatar_url: data.avatar_url },
    });

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
  } catch (err) {
    console.error("Failed to save mood:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  try {
    const moods = await prisma.retroMood.findMany({
      where: { session_id },
      orderBy: { created_at: "asc" },
    });

    const myMood = await prisma.retroMood.findFirst({
      where: { user_id: user.id, session_id },
      select: { mood: true },
    });

    return NextResponse.json({
      moods: moods || [],
      myMood: myMood?.mood || null,
    });
  } catch (err) {
    console.error("Failed to fetch moods:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const emp = await prisma.employee.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!emp || !["scrum_master", "super_admin"].includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { session_id } = await req.json();
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  await prisma.retroMood.deleteMany({ where: { session_id } });

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
