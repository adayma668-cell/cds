import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import prisma from "@/lib/prisma";

export async function POST(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existingAdmins = await prisma.employee.findMany({
    where: { role: "super_admin" },
    select: { id: true },
  });

  if (existingAdmins.length > 0) {
    return NextResponse.json(
      { error: "A super admin already exists" },
      { status: 409 }
    );
  }

  await prisma.employee.upsert({
    where: { id: user.id },
    create: { id: user.id, role: "super_admin" },
    update: { role: "super_admin" },
  });

  return NextResponse.json({ success: true, message: "You are now super admin" });
}
