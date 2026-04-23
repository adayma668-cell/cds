import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendInviteEmail } from "@/lib/sendEmail";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";

async function verifySuperAdmin(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const employee = await prisma.employee.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

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

  const employees = await prisma.employee.findMany();

  const merged = users.map((u) => {
    const emp = employees?.find((e) => e.id === u.id);
    return {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || "",
      avatar_url: u.user_metadata?.avatar_url || null,
      role: emp?.role || "employee",
      teams: emp?.teams || [],
      password_set: emp?.password_set ?? true,
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
  console.log("[invite] Starting invite for:", email);

  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { name: name || "" },
        redirectTo: `${appUrl}/set-password`,
      },
    });

  if (linkError) {
    console.error("[invite] generateLink failed:", linkError.message);
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const userId = linkData.user.id;
  console.log("[invite] User created/found:", userId);

  const inviteToken = randomUUID();
  const inviteExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { invite_token: inviteToken, invite_token_expires: inviteExpires },
  });

  if (metaError) {
    console.error("[invite] Failed to store invite token in metadata:", metaError.message);
    return NextResponse.json({ error: metaError.message }, { status: 500 });
  }
  console.log("[invite] Invite token stored in app_metadata, expires:", inviteExpires);

  const inviteLink = `${appUrl}/set-password?token=${inviteToken}&uid=${userId}`;
  console.log("[invite] Invite link generated:", inviteLink);

  try {
    await prisma.employee.upsert({
      where: { id: userId },
      create: { id: userId, name: name || "", email, role, teams: teams || [], password_set: false },
      update: { name: name || "", email, role, teams: teams || [], password_set: false },
    });
  } catch (err) {
    console.error("[invite] Employee upsert failed:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  console.log("[invite] Employee record upserted with password_set=false");

  try {
    await sendInviteEmail({ to: email, name: name || "", inviteLink });
    console.log("[invite] Invite email sent successfully to:", email);
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
  if (email !== undefined) authUpdate.email = email;
  if (password) authUpdate.password = password;

  if (name !== undefined) {
    const { data: { user: existingUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    authUpdate.user_metadata = { ...(existingUser?.user_metadata || {}), name };
  }

  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);
    if (authError)
      return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const employeeUpdate = {};
  let hasEmployeeUpdate = false;
  if (role !== undefined) { employeeUpdate.role = role; hasEmployeeUpdate = true; }
  if (teams !== undefined) { employeeUpdate.teams = teams; hasEmployeeUpdate = true; }
  if (name !== undefined) { employeeUpdate.name = name; hasEmployeeUpdate = true; }
  if (email !== undefined) { employeeUpdate.email = email; hasEmployeeUpdate = true; }

  if (hasEmployeeUpdate) {
    try {
      await prisma.employee.upsert({
        where: { id: userId },
        create: { id: userId, ...employeeUpdate },
        update: employeeUpdate,
      });
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
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

  await prisma.employee.delete({ where: { id: userId } });

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
