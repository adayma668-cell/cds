import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { token, userId, password } = await req.json();

  if (!token || !userId || !password) {
    return NextResponse.json(
      { error: "Token, user ID, and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const {
    data: { user },
    error: fetchError,
  } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (fetchError || !user) {
    console.error("[reset-password] User not found:", fetchError?.message);
    return NextResponse.json(
      { error: "Invalid or expired reset link." },
      { status: 400 }
    );
  }

  const { reset_token, reset_token_expires } = user.app_metadata || {};

  if (!reset_token || reset_token !== token) {
    return NextResponse.json(
      { error: "Invalid or expired reset link." },
      { status: 400 }
    );
  }

  if (new Date(reset_token_expires) < new Date()) {
    return NextResponse.json(
      { error: "This reset link has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    {
      password,
      app_metadata: {
        ...user.app_metadata,
        reset_token: null,
        reset_token_expires: null,
      },
    }
  );

  if (updateError) {
    console.error("[reset-password] Password update failed:", updateError.message);
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  console.log("[reset-password] Password reset successfully for:", user.email);
  return NextResponse.json({ success: true });
}
