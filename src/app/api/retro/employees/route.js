import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("team_id");

    const { data: employees, error } = await supabaseAdmin
      .from("employees")
      .select("id, name, email, teams");

    if (error) throw error;

    const {
      data: { users },
    } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    const avatarMap = {};
    for (const u of users || []) {
      avatarMap[u.id] = u.user_metadata?.avatar_url || null;
    }

    let filtered = employees || [];
    if (teamId && teamId !== "all") {
      const teamIds = teamId.split(",").filter(Boolean);
      filtered = filtered.filter((e) =>
        (e.teams || []).some((t) => teamIds.includes(t))
      );
    }

    const list = filtered.map((e) => ({
      id: e.id,
      name: e.name || e.email?.split("@")[0] || "Unknown",
      avatar_url: avatarMap[e.id] || null,
      teams: e.teams || [],
    }));

    return NextResponse.json({ employees: list });
  } catch (err) {
    console.error("Failed to fetch employees:", err);
    return NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
  }
}
