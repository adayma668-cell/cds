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

  const { vote, session_id } = await req.json();
  if (!vote) return NextResponse.json({ error: "vote is required" }, { status: 400 });
  if (!session_id) return NextResponse.json({ error: "session_id is required" }, { status: 400 });

  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "Unknown";
  const today = new Date().toISOString().slice(0, 10);

  try {
    const existing = await prisma.retroMeetingWorth.findFirst({
      where: { user_id: user.id, session_id },
      select: { vote: true },
    });

    const data = {
      user_id: user.id,
      user_name: userName,
      vote,
      session_id,
      session_date: new Date(today),
      avatar_url: user.user_metadata?.avatar_url || null,
    };

    await prisma.retroMeetingWorth.upsert({
      where: { user_id_session_id: { user_id: user.id, session_id } },
      create: data,
      update: { user_name: userName, vote, session_date: new Date(today), avatar_url: data.avatar_url },
    });

    const isChange = existing && existing.vote !== vote;
    await logAudit({
      entityType: "retro_meeting_worth",
      entityId: `${user.id}_${session_id}`,
      action: isChange ? "changed" : "submitted",
      actorId: user.id,
      actorName: userName,
      oldData: existing ? { vote: existing.vote } : null,
      newData: { vote },
      metadata: { session_id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to save meeting worth vote:", err);
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
    const votes = await prisma.retroMeetingWorth.findMany({
      where: { session_id },
      orderBy: { created_at: "asc" },
    });

    const myVote = await prisma.retroMeetingWorth.findFirst({
      where: { user_id: user.id, session_id },
      select: { vote: true },
    });

    return NextResponse.json({
      votes: votes || [],
      myVote: myVote?.vote || null,
    });
  } catch (err) {
    console.error("Failed to fetch meeting worth votes:", err);
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

  await prisma.retroMeetingWorth.deleteMany({ where: { session_id } });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "retro_meeting_worth",
    entityId: session_id,
    action: "cleared_all",
    actorId: user.id,
    actorName,
    metadata: { session_id },
  });

  return NextResponse.json({ success: true });
}
