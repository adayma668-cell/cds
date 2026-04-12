import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPasswordResetEmail } from "@/lib/sendEmail";

export async function POST(req) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  const successResponse = NextResponse.json({
    success: true,
    message: "If an account with that email exists, a reset link has been sent.",
  });

  try {
    const { data: { users }, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("[forgot-password] listUsers failed:", listError.message);
      return successResponse;
    }

    const user = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return successResponse;
    }

    const { data: employee } = await supabaseAdmin
      .from("employees")
      .select("name")
      .eq("id", user.id)
      .single();

    const resetToken = randomUUID();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          ...user.app_metadata,
          reset_token: resetToken,
          reset_token_expires: resetExpires,
        },
      }
    );

    if (metaError) {
      console.error("[forgot-password] Failed to store reset token:", metaError.message);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetLink = `${appUrl}/reset-password?token=${resetToken}&uid=${user.id}`;

    await sendPasswordResetEmail({
      to: email,
      name: employee?.name || user.user_metadata?.name || "",
      resetLink,
    });

    console.log("[forgot-password] Reset email sent to:", email);
  } catch (err) {
    console.error("[forgot-password] Unexpected error:", err);
  }

  return successResponse;
}
