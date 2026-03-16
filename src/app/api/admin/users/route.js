import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendInviteEmail } from "@/lib/sendEmail";
import { logAudit } from "@/lib/audit";

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

  const { name, email, role, teams } = await req.json();

  if (!email || !role) {
    return NextResponse.json(
      { error: "Email and role are required" },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { name: name || "" },
        redirectTo: `${appUrl}/set-password`,
      },
    });

  if (linkError)
    return NextResponse.json({ error: linkError.message }, { status: 500 });

  const userId = linkData.user.id;
  const inviteLink = linkData.properties.action_link;

  const { error: insertError } = await supabaseAdmin
    .from("employees")
    .upsert({ id: userId, name: name || "", email, role, teams: teams || [] });

  if (insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 });

  try {
    await sendInviteEmail({ to: email, name: name || "", inviteLink });
  } catch (emailErr) {
    console.error("[invite] SendGrid email failed:", emailErr);
    return NextResponse.json(
      { error: "User created but invite email failed to send. Try resending." },
      { status: 207 }
    );
  }

  const adminName = admin.user_metadata?.name || admin.email;
  await logAudit({
    entityType: "user",
    entityId: userId,
    action: "invited",
    actorId: admin.id,
    actorName: adminName,
    newData: { email, name, role, teams },
  });

  return NextResponse.json({
    user: { id: userId, email, name, role, teams: teams || [] },
    invited: true,
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
