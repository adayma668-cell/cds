import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("retro_items")
      .select("*")
      .eq("phase", "action_items")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ actions: data || [] });
  } catch (err) {
    console.error("Failed to fetch open actions:", err);
    return NextResponse.json({ error: "Failed to load open actions" }, { status: 500 });
  }
}
