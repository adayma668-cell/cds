import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { token, userId, password } = await req.json();
  console.log("[set-password] Request received for userId:", userId);

  if (!token || !userId || !password) {
    console.log("[set-password] Missing fields - token:", !!token, "userId:", !!userId, "password:", !!password);
    return NextResponse.json(
      { error: "Token, user ID, and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    console.log("[set-password] Password too short");
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
    console.error("[set-password] User not found:", fetchError?.message);
    return NextResponse.json(
      { error: "Invalid invite link. Please ask your admin to resend." },
      { status: 400 }
    );
  }

  console.log("[set-password] User found:", user.email);
  console.log("[set-password] app_metadata:", JSON.stringify(user.app_metadata));

  const { invite_token, invite_token_expires } = user.app_metadata || {};

  if (!invite_token || invite_token !== token) {
    console.log("[set-password] Token mismatch - stored:", invite_token, "received:", token);
    return NextResponse.json(
      { error: "Invalid invite link. Please ask your admin to resend." },
      { status: 400 }
    );
  }

  if (new Date(invite_token_expires) < new Date()) {
    console.log("[set-password] Token expired at:", invite_token_expires, "now:", new Date().toISOString());
    return NextResponse.json(
      { error: "This invite link has expired. Please ask your admin to resend." },
      { status: 400 }
    );
  }

  console.log("[set-password] Token valid, setting password...");

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    {
      password,
      app_metadata: { invite_token: null, invite_token_expires: null },
    }
  );

  if (updateError) {
    console.error("[set-password] Password update failed:", updateError.message);
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  const { error: empError } = await supabaseAdmin
    .from("employees")
    .update({ password_set: true })
    .eq("id", userId);

  if (empError) {
    console.error("[set-password] Employee password_set update failed:", empError.message);
  }

  console.log("[set-password] Password set successfully for:", user.email);
  return NextResponse.json({ success: true });
}
