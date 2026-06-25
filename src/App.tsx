import {
  Activity,
  BellRing,
  Bot,
  CheckCircle2,
  CircleDot,
  Database,
  Droplet,
  Droplets,
  File,
  Heart,
  Inbox,
  ListTodo,
  Mic,
  Moon,
  Newspaper,
  Paperclip,
  RefreshCcw,
  Send,
  Server,
  Smile,
  Sparkles,
  Target,
  Upload,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { goals as initialGoals, notes as initialNotes, tasks as initialTasks } from "./data/mock";
import {
  fetchPushRecords,
  fetchPushStatus,
  runDailyPush,
  routeCapture,
  sendTestPush,
  type PushRecord,
  type PushStatus
} from "./services/assistantGateway";
import type { Attachment, Goal, HealthEntry, Note, Task } from "./types";

type CaptureMode = "save" | "organize";
type AppView = "ai" | "memory" | "push" | "health";

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
  { id: "health", label: "健康", icon: Heart }
];

const MOODS = [
  { score: 1, emoji: "😫", label: "很糟" },
  { score: 2, emoji: "😕", label: "不好" },
  { score: 3, emoji: "😐", label: "一般" },
  { score: 4, emoji: "🙂", label: "还好" },
  { score: 5, emoji: "😊", label: "很好" }
] as const;

const WATER_GOAL = 4;

function moodLabel(score: number) {
  return MOODS.find((m) => m.score === score)?.label ?? "—";
}

function stripMarkdown(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/`[^`]+`/g, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

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
  const [healthLogs, setHealthLogs] = useState<HealthEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("neo_health_logs") ?? "[]"); }
    catch { return []; }
  });
  const [logModal, setLogModal] = useState<HealthEntry["category"] | null>(null);
  const [sleepTracking, setSleepTracking] = useState<{ startTime: string; date: string } | null>(
    () => {
      try { return JSON.parse(localStorage.getItem("neo_sleep_tracking") ?? "null"); }
      catch { return null; }
    }
  );
  const [toast, setToast] = useState("");
  const [latestPush, setLatestPush] = useState<PushRecord | null>(null);

  const nextTask = tasks.find((task) => task.state === "doing") ?? tasks[0];

  useEffect(() => {
    fetchPushRecords().then((records) => setLatestPush(records[0] ?? null));
  }, []);

  useEffect(() => {
    localStorage.setItem("neo_health_logs", JSON.stringify(healthLogs));
  }, [healthLogs]);

  // Auto-complete sleep tracking left open from a previous day
  useEffect(() => {
    if (!sleepTracking || sleepTracking.date >= todayStr()) return;
    const hours = calcSleepHours(sleepTracking.startTime, "07:30");
    const entry: HealthEntry = {
      id: `health-${Date.now()}`,
      date: sleepTracking.date,
      category: "sleep",
      sleepStart: sleepTracking.startTime,
      sleepEnd: "07:30",
      sleepHours: hours,
      createdAt: "07:30"
    };
    setHealthLogs((prev) => {
      if (prev.some((l) => l.date === sleepTracking.date && l.category === "sleep")) return prev;
      return [entry, ...prev];
    });
    setSleepTracking(null);
    localStorage.removeItem("neo_sleep_tracking");
    notify("昨晚睡眠已自动保存");
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function startSleepTracking() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const tracking = { startTime: timeStr, date: todayStr() };
    setSleepTracking(tracking);
    localStorage.setItem("neo_sleep_tracking", JSON.stringify(tracking));
    notify(`入睡时间已记录 · ${timeStr}`);
  }

  function finishSleepTracking() {
    if (!sleepTracking) return;
    const wakeTime = "07:30";
    const hours = calcSleepHours(sleepTracking.startTime, wakeTime);
    saveHealthLog({ category: "sleep", sleepStart: sleepTracking.startTime, sleepEnd: wakeTime, sleepHours: hours });
    setSleepTracking(null);
    localStorage.removeItem("neo_sleep_tracking");
  }

  function cancelSleepTracking() {
    setSleepTracking(null);
    localStorage.removeItem("neo_sleep_tracking");
    notify("睡眠追踪已取消");
  }

  function addWaterCup() {
    const today = todayStr();
    const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    setHealthLogs((prev) => {
      const existing = prev.find((l) => l.date === today && l.category === "water");
      if (existing) {
        return [
          { ...existing, waterCount: (existing.waterCount ?? 0) + 1, createdAt: now },
          ...prev.filter((l) => l.id !== existing.id)
        ];
      }
      return [{ id: `health-${Date.now()}`, date: today, category: "water", waterCount: 1, createdAt: now }, ...prev];
    });
    notify("喝水 +1 大杯");
  }

  function saveMood(score: number) {
    saveHealthLog({ category: "mood", moodScore: score });
  }

  function saveHealthLog(data: Omit<HealthEntry, "id" | "date" | "createdAt">) {
    const today = todayStr();
    const entry: HealthEntry = {
      ...data,
      id: `health-${Date.now()}`,
      date: today,
      createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
    };
    setHealthLogs((prev) => {
      // These categories allow only one entry per day — replace existing
      if (data.category === "sleep" || data.category === "digestion" || data.category === "mood") {
        return [entry, ...prev.filter((l) => !(l.date === today && l.category === data.category))];
      }
      return [entry, ...prev];
    });
    setLogModal(null);
    const msg =
      data.category === "sleep"
        ? `睡眠已记录 · ${data.sleepHours}h`
        : data.category === "digestion"
          ? data.diarrheaCount === 0
            ? "今日肠胃正常 · 已记录"
            : `腹泻 ${data.diarrheaCount} 次 · 已记录`
          : data.category === "mood"
            ? `心情已记录 · ${moodLabel(data.moodScore!)}`
            : "健康备注已保存";
    notify(msg);
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
            latestPush={latestPush}
            onOpen={setActiveView}
            todaySleep={healthLogs.find((l) => l.date === todayStr() && l.category === "sleep")}
            todayDiarrhea={healthLogs
              .filter((l) => l.date === todayStr() && l.category === "digestion")
              .reduce((s, l) => s + (l.diarrheaCount ?? 0), 0)}
            todayWater={healthLogs.find((l) => l.date === todayStr() && l.category === "water")?.waterCount ?? 0}
            onLogHealth={setLogModal}
            sleepTracking={sleepTracking}
            onStartSleep={startSleepTracking}
            onFinishSleep={finishSleepTracking}
            onCancelSleep={cancelSleepTracking}
            onAddWater={addWaterCup}
          />
        )}
        {activeView === "memory" && <MemoryView notes={notes} recentTags={recentTags} />}
        {activeView === "push" && <PushView onNotify={notify} />}
        {activeView === "health" && <HealthView logs={healthLogs} onLogHealth={setLogModal} onAddWater={addWaterCup} onSaveMood={saveMood} />}
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

      {logModal && (
        <HealthLogModal category={logModal} onSave={saveHealthLog} onClose={() => setLogModal(null)} />
      )}

      <div className={cx("toast", toast && "show")}>{toast}</div>
    </div>
  );
}

function AIView({
  result,
  nextTask,
  recentNotes,
  inboxCount,
  latestPush,
  onOpen,
  todaySleep,
  todayDiarrhea,
  todayWater,
  onLogHealth,
  sleepTracking,
  onStartSleep,
  onFinishSleep,
  onCancelSleep,
  onAddWater
}: {
  result: OrganizeResult | null;
  nextTask: Task;
  recentNotes: Note[];
  inboxCount: number;
  latestPush: PushRecord | null;
  onOpen: (view: AppView) => void;
  todaySleep: HealthEntry | undefined;
  todayDiarrhea: number;
  todayWater: number;
  onLogHealth: (category: HealthEntry["category"]) => void;
  sleepTracking: { startTime: string; date: string } | null;
  onStartSleep: () => void;
  onFinishSleep: () => void;
  onCancelSleep: () => void;
  onAddWater: () => void;
}) {
  const [pushReaderOpen, setPushReaderOpen] = useState(false);

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
        </article>
      )}

      <div
        className={cx("home-push-card", !!latestPush && "is-clickable")}
        onClick={() => latestPush && setPushReaderOpen(true)}
      >
        <div className="home-push-meta">
          <span className="home-push-source">
            <Newspaper size={12} />
            {latestPush?.channel ?? "日报"}
          </span>
          <span className="home-push-date">{latestPush?.createdAt ?? "待同步"}</span>
        </div>
        <h3 className="home-push-title">{latestPush?.title ?? "明早 08:30 自动同步"}</h3>
        <p className="home-push-excerpt">
          {latestPush?.excerpt ? stripMarkdown(latestPush.excerpt) : "AI HOT 每日精选，每天自动送到这里。"}
        </p>
        {latestPush && <span className="home-push-read">阅读全文 →</span>}
      </div>

      {pushReaderOpen && latestPush && (
        <div className="push-reader-overlay" onClick={() => setPushReaderOpen(false)}>
          <div className="push-reader" onClick={(e) => e.stopPropagation()}>
            <div className="push-reader-head">
              <div>
                <p className="push-reader-meta">{latestPush.channel} · {latestPush.createdAt}</p>
                <h2>{latestPush.title}</h2>
              </div>
              <button className="icon-button" onClick={() => setPushReaderOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="push-reader-body">
              {latestPush.content
                ? <ReportMarkdown text={latestPush.content} />
                : <p style={{ color: "var(--muted)" }}>暂无内容</p>}
            </div>
          </div>
        </div>
      )}

      <div className="home-health">
        <div className="home-health-hd">
          <Heart size={14} />
          <span>健康</span>
          <button className="home-health-all" onClick={() => onOpen("health")}>
            查看全部 ›
          </button>
        </div>

        {/* 睡眠行 */}
        <div className="health-metric-row">
          <span className="hmr-icon sleep"><Moon size={14} /></span>
          <div className="hmr-body">
            <p className="hmr-label">睡眠</p>
            {todaySleep ? (
              <div className="hmr-val">
                <strong>{todaySleep.sleepHours}h</strong>
                <span>{todaySleep.sleepStart} → {todaySleep.sleepEnd}</span>
              </div>
            ) : sleepTracking ? (
              <div className="hmr-val is-tracking">
                <span className="hmr-pulse" />
                追踪中 · 入睡 {sleepTracking.startTime}
                <em>预计 {calcSleepHours(sleepTracking.startTime, "07:30")}h</em>
              </div>
            ) : (
              <div className="hmr-val is-empty">未记录</div>
            )}
          </div>
          <div className="hmr-actions">
            {todaySleep ? (
              <button className="hmr-btn ghost" onClick={() => onLogHealth("sleep")}>修改</button>
            ) : sleepTracking ? (
              <div className="hmr-actions-col">
                <button className="hmr-btn confirm" onClick={onFinishSleep}>起床了</button>
                <button className="hmr-btn ghost hmr-btn-xs" onClick={onCancelSleep}>取消追踪</button>
              </div>
            ) : (
              <button className="hmr-btn accent" onClick={onStartSleep}>
                <Moon size={12} />入睡
              </button>
            )}
          </div>
        </div>

        {/* 肠胃行 */}
        <div className="health-metric-row">
          <span className="hmr-icon digestion"><Droplets size={14} /></span>
          <div className="hmr-body">
            <p className="hmr-label">肠胃</p>
            <div className={cx("hmr-val", todayDiarrhea > 0 && "is-warn")}>
              {todayDiarrhea > 0 ? (
                <>腹泻 <strong>{todayDiarrhea}</strong> 次</>
              ) : (
                "今日正常"
              )}
              <span className={cx("hmr-pill", todayDiarrhea > 0 ? "warn" : "ok")}>
                {todayDiarrhea > 0 ? "注意" : "正常"}
              </span>
            </div>
          </div>
          <div className="hmr-actions">
            <button className="hmr-btn ghost" onClick={() => onLogHealth("digestion")}>记录</button>
          </div>
        </div>

        {/* 喝水行 */}
        <div className="health-metric-row">
          <span className="hmr-icon water"><Droplet size={14} /></span>
          <div className="hmr-body">
            <p className="hmr-label">喝水</p>
            <div className="hmr-val">
              {todayWater > 0 ? (
                <><strong>{todayWater}</strong><span>大杯 · 目标 {WATER_GOAL} 杯</span></>
              ) : (
                <span className="is-empty">未记录</span>
              )}
              {todayWater > 0 && (
                <span className={cx("hmr-pill", todayWater >= WATER_GOAL ? "ok" : "neutral")}>
                  {todayWater >= WATER_GOAL ? "达标" : `${WATER_GOAL - todayWater} 杯`}
                </span>
              )}
            </div>
          </div>
          <div className="hmr-actions">
            <button className="hmr-btn accent" onClick={onAddWater}>
              <Droplet size={12} />+1
            </button>
          </div>
        </div>
      </div>

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
        <button className="entry-card" onClick={() => onOpen("health")}>
          <span className="entry-icon" style={{ color: "var(--blue)", background: "var(--blue-soft)" }}>
            <Heart size={18} />
          </span>
          <div>
            <p>健康</p>
            <h3>{todaySleep ? `睡了 ${todaySleep.sleepHours}h` : "记录健康"}</h3>
            <span className="entry-sub">睡眠 · 饮食 · 追踪</span>
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

/* ─── Health utilities ─── */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function calcSleepHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round(mins / 6) / 10;
}

function getHealthStatus(sleep: HealthEntry | undefined, diarrhea: number) {
  if (!sleep && diarrhea === 0) return { label: "待记录", cls: "neutral" };
  const sleepOk = sleep ? (sleep.sleepHours ?? 0) >= 7 : true;
  const gutOk = diarrhea === 0;
  if (sleepOk && gutOk) return { label: "良好", cls: "good" };
  if (!sleepOk && !gutOk) return { label: "注意", cls: "bad" };
  return { label: "一般", cls: "fair" };
}

/* ─── Health components ─── */

function HealthView({
  logs,
  onLogHealth,
  onAddWater,
  onSaveMood
}: {
  logs: HealthEntry[];
  onLogHealth: (category: HealthEntry["category"]) => void;
  onAddWater: () => void;
  onSaveMood: (score: number) => void;
}) {
  const today = todayStr();
  const sleepLog = logs.find((l) => l.date === today && l.category === "sleep");
  const todayDiarrhea = logs
    .filter((l) => l.date === today && l.category === "digestion")
    .reduce((s, l) => s + (l.diarrheaCount ?? 0), 0);
  const todayWater = logs.find((l) => l.date === today && l.category === "water")?.waterCount ?? 0;
  const todayMood = logs.find((l) => l.date === today && l.category === "mood");
  const status = getHealthStatus(sleepLog, todayDiarrhea);

  return (
    <section className="screen-stack">
      <div className="content-head floating">
        <div>
          <p>健康追踪</p>
          <h2>今日状态</h2>
        </div>
        <Heart size={20} style={{ color: "var(--blue)" }} />
      </div>

      <div className="panel-card health-summary-card">
        <div className="health-stat-row">
          <div className="health-stat">
            <Moon size={18} style={{ color: "var(--blue)" }} />
            <strong>{sleepLog ? `${sleepLog.sleepHours}h` : "—"}</strong>
            <span>睡眠</span>
          </div>
          <div className="health-divider" />
          <div className="health-stat">
            <Droplets size={18} style={{ color: "var(--amber)" }} />
            <strong style={{ color: todayDiarrhea > 0 ? "var(--amber)" : "var(--ink)" }}>
              {todayDiarrhea > 0 ? `${todayDiarrhea}次` : "正常"}
            </strong>
            <span>肠胃</span>
          </div>
          <div className="health-divider" />
          <div className="health-stat">
            <Droplet size={18} style={{ color: "var(--blue)" }} />
            <strong style={{ color: todayWater >= WATER_GOAL ? "var(--green)" : "var(--ink)" }}>
              {todayWater > 0 ? `${todayWater}杯` : "—"}
            </strong>
            <span>喝水</span>
          </div>
          <div className="health-divider" />
          <div className="health-stat">
            <Activity size={18} style={{ color: "var(--green)" }} />
            <strong className={`health-status-${status.cls}`}>{status.label}</strong>
            <span>状态</span>
          </div>
        </div>
      </div>

      {/* 心情选择 */}
      <div className="panel-card mood-card">
        <div className="mood-card-head">
          <Smile size={14} style={{ color: "var(--amber)" }} />
          <span>今日心情</span>
          {todayMood && <span className="mood-selected-label">{moodLabel(todayMood.moodScore!)}</span>}
        </div>
        <div className="mood-picker">
          {MOODS.map(({ score, emoji }) => (
            <button
              key={score}
              className={cx("mood-btn", todayMood?.moodScore === score && "selected")}
              onClick={() => onSaveMood(score)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <SleepChart logs={logs} />

      <div className="health-quick-actions">
        <button className="secondary-button" onClick={() => onLogHealth("sleep")}>
          <Moon size={15} /> 记录睡眠
        </button>
        <button className="secondary-button" onClick={() => onLogHealth("digestion")}>
          <Droplets size={15} /> 记录肠胃
        </button>
        <button className="secondary-button" onClick={onAddWater}>
          <Droplet size={15} /> 喝水 +1
        </button>
      </div>

      <div className="panel-card health-log-list">
        <div className="content-head" style={{ padding: "14px 16px 10px" }}>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>记录历史</p>
        </div>
        {logs.length === 0 ? (
          <div className="health-empty">
            <Heart size={28} />
            <p>还没有记录</p>
            <span>用上方快捷按钮记录睡眠和饮食</span>
          </div>
        ) : (
          logs.map((entry) => <HealthLogRow key={entry.id} entry={entry} />)
        )}
      </div>
    </section>
  );
}

function HealthLogRow({ entry }: { entry: HealthEntry }) {
  const icon =
    entry.category === "sleep" ? (
      <Moon size={15} />
    ) : entry.category === "digestion" ? (
      <Droplets size={15} />
    ) : entry.category === "water" ? (
      <Droplet size={15} />
    ) : entry.category === "mood" ? (
      <span style={{ fontSize: 15, lineHeight: 1 }}>
        {MOODS.find((m) => m.score === entry.moodScore)?.emoji ?? "😐"}
      </span>
    ) : (
      <Activity size={15} />
    );

  const summary =
    entry.category === "sleep"
      ? `${entry.sleepStart} — ${entry.sleepEnd}，共 ${entry.sleepHours}h`
      : entry.category === "digestion"
        ? (entry.diarrheaCount ?? 0) > 0
          ? `腹泻 ${entry.diarrheaCount} 次`
          : "今日肠胃正常 · 已确认"
        : entry.category === "water"
          ? `今日喝水 ${entry.waterCount} 大杯`
          : entry.category === "mood"
            ? `心情 · ${moodLabel(entry.moodScore!)}`
            : entry.note ?? "健康备注";

  return (
    <article className="health-log-row">
      <span className={`health-log-icon ${entry.category}`}>{icon}</span>
      <div>
        <h3>{summary}</h3>
        <p>
          {entry.date} · {entry.createdAt}
          {entry.note && entry.category !== "note" ? ` · ${entry.note}` : ""}
        </p>
      </div>
    </article>
  );
}

function SleepChart({ logs }: { logs: HealthEntry[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  const MAX_H = 10;

  const recordedHours = days
    .map((d) => logs.find((l) => l.date === d && l.category === "sleep")?.sleepHours ?? 0)
    .filter((h) => h > 0);
  const weekAvg =
    recordedHours.length > 0
      ? Math.round((recordedHours.reduce((a, b) => a + b, 0) / recordedHours.length) * 10) / 10
      : null;

  return (
    <div className="panel-card sleep-chart-card">
      <div className="sleep-chart-head">
        <Moon size={15} style={{ color: "var(--blue)" }} />
        <span>近 7 天睡眠</span>
      </div>
      <div className="sleep-chart-bars">
        {days.map((date) => {
          const log = logs.find((l) => l.date === date && l.category === "sleep");
          const hours = log?.sleepHours ?? 0;
          const pct = Math.min(hours / MAX_H, 1) * 100;
          const cls = hours === 0 ? "empty" : hours >= 7 ? "good" : hours >= 6 ? "fair" : "bad";
          const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("zh-CN", { weekday: "short" }).replace("周", "");
          const isToday = date === todayStr();

          return (
            <div key={date} className={cx("sleep-bar-col", isToday && "today")}>
              {hours > 0 && <span className="sleep-bar-val">{hours}h</span>}
              <div className="sleep-bar-wrap">
                <div className={`sleep-bar ${cls}`} style={{ height: `${pct}%` }} />
              </div>
              <span className="sleep-bar-day">{dayLabel}</span>
            </div>
          );
        })}
      </div>
      <div className="sleep-chart-legend">
        <span className="good">≥7h</span>
        <span className="fair">6–7h</span>
        <span className="bad">&lt;6h</span>
      </div>
      {weekAvg !== null && (
        <p className="sleep-chart-avg">
          本周平均 <strong>{weekAvg}h</strong> · {recordedHours.length} 天有记录
        </p>
      )}
    </div>
  );
}

function HealthLogModal({
  category,
  onSave,
  onClose
}: {
  category: HealthEntry["category"];
  onSave: (data: Omit<HealthEntry, "id" | "date" | "createdAt">) => void;
  onClose: () => void;
}) {
  const [sleepStart, setSleepStart] = useState("23:00");
  const [sleepEnd, setSleepEnd] = useState("07:00");
  const [diarrheaCount, setDiarrheaCount] = useState(1);
  const [note, setNote] = useState("");

  const sleepHours = calcSleepHours(sleepStart, sleepEnd);

  function handleSave() {
    if (category === "sleep") {
      onSave({ category, sleepStart, sleepEnd, sleepHours, note: note || undefined });
    } else if (category === "digestion") {
      onSave({ category, diarrheaCount, note: note || undefined });
    } else {
      if (!note.trim()) return;
      onSave({ category, note });
    }
  }

  const title =
    category === "sleep" ? "记录睡眠" : category === "digestion" ? "记录肠胃" : "健康备注";

  return (
    <div className="health-modal-overlay" onClick={onClose}>
      <div className="health-modal" onClick={(e) => e.stopPropagation()}>
        <div className="health-modal-head">
          <h3>{title}</h3>
          <button className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {category === "sleep" && (
          <div className="health-fields">
            <label className="health-field">
              <span>入睡时间</span>
              <input type="time" value={sleepStart} onChange={(e) => setSleepStart(e.target.value)} />
            </label>
            <label className="health-field">
              <span>起床时间</span>
              <input type="time" value={sleepEnd} onChange={(e) => setSleepEnd(e.target.value)} />
            </label>
            <p className="sleep-preview">
              共睡 <strong>{sleepHours}</strong> 小时
            </p>
          </div>
        )}

        {category === "digestion" && (
          <div className="health-fields">
            <p className="health-field-label">今天腹泻次数</p>
            <div className="digestion-counter">
              <button onClick={() => setDiarrheaCount((c) => Math.max(0, c - 1))}>−</button>
              <span>{diarrheaCount}</span>
              <button onClick={() => setDiarrheaCount((c) => c + 1)}>+</button>
            </div>
          </div>
        )}

        <textarea
          className="health-note-input"
          placeholder={category === "note" ? "记录健康状态、症状或感受..." : "补充说明（可选）"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />

        <button
          className="primary-button full"
          disabled={category === "note" && !note.trim()}
          onClick={handleSave}
        >
          保存记录
        </button>
      </div>
    </div>
  );
}
