# TILE CLUB · 2048 生成过程文档

项目：TILE CLUB — 中文界面 2048 网页游戏（游客设备身份 + 账户管理 + 排行榜）
代码仓库：https://github.com/liubaikang/tile-club-2048
文档版本：v1.0 · 2026-11-22

---

## 一、阶段总览

| 阶段 | 名称 | 主要产出 | 状态 |
| --- | --- | --- | --- |
| S0 | 需求解析与范围界定 | 功能清单、能力边界结论 | 已完成 |
| S1 | 后端能力判定与选型 | Atoms Cloud / FuncSea 方案 | 已完成 |
| S2 | 模板装配与资源初始化 | 前后端脚手架、数据库/认证/存储 | 已完成 |
| S3 | 数据模型设计 | `game_players`、`game_scores` | 已完成 |
| S4 | 后端业务接口 | `/api/v1/game/*` 五个接口 | 已完成 |
| S5 | 游戏核心引擎 | `lib/game2048.ts` 纯函数内核 | 已完成 |
| S6 | 视觉方向与参考稿 | `homepage-reference.png`、`DESIGN.md` | 已完成 |
| S7 | 前端界面实现 | 主页、账户页、四类卡片组件 | 已完成 |
| S8 | 身份体系落地 | 设备指纹游客 + OIDC 账户 | 已完成 |
| S9 | 工程校验 | tsc / lint / build / pycheck | 已完成 |
| S10 | 预览与渲染检查 | 首屏渲染评分与修复 | 已完成 |
| S11 | 代码托管 | GitHub 仓库与提交 | 已完成 |
| S12 | 线上联调与数据清理 | 接口在线验证、测试数据清除 | 已完成 |
| S13 | 交付与后续计划 | README、上下文文档、演进建议 | 已完成 |

---

## 二、S0 需求解析与范围界定

### 目标
把一句话需求拆成可验证的功能契约，同时判定哪些部分必须由服务端承担。

### 具体执行计划
1. 提取显式需求：2048 网页版；可部署访问；账户注册与账户管理；游客默认身份且依据设备信息生成。
2. 拆分隐式依赖：账户体系需要服务端认证；游客与账户的成绩需要持久化；排名需要服务端聚合。
3. 明确不做的事：不引入支付/订阅；不做社交功能（好友、私信）；不做多人对战。避免范围膨胀。
4. 定义验收口径：能玩完整一局、结束后成绩入库、游客刷新页面身份不变、登录后成绩归属账户。

### 产出物
- 功能清单与验收口径（记录于项目进度文档）
- 后端能力需求结论：需要认证、数据库两张业务表

### 关键决策
游客身份不采集个人隐私，只使用浏览器公开信号做本地哈希，避免合规风险。

---

## 三、S1 后端能力判定与选型

### 目标
确定后端承载方式，避免自建账号体系与平台能力冲突。

### 具体执行计划
1. 读取平台后端规范，确认默认后端为 Atoms Cloud（FuncSea），提供认证、数据库、对象存储、边缘函数、AI 能力。
2. 判定本项目仅需「认证 + 数据库」，不需要对象存储与 AI，因此不引入第三方密钥。
3. 确认运行状态 `FuncSea db_mode=single`，据此采用单库单表空间策略。
4. 确定认证复用平台 OIDC，禁止另建 `admins` 表或自定义 JWT 登录。

### 产出物
- 技术选型结论：FastAPI + SQLAlchemy 2.0（AsyncSession）+ PostgreSQL，前端 Vite + React 18 + Tailwind + shadcn/ui。

### 验收标准
选型不引入任何非必要第三方服务；账户能力完全复用平台认证。

---

## 四、S2 模板装配与资源初始化

### 目标
用最短路径拿到可运行的「前端 + 后端 + 认证」骨架。

### 具体执行计划
1. 读取 FuncSea 技能的初始化流程与资源说明，确认必须先查询状态再装配模板。
2. 调用 `funcsea:status`，返回 `UNINITIALIZED`，缺失 `DATABASE_URL`、`OIDC_*`、`OSS_*`、`JWT_SECRET_KEY`。
3. 在项目根目录执行模板装配脚本：
   `python .atoms/skills/funcsea-backend/scripts/init_template.py --workspace "$PWD" --mode full`
   返回 `{"status":"initialized","template_version":"source-ed1c844b46e7"}`。
4. 调用 `funcsea:initialize` 创建数据库、OIDC 与存储资源，返回 `{"state":"READY","created":true}`。
5. 阅读 `app/backend/README.md` 与前端模板说明，确认目录职责：业务代码写 `routers/`、`services/`、`schemas/`；`core/`、`main.py` 为受保护文件。
6. 阅读 Web SDK 参考，锁定前端调用契约：`client.auth.*`、`client.entities.*`、`client.apiCall.invoke`，禁止用 `fetch`/`axios` 直连 `/api/v1`。

### 产出物
- 可运行的 `app/frontend` 与 `app/backend`
- 平台托管的认证回调页 `/auth/callback`（模板管理，未修改）

### 问题与处理
模板自带的认证文件（`src/lib/auth.ts`、`src/contexts/AuthContext.tsx`、`src/pages/AuthCallback.tsx`）属于模板管理资产，全程只读复用，业务逻辑另建上下文。

---

## 五、S3 数据模型设计

### 目标
用两张表同时支撑「身份」与「成绩」，且不触碰平台受保护表。

### 具体执行计划
1. 调用 `funcsea:get_table_names`，确认库中仅有 `alembic_version`、`oidc_states`、`users`，业务表为空，不存在覆盖风险。
2. 设计 `game_players`（身份表）：`player_key` 唯一、`display_name`、`is_guest`。
3. 设计 `game_scores`（成绩表）：`player_key`、`display_name`（冗余便于排名展示）、`score`、`best_tile`、`moves`、`duration_seconds`、`is_guest`。
4. 两张表均使用 `create_only: false`：排行榜需要跨用户全局读取，不能用按用户隔离的模式。
5. 主键统一整数自增；时间戳由框架托管，插入时省略。
6. 调用 `funcsea:create_tables` 提交扁平 JSON Schema，返回生成文件清单与迁移 `43dc4dfbeb77_auto_update.py`，`migration_applied: true`。

### 产出物
- ORM：`models/game_players.py`、`models/game_scores.py`
- 服务层：`services/game_players.py`、`services/game_scores.py`
- 生成路由：`routers/game_players.py`、`routers/game_scores.py`

### 验收标准
表结构可反射；生成的模型与服务不手工改写；`users` 表未被触碰。

---

## 六、S4 后端业务接口

### 目标
提供身份同步、成绩提交、改名、排行榜、历史五条业务接口，并保证越权不可写入。

### 具体执行计划
1. 新建 `app/backend/routers/game.py`，前缀 `/api/v1/game`，由 `main.py` 自动发现注册。
2. 实现可选鉴权解析 `get_optional_user`：读取 `Authorization: Bearer`，用平台 `decode_access_token` 校验；无 token 或 token 失效时按游客处理，不返回 401，保证游客可玩。
3. 实现身份归一 `_resolve_identity`：登录用户一律以 token 的 `sub` 作为 `player_key`，忽略前端传值；游客 key 强制 `guest_` 前缀，否则 400。
4. 实现 `POST /sync`：玩家行幂等 upsert，返回个人统计（局数、最高分、最高瓦片、总步数、最近时间）。
5. 实现 `POST /scores`：校验 `best_tile` 为 2 的幂、分值区间上限，写入成绩后回写统计。
6. 实现 `POST /rename`：更新身份昵称，并用批量 update 同步该玩家历史成绩的展示名。
7. 实现 `GET /leaderboard`：取最近 400 条成绩后按玩家去重取单局最高分，输出名次。
8. 实现 `GET /history`：按身份倒序返回最近对局。
9. 用 `mgx-pycheck routers/game.py` 做语法与静态检查，返回 `{"status":"ok"}`。

### 产出物
- `app/backend/routers/game.py`
- 接口契约：`sync` / `scores` / `rename` / `leaderboard` / `history`

### 关键决策
以 token 为准的身份归一，使「登录后成绩归属账户」成为服务端强制事实，而非前端承诺。

---

## 七、S5 游戏核心引擎

### 目标
用无副作用的纯函数实现 2048 规则，使界面只负责表现与输入。

### 具体执行计划
1. 定义 `Tile`（稳定 `id`、值、行列、新生成/刚合并标记）与 `GameState`（瓦片、分数、步数、状态）。
2. 实现 `slide`：按方向确定遍历顺序，逐格找最远空位；遇到同值且未合并的相邻瓦片则合并、翻倍、计入得分，并标记吸收。
3. 处理「单次移动每块只合并一次」：用 `mergedIds` 屏蔽已被吸收的目标，防止连锁翻倍。
4. 保留瓦片身份而非重建数组，使 DOM 能用 `left/top` 过渡表现滑动。
5. 实现 `spawnTile`：在空格中随机落位，90% 生成 2、10% 生成 4。
6. 实现 `hasMoves`：存在空格或存在相邻同值即视为仍可行动。
7. 实现 `playMove`：无位移则不生成新瓦片；有位移则加分、加步、生成新瓦片，并判定 `won`（出现 2048）或 `lost`。
8. 实现 `keepPlaying`：胜利后继续时重新评估是否还有可用移动。
9. 实现 `tileTone`：按数值分档映射到 CSS 类，供视觉层复用。

### 产出物
- `app/frontend/src/lib/game2048.ts`

### 验收标准
连续同值 4 块向左移动只产生一次合并；无效方向不增加步数；填满且无同值临格时判负。

---

## 八、S6 视觉方向与参考稿

### 目标
先定视觉语言再写界面，避免落入通用模板观感。

### 具体执行计划
1. 阅读图像生成技能规范，按首页参考流程生成一张桌面首屏参考稿。
2. 首次生成因请求缺少 `filename` 字段被校验拒绝，读到 Pydantic 报错后补齐字段重试。
3. 生成成功：`homepage-reference.png`，1536×1024，暖米白底、焦糖棋盘、赤陶瓦片梯度、超大压缩标题、右侧三张卡片。
4. 由于当前模型不支持读图，改用图像理解技能做结构化分析，得到版式比例（左 62% 棋盘、右 38% 卡片栏）、配色估算与字体气质。
5. 将结论写入 `DESIGN.md`：方向与版式、Tokens（色板、字体、间距与圆角）、共享模式与状态、媒体策略。
6. 因需求为中文，界面文案整体改为中文，并把展示字体调整为 `Anton + ZCOOL QingKe HuangYou`，正文改为 `Noto Sans SC`，同时记录该视觉例外。

### 产出物
- `app/frontend/image_manifest.json` + `assets/images/homepage-reference.png`
- `DESIGN.md`

### 验收标准
首屏版式、配色、字体与参考稿一致；无蓝紫渐变、无玻璃拟态、无发光描边。

---

## 九、S7 前端界面实现

### 目标
把设计规范变成真实组件，保证首屏即完整可玩。

### 具体执行计划
1. 重写 `src/index.css`：引入字体、设定语义 CSS 变量、定义纸张肌理、胶囊按钮、棋盘与 12 档瓦片配色、瓦片动画与动效降级。
2. 实现 `GameBoard`：16 个空槽 + 绝对定位瓦片层；`ResizeObserver` 按棋盘宽度计算数字字号，保证 4 位数不溢出；指针按下/抬起推导滑动方向（阈值 24px）。
3. 实现 `ScoreCard`：本局得分与历史最佳分列，显示步数与目标，分数区 `aria-live="polite"`。
4. 实现 `IdentityCard`：首字母头像、昵称、游客设备尾号或邮箱、登录/退出与改名入口，附改名弹窗。
5. 实现 `LeaderboardCard`：加载骨架、错误重试、空状态引导、行内高亮「你」。
6. 实现 `Index` 主页：标题层级、胶囊按钮组、棋盘、异步侧栏、底部三栏规则说明。
7. 实现 `AccountPage`：身份信息、五项统计、登录/退出/改名/重置游客身份、最近对局列表与刷新。
8. 在 `App.tsx` 挂载 `PlayerProvider` 与 `/account` 路由，保留模板既有路由。

### 产出物
- `GameBoard.tsx`、`ScoreCard.tsx`、`IdentityCard.tsx`、`LeaderboardCard.tsx`、`Index.tsx`、`AccountPage.tsx`

### 验收标准
桌面为 62/38 双栏，平板与手机降为单列；所有交互按钮可达且有焦点环；首屏无依赖滚动的隐藏内容。

---

## 十、S8 身份体系落地

### 目标
让「游客默认身份」与「账户管理」在同一数据模型下并存。

### 具体执行计划
1. 实现设备指纹：拼接 UA、语言列表、平台、硬件并发、触点数、屏幕尺寸与色深、像素比、时区，做 FNV-1a 哈希取 8 位十六进制。
2. 指纹持久化到 `localStorage` 的 `tileclub.guest.key`，键名前缀 `guest_`；昵称默认 `Guest <尾号>`，可改名并单独持久化。
3. 新建 `PlayerContext` 作为身份与成绩的单一数据源：整合 `AuthContext` 的登录用户，登录态优先，否则用游客身份。
4. 首屏同步：`authLoading` 结束后调用 `sync`，写入档案与统计；失败不清空游戏，仅提示排行榜暂不可用。
5. 本地兜底：最高分按身份键写入 `localStorage`，弱网或接口失败时最佳分不丢。
6. 成绩提交：仅在判定 `lost` 时提交一次（`submittedRef` 防重复），提交后自增刷新键触发排行榜重载。
7. 账户切换：登录/退出后身份键变化，上下文自动重新同步；游客可重置身份获得全新档案。
8. 修正 SDK 调用契约：确认 `apiCall.invoke` 不支持独立 `params` 字段，改为把查询串拼进 `url`。

### 产出物
- `src/contexts/PlayerContext.tsx`、`src/lib/gameApi.ts`

### 验收标准
同一浏览器刷新后游客身份不变；登录后新成绩写入用户 ID 名下；退出后回到原游客档案。

---

## 十一、S9 工程校验

### 目标
用可重复的命令证明代码可编译、可构建、无静态错误。

### 具体执行计划
1. 前端安装依赖（`pnpm install`），补齐 FuncSea 模板要求的 SDK。
2. 读取 SDK 类型声明，确认 `ApiCallParams` 结构与 `invoke` 返回形态，避免类型误用。
3. 执行 `pnpm exec tsc -p tsconfig.app.json --noEmit`，退出码 0。
4. 执行 `pnpm run lint`，无输出即通过。
5. 执行 `pnpm run build`，1820 模块转换成功，产物正常。
6. 后端执行 `mgx-pycheck routers/game.py`，返回 `{"status":"ok"}`。

### 产出物
- 通过的类型检查、lint 与生产构建

### 问题与处理
修复过程中发现 `LeaderboardCard` 使用了未定义的刷新字段，先在上下文中正式补上 `refreshKey` 并接入改名与提交路径，再复跑校验，避免类型断言掩盖问题。

---

## 十二、S10 预览与渲染检查

### 目标
确认实际渲染与设计一致，而不是只看代码。

### 具体执行计划
1. 用预览器启动 `app` 根目录（一次启动前后端），确认 URL 就绪。
2. 提交渲染检查，描述首屏要素：棋盘、得分/身份/排行榜卡片、中文标题与胶囊按钮、米白纸张底、无蓝紫渐变。
3. 检查结论：整体层级与配色达标，渲染评分 4；唯一瑕疵为主标题末字「上」单独换行。
4. 修复：将标题拆成两个 `block + whitespace-nowrap` 行，并适当下调桌面字号，保证两行稳定断行。
5. 复跑 lint 与 build，确认改动无回归。

### 产出物
- 稳定的首屏标题断行与通过的构建结果

### 验收标准
首屏焦点为棋盘；信息层级清晰；无文字孤行。

---

## 十三、S11 代码托管

### 目标
把代码交付到指定 GitHub 账户，并保证可复现。

### 具体执行计划
1. 读取平台托管说明，确认工作区 Git 配置目录为只读挂载（`/run/gitdata/workspace`）。
2. 校验 GitHub 令牌身份：调用 `/user` 返回 `login: liubaikang`，权限满足。
3. 查询该账户仓库列表，确认无同名仓库，避免误覆盖。
4. 通过 API 创建仓库 `liubaikang/tile-club-2048`（public，默认分支 main），返回 201。
5. 发现工作区 `git add` 因索引只读失败，改用可写临时目录承载副本：`tar` 打包并排除 `.git`、`node_modules`、`dist`、`__pycache__`、日志与技能目录，得到 3.3MB / 217 文件。
6. 在临时目录 `git init -b main` 并提交首个版本，用令牌经 HTTPS 推送到远端。
7. 通过 API 校验远端提交与关键文件（`DESIGN.md`、`Index.tsx`、`routers/game.py`、`game2048.ts`）均返回 200。
8. 同步上下文文档与新增 `README.md` 到仓库，形成三次提交。

### 产出物
- 仓库 https://github.com/liubaikang/tile-club-2048
- 提交记录：`d697224`（源码）→ `02e37f7`（上下文）→ `0f813b2`（README）

### 问题与处理
不写入远端地址到只读 Git 配置，避免配置锁失败；所有推送使用一次性 URL 凭据，不落盘。

---

## 十四、S12 线上联调与数据清理

### 目标
验证线上路径真实可用，并保证交付环境干净。

### 具体执行计划
1. 请求预览域名根路径，返回 200，确认前端可达。
2. 通过同一域名调用后端 `/api/v1/game/leaderboard`，返回 200，确认网关转发正常（无需直连内部端口）。
3. 模拟真实链路：`POST /sync` 建立游客 `guest_smoke1234` → `POST /scores` 写入 1024 分 → `GET /leaderboard` 返回该玩家第 1 名。
4. 发现联调数据会污染展示，查询 `/history` 定位记录 id=1。
5. 调用 `DELETE /api/v1/entities/game_scores/1` 清除，复查排行榜回到空列表。
6. 记录线上联调结论到项目上下文。

### 产出物
- 线上接口验证结论（身份同步、成绩提交、排名聚合均 200）
- 干净的初始排行榜

### 验收标准
线上读写闭环成立；交付时无测试残留数据。

---

## 十五、S13 交付与后续计划

### 交付清单
1. 可运行应用：预览环境已启动，前端与后端同域可达。
2. 源码仓库：`liubaikang/tile-club-2048`，含 README、设计规范与上下文文档。
3. 设计规范：`DESIGN.md`（版式、色板、字体、组件状态、动效与无障碍）。
4. 架构说明：前后端职责、身份模型、数据契约、校验方式。

### 正式对外域名
应用已在平台预览环境可访问。如需固定对外域名，需在预览界面右上角执行发布并确认可编辑链接；该确认动作属于账号侧操作，需由仓库所有者完成。

### 后续可演进方向
1. 账号合并：游客登录后把历史游客成绩并入账户（需新增一次性迁移接口与确认 UI）。
2. 排行榜筛选：按周/月/全部切换，需要给成绩表补时间维度索引。
3. 可访问性增强：为棋盘提供逐格文本摘要模式，便于读屏完整播报。
4. 离线可玩：引入 Service Worker 缓存资源，断网时本地继续游玩并在恢复后补传成绩。
5. 视觉延展：按达成 512/1024/2048 触发限定配色主题，复用现有瓦片分档机制。

---

## 十六、经验沉淀

1. 先定能力边界再写代码：明确「认证复用平台」后，整个账户体系只需两处接入，避免了自建账号的返工。
2. 纯函数内核让游戏逻辑可独立推演：滑行与合并的边界（单次只合并一次、无效移动不生成新瓦片）在引擎层一次说清，UI 只做表现。
3. 契约先行减少联调成本：`player_key/display_name/is_guest` 与统计字段在前后端同名同义，线上一次联调即通过。
4. 只读环境要做路径设计：当 Git 索引不可写时，用可写副本推送而不是强行改权限，交付更快也更安全。
5. 联调数据必须清理：任何用于验证的写入都要能定位并删除，否则会污染用户看到的第一印象。