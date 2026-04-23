import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ORG = process.env.AZURE_DEVOPS_ORG;
const PAT = process.env.AZURE_DEVOPS_PAT;
const DOMAIN_MAP = process.env.AZURE_DEVOPS_EMAIL_DOMAIN_MAP;

function mapEmailForDevOps(appEmail) {
  if (!DOMAIN_MAP || !appEmail) return appEmail;
  const [fromDomain, toDomain] = DOMAIN_MAP.split(":");
  if (!fromDomain || !toDomain) return appEmail;
  if (appEmail.endsWith(`@${fromDomain}`)) {
    return appEmail.replace(`@${fromDomain}`, `@${toDomain}`);
  }
  return appEmail;
}

function buildAuthHeader() {
  return "Basic " + Buffer.from(":" + PAT).toString("base64");
}

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

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

export async function GET(request) {
  const user = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!PAT || !ORG) {
    return NextResponse.json(
      { error: "Azure DevOps not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const refresh = searchParams.get("refresh") === "true";

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("email")
    .eq("id", user.id)
    .single();

  const devopsEmail = mapEmailForDevOps(employee?.email || user.email);
  const cacheKey = `${devopsEmail}:${search}`;
  if (!refresh) {
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);
  }

  try {
    const authHeader = buildAuthHeader();

    let searchFilter = "";
    if (search.trim()) {
      const safeSearch = search.replace(/'/g, "''");
      const numericId = parseInt(search, 10);
      if (!isNaN(numericId)) {
        searchFilter = `AND ([System.Title] CONTAINS '${safeSearch}' OR [System.Id] = ${numericId})`;
      } else {
        searchFilter = `AND [System.Title] CONTAINS '${safeSearch}'`;
      }
    }

    const wiqlQuery = {
      query: `SELECT [System.Id]
              FROM WorkItems
              WHERE [System.AssignedTo] = '${devopsEmail}'
                AND [System.State] <> 'Removed'
                AND [System.WorkItemType] IN ('User Story', 'Task', 'Bug', 'Requirement')
                ${searchFilter}
              ORDER BY [System.IterationPath] DESC, [System.ChangedDate] DESC`,
    };

    const wiqlRes = await fetch(
      `https://dev.azure.com/${ORG}/_apis/wit/wiql?$top=20000&api-version=7.0`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wiqlQuery),
      }
    );

    if (!wiqlRes.ok) {
      const errorText = await wiqlRes.text();
      console.error("[azure-devops] WIQL error:", wiqlRes.status, errorText);
      return NextResponse.json(
        { error: "Failed to query Azure DevOps", detail: errorText },
        { status: wiqlRes.status }
      );
    }

    const wiqlData = await wiqlRes.json();
    const ids = wiqlData.workItems?.map((wi) => wi.id);

    if (!ids || ids.length === 0) {
      const result = { workItems: [], grouped: {} };
      setCache(cacheKey, result);
      return NextResponse.json(result);
    }

    const allItems = [];
    const batchSize = 200;
    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      const detailsRes = await fetch(
        `https://dev.azure.com/${ORG}/_apis/wit/workitems?ids=${chunk.join(",")}&api-version=7.0`,
        { headers: { Authorization: authHeader } }
      );

      if (!detailsRes.ok) {
        console.error("[azure-devops] Details fetch error:", detailsRes.status);
        continue;
      }

      const detailsData = await detailsRes.json();
      if (detailsData.value) {
        allItems.push(...detailsData.value);
      }
    }

    const workItems = allItems.map((wi) => {
      const f = wi.fields;
      const rawDue =
        f["Microsoft.VSTS.Scheduling.DueDate"] ||
        f["Microsoft.VSTS.Scheduling.TargetDate"] ||
        f["Microsoft.VSTS.Scheduling.FinishDate"] ||
        null;

      return {
        id: wi.id,
        title: f["System.Title"],
        state: f["System.State"],
        type: f["System.WorkItemType"],
        project: f["System.TeamProject"],
        parentId: f["System.Parent"] || null,
        dueDate: rawDue ? rawDue.slice(0, 10) : null,
        iterationPath: f["System.IterationPath"] || "",
      };
    });

    workItems.sort((a, b) => {
      const stateOrder = (s) => {
        const lower = (s || "").toLowerCase();
        if (["active", "in progress", "committed", "new", "to do", "approved"].includes(lower)) return 0;
        if (["resolved"].includes(lower)) return 1;
        return 2;
      };
      const sa = stateOrder(a.state);
      const sb = stateOrder(b.state);
      if (sa !== sb) return sa - sb;

      const iterA = a.iterationPath || "";
      const iterB = b.iterationPath || "";
      if (iterA !== iterB) return iterB.localeCompare(iterA);

      const da = a.dueDate || "9999-12-31";
      const db = b.dueDate || "9999-12-31";
      if (da !== db) return da.localeCompare(db);

      return 0;
    });

    const grouped = {};
    for (const wi of workItems) {
      if (!grouped[wi.project]) grouped[wi.project] = [];
      grouped[wi.project].push(wi);
    }

    const result = { workItems, grouped };
    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[azure-devops] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
