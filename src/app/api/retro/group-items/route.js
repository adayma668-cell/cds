import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import prisma from "@/lib/prisma";
import Groq from "groq-sdk";

export const dynamic = "force-dynamic";

const BOARD_PHASES = ["went_well", "didnt_go_well", "should_try", "puzzles_us"];

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
}

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
  const session_id = searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "session_id is required" }, { status: 400 });

  const data = await prisma.retroItem.findMany({
    where: { session_id, phase: { in: BOARD_PHASES } },
    orderBy: { created_at: "asc" },
  });

  const groups = {};
  const ungrouped = [];
  for (const item of data || []) {
    if (item.group_name) {
      if (!groups[item.group_name]) groups[item.group_name] = [];
      groups[item.group_name].push(item);
    } else {
      ungrouped.push(item);
    }
  }

  return NextResponse.json({ groups, ungrouped });
}

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { session_id } = await req.json();
  if (!session_id) return NextResponse.json({ error: "session_id is required" }, { status: 400 });

  const items = await prisma.retroItem.findMany({
    where: { session_id, phase: { in: BOARD_PHASES } },
    orderBy: { created_at: "asc" },
  });
  if (!items || items.length === 0) {
    return NextResponse.json({ groups: {}, ungrouped: [] });
  }

  const itemList = items.map((it) => ({ id: it.id, content: it.content, phase: it.phase }));

  const prefixGrouped = extractPrefixGroups(items);
  if (prefixGrouped) {
    await persistGroups(prefixGrouped);
    return NextResponse.json({ groups: prefixGrouped, ungrouped: [], source: "prefix" });
  }

  if (!process.env.GROQ_API_KEY) {
    const fallbackGroups = buildFallbackGroups(items);
    await persistGroups(fallbackGroups);
    return NextResponse.json({ groups: fallbackGroups, ungrouped: [], source: "fallback" });
  }

  try {
    const chatCompletion = await getGroq().chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a retrospective facilitator assistant. You will receive a list of retrospective board items. Each item has an id, content text, and phase (went_well, didnt_go_well, should_try, puzzles_us).

Your job is to group these items STRICTLY by their domain/team prefix tag.

RULES:
1. Items often have an explicit prefix in brackets like "[Marketing]", "[Backend]", "[QA]" or with a colon like "Marketing:", "IT:", "SPT:" — extract that EXACT prefix as the group name.
2. Two different prefixes are ALWAYS two different groups, even if their tasks sound similar. "[Marketing] - Improvise UI" and "[Manava] - Improvised UI" belong to DIFFERENT groups ("Marketing" vs "Manava").
3. If an item has no clear prefix, analyze its content to determine the most fitting domain and assign it there.
4. Group names should be the exact prefix text (cleaned up to Title Case, no brackets/colons). Do NOT merge or rename prefixes.
5. Every item MUST be assigned to exactly one group.

Return ONLY a JSON object where keys are group names and values are arrays of item IDs.
Example: { "Marketing": ["id1"], "IT": ["id2", "id3"], "SPT": ["id4"] }`,
        },
        {
          role: "user",
          content: `Group these retrospective items:\n${JSON.stringify(itemList)}`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });

    const raw = chatCompletion.choices[0]?.message?.content;
    const parsed = JSON.parse(raw);

    const groupMap = {};
    const itemById = {};
    for (const it of items) itemById[it.id] = it;

    const assignedIds = new Set();
    for (const [groupName, ids] of Object.entries(parsed)) {
      if (!Array.isArray(ids)) continue;
      groupMap[groupName] = [];
      for (const id of ids) {
        if (itemById[id]) {
          groupMap[groupName].push(itemById[id]);
          assignedIds.add(id);
        }
      }
      if (groupMap[groupName].length === 0) delete groupMap[groupName];
    }

    const ungrouped = items.filter((it) => !assignedIds.has(it.id));
    if (ungrouped.length > 0) {
      groupMap["Other"] = [...(groupMap["Other"] || []), ...ungrouped];
    }

    await persistGroups(groupMap);

    return NextResponse.json({ groups: groupMap, ungrouped: [], source: "groq" });
  } catch (err) {
    console.error("AI grouping failed:", err);
    const fallbackGroups = buildFallbackGroups(items);
    await persistGroups(fallbackGroups);
    return NextResponse.json({ groups: fallbackGroups, ungrouped: [], source: "fallback" });
  }
}

export async function PATCH(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.rename) {
    const { old_name, new_name, session_id } = body.rename;
    if (!old_name || !new_name || !session_id) {
      return NextResponse.json({ error: "old_name, new_name, and session_id are required" }, { status: 400 });
    }
    await prisma.retroItem.updateMany({
      where: { session_id, group_name: old_name },
      data: { group_name: new_name.trim() },
    });
    return NextResponse.json({ success: true });
  }

  if (body.items && Array.isArray(body.items)) {
    for (const { id, group_name } of body.items) {
      if (!id || !group_name) continue;
      await prisma.retroItem.update({
        where: { id },
        data: { group_name: group_name.trim() },
      });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
}

function extractPrefixGroups(items) {
  const prefixRe = /^\[([^\]]+)\]|^([A-Za-z0-9_]+)\s*[:\-–—]\s/;
  const groups = {};
  let matched = 0;

  for (const item of items) {
    const m = item.content.match(prefixRe);
    if (m) {
      const prefix = (m[1] || m[2]).trim();
      const name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      if (!groups[name]) groups[name] = [];
      groups[name].push(item);
      matched++;
    }
  }

  if (matched === 0) return null;

  const ungrouped = items.filter((item) => {
    const m = item.content.match(prefixRe);
    return !m;
  });
  if (ungrouped.length > 0) {
    groups["Other"] = [...(groups["Other"] || []), ...ungrouped];
  }

  return groups;
}

function buildFallbackGroups(items) {
  const PHASE_LABELS = {
    went_well: "Went Well",
    didnt_go_well: "Needs Improvement",
    should_try: "Try Next",
    puzzles_us: "Puzzles",
  };
  const groups = {};
  for (const item of items) {
    const label = PHASE_LABELS[item.phase] || "Other";
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

async function persistGroups(groupMap) {
  let hasError = false;
  for (const [groupName, items] of Object.entries(groupMap)) {
    const ids = items.map((it) => it.id);
    if (ids.length === 0) continue;
    try {
      await prisma.retroItem.updateMany({
        where: { id: { in: ids } },
        data: { group_name: groupName },
      });
    } catch (error) {
      console.error(`persistGroups failed for "${groupName}" (${ids.length} items):`, error.message);
      hasError = true;
    }
  }
  return !hasError;
}
