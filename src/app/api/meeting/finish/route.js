import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getLeader(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const employee = await prisma.employee.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!employee || !["super_admin", "scrum_master"].includes(employee.role))
    return null;

  return user;
}

export async function POST(req) {
  const user = await getLeader(req);
  if (!user)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body = {};
  try { body = await req.json(); } catch {}

  const { memberCount, team, standupIds } = body;
  const actorName = user.user_metadata?.name || user.email;

  if (standupIds && standupIds.length > 0) {
    await prisma.standup.updateMany({
      where: { id: { in: standupIds } },
      data: { presented: true },
    });
  }

  await logAudit({
    entityType: "meeting",
    entityId: new Date().toISOString().slice(0, 10),
    action: "completed",
    actorId: user.id,
    actorName,
    newData: { memberCount, team, standupIds, finishedAt: new Date().toISOString() },
    metadata: { memberCount, team },
  });

  return NextResponse.json({ success: true });
}
