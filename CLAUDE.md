# neo-personal-app

## 项目概述
个人 PWA 助手应用，React 18 + TypeScript + Vite。单文件架构（`src/App.tsx` ~1900 行），所有组件内联，无 UI 库。

## 关键信息

**仓库**：`github.com/peo1234/neo-personal-app`  
**本地路径**：`C:\Users\96364\Documents\GitHub\neo-personal-app`  
**线上地址**：`https://neo.example-wabulae.top`（Cloudflare DNS → 16.145.12.11）  
**服务器**：`16.145.12.11`，SSH alias `meixi`，静态文件在 `/var/www/neo/`

## 部署

```bash
npm run deploy   # 自动版本+1，build，ssh 上传到服务器
npm run dev      # 本地开发，自动选端口 5173/5174/5175
```

版本号在 `src/version.txt`，App 每 2 分钟轮询 `/version.txt` 自动刷新 PWA。

## 技术栈

- React 18 + TypeScript，`src/App.tsx` 是唯一组件文件（所有组件内联）
- `src/styles.css` 全量 CSS（~3800 行），CSS 变量系统（`--green`、`--ink`、`--muted` 等）
- `vite-plugin-pwa` + Workbox，Service Worker 离线缓存
- `src/services/assistantGateway.ts`：API 调用层，含 `fetchPushRecords()`、`fetchPushStatus()`
- localStorage 持久化：`neo_health_logs`、`neo_sleep_tracking`、`neo_scratch_date`

## 导航栏（4个 Tab）

```
主页（AIView）| AI日报（PushView）| 随手记（MemoryView）| 治愈（WellnessView）
```

图标：`Sparkles | BellRing | Database | Smile`（来自 lucide-react）

## 首页结构（AIView → home-surface）

```
home-surface
├── hero-card       天气 + 时段问候（Open-Meteo API，深圳宝安坐标 22.5552, 113.8835）
│                   透明背景，无边框，字体柔和
├── NewsTicker      AI日报标题轮播，每4秒切一条，点击→日报页
│                   有离线 fallback（TICKER_FALLBACK 数组）
│                   stripMarkdown() 过滤 **bold** 等标记
│                   每条前加 ①②③ 序号
├── PomodoroCard    专注/发呆，+/- 步进调时长，发呆有呼吸动画
├── FortuneCard     抽签卡（替代了原 ScratchCard 和 ChargeCard）
└── home-entries    随手记 + 健康 快捷入口
```

## FortuneCard 详细说明

**位置**：`src/App.tsx`，`FORTUNES` 数组 + `FortuneCard` 函数组件

**交互**：
- 初始：显示 SVG 签筒（红漆筒身 + 金腰带 + 7根签杆探出），文字「轻触抽签」
- 点击 → 签筒抖动（`.fortune-shaking` CSS 动画）→ 520ms 后抽出随机签
- 抽出后：签筒隐藏（`.fortune-scene--hidden`），显示签文内容
- 再次点击 → 重新抽

**签文格式**：
```
第 N 签              上上签（彩色徽章）
柳暗花明              ← 大字标题（26px）
── 诗曰 ──────────
山穷水复疑无路，      ← 七言对联（white-space: pre-line）
柳暗花明又一村。
── 解 ─────────────
前路虽阻，转机将至。  ← 一句白话释义
                再抽 →
```

**签的级别与颜色**：
- 上上签 `#c8860a`（金）/ 上签 `#1a8c5c`（绿）/ 中签 `#5258c0`（蓝紫）
- 下签 `#c05818`（橙）/ 下下签 `#b02020`（红）

**Fortune 类型**：
```ts
type Fortune = { id: number; level: FortuneLevel; title: string; poem: string; body: string }
```

共 30 条签，涵盖全部 5 个级别。

**SVG 签筒结构**（`JAR_STICKS` + inline SVG）：
- 7 根签杆，坐标硬编码，index=2 为高亮签（`.fj-hl`）
- 抽出后高亮签上移 16px（CSS `transform: translateY(-16px)`）+ 金色 + 发光 filter
- 签筒渐变：`fj-body`（红）/ `fj-rim`（深红椭圆口）/ `fj-gold`（金腰带）

## WellnessView（治愈 Tab）

4 个分类标签页：快乐 / 心态 / 休息 / 脑洞，每类 15 条内容，随机展示一条。  
组件：`WellnessView`，数据：`WELLNESS` 对象。

## NewsTicker 解析逻辑

```ts
function parseHeadlines(records): string[]
// 优先级：①②③ 开头 → 数字序号 → 长度>10字的行 → title 兜底
// 最终都经过 stripMarkdown() 过滤
```

## 天气 Hero

```ts
// Open-Meteo API，坐标固定深圳宝安
// weather_code → 晴/多云/阴/小雨/中雨/大雨/雷雨/雪
// 时段：早安/上午好/下午好/晚上好/夜深了
// 显示："{时段} · {temp}° {desc}"
// 背景透明，无边框，不显示日期
```

## 设计规范（重要）

用户对 UI 要求极高，**每次改动必须考虑视觉效果**。

- 整体风格：毛玻璃 + 绿色调，`backdrop-filter: blur()`，圆角卡片
- 字体：`Segoe UI / Microsoft YaHei UI / PingFang SC`
- **不喜欢**：纯黑底色、机器人/机械感设计、字体过粗过大、色差突兀、胶囊框过于显眼、元素堆叠遮挡文字
- **喜欢**：暖色调、有文化感的设计（如签筒）、简洁留白、有趣的交互动画
- 卡片之间有 `gap: 10px`（`.home-surface`）

## 常见问题 & 历史修复

- `**` 残留在 Ticker 标题：`stripMarkdown()` 末尾加 `.replace(/\*+/g, "")`
- NewsTicker 服务器离线时为空：加 `TICKER_FALLBACK` 数组兜底
- hero-card 背景被覆盖：不能和 `.next-card` 合并写 CSS 规则
- FortuneCard 文字遮挡：签筒抽签后用 `.fortune-scene--hidden` 隐藏（max-height: 0）

## 待做 / 想法

- 鱼缸（用户曾提到，首页放真实游动的鱼）
- 通知/提醒功能
- 健康板块（用户懒得记录，目前入口保留但想换成有趣内容）
