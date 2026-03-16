import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getLeader(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!employee || !["super_admin", "scrum_master"].includes(employee.role))
    return null;

  return user;
}

export async function GET(request) {
  const leader = await getLeader(request);
  if (!leader)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [standupsResult, employeesResult] = await Promise.all([
    supabaseAdmin
      .from("standups")
      .select("*")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("employees").select("id, name, email, role, teams"),
  ]);

  if (standupsResult.error)
    return NextResponse.json(
      { error: standupsResult.error.message },
      { status: 500 }
    );
  if (employeesResult.error)
    return NextResponse.json(
      { error: employeesResult.error.message },
      { status: 500 }
    );

  const standups = standupsResult.data || [];
  const employees = employeesResult.data || [];

  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const avatarMap = Object.fromEntries(
    (authUsers || []).map((u) => [u.id, u.user_metadata?.avatar_url || null])
  );

  const submittedUserIds = new Set(standups.map((s) => s.user_id));

  const submitted = standups.map((s) => {
    const emp = employees.find((e) => e.id === s.user_id);
    return {
      id: s.id,
      user_id: s.user_id,
      name: s.employee_name || emp?.name || "Unknown",
      email: emp?.email || "",
      avatar_url: avatarMap[s.user_id] || null,
      teams: emp?.teams || [],
      ticket_number: s.ticket_number,
      due_date: s.due_date,
      mood: s.mood,
      yesterday: s.yesterday,
      today: s.today,
      blockers: s.blockers,
      created_at: s.created_at,
    };
  });

  const pending = employees
    .filter((e) => !submittedUserIds.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name || e.email,
      email: e.email,
      avatar_url: avatarMap[e.id] || null,
      teams: e.teams || [],
      role: e.role,
    }));

  return NextResponse.json({ submitted, pending });
}
