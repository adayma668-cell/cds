import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data: employees, error } = await supabaseAdmin
      .from("employees")
      .select("id, name, email");

    if (error) throw error;

    const {
      data: { users },
    } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    const avatarMap = {};
    for (const u of users || []) {
      avatarMap[u.id] = u.user_metadata?.avatar_url || null;
    }

    const list = (employees || []).map((e) => ({
      id: e.id,
      name: e.name || e.email?.split("@")[0] || "Unknown",
      avatar_url: avatarMap[e.id] || null,
    }));

    return NextResponse.json({ employees: list });
  } catch (err) {
    console.error("Failed to fetch employees:", err);
    return NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
  }
}
