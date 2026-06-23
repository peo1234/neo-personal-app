import http from "node:http";

const port = Number(process.env.NEO_SERVER_PORT ?? 8787);
const feishuWebhook = process.env.FEISHU_WEBHOOK_URL ?? "";
const hermesNewsEndpoint = process.env.HERMES_NEWS_ENDPOINT ?? "";
const schedule = process.env.NEO_DAILY_PUSH_TIME ?? "08:30";

let lastRun = "未运行";

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function fetchHermesNews() {
  if (!hermesNewsEndpoint) {
    return {
      title: "Neo 每日新闻",
      summary: "Hermes 新闻 skill 接口尚未配置。设置 HERMES_NEWS_ENDPOINT 后，这里会使用真实内容。",
      items: ["服务器桥接已就绪", "飞书 webhook 可单独测试", "前端已接入 /api/push/*"]
    };
  }

  const response = await fetch(hermesNewsEndpoint, { method: "POST" });
  if (!response.ok) throw new Error(`Hermes request failed: ${response.status}`);
  return response.json();
}

async function sendFeishuMessage(content) {
  if (!feishuWebhook) {
    return { ok: false, message: "缺少 FEISHU_WEBHOOK_URL" };
  }

  const text = [
    `**${content.title ?? "Neo 每日推送"}**`,
    "",
    content.summary ?? "",
    ...(content.items ?? []).map((item) => `- ${item}`)
  ].join("\n");

  const response = await fetch(feishuWebhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      msg_type: "interactive",
      card: {
        elements: [{ tag: "markdown", content: text }],
        header: { title: { tag: "plain_text", content: "Neo Daily" } }
      }
    })
  });

  return { ok: response.ok, message: response.ok ? "飞书已发送" : `飞书发送失败：${response.status}` };
}

async function runDailyPush() {
  const news = await fetchHermesNews();
  const feishu = await sendFeishuMessage(news);
  lastRun = new Date().toLocaleString("zh-CN", { hour12: false });
  return {
    ok: feishu.ok,
    message: feishu.message,
    news
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 200, { ok: true });

  try {
    if (req.url === "/api/push/status" && req.method === "GET") {
      return json(res, 200, {
        server: "online",
        hermes: hermesNewsEndpoint ? "ready" : "unknown",
        feishu: feishuWebhook ? "connected" : "missing",
        schedule,
        lastRun,
        nextRun: `每天 ${schedule}`
      });
    }

    if (req.url === "/api/push/run" && req.method === "POST") {
      await readJson(req);
      return json(res, 200, await runDailyPush());
    }

    if (req.url === "/api/push/test" && req.method === "POST") {
      await readJson(req);
      return json(res, 200, await sendFeishuMessage({
        title: "Neo 测试推送",
        summary: "如果你看到这条消息，说明 Neo 已经可以连接飞书。",
        items: ["下一步接入 Hermes 新闻 skill", "再配置服务器定时任务"]
      }));
    }

    return json(res, 404, { ok: false, message: "Not found" });
  } catch (error) {
    return json(res, 500, { ok: false, message: error instanceof Error ? error.message : "Server error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`neo server listening on http://127.0.0.1:${port}`);
});
