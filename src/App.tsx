import {
  Activity,
  BellRing,
  Bot,
  CheckCircle2,
  Circle,
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
  Pencil,
  RefreshCcw,
  Search,
  Send,
  Server,
  Smile,
  Sparkles,
  Target,
  Upload,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
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
type AppView = "ai" | "memory" | "push" | "health" | "wellness";
type NoteFilter = Note["kind"] | "all";

type WellnessCat = "joy" | "mind" | "rest" | "brain";
const WELLNESS: Record<WellnessCat, { emoji: string; label: string; color: string; items: string[] }> = {
  joy: {
    emoji: "😄", label: "快乐", color: "#f59e0b",
    items: [
      "章鱼有三个心脏，但一跑步两个就罢工——说明它也不想动 🐙",
      "熊猫每天吃 12 小时竹子，剩下 12 小时睡觉。这才是理想生活 🐼",
      "鳄鱼伸不出舌头，所以它永远没办法对你做鬼脸，你赢了 🐊",
      "海马由雄性生宝宝——爸爸才是那个更累的，全程 🐴",
      "猫头鹰没有眼球，只有眼管，所以只能靠转头看东西。脖子是真的强 🦉",
      "河马的汗液是天然防晒霜，它生来自带防晒，你呢 🦛",
      "松鼠经常忘记自己把坚果藏在哪，无意中种了很多树。拖延也是贡献 🐿️",
      "蜗牛可以睡整整三年。你睡 8 小时还觉得不够？ 🐌",
      "大象怕蜜蜂。地球最大的陆地动物怕小虫子，你的恐惧也没那么奇怪 🐘",
      "猫不懂甜味，但还是假装对蛋糕感兴趣。社交礼仪做到位了 🐱",
      "海獭睡觉时会互相牵手防止漂散。浪漫是刻在 DNA 里的 🦦",
      "蜂鸟的心每分钟跳 1200 次，比你喝完三杯美式还快 🐦",
      "土豚在很多语言字典里排第一，只因为名字以 A 开头。机会真的靠名字 🐾",
      "企鹅求偶会精心挑一颗石头送给喜欢的对象。它的礼物比你认真 🐧",
      "北极熊的毛其实是透明的，只是看起来白色——视觉欺骗了你一辈子 🐻‍❄️",
    ],
  },
  mind: {
    emoji: "🌿", label: "心态", color: "#10b981",
    items: [
      "你跟自己说「再刷五分钟」已经第 14 次了，但这次是真的对吧",
      "拖延本质上是时间管理——只是把「做」安排给了未来的自己",
      "世界上没有完美的时机，只有你终于烦了开始动的那一刻",
      "计划 A 失败了没关系，字母表还有 25 个",
      "大脑需要无聊才能产生好主意，你现在发呆非常有必要",
      "不想干活不是懒惰，是人类千万年进化留下来的自我保护",
      "你现在觉得很难的事，半年后可能连回忆都找不到",
      "「改天」是个很长的词，长到从来没到过",
      "焦虑是因为你用今天的资源担心明天的问题，很不划算",
      "没人觉得你失败，他们都忙着担心自己",
      "有个词叫「够好了」，比「完美」实用得多",
      "你做的决定在当时都是有道理的，不要追着过去的自己打",
      "最有效的自律，是让懒比做事更麻烦",
      "睡一觉往往是解决问题效率最高的方式，不信试试",
      "不必每天都很燃，偶尔小火慢炖也是一种活法",
    ],
  },
  rest: {
    emoji: "☁️", label: "休息", color: "#6366f1",
    items: [
      "你的眼睛刚才在加班，给它们 20 秒假期，看看窗外有没有奇怪的人 👀",
      "喝一口水——不是因为你渴了，是因为你身体里 60% 都是水，需要续杯 💧",
      "站起来走走，顺便告诉自己这叫「主动休息」，不是「不想干活」",
      "深呼吸，科学证明比在心里骂三遍更有效，虽然骂三遍也很爽",
      "把手机正面朝下放 5 分钟，看看世界会不会因此崩塌（剧透：不会）",
      "你已经坐了多久？超过一小时，椅子比你更需要休息",
      "闭眼 60 秒，如果有人问，说你在「视觉休眠」",
      "转动一下手腕——你打了这么多字，它们也有情绪",
      "现在需要一杯热的，不管是水、茶还是奶茶，去倒",
      "完全靠在椅背上，像个不想上班的人，保持 30 秒，这叫放松",
      "你的肩膀又耸上去了。放下来，你不是乌龟 🐢",
      "对着枕头喊一声也行，亲测非常解压，邻居不一定理解",
      "看向 5 米以外，让眼睛对焦到远处，感受一下什么叫「自由」",
      "很累但睡不着？躺着也比坐着省电，先躺了再说",
      "活动一下脚趾头，因为没人记得脚趾头也需要运动 🦶",
    ],
  },
  brain: {
    emoji: "💡", label: "脑洞", color: "#ec4899",
    items: [
      "你的浏览器历史记录如果出版成书，书名叫什么",
      "鱼知道自己在水里吗，还是觉得水就是空气",
      "外卖小哥已经见过你多少次了，但你们连名字都不知道",
      "手机没电的感觉，到底是焦虑还是解脱",
      "如果你的猫/狗会说话，第一句话是什么",
      "如果梦境可以打包外卖，你今晚点什么",
      "全世界停电 24 小时，人类第一件事是什么",
      "你最后一次真的无聊是什么时候，什么都不想那种",
      "如果睡觉算工作，你的时薪是多少",
      "如果所有人今天都只能说真话，世界会乱成什么样",
      "如果大脑有存储限制，你最想删掉什么腾出空间",
      "一只猫知道自己是猫吗，还是觉得自己只是住在这里",
      "如果情绪可以装瓶出售，哪种最贵，哪种卖不出去",
      "你用过的所有密码里，最离谱的那个是什么",
      "如果语言有颜色，粤语和普通话分别是什么颜色",
    ],
  },
};

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

const DAILY_CARDS = [
  { emoji: "🦫", title: "今天你是水豚", body: "随遇而安，泡澡优先" },
  { emoji: "🌿", title: "今日发呆任务", body: "闭眼，数 10 个呼吸" },
  { emoji: "🐠", title: "今天你是小丑鱼", body: "家就在附近，不用跑太远" },
  { emoji: "☁️", title: "今日发呆任务", body: "想象自己是一片云，飘着就好" },
  { emoji: "🦔", title: "今天你是刺猬", body: "看着扎，其实只是需要空间" },
  { emoji: "🌸", title: "今日发呆任务", body: "找窗外最远处的树，看一会儿" },
  { emoji: "🐢", title: "今天你是乌龟", body: "慢下来也没关系，壳是自己的家" },
  { emoji: "🍵", title: "今日发呆任务", body: "泡杯茶，就盯着水汽发一会呆" },
  { emoji: "🦭", title: "今天你是海豹", body: "懒得动很正常，晒太阳是正事" },
  { emoji: "🌙", title: "今日发呆任务", body: "今天允许自己早一点睡" },
  { emoji: "🦦", title: "今天你是水獭", body: "睡觉时记得拉好朋友的手" },
  { emoji: "🍃", title: "今日发呆任务", body: "深呼吸，然后慢慢呼出" },
  { emoji: "🐨", title: "今天你是考拉", body: "一天睡22小时，效率极高" },
  { emoji: "✨", title: "今日发呆任务", body: "回忆今天一个细小的好瞬间" },
  { emoji: "🦙", title: "今天你是羊驼", body: "淡定是一种天赋" },
  { emoji: "🌊", title: "今日发呆任务", body: "想象海浪一次次拍岸，再退去" },
  { emoji: "🐼", title: "今天你是熊猫", body: "吃竹子也是一种修行" },
  { emoji: "🍀", title: "今日发呆任务", body: "把手放在心脏上，感受一下它" },
  { emoji: "🦥", title: "今天你是树懒", body: "慢即是快，挂着也是姿势" },
  { emoji: "🌻", title: "今日发呆任务", body: "找一件小事，做得认真一些" },
  { emoji: "🐸", title: "今天你是青蛙", body: "井里也有天，安心就好" },
  { emoji: "🦊", title: "今天你是狐狸", body: "聪明就是知道什么时候装糊涂" },
  { emoji: "🫶", title: "今日发呆任务", body: "今天对自己好一点就够了" },
  { emoji: "🐧", title: "今天你是企鹅", body: "摇摇晃晃也能走到目的地" },
  { emoji: "🍄", title: "今日发呆任务", body: "什么都不想，也是一种状态" },
  { emoji: "🌠", title: "今日发呆任务", body: "许个愿，不用太具体" },
  { emoji: "🦜", title: "今天你是鹦鹉", body: "重复说也是一种坚持" },
  { emoji: "🐉", title: "今天你是龙", body: "偶尔可以大声一点" },
  { emoji: "🫧", title: "今日发呆任务", body: "吹个泡泡，看它慢慢飘走" },
  { emoji: "🌈", title: "今日发呆任务", body: "今天选一个颜色代表你的状态" },
];

const starterPrompt =
  "把这个个人助手 app 的第一版后端接口设计出来：记忆流、AI 整理、目标总结、Codex 任务队列。要求包含数据模型、权限边界和最小可运行 API。";

const navItems: Array<{ id: AppView; label: string; icon: LucideIcon }> = [
  { id: "ai", label: "主页", icon: Sparkles },
  { id: "push", label: "AI日报", icon: BellRing },
  { id: "memory", label: "随手记", icon: Database },
  { id: "wellness", label: "治愈", icon: Smile }
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
    .replace(/\*+/g, "")
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

  // Check server version and reload if newer
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/version.txt?t=" + Date.now());
        const serverVer = parseInt((await res.text()).trim(), 10);
        if (serverVer > __APP_VERSION__) window.location.reload();
      } catch {}
    };
    const t = window.setTimeout(check, 3000);
    const i = window.setInterval(check, 120000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, []);
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
  const nextTask = tasks.find((task) => task.state === "doing") ?? tasks[0];

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


  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  function deleteNotes(ids: string[]) {
    setNotes((prev) => prev.filter((n) => !ids.includes(n.id)));
    notify(`已删除 ${ids.length} 条记录`);
  }

  function updateNote(id: string, text: string, kind: Note["kind"]) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text, kind } : n)));
    notify("笔记已更新");
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
      <main className="app-main">
        {activeView === "ai" && (
          <AIView
            result={organizeResult}
            nextTask={nextTask}
            recentNotes={notes.slice(0, 2)}
            inboxCount={notes.filter((note) => note.kind === "inbox").length}
            onNotify={notify}
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
        {activeView === "memory" && <MemoryView notes={notes} onDelete={deleteNotes} onUpdate={updateNote} />}
        {activeView === "push" && <PushView onNotify={notify} />}
        {activeView === "health" && <HealthView logs={healthLogs} onLogHealth={setLogModal} onAddWater={addWaterCup} onSaveMood={saveMood} />}
        {activeView === "wellness" && <WellnessView />}
      </main>

      <section className="app-dock">
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

function PomodoroCard({ onNotify }: { onNotify: (msg: string) => void }) {
  const [phase, setPhase] = useState<"idle" | "focus" | "break">("idle");
  const [secsLeft, setSecsLeft] = useState(25 * 60);
  const [sessions, setSessions] = useState(0);
  const [focusMins, setFocusMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);

  useEffect(() => {
    if (phase === "idle") return;
    const id = window.setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (secsLeft !== 0 || phase === "idle") return;
    if (phase === "focus") {
      setSessions((s) => s + 1);
      setPhase("break");
      setSecsLeft(breakMins * 60);
      onNotify("专注结束，发呆一会儿 🌿");
    } else {
      setPhase("idle");
      setSecsLeft(focusMins * 60);
      onNotify("发呆结束，继续加油 ✨");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secsLeft]);

  function startFocus() { setPhase("focus"); setSecsLeft(focusMins * 60); }
  function startBreak() { setPhase("break"); setSecsLeft(breakMins * 60); }
  function stop() { setPhase("idle"); setSecsLeft(focusMins * 60); }

  const total = phase === "break" ? breakMins * 60 : focusMins * 60;
  const pct = Math.round((1 - secsLeft / total) * 100);
  const mm = String(Math.floor(secsLeft / 60)).padStart(2, "0");
  const ss = String(secsLeft % 60).padStart(2, "0");

  return (
    <div className={cx("pomodoro-card", phase !== "idle" && phase)}>
      <div className="pomo-head">
        <span className="pomo-label">
          {phase === "idle" ? "专注 · 发呆" : phase === "focus" ? "🍅 专注中" : "☁️ 发呆放空"}
        </span>
        {sessions > 0 && <span className="pomo-sessions">今日 {sessions} 轮</span>}
      </div>

      {phase !== "idle" ? (
        <>
          {phase === "break" && <div className="breath-orb" />}
          <div className="pomo-timer">{mm}:{ss}</div>
          <div className="pomo-bar">
            <div className="pomo-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="pomo-actions">
            {phase === "focus" && (
              <button className="pomo-btn secondary" onClick={startBreak}>提前发呆</button>
            )}
            <button className="pomo-btn ghost" onClick={stop}>放弃</button>
          </div>
        </>
      ) : (
        <div className="pomo-idle-actions">
          <div className="pomo-action-group">
            <button className="pomo-focus-btn" onClick={startFocus}>🍅 开始专注</button>
            <div className="pomo-stepper">
              <button className="pomo-step-btn" onClick={() => setFocusMins(m => Math.max(5, m - 5))}>−</button>
              <span>{focusMins}'</span>
              <button className="pomo-step-btn" onClick={() => setFocusMins(m => Math.min(180, m + 5))}>+</button>
            </div>
          </div>
          <div className="pomo-action-group">
            <button className="pomo-break-btn" onClick={startBreak}>☁️ 发呆放空</button>
            <div className="pomo-stepper">
              <button className="pomo-step-btn" onClick={() => setBreakMins(m => Math.max(5, m - 5))}>−</button>
              <span>{breakMins}'</span>
              <button className="pomo-step-btn" onClick={() => setBreakMins(m => Math.min(60, m + 5))}>+</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type FortuneLevel = "上上签" | "上签" | "中签" | "下签" | "下下签";
type Fortune = { id: number; level: FortuneLevel; title: string; poem: string; body: string };

const FORTUNE_COLOR: Record<FortuneLevel, string> = {
  "上上签": "#c8860a",
  "上签":   "#1a8c5c",
  "中签":   "#5258c0",
  "下签":   "#c05818",
  "下下签": "#b02020",
};

const FORTUNES: Fortune[] = [
  { id: 1,  level: "上上签", title: "柳暗花明", poem: "山穷水复疑无路，\n柳暗花明又一村。", body: "前路虽阻，转机将至，勿忧勿虑。" },
  { id: 2,  level: "上上签", title: "花开自在", poem: "不争春色艳三分，\n自有秋来万里香。", body: "顺应本心，时机已熟，静待自成。" },
  { id: 3,  level: "上上签", title: "龙吟虎啸", poem: "蛟龙得水终腾起，\n自有风云际会时。", body: "蛰伏已久，显露之时将至，勿失时机。" },
  { id: 4,  level: "上上签", title: "顺水行舟", poem: "顺流而下万里舟，\n东风自有送归途。", body: "顺势而为，所谋皆宜，放手一试。" },
  { id: 5,  level: "上上签", title: "鱼跃龙门", poem: "一跃龙门身已变，\n从此云路任翱翔。", body: "机缘已至，勇于一跃，莫令错失。" },
  { id: 6,  level: "上签",   title: "春风得意", poem: "春风得意马蹄疾，\n一日看尽长安花。", body: "风向顺遂，迈步即是，无须迟疑。" },
  { id: 7,  level: "上签",   title: "马到成功", poem: "千里马蹄风路远，\n功名自有到来时。", body: "起而行之胜于空想，今日动手。" },
  { id: 8,  level: "上签",   title: "旭日东升", poem: "旭日东升驱夜色，\n新程万里正当时。", body: "昨事已过，今日重计，焕然一新。" },
  { id: 9,  level: "上签",   title: "步步高升", poem: "步履虽迟志弥坚，\n高山仰止在云端。", body: "虽不显于人，积累之势已成。" },
  { id: 10, level: "上签",   title: "金玉满堂", poem: "积善余庆家道兴，\n金玉满堂德所彰。", body: "所有之物，多于所见，知足者富。" },
  { id: 11, level: "上签",   title: "天降甘霖", poem: "久旱忽闻甘雨至，\n枯木逢春又发芽。", body: "久候之事，消息将至，静待佳音。" },
  { id: 12, level: "上签",   title: "一帆风顺", poem: "一帆顺风千里去，\n万里前程任往来。", body: "无大波折，踏实行事即可。" },
  { id: 13, level: "中签",   title: "云淡风轻", poem: "云淡风轻近午天，\n傍花随柳过前川。", body: "今日平平，然平安即是福泽。" },
  { id: 14, level: "中签",   title: "守株待兔", poem: "静守芳华候时节，\n时至自有桃李春。", body: "时机未至，暂作等待，切勿妄动。" },
  { id: 15, level: "中签",   title: "随遇而安", poem: "随缘消旧业，\n安分度余生。", body: "不必强求定数，随顺而行，自有归处。" },
  { id: 16, level: "中签",   title: "默默耕耘", poem: "但问耕耘莫问收，\n时至自有花开候。", body: "无人见证亦无妨，因果自有印证之日。" },
  { id: 17, level: "中签",   title: "细水长流", poem: "涓涓细流终成海，\n点点滴滴积成山。", body: "不适合急进，绵长之力胜于一时之猛。" },
  { id: 18, level: "中签",   title: "静观其变", poem: "静观天色风云变，\n时至自有峰回路。", body: "勿急于表态，再观望片刻，局势未定。" },
  { id: 19, level: "中签",   title: "因势利导", poem: "水善利万物而不争，\n顺势而行自然通。", body: "依现有之势而行，不可逆势强求。" },
  { id: 20, level: "中签",   title: "积少成多", poem: "积土成山风雨兴，\n积水成渊蛟龙生。", body: "今日微末之举，他日自有大成之时。" },
  { id: 21, level: "中签",   title: "暗流涌动", poem: "水面无波潜有鱼，\n须知静处有玄机。", body: "表面平静之中，有事正在悄然变化。" },
  { id: 22, level: "中签",   title: "半途而废", poem: "行百里者半九十，\n回首来时路尚清。", body: "非令你放弃，而是提醒回看，路是否走偏。" },
  { id: 23, level: "下签",   title: "逆风而行", poem: "逆风岂可强行舟，\n且守本心待转机。", body: "今日诸事不顺，少做决定，守而待时。" },
  { id: 24, level: "下签",   title: "一波三折", poem: "路虽迂回终向前，\n波折之中有真章。", body: "事有曲折，切勿冒进，多思一步。" },
  { id: 25, level: "下签",   title: "乌云蔽日", poem: "乌云遮日非久长，\n守住初心待晴天。", body: "所见之方向或有盲区，换角度再看。" },
  { id: 26, level: "下签",   title: "力不从心", poem: "欲速则不达，\n缓行方得安。", body: "思虑过多已成负累，今日且先放下。" },
  { id: 27, level: "下签",   title: "迷途知返", poem: "迷途知返犹未晚，\n回头是岸自有期。", body: "偏离正途并不可怕，知晓即可折返。" },
  { id: 28, level: "下下签", title: "大事不妙", poem: "风浪未息莫行舟，\n静守其时待天光。", body: "今日宜静不宜动，凡决断皆宜缓行。" },
  { id: 29, level: "下下签", title: "四面楚歌", poem: "四面楚歌势已孤，\n独善其身守本真。", body: "所倚之人今日或有变，需靠一己之力。" },
  { id: 30, level: "下下签", title: "焦头烂额", poem: "事急则乱缓则安，\n且放宽心再图谋。", body: "诸事搁置，饮水歇息，明日再议。" },
];

const JAR_STICKS = [
  { x1: 20, y1: 16, x2: 30, y2: 65 },
  { x1: 28, y1:  8, x2: 37, y2: 62 },
  { x1: 37, y1:  2, x2: 43, y2: 60 },
  { x1: 46, y1:  9, x2: 48, y2: 60 },
  { x1: 55, y1:  4, x2: 53, y2: 60 },
  { x1: 65, y1:  9, x2: 59, y2: 62 },
  { x1: 74, y1: 17, x2: 67, y2: 65 },
];
const JAR_HL = 2;

function FortuneCard() {
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [shaking, setShaking] = useState(false);

  function draw() {
    if (shaking) return;
    setShaking(true);
    setFortune(null);
    setTimeout(() => {
      setShaking(false);
      setFortune(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]);
    }, 520);
  }

  const levelColor = fortune ? FORTUNE_COLOR[fortune.level] : null;

  return (
    <div
      className={`fortune-card${shaking ? " fortune-shaking" : ""}`}
      onClick={draw}
      role="button"
      tabIndex={0}
    >
      {/* SVG 签筒：仅未抽时显示 */}
      <div className={`fortune-scene${fortune ? " fortune-scene--hidden" : ""}`}>
        <svg viewBox="0 0 96 140" width="96" height="140" aria-hidden="true" style={{ display: "block" }}>
          <defs>
            <linearGradient id="fj-body" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%"   stopColor="#5c0c0c" />
              <stop offset="22%"  stopColor="#9e1c1c" />
              <stop offset="50%"  stopColor="#c52424" />
              <stop offset="78%"  stopColor="#9e1c1c" />
              <stop offset="100%" stopColor="#5c0c0c" />
            </linearGradient>
            <linearGradient id="fj-rim" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%"   stopColor="#3a0808" />
              <stop offset="50%"  stopColor="#741616" />
              <stop offset="100%" stopColor="#3a0808" />
            </linearGradient>
            <linearGradient id="fj-gold" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%"   stopColor="#5a3a06" />
              <stop offset="28%"  stopColor="#b88010" />
              <stop offset="50%"  stopColor="#e8b828" />
              <stop offset="72%"  stopColor="#b88010" />
              <stop offset="100%" stopColor="#5a3a06" />
            </linearGradient>
            <filter id="fj-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* regular sticks */}
          {JAR_STICKS.map((s, i) => i !== JAR_HL && (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
              stroke="#c9a040" strokeWidth="5" strokeLinecap="round" />
          ))}

          {/* highlighted stick */}
          <line
            className={`fj-hl${fortune ? " fj-hl--out" : ""}`}
            x1={JAR_STICKS[JAR_HL].x1} y1={JAR_STICKS[JAR_HL].y1}
            x2={JAR_STICKS[JAR_HL].x2} y2={JAR_STICKS[JAR_HL].y2}
            stroke={fortune ? "#f4c428" : "#c9a040"}
            strokeWidth="5" strokeLinecap="round"
            filter={fortune ? "url(#fj-glow)" : undefined}
          />

          {/* container body */}
          <rect x="8" y="62" width="80" height="66" rx="8" fill="url(#fj-body)" />

          {/* top opening */}
          <ellipse cx="48" cy="62" rx="40" ry="13" fill="url(#fj-rim)" />
          <ellipse cx="48" cy="65" rx="30"  ry="8"  fill="rgba(0,0,0,0.38)" />

          {/* gold band top */}
          <rect x="8" y="75" width="80" height="5" rx="1" fill="url(#fj-gold)" />

          {/* center decoration */}
          <rect x="37" y="90" width="22" height="16" rx="2" fill="none"
            stroke="rgba(232,184,40,0.22)" strokeWidth="1.5" />

          {/* gold band bottom */}
          <rect x="8" y="116" width="80" height="5" rx="1" fill="url(#fj-gold)" />

          {/* bottom oval */}
          <ellipse cx="48" cy="128" rx="40" ry="10" fill="rgba(36,4,4,0.88)" />

          {/* sheen */}
          <ellipse cx="30" cy="96" rx="6" ry="18" fill="rgba(255,255,255,0.04)" />
        </svg>
      </div>

      {!fortune ? (
        <p className="fortune-cta">轻触抽签</p>
      ) : (
        <div className="fortune-result">
          <div className="fortune-header">
            <span className="fortune-num">第 {fortune.id} 签</span>
            <span className="fortune-level-badge"
              style={{ color: levelColor!, background: `${levelColor}18` }}>
              {fortune.level}
            </span>
          </div>
          <p className="fortune-title">{fortune.title}</p>
          <div className="fortune-sep">
            <span className="fortune-sep-label">诗曰</span>
            <div className="fortune-sep-line" />
          </div>
          <p className="fortune-poem">{fortune.poem}</p>
          <div className="fortune-sep">
            <span className="fortune-sep-label">解</span>
            <div className="fortune-sep-line" />
          </div>
          <p className="fortune-body">{fortune.body}</p>
          <span className="fortune-redraw">再抽 →</span>
        </div>
      )}
    </div>
  );
}

const TICKER_FALLBACK = [
  "① Claude 4.5 发布，推理与速度双提升",
  "② Gemini Ultra 2 正式上线，支持 100 万 token 上下文",
  "③ OpenAI 推出 o3 模型，数学竞赛超越人类水平",
  "④ Apple 发布 Apple Intelligence 2.0，深度整合 Siri",
  "⑤ 国内大模型混战加剧，百模大战进入下半场",
];

function extractNewsTitle(line: string): string | null {
  // **① title** — bold + circled number (latest API format)
  if (/^\*{1,2}[①②③④⑤⑥⑦⑧⑨⑩]/.test(line)) {
    return line.replace(/^\*{1,2}/, "").replace(/\*{1,2}$/, "").replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "").trim();
  }
  // ① title — plain circled number
  if (/^[①②③④⑤⑥⑦⑧⑨⑩]\s/.test(line)) {
    return line.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "").trim();
  }
  // ### 1. title — h3 numbered heading
  if (/^###\s+\d+[.、）)]\s/.test(line)) {
    return line.replace(/^###\s+/, "").replace(/^\d+[.、）)]\s*/, "").trim();
  }
  // **1. title** — bold numbered
  if (/^\*{1,2}\d+[.、）)]\s/.test(line)) {
    return line.replace(/^\*{1,2}/, "").replace(/\*{1,2}$/, "").replace(/^\d+[.、）)]\s*/, "").replace(/^🏷️\s*/, "").trim();
  }
  return null;
}

function parseHeadlines(records: { content?: string; excerpt?: string; title?: string }[]): string[] {
  if (!records.length) return [];
  const r = records[0];
  const raw = r.content ?? r.excerpt ?? "";
  const firstSection = raw.indexOf("\n## ");
  const content = firstSection >= 0 ? raw.slice(firstSection + 1) : raw;
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean);
  const parsed = lines.map(extractNewsTitle).filter(Boolean) as string[];
  if (parsed.length) return parsed.map(l => stripMarkdown(l));
  if (r.title) return [stripMarkdown(r.title)];
  return [];
}

function NewsTicker({ onOpen }: { onOpen: (view: AppView) => void }) {
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetchPushRecords().then(records => {
      const h = parseHeadlines(records);
      if (h.length) setHeadlines(h);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const display = headlines.length ? headlines : (loaded ? TICKER_FALLBACK : []);

  useEffect(() => {
    if (display.length <= 1) return;
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % display.length);
        setVisible(true);
      }, 350);
    }, 4000);
    return () => clearInterval(t);
  }, [display.length]);

  if (!display.length) return null;

  return (
    <button className="news-ticker" onClick={() => onOpen("push")}>
      <span className="ticker-label">AI日报</span>
      <div className="ticker-viewport">
        <span className={`ticker-item${visible ? "" : " ticker-item--out"}`}>
          <span className="ticker-idx">{"①②③④⑤⑥⑦⑧⑨⑩"[idx % 10]}</span>
          {display[idx].replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "")}
        </span>
      </div>
    </button>
  );
}

function AIView({
  result,
  nextTask,
  recentNotes,
  inboxCount,
  onNotify,
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
  onNotify: (msg: string) => void;
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
  const [weather, setWeather] = useState<{ temp: number; desc: string } | null>(null);

  useEffect(() => {
    // 深圳市宝安区
    fetch("https://api.open-meteo.com/v1/forecast?latitude=22.5552&longitude=113.8835&current=temperature_2m,weather_code&timezone=Asia%2FShanghai")
      .then(r => r.json())
      .then(data => {
        const code: number = data.current.weather_code;
        const temp = Math.round(data.current.temperature_2m);
        const desc =
          code === 0 ? "晴" :
          code <= 3  ? "多云" :
          code <= 48 ? "有雾" :
          code <= 55 ? "小雨" :
          code <= 65 ? "雨" :
          code <= 75 ? "雪" :
          code <= 82 ? "阵雨" : "雷雨";
        setWeather({ temp, desc });
      }).catch(() => {});
  }, []);

  const h = new Date().getHours();
  const timeHint =
    h < 6  ? "深夜了" :
    h < 9  ? "清早了" :
    h < 11 ? "上午好" :
    h < 13 ? "到饭点了" :
    h < 15 ? "下午了" :
    h < 17 ? "快下班了" :
    h < 19 ? "傍晚了" :
    h < 21 ? "晚上好" :
    h < 23 ? "入夜了" : "深夜了";

  const d = new Date();
  const days = ["周日","周一","周二","周三","周四","周五","周六"];
  const dateStr = `${d.getMonth()+1}月${d.getDate()}日 ${days[d.getDay()]}`;

  const heroPeriod =
    h < 6  ? "night" :
    h < 11 ? "morning" :
    h < 18 ? "day" :
    h < 22 ? "evening" : "night";

  return (
    <section className="screen-stack home-surface">
      <div className={`hero-card hero-card--${heroPeriod}`}>
        <span className="hero-time-hint">
          {timeHint}{weather ? ` · ${weather.temp}° ${weather.desc}` : ""}
        </span>
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

      <NewsTicker onOpen={onOpen} />

      <PomodoroCard onNotify={onNotify} />

      <FortuneCard />

      <section className="home-entries">
        <button className="entry-card" onClick={() => onOpen("memory")}>
          <span className="entry-icon">
            <Database size={18} />
          </span>
          <div>
            <p>随手记</p>
            <h3>{inboxCount > 0 ? `${inboxCount} 条待整理` : "全部已整理"}</h3>
            <span className="entry-sub">{recentNotes[0]?.text ?? "随手记"}</span>
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

function MemoryView({ notes, onDelete, onUpdate }: {
  notes: Note[];
  onDelete: (ids: string[]) => void;
  onUpdate: (id: string, text: string, kind: Note["kind"]) => void;
}) {
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const filtered = notes
    .filter((n) => filter === "all" || n.kind === filter)
    .filter((n) => !search || n.text.toLowerCase().includes(search.toLowerCase()));

  const counts: Record<NoteFilter, number> = {
    all: notes.length,
    inbox: notes.filter((n) => n.kind === "inbox").length,
    knowledge: notes.filter((n) => n.kind === "knowledge").length,
    task: notes.filter((n) => n.kind === "task").length,
    goal: notes.filter((n) => n.kind === "goal").length
  };

  const filterItems: Array<[NoteFilter, string]> = [
    ["all", "全部"],
    ["inbox", "待整理"],
    ["knowledge", "记忆"],
    ["task", "任务"],
    ["goal", "目标"]
  ];

  function exitManage() {
    setIsManaging(false);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <section className="screen-stack">
      <div className="content-head floating">
        <div>
          <p>随手记</p>
          <h2>全部笔记</h2>
        </div>
        <button
          className={cx("manage-toggle", isManaging && "active")}
          onClick={() => (isManaging ? exitManage() : setIsManaging(true))}
        >
          {isManaging ? "完成" : "管理"}
        </button>
      </div>

      {!isManaging && (
        <div className="memory-search">
          <Search size={15} />
          <input
            placeholder="搜索记录..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="filter-tabs">
        {filterItems.map(([id, label]) => (
          <button
            key={id}
            className={cx("filter-tab", filter === id && "active")}
            onClick={() => setFilter(id)}
          >
            {label}
            <span className="filter-count">{counts[id]}</span>
          </button>
        ))}
      </div>

      {isManaging && (
        <div className="manage-action-bar">
          <button
            className="manage-select-all"
            onClick={() =>
              setSelectedIds(allSelected ? new Set() : new Set(filtered.map((n) => n.id)))
            }
          >
            {allSelected ? "取消全选" : "全选"}
          </button>
          <span className="manage-count">
            {selectedIds.size > 0 ? `已选 ${selectedIds.size} 条` : "选择笔记"}
          </span>
          <button
            className="manage-delete-btn"
            disabled={selectedIds.size === 0}
            onClick={() => {
              onDelete(Array.from(selectedIds));
              setSelectedIds(new Set());
              setIsManaging(false);
            }}
          >
            删除
          </button>
        </div>
      )}

      <div className="note-cards">
        {filtered.length === 0 ? (
          <div className="memory-empty">
            <Database size={28} />
            <p>{search ? `没有包含「${search}」的记录` : "暂无记录"}</p>
          </div>
        ) : (
          filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              expanded={expandedId === note.id}
              onToggle={() => setExpandedId((prev) => (prev === note.id ? null : note.id))}
              isManaging={isManaging}
              isSelected={selectedIds.has(note.id)}
              onSelect={() => toggleSelect(note.id)}
              onEdit={() => setEditingNote(note)}
            />
          ))
        )}
      </div>

      {editingNote && (
        <NoteEditModal
          note={editingNote}
          onSave={(text, kind) => {
            onUpdate(editingNote.id, text, kind);
            setEditingNote(null);
          }}
          onClose={() => setEditingNote(null)}
        />
      )}
    </section>
  );
}

function WellnessView() {
  const [cat, setCat] = useState<WellnessCat>("joy");
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * WELLNESS.joy.items.length));
  const [animating, setAnimating] = useState(false);

  const cats = Object.entries(WELLNESS) as [WellnessCat, typeof WELLNESS.joy][];
  const current = WELLNESS[cat];

  function shuffle() {
    setAnimating(true);
    setTimeout(() => {
      setIdx(Math.floor(Math.random() * current.items.length));
      setAnimating(false);
    }, 280);
  }

  function switchCat(c: WellnessCat) {
    setCat(c);
    setIdx(Math.floor(Math.random() * WELLNESS[c].items.length));
  }

  return (
    <section className="screen-stack wellness-view">
      <div className="content-head">
        <h2>治愈时间</h2>
        <p>随时来充个电</p>
      </div>

      <div className="wellness-cats">
        {cats.map(([id, cfg]) => (
          <button
            key={id}
            className={`wellness-cat-btn${cat === id ? " active" : ""}`}
            style={{ "--cat-color": cfg.color } as React.CSSProperties}
            onClick={() => switchCat(id)}
          >
            <span>{cfg.emoji}</span>
            <span>{cfg.label}</span>
          </button>
        ))}
      </div>

      <div className={`wellness-card${animating ? " wellness-card--out" : ""}`}
           style={{ "--cat-color": current.color } as React.CSSProperties}>
        <div className="wellness-card-emoji">{current.emoji}</div>
        <p className="wellness-card-text">{current.items[idx]}</p>
      </div>

      <button className="wellness-shuffle" onClick={shuffle}>
        换一个 ↻
      </button>
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
    <section className="screen-stack push-view">
      <div className="content-head floating">
        <div>
          <p>每日精选</p>
          <h2>AI 日报</h2>
        </div>
        <button className="icon-button" onClick={triggerPush} disabled={running} aria-label="立即推送">
          <RefreshCcw size={17} className={running ? "spin" : ""} />
        </button>
      </div>

      <div className="push-status-bar">
        <span className={cx("push-dot-sm", status.server === "online" && "online")} />
        <span>{status.server === "online" ? "服务器在线" : "服务器离线"}</span>
        <span className="push-sep">·</span>
        <span>Hermes {status.hermes === "ready" ? "就绪" : "待确认"}</span>
        <span className="push-sep">·</span>
        <span>每日 {status.schedule}</span>
      </div>

      {latest ? (
        <article className="push-report-card">
          <div className="push-report-top">
            <span>{latest.channel}</span>
            <span>{latest.createdAt}</span>
          </div>
          <h3 className="push-report-h">{latest.title}</h3>
          {latest.content ? (
            <ReportMarkdown text={latest.content} />
          ) : latest.excerpt ? (
            <p className="push-report-excerpt">{stripMarkdown(latest.excerpt)}</p>
          ) : null}
        </article>
      ) : (
        <div className="push-empty-card">
          <Newspaper size={26} />
          <p>明早 {status.schedule} 自动同步</p>
          <span>AI HOT 每日精选</span>
        </div>
      )}

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
  // Skip meta header (title line, date, coverage, overview) before first section
  const firstSection = text.indexOf("\n## ");
  const body = firstSection >= 0 ? text.slice(firstSection + 1) : text;

  const blocks = body.split("\n").map((raw, index) => {
    const line = raw.trim();
    if (!line || line === "---") return null;
    if (line.startsWith("## ")) return <h3 key={index}>{renderInline(line.slice(3))}</h3>;
    // News item title (various API formats)
    const title = extractNewsTitle(line);
    if (title) return <p key={index} className="report-news-item">{renderInline(title)}</p>;
    // Skip metadata lines: 来源/时间/分类 bullets, 🏷️/🕐 inline tags, ### category headers
    if (line.startsWith("- **分类") || line.startsWith("- **来源") || line.startsWith("- **时间")) return null;
    if (line.startsWith("🏷️") || line.startsWith("🕐") || line.startsWith("###")) return null;
    if (/^[-•]\s*(来源|时间|分类|标签)[：:]/.test(line)) return null;
    // Render content paragraph
    return <p key={index}>{renderInline(line)}</p>;
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

function NoteCard({ note, expanded, onToggle, isManaging, isSelected, onSelect, onEdit }: {
  note: Note;
  expanded: boolean;
  onToggle: () => void;
  isManaging: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const isLong = note.text.length > 100;
  const displayText = isLong && !expanded ? note.text.slice(0, 100) + "…" : note.text;

  return (
    <article
      className={cx("note-card", expanded && "expanded", isSelected && "selected")}
      onClick={isManaging ? onSelect : onToggle}
    >
      <div className="note-card-head">
        {isManaging && (
          <span className="note-card-checkbox">
            {isSelected ? <CheckCircle2 size={19} /> : <Circle size={19} />}
          </span>
        )}
        <KindPill kind={note.kind} />
        <span className="note-card-spacer" />
        <span className="note-card-time">
          {note.date ? formatNoteDate(note.date) + " · " : ""}
          {note.createdAt}
        </span>
        {!isManaging && (
          <button
            className="note-edit-icon"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
      <p className="note-card-text">{displayText}</p>
      {note.attachments?.length ? (
        <div className="note-card-footer">
          <Paperclip size={12} />
          <span>{note.attachments.length} 个附件</span>
        </div>
      ) : null}
      {isLong && !isManaging && (
        <span className="note-expand-btn">{expanded ? "收起 ↑" : "展开 ↓"}</span>
      )}
    </article>
  );
}

function NoteEditModal({ note, onSave, onClose }: {
  note: Note;
  onSave: (text: string, kind: Note["kind"]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(note.text);
  const [kind, setKind] = useState<Note["kind"]>(note.kind);

  const kindOptions: Array<[Note["kind"], string]> = [
    ["inbox", "待整理"],
    ["knowledge", "记忆"],
    ["task", "任务"],
    ["goal", "目标"]
  ];

  return (
    <div className="health-modal-overlay" onClick={onClose}>
      <div className="health-modal note-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="health-modal-head">
          <h3>编辑笔记</h3>
          <button className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="note-kind-picker">
          {kindOptions.map(([k, label]) => (
            <button
              key={k}
              className={cx("note-kind-chip", k, kind === k && "active")}
              onClick={() => setKind(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          className="note-edit-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          autoFocus
        />
        <button
          className="primary-button full"
          disabled={!text.trim()}
          onClick={() => onSave(text.trim(), kind)}
        >
          保存
        </button>
      </div>
    </div>
  );
}

function formatNoteDate(date: string): string {
  const today = todayStr();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);
  if (date === today) return "今天";
  if (date === yesterday) return "昨天";
  return date.slice(5).replace("-", "/");
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
