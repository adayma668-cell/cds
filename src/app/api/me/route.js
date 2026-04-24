import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import prisma from "@/lib/prisma";

export async function GET(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let employee;
  try {
    employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
  } catch (err) {
    console.error("Failed to fetch employee from DB:", err.message);
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 }
    );
  }

  const role = employee?.role ?? "employee";

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    },
    role,
  });
}
