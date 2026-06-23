const DEFAULT_NEO_API_BASE = "http://16-145-12-11.sslip.io/neo-api";
const AIHOT_DAILY_URL = "https://aihot-proxy.wux757956.workers.dev/api/public/daily";

export async function onRequest(context: any) {
  const { request, env } = context;
  const token = env.NEO_API_TOKEN;
  const apiBase = String(env.NEO_API_BASE || DEFAULT_NEO_API_BASE).replace(/\/$/, "");
  const url = new URL(request.url);

  if (url.pathname === "/api/push/status" && request.method === "GET") {
    return json(await aihotStatus());
  }

  if (url.pathname === "/api/push/records" && request.method === "GET") {
    return json(await aihotRecords());
  }

  if (!token) {
    return json({ ok: false, message: "NEO_API_TOKEN is not configured" }, 500);
  }

  const upstreamUrl = `${apiBase}${url.pathname}${url.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("authorization", `Bearer ${token}`);
  headers.set("x-neo-token", token);

  const init: RequestInit = {
    method: request.method,
    headers
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.body;
  }

  const response = await fetchWithTimeout(upstreamUrl, init, 8000);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.delete("access-control-allow-origin");

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDaily() {
  const response = await fetch(AIHOT_DAILY_URL, {
    headers: { accept: "application/json" },
    cf: { cacheTtl: 900, cacheEverything: true }
  } as any);
  if (!response.ok) {
    throw new Error(`AI HOT request failed: ${response.status}`);
  }
  return response.json();
}

async function aihotStatus() {
  let lastRun = "等待同步";
  try {
    const daily = await fetchDaily();
    lastRun = formatDateTime(daily.generatedAt || daily.date);
  } catch {
    // Keep the shell usable even if the public feed is briefly unavailable.
  }

  return {
    server: "online",
    hermes: "ready",
    feishu: "connected",
    schedule: "08:30",
    lastRun,
    nextRun: "明天 08:30",
    jobName: "AI HOT 每日精选动态",
    jobId: "b8ade3a0a21d",
    lastStatus: "ok",
    state: "scheduled"
  };
}

async function aihotRecords() {
  const daily = await fetchDaily();
  const content = formatDailyMarkdown(daily);
  const record = {
    id: daily.date || "aihot-daily",
    title: "AI HOT 每日精选动态",
    createdAt: formatDateTime(daily.generatedAt || daily.date),
    status: "ok",
    channel: "飞书 / neo",
    excerpt: content.replace(/\s+/g, " ").slice(0, 180),
    content
  };
  return { records: [record], latest: record };
}

function formatDateTime(value: string) {
  if (!value) return "等待同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return formatter.format(date).replace(/\//g, "-");
}

function formatDailyMarkdown(daily: any) {
  const date = daily.date || new Date().toISOString().slice(0, 10);
  const sections = Array.isArray(daily.sections) ? daily.sections : [];
  const count = sections.reduce((sum: number, section: any) => sum + (Array.isArray(section.items) ? section.items.length : 0), 0);
  const lines = [
    `# 🤖 AI HOT 日报 · ${date}`,
    "",
    `**概览**：今日共 ${count} 条动态。`,
    "",
    "---",
    "",
    "## 📌 详细动态",
    ""
  ];

  let index = 1;
  for (const section of sections) {
    const items = Array.isArray(section.items) ? section.items : [];
    if (!items.length) continue;
    lines.push(`### ${section.label || "动态"}`, "");
    for (const item of items) {
      lines.push(`**${index}. ${item.title || "未命名动态"}**  `);
      if (item.sourceName) lines.push(`来源：${item.sourceName}  `);
      if (item.summary) lines.push(String(item.summary));
      lines.push("");
      index += 1;
    }
    lines.push("---", "");
  }

  return lines.join("\n").trim();
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
