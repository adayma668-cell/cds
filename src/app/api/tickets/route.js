import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getAuthUser(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function GET(request) {
  const user = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabaseAdmin
    .from("tickets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status && ["to_be_done", "in_progress", "closed"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tickets: data });
}

export async function POST(request) {
  const user = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { ticket_number, due_date, status, description } = body;

  if (!ticket_number || !ticket_number.trim()) {
    return NextResponse.json(
      { error: "Ticket number is required" },
      { status: 400 }
    );
  }

  const validStatus = ["to_be_done", "in_progress", "closed"].includes(status)
    ? status
    : "to_be_done";

  const { error } = await supabaseAdmin.from("tickets").insert([
    {
      user_id: user.id,
      ticket_number: ticket_number.trim(),
      due_date: due_date || null,
      status: validStatus,
      description: description || "",
    },
  ]);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: "Ticket created" });
}
