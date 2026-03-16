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

export async function PATCH(request, context) {
  const user = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();
  const { ticket_number, due_date, status, description } = body;

  const { data: existing } = await supabaseAdmin
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData = { updated_at: new Date().toISOString() };
  if (ticket_number !== undefined) updateData.ticket_number = ticket_number.trim();
  if (due_date !== undefined) updateData.due_date = due_date || null;
  if (status !== undefined && ["to_be_done", "in_progress", "closed"].includes(status)) {
    updateData.status = status;
  }
  if (description !== undefined) updateData.description = description;

  const { data: updated, error } = await supabaseAdmin
    .from("tickets")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = user.user_metadata?.name || user.email;
  const action = status !== undefined && status !== existing.status ? "status_changed" : "updated";
  await logAudit({
    entityType: "ticket",
    entityId: id,
    action,
    actorId: user.id,
    actorName,
    oldData: existing,
    newData: updated,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request, context) {
  const user = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { data: existing } = await supabaseAdmin
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabaseAdmin.from("tickets").delete().eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const actorName = user.user_metadata?.name || user.email;
  await logAudit({
    entityType: "ticket",
    entityId: id,
    action: "deleted",
    actorId: user.id,
    actorName,
    oldData: existing,
  });

  return NextResponse.json({ success: true });
}
