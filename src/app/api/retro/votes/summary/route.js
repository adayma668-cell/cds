import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
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

  const emp = await prisma.employee.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!emp || !["scrum_master", "super_admin"].includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  try {
    const votes = await prisma.retroVote.findMany({
      where: { session_id },
      select: { user_id: true },
    });

    const countByUser = {};
    for (const v of (votes || [])) {
      countByUser[v.user_id] = (countByUser[v.user_id] || 0) + 1;
    }

    return NextResponse.json({ voteSummary: countByUser, totalVotes: (votes || []).length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
