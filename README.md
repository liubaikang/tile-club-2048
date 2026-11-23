# TILE CLUB · 2048

一款中文界面的 2048 网页游戏，带游客设备身份、账户登录与排行榜。视觉为米白纸张 + 焦糖棋盘 + 赤陶瓦片的「俱乐部计分牌」风格。

## 功能

- 2048 完整规则：方向键 / WASD / 触屏滑动，同值瓦片合并计分，2048 达成后可继续挑战
- 20 步撤销、单局计时与步数统计、胜负浮层
- 游客身份：依据 UA、语言、平台、屏幕尺寸、像素比、时区等设备信息生成指纹，稳定存于 `localStorage`
- 账户体系：复用平台 OIDC 登录；登录后成绩归属账户，可跨设备查看
- 账户管理：昵称修改、完成局数、最高单局、最高瓦片、最近对局记录、重置游客身份
- 排行榜：按玩家单局最高分排名，实时展示

## 技术栈

前端 Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui
后端 FastAPI + SQLAlchemy 2.0（AsyncSession）+ PostgreSQL

## 目录

```
app/frontend/                 前端
  src/lib/game2048.ts         纯函数游戏引擎（滑行、合并、胜负判定）
  src/lib/gameApi.ts          后端接口封装 + 设备指纹游客身份
  src/contexts/PlayerContext.tsx  玩家身份与成绩单一数据源
  src/components/game/        棋盘、记分卡、身份卡、排行榜卡
  src/pages/Index.tsx         游戏主页
  src/pages/AccountPage.tsx   账户管理
app/backend/                  后端
  routers/game.py             /api/v1/game 身份同步、成绩、排行榜、历史
  models/、services/          FuncSea 生成的数据模型与服务层
```

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/game/sync` | 幂等创建/更新玩家并返回个人统计 |
| POST | `/api/v1/game/scores` | 提交一局成绩 |
| POST | `/api/v1/game/rename` | 修改昵称并同步历史成绩 |
| GET | `/api/v1/game/leaderboard` | 玩家最高分排行榜 |
| GET | `/api/v1/game/history` | 当前身份最近对局 |

## 本地开发

```bash
# 前端
cd app/frontend && pnpm install && pnpm run dev

# 后端
cd app && ./start_app_v2.sh --local
```

## 校验

```bash
cd app/frontend && pnpm exec tsc -p tsconfig.app.json --noEmit && pnpm run lint && pnpm run build
```

## 说明

游客身份通过浏览器指纹生成，不采集个人隐私数据，仅用于在同一设备上延续成绩。登录后后端以 Token 中的用户 ID 为准，忽略前端传入的 `player_key`，防止越权写入。