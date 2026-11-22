---
last_updated: 2026-11-22T09:34:33Z
status: active
---

# Project Context

## Project Overview
TILE CLUB：中文界面的 2048 网页游戏，带游客设备身份、账户登录/注册、排行榜与对局历史。

## Key Decisions
| Date | Decision | By | Rationale |
|------|----------|-----|-----------|
| 2026-11-22 | 复用 FuncSea 内置 OIDC 认证，不另建账户表 | Alex | 平台要求复用既有认证，避免第二套账号体系 |
| 2026-11-22 | 游客身份用浏览器指纹（UA/语言/平台/屏幕/时区）哈希生成并存 localStorage | Alex | 无登录也要有稳定身份，且同设备跨会话可延续 |
| 2026-11-22 | 携带 Bearer token 时后端忽略前端 player_key | Alex | 防止越权写入他人成绩 |
| 2026-11-22 | 排行榜按玩家取单局最高分 | Alex | 符合 2048 习惯，避免刷局数堆积 |
| 2026-11-22 | 视觉方向为米白纸张 + 焦糖棋盘 + 赤陶瓦片 | Alex | 参考图生成的编辑版式，区别于通用蓝紫 AI 风格 |

## Constraints
- 游戏结束才提交成绩；撤销上限 20 步。
- 游客 key 必须带 `guest_` 前缀，后端强校验。
- 不修改 `app/backend/core/**`、`main.py`、模板管理的认证文件。


