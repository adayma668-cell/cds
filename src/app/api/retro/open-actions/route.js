import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await prisma.retroItem.findMany({
      where: { phase: "action_items" },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ actions: data });
  } catch (err) {
    console.error("Failed to fetch open actions:", err);
    return NextResponse.json({ error: "Failed to load open actions" }, { status: 500 });
  }
}
