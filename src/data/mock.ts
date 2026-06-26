import type { AgentSource, Goal, HotItem, Note, Task } from "../types";

export const hotItems: HotItem[] = [
  {
    id: "hot-1",
    title: "个人 AI 工具正在从聊天框转向工作流入口",
    summary: "更有用的个人助手会记住输入、整理上下文，并把内容转成任务、知识或目标回顾。",
    source: "AIHot",
    time: "09:20",
    tags: ["AI 产品", "个人知识库", "工作流"],
    relevance: "high",
    relatedGoals: ["个人助手 MVP"],
    insight: "首页应该让用户看到记录之后会发生什么，而不是只给一个空聊天框。",
    suggestedActions: ["保存为产品灵感", "生成竞品观察任务"],
    status: "new"
  }
];

export const goals: Goal[] = [
  {
    id: "goal-1",
    title: "助手 MVP",
    focus: "跑通 AI、记忆、目标、执行",
    progress: 42,
    cadence: "本周",
    nextAction: "先固定首页"
  },
  {
    id: "goal-2",
    title: "每日记录",
    focus: "每天留下 3 条记录",
    progress: 58,
    cadence: "每日",
    nextAction: "晚上整理一次"
  }
];

export const tasks: Task[] = [
  {
    id: "task-1",
    title: "固定首页",
    detail: "先定 AI 首页，再接功能。",
    priority: "high",
    state: "doing"
  },
  {
    id: "task-2",
    title: "最小数据模型",
    detail: "Entry、Goal、Task、AgentTask。",
    priority: "high",
    state: "next"
  },
  {
    id: "task-3",
    title: "Codex 审批",
    detail: "执行前先确认。",
    priority: "medium",
    state: "next"
  }
];

export const notes: Note[] = [];

export const agentSources: AgentSource[] = [
  {
    id: "agent-openai",
    name: "OpenAI",
    role: "整理、总结、归档和目标回顾",
    status: "ready",
    route: "/api/ai/openai"
  },
  {
    id: "agent-codex",
    name: "Codex",
    role: "代码、文档、项目执行",
    status: "server",
    route: "/api/agents/codex/tasks"
  }
];
