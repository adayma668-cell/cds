import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";

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

  const where = {};

  if (!all && session_id) {
    where.session_id = session_id;
  }

  if (phase === "all_board") {
    where.phase = { in: ["went_well", "didnt_go_well", "should_try", "puzzles_us"] };
  } else if (phase && VALID_PHASES.includes(phase)) {
    where.phase = phase;
  }

  try {
    const data = await prisma.retroItem.findMany({
      where,
      orderBy: { created_at: "asc" },
    });
    return NextResponse.json({ items: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
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

  try {
    const data = await prisma.retroItem.create({ data: row });

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
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, done, content, assignee, due_date } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const oldItem = await prisma.retroItem.findUnique({ where: { id } });

    if (content !== undefined || assignee !== undefined || due_date !== undefined) {
      const updates = {};
      if (content !== undefined) {
        if (!content?.trim())
          return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
        updates.content = content.trim();
      }
      if (assignee !== undefined) updates.assignee = assignee?.trim() || null;
      if (due_date !== undefined) updates.due_date = due_date || null;

      if (Object.keys(updates).length === 0)
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });

      await prisma.retroItem.update({ where: { id }, data: updates });

      const actorName = user.user_metadata?.name || user.email;
      await logAudit({
        entityType: "retro_item",
        entityId: id,
        action: "edited",
        actorId: user.id,
        actorName,
        oldData: oldItem,
        newData: { ...oldItem, ...updates },
        metadata: { phase: oldItem?.phase, session_id: oldItem?.session_id },
      });

      return NextResponse.json({ success: true, item: { ...oldItem, ...updates } });
    }

    await prisma.retroItem.update({ where: { id }, data: { done } });

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
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const oldItem = await prisma.retroItem.findUnique({ where: { id } });

    await prisma.retroItem.delete({ where: { id } });

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
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
