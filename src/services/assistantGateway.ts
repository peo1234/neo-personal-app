import { hotItems } from "../data/mock";
import type { HotItem, Note, PushRecord, PushStatus } from "../types";

export type { PushRecord, PushStatus } from "../types";

export interface CapturePayload {
  text: string;
  mode: "save" | "route";
}

export interface CodexTaskPayload {
  prompt: string;
  workspacePath?: string;
  requireApproval?: boolean;
}

export const endpoints = {
  capture: "/api/capture",
  aihotFeed: "/api/aihot/feed",
  codexTasks: "/api/agents/codex/tasks",
  pushStatus: "/api/push/status",
  pushRecords: "/api/push/records",
  pushRun: "/api/push/run",
  pushTest: "/api/push/test",
  goals: "/api/goals",
  knowledge: "/api/knowledge"
};

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  return fetch(path, {
    ...options,
    headers
  });
}

export async function fetchAIHotFeed(): Promise<HotItem[]> {
  return Promise.resolve(hotItems);
}

export async function routeCapture(payload: CapturePayload): Promise<Note> {
  return Promise.resolve({
    id: crypto.randomUUID(),
    text: payload.text,
    kind: payload.mode === "route" ? classifyCapture(payload.text) : "inbox",
    createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
  });
}

export async function createCodexTask(payload: CodexTaskPayload) {
  return Promise.resolve({
    id: crypto.randomUUID(),
    status: "queued",
    endpoint: endpoints.codexTasks,
    prompt: payload.prompt,
    workspacePath: payload.workspacePath ?? "server default workspace",
    requireApproval: payload.requireApproval ?? true
  });
}

export async function fetchPushStatus(): Promise<PushStatus> {
  try {
    const response = await apiFetch(endpoints.pushStatus);
    if (response.ok) return response.json();
  } catch {
    // Local UI can still render before the user's server is connected.
  }

  return {
    server: "offline",
    hermes: "unknown",
    feishu: "missing",
    schedule: "08:30",
    lastRun: "未连接",
    nextRun: "连接服务器后同步"
  };
}

export async function fetchPushRecords(): Promise<PushRecord[]> {
  try {
    const response = await apiFetch(endpoints.pushRecords);
    if (response.ok) {
      const payload = await response.json();
      return payload.records ?? [];
    }
  } catch {
    // The app can still show the schedule before archive sync is ready.
  }

  return [];
}

export async function runDailyPush() {
  try {
    const response = await apiFetch(endpoints.pushRun, { method: "POST" });
    if (response.ok) return response.json();
  } catch {
    // Fall through to local draft response.
  }

  return {
    ok: false,
    message: "本地已准备触发入口，等待服务器接入。"
  };
}

export async function sendTestPush() {
  try {
    const response = await apiFetch(endpoints.pushTest, { method: "POST" });
    if (response.ok) return response.json();
  } catch {
    // Fall through to local draft response.
  }

  return {
    ok: false,
    message: "连接测试需要先配置服务器。"
  };
}

function classifyCapture(text: string): Note["kind"] {
  const value = text.toLowerCase();
  if (/codex|代码|接口|后端|api|项目|repo|任务|todo|需要|实现|修|写/.test(value)) return "task";
  if (/目标|复盘|总结|长期|本周|本月|习惯/.test(value)) return "goal";
  return "knowledge";
}
