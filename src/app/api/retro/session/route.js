import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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

  try {
    const data = await prisma.retroSession.findFirst({
      where: { status: "active" },
      orderBy: { created_at: "desc" },
    });

    if (data && data.created_by) {
      const [facilitator, authResult] = await Promise.all([
        prisma.employee.findUnique({
          where: { id: data.created_by },
          select: { name: true, email: true },
        }),
        supabaseAdmin.auth.admin.getUserById(data.created_by),
      ]);

      data.facilitator_id = data.created_by;
      data.facilitator_name =
        facilitator?.name || facilitator?.email?.split("@")[0] || "Unknown";
      data.facilitator_avatar =
        authResult?.data?.user?.user_metadata?.avatar_url || null;
    }

    return NextResponse.json({ session: data || null });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const team_id = body.team_id || null;
  const title = body.title || null;

  try {
    const existing = await prisma.retroSession.findFirst({
      where: { status: "active" },
    });

    if (existing) {
      return NextResponse.json({ session: existing });
    }

    const row = { created_by: user.id, status: "active", team_id };
    if (title) row.title = title;

    const data = await prisma.retroSession.create({ data: row });

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
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { session_id, current_phase } = await req.json();
  if (!session_id || current_phase === undefined) {
    return NextResponse.json({ error: "session_id and current_phase required" }, { status: 400 });
  }

  try {
    const oldSession = await prisma.retroSession.findUnique({ where: { id: session_id } });

    await prisma.retroSession.update({
      where: { id: session_id },
      data: { current_phase },
    });

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
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { session_id, archive, pdf_url } = await req.json();
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  try {
    const oldSession = await prisma.retroSession.findUnique({ where: { id: session_id } });

    const newStatus = archive ? "archived" : "finished";
    const finishedAt = new Date();
    const updatePayload = { status: newStatus, finished_at: finishedAt };
    if (pdf_url) updatePayload.pdf_url = pdf_url;

    await prisma.retroSession.update({
      where: { id: session_id },
      data: updatePayload,
    });

    const actorName = user.user_metadata?.name || user.email;
    await logAudit({
      entityType: "retro_session",
      entityId: session_id,
      action: newStatus,
      actorId: user.id,
      actorName,
      oldData: oldSession,
      newData: { ...oldSession, status: newStatus, finished_at: finishedAt.toISOString() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
