import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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

  if (!emp || emp.role !== "super_admin") return null;
  return user;
}

export async function GET(req) {
  const user = await verifySuperAdmin(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entity_type");
  const entityId = searchParams.get("entity_id");
  const actorId = searchParams.get("actor_id");
  const action = searchParams.get("action");
  const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 50));
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  if (actorId) query = query.eq("actor_id", actorId);
  if (action) query = query.eq("action", action);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    logs: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
