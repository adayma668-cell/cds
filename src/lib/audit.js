import { supabaseAdmin } from "./supabaseAdmin";

function computeDiff(oldData, newData) {
  if (!oldData || !newData) return null;
  const diff = {};
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  for (const key of keys) {
    if (key === "updated_at" || key === "created_at") continue;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      diff[key] = { old: oldData[key] ?? null, new: newData[key] ?? null };
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

export async function logAudit({
  entityType,
  entityId,
  action,
  actorId = null,
  actorName = null,
  oldData = null,
  newData = null,
  metadata = null,
}) {
  try {
    const changes = computeDiff(oldData, newData);
    await supabaseAdmin.from("audit_logs").insert({
      entity_type: entityType,
      entity_id: String(entityId),
      action,
      actor_id: actorId,
      actor_name: actorName,
      old_data: oldData,
      new_data: newData,
      changes,
      metadata,
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
  }
}
