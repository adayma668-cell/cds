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

  const {
    data: { users },
    error: listError,
  } = await supabaseAdmin.auth.admin.listUsers();
  if (listError)
    return NextResponse.json({ error: listError.message }, { status: 500 });

  const { data: employees } = await supabaseAdmin
    .from("employees")
    .select("*");

  const merged = users.map((u) => {
    const emp = employees?.find((e) => e.id === u.id);
    return {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || "",
      avatar_url: u.user_metadata?.avatar_url || null,
      role: emp?.role || "employee",
      teams: emp?.teams || [],
      created_at: u.created_at,
    };
  });

  return NextResponse.json({ users: merged });
}

export async function POST(req) {
  const admin = await verifySuperAdmin(req);
  if (!admin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, email, password, role, teams } = await req.json();

  if (!email || !password || !role) {
    return NextResponse.json(
      { error: "Email, password, and role are required" },
      { status: 400 }
    );
  }

  const { data: newUser, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || "" },
    });

  if (createError)
    return NextResponse.json({ error: createError.message }, { status: 500 });

  const { error: insertError } = await supabaseAdmin
    .from("employees")
    .insert({ id: newUser.user.id, name: name || "", email, role, teams: teams || [] });

  if (insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({
    user: { id: newUser.user.id, email, name, role, teams: teams || [] },
  });
}

export async function PATCH(req) {
  const admin = await verifySuperAdmin(req);
  if (!admin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, role, teams, name, email, password } = await req.json();

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const authUpdate = {};
  if (name !== undefined) authUpdate.user_metadata = { name };
  if (email !== undefined) authUpdate.email = email;
  if (password) authUpdate.password = password;

  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);
    if (authError)
      return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const employeeUpdate = { id: userId };
  let hasEmployeeUpdate = false;
  if (role !== undefined) { employeeUpdate.role = role; hasEmployeeUpdate = true; }
  if (teams !== undefined) { employeeUpdate.teams = teams; hasEmployeeUpdate = true; }
  if (name !== undefined) { employeeUpdate.name = name; hasEmployeeUpdate = true; }
  if (email !== undefined) { employeeUpdate.email = email; hasEmployeeUpdate = true; }

  if (hasEmployeeUpdate) {
    const { error } = await supabaseAdmin
      .from("employees")
      .upsert(employeeUpdate);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req) {
  const admin = await verifySuperAdmin(req);
  if (!admin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  if (userId === admin.id) {
    return NextResponse.json(
      { error: "Cannot delete yourself" },
      { status: 400 }
    );
  }

  await supabaseAdmin.from("employees").delete().eq("id", userId);

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
