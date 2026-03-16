import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendInviteEmail } from "@/lib/sendEmail";

async function verifySuperAdmin(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();

  if (emp?.role !== "super_admin") return null;
  return user;
}

export async function POST(req) {
  const admin = await verifySuperAdmin(req);
  if (!admin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, name } = await req.json();
  if (!email)
    return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log("[resend-invite] Resending invite for:", email);

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
    console.error("[resend-invite] generateLink failed:", linkError.message);
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const userId = linkData.user.id;
  console.log("[resend-invite] User ID:", userId);

  const inviteToken = randomUUID();
  const inviteExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { invite_token: inviteToken, invite_token_expires: inviteExpires },
  });

  if (metaError) {
    console.error("[resend-invite] Failed to store token:", metaError.message);
    return NextResponse.json({ error: metaError.message }, { status: 500 });
  }
  console.log("[resend-invite] New invite token stored, expires:", inviteExpires);

  const inviteLink = `${appUrl}/set-password?token=${inviteToken}&uid=${userId}`;
  console.log("[resend-invite] Invite link:", inviteLink);

  try {
    await sendInviteEmail({ to: email, name: name || "", inviteLink });
    console.log("[resend-invite] Email sent successfully to:", email);
  } catch (emailErr) {
    console.error("[resend-invite] SendGrid email failed:", emailErr);
    return NextResponse.json(
      { error: "Failed to send invite email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
