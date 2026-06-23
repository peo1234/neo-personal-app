import {
  BellRing,
  Bot,
  CheckCircle2,
  CircleDot,
  Database,
  File,
  Inbox,
  ListTodo,
  Mic,
  Newspaper,
  Paperclip,
  RefreshCcw,
  Send,
  Server,
  Sparkles,
  Target,
  Upload,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { goals as initialGoals, notes as initialNotes, tasks as initialTasks } from "./data/mock";
import {
  createCodexTask,
  fetchPushRecords,
  fetchPushStatus,
  runDailyPush,
  routeCapture,
  sendTestPush,
  type PushRecord,
  type PushStatus
} from "./services/assistantGateway";
import type { Attachment, Goal, Note, Task } from "./types";

type CaptureMode = "save" | "organize";
type AppView = "ai" | "memory" | "push" | "codex";

interface OrganizeResult {
  title: string;
  summary: string;
  kind: Note["kind"];
  tags: string[];
  nextAction: string;
}

interface CodexDraft {
  id: string;
  title: string;
  prompt: string;
  status: "draft" | "queued";
  createdAt: string;
}

const starterPrompt =
  "把这个个人助手 app 的第一版后端接口设计出来：记忆流、AI 整理、目标总结、Codex 任务队列。要求包含数据模型、权限边界和最小可运行 API。";

const navItems: Array<{ id: AppView; label: string; icon: LucideIcon }> = [
  { id: "ai", label: "AI", icon: Sparkles },
  { id: "memory", label: "记忆", icon: Database },
  { id: "push", label: "推送", icon: BellRing },
  { id: "codex", label: "执行", icon: Bot }
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRef = useRef<any>(null);
  const [activeView, setActiveView] = useState<AppView>("ai");
  const [captureText, setCaptureText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [goals] = useState<Goal[]>(initialGoals);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [organizeResult, setOrganizeResult] = useState<OrganizeResult | null>(null);
  const [summary, setSummary] = useState(createDailySummary(initialNotes, initialGoals, initialTasks));
  const [codexDrafts, setCodexDrafts] = useState<CodexDraft[]>([
    {
      id: "codex-draft-1",
      title: "后端接口草案",
      prompt: starterPrompt,
      status: "draft",
      createdAt: "待提交"
    }
  ]);
  const [toast, setToast] = useState("");
  const [latestPush, setLatestPush] = useState<PushRecord | null>(null);

  const nextTask = tasks.find((task) => task.state === "doing") ?? tasks[0];

  useEffect(() => {
    fetchPushRecords().then((records) => setLatestPush(records[0] ?? null));
  }, []);

  const recentTags = useMemo(() => {
    const words = notes
      .flatMap((note) => note.text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g) ?? [])
      .filter((word) => !["今天", "一个", "这个", "可以", "需要"].includes(word));
    return Array.from(new Set(words)).slice(0, 8);
  }, [notes]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  async function submitCapture(mode: CaptureMode) {
    const text = captureText.trim();
    if (!text && attachments.length === 0) {
      notify("先输入一句话，或添加一个文件");
      return;
    }

    const noteText = text || `${attachments.length} 个附件`;
    const routedNote = await routeCapture({ text: noteText, mode: mode === "organize" ? "route" : "save" });
    const noteWithAttachments: Note = { ...routedNote, attachments };

    setNotes((current) => [noteWithAttachments, ...current]);
    setCaptureText("");
    setAttachments([]);

    if (mode === "organize") {
      const result = organizeText(noteText, attachments);
      setOrganizeResult(result);
      setActiveView("ai");
      if (result.kind === "task") {
        setTasks((current) => [
          {
            id: `task-${Date.now()}`,
            title: result.title,
            detail: result.nextAction,
            priority: "medium",
            state: "next"
          },
          ...current
        ]);
      }
      notify("AI 已整理成下一步");
      return;
    }

    setActiveView("memory");
    notify("已存入记忆流");
  }

  function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      url: URL.createObjectURL(file)
    }));
    setAttachments((current) => [...current, ...next]);
    notify(next.some((file) => file.type.startsWith("image/")) ? "图片已加入" : "文件已加入");
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((item) => item.id !== id);
    });
  }

  function toggleVoiceInput() {
    if (isListening) {
      speechRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify("当前浏览器不支持语音输入");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? "")
        .join("")
        .trim();
      if (transcript) {
        setCaptureText((current) => `${current}${current ? " " : ""}${transcript}`);
      }
    };
    recognition.onerror = () => {
      notify("语音识别失败，请再试一次");
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    speechRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function refreshSummary() {
    setSummary(createDailySummary(notes, goals, tasks));
    notify("目标摘要已刷新");
  }

  async function queueCodexDraft(draft: CodexDraft) {
    await createCodexTask({ prompt: draft.prompt, requireApproval: true });
    setCodexDrafts((current) => current.map((item) => (item.id === draft.id ? { ...item, status: "queued", createdAt: "刚刚" } : item)));
    setActiveView("codex");
    notify("Codex 任务已进入队列");
  }

  function createDraftFromOrganized() {
    const base = organizeResult?.nextAction ?? starterPrompt;
    const draft: CodexDraft = {
      id: `codex-draft-${Date.now()}`,
      title: organizeResult?.title ?? "新的 Codex 执行草稿",
      prompt: `请基于下面的个人助手需求，给出可执行的代码或文档改动建议：\n\n${base}`,
      status: "draft",
      createdAt: "待提交"
    };
    setCodexDrafts((current) => [draft, ...current]);
    setActiveView("codex");
    notify("已生成 Codex 草稿");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span className="neo-buddy">
              <i className="neo-eye left" />
              <i className="neo-eye right" />
            </span>
          </div>
          <div>
            <p>Personal AI</p>
            <h1>neo</h1>
          </div>
        </div>
      </header>

      <main className="app-main">
        {activeView === "ai" && (
          <AIView
            result={organizeResult}
            nextTask={nextTask}
            recentNotes={notes.slice(0, 2)}
            inboxCount={notes.filter((note) => note.kind === "inbox").length}
            codexCount={codexDrafts.filter((draft) => draft.status === "draft").length}
            latestPush={latestPush}
            onOpen={setActiveView}
            onCreateDraft={createDraftFromOrganized}
          />
        )}
        {activeView === "memory" && <MemoryView notes={notes} recentTags={recentTags} />}
        {activeView === "push" && <PushView onNotify={notify} />}
        {activeView === "codex" && <CodexView drafts={codexDrafts} onQueue={queueCodexDraft} />}
      </main>

      <section className="app-dock">
        <Composer
          text={captureText}
          attachments={attachments}
          fileInputRef={fileInputRef}
          onTextChange={setCaptureText}
          onFiles={addAttachments}
          onRemoveAttachment={removeAttachment}
          isListening={isListening}
          onVoice={toggleVoiceInput}
          onSave={() => submitCapture("save")}
          onOrganize={() => submitCapture("organize")}
        />

        <nav className="bottom-nav" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={cx(activeView === item.id && "active")} onClick={() => setActiveView(item.id)}>
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </section>

      <div className={cx("toast", toast && "show")}>{toast}</div>
    </div>
  );
}

function AIView({
  result,
  nextTask,
  recentNotes,
  inboxCount,
  codexCount,
  latestPush,
  onOpen,
  onCreateDraft
}: {
  result: OrganizeResult | null;
  nextTask: Task;
  recentNotes: Note[];
  inboxCount: number;
  codexCount: number;
  latestPush: PushRecord | null;
  onOpen: (view: AppView) => void;
  onCreateDraft: () => void;
}) {
  return (
    <section className="screen-stack home-surface">
      <div className="hero-card">
        <div className="hero-icon">
          <Sparkles size={22} />
        </div>
        <div>
          <h2>{result ? result.title : "今天处理什么？"}</h2>
          {!result && (
            <p className="hero-focus">
              <Target size={14} />
              <span>下一步 · {nextTask.title}</span>
            </p>
          )}
        </div>
        {!result && (
          <div className="mascot-scene" aria-hidden="true">
            <div className="float-orbit orbit-one" />
            <div className="float-orbit orbit-two" />
            <div className="spark-dot one" />
            <div className="spark-dot two" />
            <div className="mini-note-shape" />
            <div className="mascot-sticker">
              <img
                className="mascot-image"
                src="/shinchan-avatar.png"
                alt=""
                onError={(event) => {
                  event.currentTarget.hidden = true;
                  event.currentTarget.parentElement?.classList.add("is-empty");
                }}
              />
              <Sparkles className="sticker-fallback" size={28} />
            </div>
          </div>
        )}
      </div>

      {result && (
        <article className="result-card">
          <div className="result-head">
            <KindPill kind={result.kind} />
            <span>{result.tags.join(" / ")}</span>
          </div>
          <div className="next-action">
            <CircleDot size={16} />
            <span>{result.nextAction}</span>
          </div>
          <button className="secondary-button full" onClick={onCreateDraft}>
            <Bot size={16} />
            生成 Codex 草稿
          </button>
        </article>
      )}

      <button className="home-push" onClick={() => onOpen("push")}>
        <span className="home-push-icon">
          <Newspaper size={18} />
        </span>
        <div className="home-push-body">
          <p>日报推送{latestPush ? ` · ${latestPush.channel}` : ""}</p>
          <h3>{latestPush?.title ?? "明早 08:30 自动同步"}</h3>
          <span>{latestPush?.excerpt ?? "AI HOT 每日精选，每天自动送到这里。"}</span>
        </div>
        <span className="home-push-time">{latestPush?.createdAt ?? "待同步"}</span>
      </button>

      <section className="home-entries">
        <button className="entry-card" onClick={() => onOpen("memory")}>
          <span className="entry-icon">
            <Database size={18} />
          </span>
          <div>
            <p>笔记</p>
            <h3>{inboxCount > 0 ? `${inboxCount} 条待整理` : "全部已整理"}</h3>
            <span className="entry-sub">{recentNotes[0]?.text ?? "记忆流"}</span>
          </div>
        </button>
        <button className="entry-card" onClick={() => onOpen("codex")}>
          <span className="entry-icon">
            <Bot size={18} />
          </span>
          <div>
            <p>Codex AI</p>
            <h3>{codexCount > 0 ? `${codexCount} 个待执行` : "接入执行"}</h3>
            <span className="entry-sub">代码 · 文档 · 项目</span>
          </div>
        </button>
      </section>
    </section>
  );
}

function MemoryView({ notes, recentTags }: { notes: Note[]; recentTags: string[] }) {
  return (
    <section className="screen-stack">
      <div className="content-head floating">
        <div>
          <p>记忆流</p>
          <h2>全部记录</h2>
        </div>
        <Database size={20} />
      </div>
      <div className="tag-strip">
        {recentTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="panel-card note-list">
        {notes.map((note) => (
          <NoteRow key={note.id} note={note} />
        ))}
      </div>
    </section>
  );
}

function PushView({ onNotify }: { onNotify: (message: string) => void }) {
  const [status, setStatus] = useState<PushStatus>({
    server: "offline",
    hermes: "unknown",
    feishu: "missing",
    schedule: "08:30",
    lastRun: "未连接",
    nextRun: "连接服务器后同步"
  });
  const [records, setRecords] = useState<PushRecord[]>([]);
  const [running, setRunning] = useState(false);
  const latest = records[0];

  useEffect(() => {
    const refreshPush = () => {
      fetchPushStatus().then(setStatus);
      fetchPushRecords().then(setRecords);
    };

    refreshPush();
    const timer = window.setInterval(refreshPush, 30 * 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function triggerPush() {
    setRunning(true);
    const result = await runDailyPush();
    setRunning(false);
    onNotify(result.message ?? (result.ok ? "已触发每日推送" : "等待服务器接入"));
    fetchPushStatus().then(setStatus);
    fetchPushRecords().then(setRecords);
  }

  async function testFeishu() {
    const result = await sendTestPush();
    onNotify(result.message ?? (result.ok ? "连接正常" : "需要配置服务器"));
  }

  return (
    <section className="screen-stack">
      <div className="content-head floating">
        <div>
          <p>每日自动化</p>
          <h2>推送</h2>
        </div>
        <BellRing size={20} />
      </div>

      <section className="panel-card push-hub">
        <div className="push-hero">
          <div>
            <p>AI HOT 每日精选 · Hermes 调度</p>
            <h3>早上 {status.schedule} 自动同步</h3>
          </div>
          <span className={cx("server-dot", status.server === "online" && "online")} />
        </div>

        <div className="push-status-grid">
          <StatusTile icon={Server} label="服务器" value={status.server === "online" ? "在线" : "待接入"} />
          <StatusTile icon={Newspaper} label="Hermes" value={status.hermes === "ready" ? "就绪" : "待确认"} />
          <StatusTile icon={Send} label="飞书" value={status.feishu === "connected" ? "已连接" : "未配置"} />
        </div>

        <div className="push-meta">
          <p>上次：{status.lastRun}</p>
          <p>下次：{status.nextRun}</p>
        </div>

        <div className="push-actions">
          <button className="secondary-button" onClick={testFeishu}>
            <Send size={16} />
            测试连接
          </button>
          <button className="primary-button" disabled={running} onClick={triggerPush}>
            <Sparkles size={16} />
            {running ? "触发中" : "立即推送"}
          </button>
        </div>
      </section>

      <section className="panel-card push-latest">
        <div className="push-latest-head">
          <div>
            <p>最新日报</p>
            <h3>{latest?.title ?? "明早自动同步到这里"}</h3>
          </div>
          <span>{latest?.createdAt ?? status.nextRun}</span>
        </div>
        {latest?.content ? (
          <ReportMarkdown text={latest.content} />
        ) : (
          <div className="push-empty">
            <Newspaper size={22} />
            <span>AI HOT 跑完后，日报正文会留在这里。</span>
          </div>
        )}
        {records.length > 1 && (
          <div className="push-history">
            {records.slice(1, 4).map((record) => (
              <span key={record.id}>{record.createdAt}</span>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function StatusTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <article className="status-tile">
      <Icon size={17} />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function renderInline(text: string) {
  return text.split(/\*\*/).map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>
  );
}

function ReportMarkdown({ text }: { text: string }) {
  const blocks = text.split("\n").map((raw, index) => {
    const line = raw.trim();
    if (!line) return null;
    if (line === "---") return <hr key={index} />;
    if (line.startsWith("### ")) return <h4 key={index}>{renderInline(line.slice(4))}</h4>;
    if (line.startsWith("## ")) return <h3 key={index}>{renderInline(line.slice(3))}</h3>;
    if (line.startsWith("# ")) return <h2 key={index}>{renderInline(line.slice(2))}</h2>;
    if (line.startsWith("- ")) return <p key={index} className="report-bullet">{renderInline(line.slice(2))}</p>;
    const className = line.startsWith("来源：") ? "report-source" : undefined;
    return <p key={index} className={className}>{renderInline(line)}</p>;
  });

  return <div className="push-report-body">{blocks}</div>;
}

function GoalsView({ goals, tasks, summary, onRefresh }: { goals: Goal[]; tasks: Task[]; summary: string; onRefresh: () => void }) {
  return (
    <section className="screen-stack">
      <div className="content-head floating">
        <div>
          <p>目标面板</p>
          <h2>今天推进</h2>
        </div>
        <button className="icon-button" aria-label="刷新目标摘要" onClick={onRefresh}>
          <RefreshCcw size={17} />
        </button>
      </div>
      <section className="panel-card">
        <p className="summary-copy">{summary}</p>
      </section>
      {goals.map((goal) => (
        <article className="goal-card" key={goal.id}>
          <div>
            <p>{goal.cadence}</p>
            <h3>{goal.title}</h3>
          </div>
          <strong>{goal.progress}%</strong>
          <span>{goal.nextAction}</span>
        </article>
      ))}
      <section className="panel-card task-list">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </section>
    </section>
  );
}

function CodexView({ drafts, onQueue }: { drafts: CodexDraft[]; onQueue: (draft: CodexDraft) => void }) {
  return (
    <section className="screen-stack">
      <div className="content-head floating">
        <div>
          <p>执行队列</p>
          <h2>待确认</h2>
        </div>
        <Bot size={20} />
      </div>
      <div className="panel-card codex-list">
        {drafts.map((draft) => (
          <article key={draft.id} className="codex-draft">
            <div>
              <span className={cx("status-pill", draft.status)}>{draft.status === "queued" ? "已入队" : "草稿"}</span>
              <h3>{draft.title}</h3>
              <p>{draft.prompt}</p>
            </div>
            <button className="primary-button" disabled={draft.status === "queued"} onClick={() => onQueue(draft)}>
              <Send size={16} />
              {draft.status === "queued" ? "等待执行" : "提交"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Composer({
  text,
  attachments,
  fileInputRef,
  onTextChange,
  onFiles,
  onRemoveAttachment,
  isListening,
  onVoice,
  onSave,
  onOrganize
}: {
  text: string;
  attachments: Attachment[];
  fileInputRef: RefObject<HTMLInputElement>;
  onTextChange: (text: string) => void;
  onFiles: (files: FileList | null) => void;
  onRemoveAttachment: (id: string) => void;
  isListening: boolean;
  onVoice: () => void;
  onSave: () => void;
  onOrganize: () => void;
}) {
  return (
    <section className="composer">
      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.ppt,.pptx"
        onChange={(event) => {
          onFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      {attachments.length > 0 && <AttachmentTray attachments={attachments} onRemove={onRemoveAttachment} />}
      <div className="composer-row">
        <button className="tool-button" aria-label="添加文件" onClick={() => fileInputRef.current?.click()}>
          <Paperclip size={18} />
        </button>
        <button className="tool-button" aria-label="上传文件" onClick={() => fileInputRef.current?.click()}>
          <Upload size={18} />
        </button>
        <button className={cx("tool-button", isListening && "listening")} aria-label={isListening ? "停止语音输入" : "语音输入"} onClick={onVoice}>
          <Mic size={18} />
        </button>
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="问 AI 或记录..."
          rows={1}
        />
        <button className="secondary-button compact-button" onClick={onSave}>
          <Inbox size={16} />
          存
        </button>
        <button className="primary-button compact-button" onClick={onOrganize}>
          <Sparkles size={16} />
          整理
        </button>
      </div>
    </section>
  );
}

function AttachmentTray({ attachments, onRemove }: { attachments: Attachment[]; onRemove: (id: string) => void }) {
  return (
    <div className="attachment-tray">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="attachment-chip">
          {attachment.type.startsWith("image/") ? <img src={attachment.url} alt={attachment.name} /> : <File size={16} />}
          <div>
            <span>{attachment.name}</span>
            <small>{formatFileSize(attachment.size)}</small>
          </div>
          <button aria-label={`移除 ${attachment.name}`} onClick={() => onRemove(attachment.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function NoteAttachments({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="note-attachments">
      {attachments.map((attachment) =>
        attachment.type.startsWith("image/") ? (
          <img key={attachment.id} src={attachment.url} alt={attachment.name} />
        ) : (
          <span key={attachment.id}>
            <File size={14} />
            {attachment.name}
          </span>
        )
      )}
    </div>
  );
}

function organizeText(text: string, attachments: Attachment[] = []): OrganizeResult {
  const lower = text.toLowerCase();
  const isCodex = /codex|代码|接口|后端|api|项目|repo/.test(lower);
  const hasImage = attachments.some((item) => item.type.startsWith("image/"));
  const hasFile = attachments.length > 0;
  const isGoal = /目标|复盘|总结|长期|本周|本月/.test(lower);
  const isTask = /要|需要|todo|任务|修|做|写|实现/.test(lower);
  const kind: Note["kind"] = isCodex || isTask ? "task" : isGoal ? "goal" : "knowledge";
  const clean = text.replace(/\s+/g, " ").trim();
  const title = clean.length > 28 ? `${clean.slice(0, 28)}...` : clean;
  const tags = [
    isCodex ? "Codex" : null,
    hasImage ? "图片" : null,
    hasFile && !hasImage ? "文件" : null,
    isGoal ? "目标" : null,
    kind === "knowledge" ? "知识" : null,
    kind === "task" ? "行动" : null
  ].filter(Boolean) as string[];

  return {
    title,
    kind,
    tags: tags.length ? tags : ["记忆"],
    summary: `这条内容更像「${kindLabel(kind)}」${hasFile ? `，并带有 ${attachments.length} 个附件` : ""}。我先帮你沉淀成可回看的条目，再给出下一步。`,
    nextAction: isCodex
      ? "生成 Codex 草稿，等你确认。"
      : isGoal
        ? "放进目标，晚点复盘。"
        : isTask
          ? "加入执行，只推进一个小动作。"
          : "保存为记忆，后续再关联。"
  };
}

function createDailySummary(notes: Note[], goals: Goal[], tasks: Task[]) {
  const pendingCount = notes.filter((note) => note.kind === "inbox").length;
  const doing = tasks.find((task) => task.state === "doing") ?? tasks[0];
  return `${pendingCount} 条待整理。今天先推进：${doing.title}。`;
}

function NoteRow({ note }: { note: Note }) {
  return (
    <article className="note-row">
      <KindIcon kind={note.kind} />
      <div>
        <h3>{note.text}</h3>
        <p>
          {note.createdAt} / {kindLabel(note.kind)}
          {note.attachments?.length ? ` / ${note.attachments.length} 个附件` : ""}
        </p>
        {note.attachments?.length ? <NoteAttachments attachments={note.attachments} /> : null}
      </div>
    </article>
  );
}

function TaskRow({ task, featured = false }: { task: Task; featured?: boolean }) {
  return (
    <article className={cx("task-row", featured && "featured")}>
      <span className={cx("task-dot", task.state)} />
      <div>
        <h3>{task.title}</h3>
        <p>{task.detail}</p>
      </div>
      {featured && <CheckCircle2 size={18} />}
    </article>
  );
}

function KindIcon({ kind }: { kind: Note["kind"] }) {
  if (kind === "task") return <ListTodo size={17} />;
  if (kind === "goal") return <Target size={17} />;
  if (kind === "knowledge") return <Database size={17} />;
  return <Inbox size={17} />;
}

function KindPill({ kind }: { kind: Note["kind"] }) {
  return <span className={cx("kind-pill", kind)}>{kindLabel(kind)}</span>;
}

function kindLabel(kind: Note["kind"]) {
  return { inbox: "待整理", knowledge: "记忆", task: "任务", goal: "目标" }[kind];
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
