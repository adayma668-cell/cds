import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import prisma from "@/lib/prisma";

async function verifySuperAdmin(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const emp = await prisma.employee.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!emp || emp.role !== "super_admin") return null;
  return user;
}

export async function GET(req) {
  const user = await verifySuperAdmin(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entity_type");
  const entityId = searchParams.get("entity_id");
  const actorId = searchParams.get("actor_id");
  const action = searchParams.get("action");
  const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 50));
  const offset = (page - 1) * limit;

  const where = {};
  if (entityType) where.entity_type = entityType;
  if (entityId) where.entity_id = entityId;
  if (actorId) where.actor_id = actorId;
  if (action) where.action = action;

  try {
    const [data, count] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs: data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
