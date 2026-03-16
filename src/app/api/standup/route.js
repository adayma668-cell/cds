import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAudit } from "@/lib/audit";

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
  const scope = searchParams.get("scope");
  const date = searchParams.get("date");

  let query = supabaseAdmin.from("standups").select("*");

  if (scope === "mine") {
    query = query.eq("user_id", user.id);
  }

  if (date) {
    const d = date === "today"
      ? new Date()
      : new Date(date + "T12:00:00");
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    query = query
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const includeTeams = searchParams.get("include") === "teams";
  if (includeTeams && data?.length > 0) {
    const userIds = [...new Set(data.map((s) => s.user_id))];
    const { data: employees } = await supabaseAdmin
      .from("employees")
      .select("id, teams")
      .in("id", userIds);
    const teamMap = {};
    (employees || []).forEach((e) => {
      teamMap[e.id] = e.teams || [];
    });
    data.forEach((s) => {
      s.teams = teamMap[s.user_id] || [];
    });
  }

  return NextResponse.json({ standups: data });
}

export async function POST(request) {
  const user = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticket_number, due_date, yesterday, today, blockers, mood } = await request.json();

  if (!yesterday || !today) {
    return NextResponse.json(
      { error: "Yesterday and Today fields are required" },
      { status: 400 }
    );
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: existing } = await supabaseAdmin
    .from("standups")
    .select("id")
    .eq("user_id", user.id)
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "You have already submitted your standup for today" },
      { status: 409 }
    );
  }

  const employeeName = user.user_metadata?.name || user.email;

  const row = {
    user_id: user.id,
    employee_name: employeeName,
    ticket_number: ticket_number || null,
    due_date: due_date || null,
    yesterday,
    today,
    blockers: blockers || "",
    mood: mood || "good",
    created_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabaseAdmin
    .from("standups")
    .insert([row])
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    entityType: "standup",
    entityId: created.id,
    action: "submitted",
    actorId: user.id,
    actorName: employeeName,
    newData: created,
  });

  return NextResponse.json({ message: "Standup submitted successfully" });
}

export async function PATCH(request) {
  const user = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ticket_number, due_date, yesterday, today, blockers, mood } = await request.json();

  if (!id)
    return NextResponse.json(
      { error: "Standup id is required" },
      { status: 400 }
    );

  const { data: existing } = await supabaseAdmin
    .from("standups")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== user.id)
    return NextResponse.json(
      { error: "Not found or not yours" },
      { status: 403 }
    );

  const updateData = {};
  if (ticket_number !== undefined) updateData.ticket_number = ticket_number;
  if (due_date !== undefined) updateData.due_date = due_date;
  if (yesterday !== undefined) updateData.yesterday = yesterday;
  if (today !== undefined) updateData.today = today;
  if (blockers !== undefined) updateData.blockers = blockers;
  if (mood !== undefined) updateData.mood = mood;

  const { data: updated, error } = await supabaseAdmin
    .from("standups")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "standup",
    entityId: id,
    action: "updated",
    actorId: user.id,
    actorName,
    oldData: existing,
    newData: updated,
  });

  return NextResponse.json({ success: true });
}
