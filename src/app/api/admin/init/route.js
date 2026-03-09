import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  const { data: existingAdmins } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("role", "super_admin");

  if (existingAdmins && existingAdmins.length > 0) {
    return NextResponse.json(
      { error: "A super admin already exists" },
      { status: 409 }
    );
  }

  const { error: upsertError } = await supabaseAdmin
    .from("employees")
    .upsert({ id: user.id, role: "super_admin" });

  if (upsertError)
    return NextResponse.json({ error: upsertError.message }, { status: 500 });

  return NextResponse.json({ success: true, message: "You are now super admin" });
}
