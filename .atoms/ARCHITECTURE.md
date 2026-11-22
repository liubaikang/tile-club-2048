# 架构说明

## 概览

TILE CLUB 是一个 2048 网页游戏，采用前后端分离的 FuncSea 全栈结构：

- `app/frontend`：Vite + React 18 + TypeScript + Tailwind + shadcn/ui，负责游戏交互与展示。
- `app/backend`：FastAPI + SQLAlchemy 2.0（AsyncSession），负责身份同步、成绩归档、排行榜与对局历史。

## 前端结构

- `src/lib/game2048.ts`：纯函数游戏引擎。负责 4×4 棋盘状态、按方向滑行与单次合并、随机新瓦片、胜负判定与撤销快照。瓦片保留稳定 `id`，因此 DOM 可用 `left/top` 过渡表现滑动。
- `src/components/game/GameBoard.tsx`：棋盘渲染、指针滑动识别、胜负浮层、按棋盘宽度自适应的数字字号。
- `src/components/game/ScoreCard.tsx`、`IdentityCard.tsx`、`LeaderboardCard.tsx`：得分、身份、排行榜三张卡片。
- `src/contexts/PlayerContext.tsx`：玩家身份与成绩的单一数据源。整合 `AuthContext` 的登录用户与游客身份，负责同步、改名、提交成绩、刷新本地最佳分。
- `src/pages/Index.tsx`：游戏主页，处理键盘（方向键/WASD）与滑动手势、撤销栈（上限 20）、结束时自动提交成绩。
- `src/pages/AccountPage.tsx`：账户管理，展示身份信息、统计、最近对局，支持登录/退出/改昵称/重置游客身份。
- `src/lib/gameApi.ts`：封装 `client.apiCall.invoke` 调用后端 `/api/v1/game/*`，并实现设备指纹游客键生成。

## 后端结构

- `routers/game.py`：游戏业务路由，挂在 `/api/v1/game` 前缀下，由 `main.py` 自动发现。
  - `POST /sync`：幂等创建/更新玩家行并返回个人统计。
  - `POST /scores`：写入一局成绩。
  - `POST /rename`：改名并同步历史成绩昵称。
  - `GET /leaderboard`：按玩家取单局最高分排序。
  - `GET /history`：当前身份最近对局。
- `models/game_players.py`、`models/game_scores.py`、`services/game_*.py`：由 `funcsea:create_tables` 生成的 ORM 与服务层，不手工改写。

## 身份模型

- 游客：浏览器根据 UA、语言、平台、硬件并发、屏幕尺寸、像素比、时区计算 FNV-1a 指纹，存于 `localStorage` 的 `tileclub.guest.key`，形如 `guest_<hash>`；昵称默认 `Guest <后四位>`，可修改并持久化。
- 账户：复用平台内置 OIDC 认证（`AuthContext`），`player_key` 为用户 ID；登录后成绩自动归属账户。
- 后端对游客键强制 `guest_` 前缀校验；携带有效 Bearer token 时忽略前端传入的 `player_key`，一律以 token 中的用户 ID 为准，避免越权写入。

## 数据契约

| 方向 | 字段 |
| --- | --- |
| 身份同步 | 请求 `player_key/display_name/is_guest` → 响应 `player_key/display_name/is_guest/stats{games_played,best_score,best_tile,total_moves,last_played}` |
| 成绩提交 | 请求 `player_key/score/best_tile/moves/duration_seconds` → 同上响应 |
| 排行榜 | `items[{rank,player_key,display_name,score,best_tile,moves,is_guest,achieved_at}], total` |
| 对局历史 | `items[{id,score,best_tile,moves,duration_seconds,created_at}], total` |

## 校验方式

- 前端：`pnpm exec tsc -p tsconfig.app.json --noEmit`、`pnpm run lint`、`pnpm run build`。
- 后端：`mgx-pycheck routers/game.py`。
- 预览：`Previewer.preview_project` 指向 `app` 根目录，由 `start_app_v2.sh` 同时启动前后端。