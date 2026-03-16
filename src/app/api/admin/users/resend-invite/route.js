import { NextResponse } from "next/server";
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

  const tokenHash = linkData.properties.hashed_token;
  const inviteLink = `${appUrl}/set-password?token_hash=${encodeURIComponent(tokenHash)}&type=invite`;

  try {
    await sendInviteEmail({ to: email, name: name || "", inviteLink });
  } catch (emailErr) {
    console.error("[resend-invite] SendGrid email failed:", emailErr);
    return NextResponse.json(
      { error: "Failed to send invite email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
