import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const AZURE_ORG = process.env.AZURE_DEVOPS_ORG;
const AZURE_PAT = process.env.AZURE_DEVOPS_PAT;

async function resolveWorkItemTitles(ids) {
  if (!ids.length || !AZURE_PAT || !AZURE_ORG) return {};
  const authHeader = "Basic " + Buffer.from(":" + AZURE_PAT).toString("base64");
  const titleMap = {};
  const batchSize = 200;
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    try {
      const res = await fetch(
        `https://dev.azure.com/${AZURE_ORG}/_apis/wit/workitems?ids=${chunk.join(",")}&fields=System.Title,System.WorkItemType&api-version=7.0`,
        { headers: { Authorization: authHeader } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const wi of data.value || []) {
        titleMap[String(wi.id)] = {
          title: wi.fields?.["System.Title"] || null,
          type: wi.fields?.["System.WorkItemType"] || null,
        };
      }
    } catch { /* skip on error */ }
  }
  return titleMap;
}

function enrichTickets(tickets, titleMap) {
  if (!tickets || !tickets.length) return tickets;
  return tickets.map((t) => {
    if (t.title || !t.ticket_number) return t;
    const info = titleMap[String(t.ticket_number)] || titleMap[String(t.ticket_id)];
    if (!info) return t;
    return { ...t, title: info.title || t.title, type: info.type || t.type };
  });
}

async function getLeader(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!employee || !["super_admin", "scrum_master"].includes(employee.role))
    return null;

  return user;
}

export async function GET(request) {
  const leader = await getLeader(request);
  if (!leader)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [standupsResult, employeesResult] = await Promise.all([
    supabaseAdmin
      .from("standups")
      .select("*")
      .gte("created_at", todayStart.toISOString())
      .or("presented.eq.false,presented.is.null")
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("employees").select("id, name, email, role, teams"),
  ]);

  if (standupsResult.error)
    return NextResponse.json(
      { error: standupsResult.error.message },
      { status: 500 }
    );
  if (employeesResult.error)
    return NextResponse.json(
      { error: employeesResult.error.message },
      { status: 500 }
    );

  const standups = standupsResult.data || [];
  const employees = employeesResult.data || [];

  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const avatarMap = Object.fromEntries(
    (authUsers || []).map((u) => [u.id, u.user_metadata?.avatar_url || null])
  );

  const superAdminIds = new Set(
    employees.filter((e) => e.role === "super_admin").map((e) => e.id)
  );

  const submittedUserIds = new Set(standups.map((s) => s.user_id));

  const allTicketEntries = standups.flatMap((s) => [
    ...(s.yesterday_tickets || []),
    ...(s.today_tickets || []),
    ...(s.blocker_tickets || []),
  ]);
  const missingTitleIds = [
    ...new Set(
      allTicketEntries
        .filter((t) => !t.title && (t.ticket_number || t.ticket_id))
        .map((t) => String(t.ticket_number || t.ticket_id))
        .filter(Boolean)
    ),
  ];
  const titleMap = await resolveWorkItemTitles(missingTitleIds);

  const submitted = standups
    .filter((s) => !superAdminIds.has(s.user_id))
    .map((s) => {
      const emp = employees.find((e) => e.id === s.user_id);
      return {
        id: s.id,
        user_id: s.user_id,
        name: s.employee_name || emp?.name || "Unknown",
        email: emp?.email || "",
        avatar_url: avatarMap[s.user_id] || null,
        teams: emp?.teams || [],
        ticket_number: s.ticket_number,
        due_date: s.due_date,
        mood: s.mood,
        yesterday: s.yesterday,
        today: s.today,
        blockers: s.blockers,
        yesterday_tickets: enrichTickets(s.yesterday_tickets || [], titleMap),
        today_tickets: enrichTickets(s.today_tickets || [], titleMap),
        blocker_tickets: enrichTickets(s.blocker_tickets || [], titleMap),
        created_at: s.created_at,
      };
    });

  const pending = employees
    .filter((e) => !submittedUserIds.has(e.id) && e.role !== "super_admin")
    .map((e) => ({
      id: e.id,
      name: e.name || e.email,
      email: e.email,
      avatar_url: avatarMap[e.id] || null,
      teams: e.teams || [],
      role: e.role,
    }));

  return NextResponse.json({ submitted, pending });
}
