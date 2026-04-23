import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["scrum_master", "super_admin"];

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
  const sessionId = searchParams.get("session_id");

  try {
    if (sessionId) {
      const [items, moods, votes] = await Promise.all([
        prisma.retroItem.findMany({
          where: { session_id: sessionId },
          orderBy: { created_at: "asc" },
        }),
        prisma.retroMood.findMany({
          where: { session_id: sessionId },
          select: { user_name: true, avatar_url: true, mood: true },
          orderBy: { created_at: "asc" },
        }),
        prisma.retroVote.findMany({
          where: { session_id: sessionId },
          select: { item_id: true, user_id: true },
        }),
      ]);

      return NextResponse.json({ items, moods, votes });
    }

    const sessions = await prisma.retroSession.findMany({
      where: { status: { in: ["finished", "archived"] } },
      orderBy: { finished_at: "desc" },
      take: 50,
    });

    const enriched = await Promise.all(
      (sessions || []).map(async (s) => {
        const [items, moodCount, facilitator] = await Promise.all([
          prisma.retroItem.findMany({
            where: { session_id: s.id },
            select: { phase: true },
          }),
          prisma.retroMood.count({ where: { session_id: s.id } }),
          prisma.employee.findUnique({
            where: { id: s.created_by },
            select: { name: true },
          }),
        ]);

        return {
          ...s,
          facilitator_name: facilitator?.name || "Unknown",
          stats: {
            went_well: items.filter((i) => i.phase === "went_well").length,
            didnt_go_well: items.filter((i) => i.phase === "didnt_go_well").length,
            should_try: items.filter((i) => i.phase === "should_try").length,
            action_items: items.filter((i) => i.phase === "action_items").length,
            appreciation: items.filter((i) => i.phase === "appreciation").length,
            moods: moodCount,
          },
        };
      })
    );

    return NextResponse.json({ sessions: enriched });
  } catch (err) {
    console.error("Failed to fetch retro history:", err);
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

  if (!emp || !ALLOWED_ROLES.includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  try {
    const session = await prisma.retroSession.findUnique({ where: { id: sessionId } });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.pdf_url) {
      try {
        const urlParts = session.pdf_url.split("/retro-pdfs/");
        if (urlParts[1]) {
          await supabaseAdmin.storage.from("retro-pdfs").remove([urlParts[1]]);
        }
      } catch {}
    }

    await Promise.allSettled([
      prisma.retroVote.deleteMany({ where: { session_id: sessionId } }),
      prisma.retroItem.deleteMany({ where: { session_id: sessionId } }),
      prisma.retroMood.deleteMany({ where: { session_id: sessionId } }),
      prisma.retroMeetingWorth.deleteMany({ where: { session_id: sessionId } }),
    ]);

    await prisma.retroSession.delete({ where: { id: sessionId } });

    const actorName = user.user_metadata?.name || user.email;
    await logAudit({
      entityType: "retro_session",
      entityId: sessionId,
      action: "deleted",
      actorId: user.id,
      actorName,
      oldData: session,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete retro session:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
