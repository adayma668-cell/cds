import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getUser(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (sessionId) {
    const [itemsRes, moodsRes, votesRes] = await Promise.all([
      supabaseAdmin
        .from("retro_items")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("retro_moods")
        .select("user_name, avatar_url, mood")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("retro_votes")
        .select("item_id, user_id")
        .eq("session_id", sessionId),
    ]);

    return NextResponse.json({
      items: itemsRes.data || [],
      moods: moodsRes.data || [],
      votes: votesRes.data || [],
    });
  }

  const { data: sessions, error } = await supabaseAdmin
    .from("retro_sessions")
    .select("*")
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch retro history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = await Promise.all(
    (sessions || []).map(async (s) => {
      const [itemsRes, moodsRes, facilitatorRes] = await Promise.all([
        supabaseAdmin
          .from("retro_items")
          .select("phase")
          .eq("session_id", s.id),
        supabaseAdmin
          .from("retro_moods")
          .select("id")
          .eq("session_id", s.id),
        supabaseAdmin
          .from("employees")
          .select("name")
          .eq("id", s.created_by)
          .single(),
      ]);

      const items = itemsRes.data || [];
      return {
        ...s,
        facilitator_name: facilitatorRes.data?.name || "Unknown",
        stats: {
          went_well: items.filter((i) => i.phase === "went_well").length,
          didnt_go_well: items.filter((i) => i.phase === "didnt_go_well").length,
          should_try: items.filter((i) => i.phase === "should_try").length,
          action_items: items.filter((i) => i.phase === "action_items").length,
          appreciation: items.filter((i) => i.phase === "appreciation").length,
          moods: (moodsRes.data || []).length,
        },
      };
    })
  );

  return NextResponse.json({ sessions: enriched });
}
