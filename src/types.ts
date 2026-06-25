import type { LucideIcon } from "lucide-react";

export type TabId = "home" | "aihot" | "capture" | "goals" | "execute" | "knowledge" | "agents";

export type Priority = "high" | "medium" | "low";

export interface AppTab {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

export interface HotItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  time: string;
  tags: string[];
  relevance: "high" | "medium" | "watch";
  relatedGoals: string[];
  insight: string;
  suggestedActions: string[];
  status: "new" | "saved" | "converted" | "ignored";
}

export interface Goal {
  id: string;
  title: string;
  focus: string;
  progress: number;
  cadence: string;
  nextAction: string;
}

export interface Task {
  id: string;
  title: string;
  detail: string;
  priority: Priority;
  state: "doing" | "next" | "blocked";
}

export interface Note {
  id: string;
  text: string;
  kind: "inbox" | "knowledge" | "task" | "goal";
  createdAt: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface AgentSource {
  id: string;
  name: string;
  role: string;
  status: "ready" | "pending" | "local" | "server";
  route: string;
}

export interface PushStatus {
  server: "online" | "offline";
  hermes: "ready" | "unknown";
  feishu: "connected" | "missing";
  schedule: string;
  lastRun: string;
  nextRun: string;
}

export interface PushRecord {
  id: string;
  title: string;
  createdAt: string;
  status: "sent" | "pending" | "failed";
  channel: string;
  excerpt?: string;
  content?: string;
}

export interface HealthEntry {
  id: string;
  date: string;
  category: "sleep" | "digestion" | "note" | "water" | "mood";
  sleepStart?: string;
  sleepEnd?: string;
  sleepHours?: number;
  diarrheaCount?: number;
  waterCount?: number;
  moodScore?: number;
  note?: string;
  createdAt: string;
}
