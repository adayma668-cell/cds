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

export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  try {
    const data = await prisma.retroVote.findMany({
      where: { session_id, user_id: user.id },
      select: { item_id: true },
    });

    return NextResponse.json({ votes: (data || []).map((v) => v.item_id) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { item_id, session_id } = await req.json();
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  try {
    const existing = await prisma.retroVote.findMany({
      where: { session_id, user_id: user.id },
      select: { id: true },
    });

    if ((existing || []).length >= 5) {
      return NextResponse.json({ error: "Maximum 5 votes reached" }, { status: 400 });
    }

    await prisma.retroVote.create({
      data: { session_id, user_id: user.id, item_id },
    });

    await prisma.$executeRaw`UPDATE retro_items SET votes = COALESCE(votes, 0) + 1 WHERE id = ${item_id}::uuid`;

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
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { item_id, session_id } = await req.json();
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  try {
    const voteRows = await prisma.retroVote.findMany({
      where: { session_id, user_id: user.id, item_id },
      select: { id: true },
      take: 1,
    });

    if (!voteRows || voteRows.length === 0) {
      return NextResponse.json({ error: "No vote to remove" }, { status: 400 });
    }

    await prisma.retroVote.delete({ where: { id: voteRows[0].id } });

    await prisma.$executeRaw`UPDATE retro_items SET votes = GREATEST(COALESCE(votes, 0) - 1, 0) WHERE id = ${item_id}::uuid`;

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
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
