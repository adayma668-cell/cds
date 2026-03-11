import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function verifySuperAdmin(req) {
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

  if (employee?.role !== "super_admin") return null;
  return user;
}

export async function GET(req) {
  const admin = await verifySuperAdmin(req);
  if (!admin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [
    { data: tickets, error: ticketsError },
    { data: employees, error: employeesError },
    { data: { users: authUsers }, error: authError },
  ] = await Promise.all([
    supabaseAdmin
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("employees").select("id, name, email, teams"),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (ticketsError)
    return NextResponse.json(
      { error: ticketsError.message },
      { status: 500 }
    );
  if (employeesError)
    return NextResponse.json(
      { error: employeesError.message },
      { status: 500 }
    );
  if (authError)
    return NextResponse.json({ error: authError.message }, { status: 500 });

  const empMap = new Map((employees || []).map((e) => [e.id, e]));
  const authMap = new Map((authUsers || []).map((u) => [u.id, u]));

  const ticketsWithUser = (tickets || []).map((t) => {
    const emp = empMap.get(t.user_id);
    const authUser = authMap.get(t.user_id);
    return {
      ...t,
      user_name: emp?.name || authUser?.user_metadata?.name || "Unknown",
      user_email: emp?.email || authUser?.email || "",
      user_teams: emp?.teams || [],
      user_avatar_url: authUser?.user_metadata?.avatar_url || null,
    };
  });

  return NextResponse.json({ tickets: ticketsWithUser });
}
