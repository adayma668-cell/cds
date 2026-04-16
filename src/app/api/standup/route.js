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
    const dateStr = date === "today"
      ? new Date().toLocaleDateString("en-CA")
      : date;
    query = query.eq("standup_date", dateStr);
  }

  const before = searchParams.get("before");
  if (before) {
    const beforeStr = before === "today"
      ? new Date().toLocaleDateString("en-CA")
      : before;
    query = query.lt("standup_date", beforeStr);
  }

  const presented = searchParams.get("presented");
  if (presented === "false") {
    query = query.or("presented.eq.false,presented.is.null");
  } else if (presented === "true") {
    query = query.eq("presented", true);
  }

  query = query.order("standup_date", { ascending: false }).order("created_at", { ascending: false });

  const limit = parseInt(searchParams.get("limit"), 10);
  if (limit > 0) {
    query = query.limit(limit);
  }

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

  if (data?.length > 0) {
    const userIds = [...new Set(data.map((s) => s.user_id))];
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const avatarMap = {};
    (authUsers || []).forEach((u) => {
      if (userIds.includes(u.id)) {
        avatarMap[u.id] = u.user_metadata?.avatar_url || null;
      }
    });
    data.forEach((s) => {
      s.avatar_url = avatarMap[s.user_id] || null;
    });
  }

  return NextResponse.json({ standups: data });
}

export async function POST(request) {
  const user = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    ticket_number, due_date, yesterday, today, blockers, mood,
    yesterday_tickets, today_tickets, blocker_tickets,
  } = await request.json();

  if (!yesterday || !today) {
    return NextResponse.json(
      { error: "Yesterday and Today fields are required" },
      { status: 400 }
    );
  }

  const todayStr = new Date().toLocaleDateString("en-CA");

  const { data: existing } = await supabaseAdmin
    .from("standups")
    .select("*")
    .eq("user_id", user.id)
    .eq("standup_date", todayStr)
    .or("presented.eq.false,presented.is.null")
    .limit(1);

  const employeeName = user.user_metadata?.name || user.email;

  if (existing && existing.length > 0) {
    const prev = existing[0];
    const { data: updated, error } = await supabaseAdmin
      .from("standups")
      .update({
        yesterday,
        today,
        blockers: blockers || "",
        ticket_number: ticket_number || prev.ticket_number || null,
        due_date: due_date || prev.due_date || null,
        mood: mood || prev.mood || "good",
        yesterday_tickets: yesterday_tickets ?? prev.yesterday_tickets ?? [],
        today_tickets: today_tickets ?? prev.today_tickets ?? [],
        blocker_tickets: blocker_tickets ?? prev.blocker_tickets ?? [],
      })
      .eq("id", prev.id)
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    await logAudit({
      entityType: "standup",
      entityId: prev.id,
      action: "resubmitted",
      actorId: user.id,
      actorName: employeeName,
      oldData: prev,
      newData: updated,
    });

    return NextResponse.json({ message: "Standup updated successfully" });
  }

  const row = {
    user_id: user.id,
    employee_name: employeeName,
    ticket_number: ticket_number || null,
    due_date: due_date || null,
    yesterday,
    today,
    blockers: blockers || "",
    mood: mood || "good",
    standup_date: todayStr,
    created_at: new Date().toISOString(),
    yesterday_tickets: yesterday_tickets || [],
    today_tickets: today_tickets || [],
    blocker_tickets: blocker_tickets || [],
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

  const {
    id, ticket_number, due_date, yesterday, today, blockers, mood,
    yesterday_tickets, today_tickets, blocker_tickets,
  } = await request.json();

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

  if (existing.presented)
    return NextResponse.json(
      { error: "Cannot edit a standup after the meeting has finished" },
      { status: 403 }
    );

  const updateData = {};
  if (ticket_number !== undefined) updateData.ticket_number = ticket_number;
  if (due_date !== undefined) updateData.due_date = due_date;
  if (yesterday !== undefined) updateData.yesterday = yesterday;
  if (today !== undefined) updateData.today = today;
  if (blockers !== undefined) updateData.blockers = blockers;
  if (mood !== undefined) updateData.mood = mood;
  if (yesterday_tickets !== undefined) updateData.yesterday_tickets = yesterday_tickets;
  if (today_tickets !== undefined) updateData.today_tickets = today_tickets;
  if (blocker_tickets !== undefined) updateData.blocker_tickets = blocker_tickets;

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
