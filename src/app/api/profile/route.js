import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("name, email")
    .eq("id", user.id)
    .single();

  const name = employee?.name ?? user.user_metadata?.name ?? "";
  const email = user.email ?? employee?.email ?? "";
  const avatar_url = user.user_metadata?.avatar_url ?? null;

  return NextResponse.json({
    name,
    email,
    avatar_url,
  });
}

export async function PATCH(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, avatar_url, password } = body;

  const authUpdate = {};
  if (typeof name === "string") authUpdate.name = name.trim();
  if (avatar_url !== undefined) authUpdate.avatar_url = avatar_url || null;
  if (password && typeof password === "string" && password.length >= 6) {
    authUpdate.password = password;
  } else if (password && password.length > 0) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  if (Object.keys(authUpdate).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const userMetadata = { ...user.user_metadata };
  if (authUpdate.name !== undefined) userMetadata.name = authUpdate.name;
  if (authUpdate.avatar_url !== undefined)
    userMetadata.avatar_url = authUpdate.avatar_url;

  const updatePayload = { user_metadata: userMetadata };
  if (authUpdate.password) updatePayload.password = authUpdate.password;

  const { error: authUpdateError } =
    await supabaseAdmin.auth.admin.updateUserById(user.id, updatePayload);

  if (authUpdateError)
    return NextResponse.json(
      { error: authUpdateError.message },
      { status: 500 }
    );

  if (typeof name === "string") {
    await supabaseAdmin
      .from("employees")
      .update({ name: name.trim() })
      .eq("id", user.id);
  }

  return NextResponse.json({ success: true });
}
