# neo-personal-app

## 项目概述
个人 PWA 助手应用，React 18 + TypeScript + Vite。单文件架构（`src/App.tsx` ~1700 行），所有组件内联，无 UI 库。

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

- React 18 + TypeScript，`src/App.tsx` 是唯一组件文件
- `src/styles.css` 全量 CSS，CSS 变量系统（`--green`、`--ink`、`--muted` 等）
- `vite-plugin-pwa` + Workbox，Service Worker 离线缓存
- `src/services/assistantGateway.ts`：API 调用层，含 `fetchPushRecords()`、`fetchPushStatus()`
- localStorage 持久化：`neo_health_logs`、`neo_sleep_tracking`、`neo_scratch_date`

## 首页结构（AIView）

```
home-surface
├── hero-card         天气 + 时段提示（Open-Meteo API，深圳宝安固定坐标）
├── NewsTicker        AI日报标题轮播（每4秒切一条，点击→日报页）
├── PomodoroCard      专注/发呆，+/- 步进调时长，发呆有呼吸动画
├── ScratchCard       每日刮刮卡（30条，seed=日期，canvas实现）
└── home-entries      随手记 + 健康 快捷入口
```

## 设计规范

- 用户非常在意美观，**做任何改动都要考虑视觉效果**
- 设计语言：毛玻璃 + 绿色调，`backdrop-filter: blur()`，圆角卡片
- 字体：`Segoe UI / Microsoft YaHei UI / PingFang SC`
- 不喜欢：堆叠过多元素、字体过粗过大、色差突兀、胶囊框过于显眼
- 喜欢：简洁、留白、有趣的交互（如刮刮卡、呼吸动画）

## AI日报（PushView）

- 服务器每日 08:30 自动推送，`Hermes` 脚本生成
- 内容格式：`①②③` 开头的条目，或 markdown 编号列表
- `NewsTicker` 解析顺序：①②③ → 1. 数字序号 → 任意长度>10字的行 → title 兜底

## 待做

- 健康板块替换成更有趣的功能（用户觉得健康记录太麻烦，懒得用）
- 通知/提醒功能
