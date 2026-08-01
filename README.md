# 传思宇宙观察局

Trance Weekend 的 Trance 领域资讯雷达 MVP。项目聚合公开资讯链接，通过后台抓取和 AI 分析生成短摘要、标签、评分与「传思味儿点评」，所有内容都必须人工审核后才会发布。

## 本地启动

```bash
npm install
npm run prisma:generate
npm run db:push
npm run db:seed
npm run dev
```

默认地址是 [http://localhost:3000](http://localhost:3000)。如果 3000 被另一个项目占用，可以改用：

```bash
npm run dev -- -p 3001
```

## 常用命令

```bash
npm run lint
npm run build
npm run db:push
npm run db:push:prod
npm run db:seed
```

## 环境变量

本地开发可以只配置 `DATABASE_URL` 和可选的 AI key。没有配置 AI key 时会使用本地启发式兜底。没有配置管理员变量时，开发环境默认口令是 `admin`。

上线前请配置：

```bash
DATABASE_URL="postgresql://..."
AI_PROVIDER="deepseek"
AI_API_KEY="..."
AI_BASE_URL="https://api.deepseek.com"
AI_MODEL="deepseek-v4-flash"
ADMIN_PASSWORD="your-admin-password"
ADMIN_COOKIE_SECRET="a-long-random-secret"
CRON_SECRET="a-long-random-cron-secret"
AUTO_DRAFT_LIMIT="20"
AUTO_DRAFT_MIN_CANDIDATES="10"
AUTO_DRAFT_RETENTION_DAYS="7"
AUTO_DRAFT_MAX_SOURCE_AGE_DAYS="7"
INSTAGRAM_ACCESS_TOKEN=""
INSTAGRAM_USER_ID=""
INSTAGRAM_GRAPH_API_VERSION="v21.0"
```

`AI_PROVIDER` 推荐用 `deepseek` 做资讯翻译、摘要和标签，性价比较高；也可以设为 `openai`。`AI_API_KEY` 是通用 key；旧的 `OPENAI_API_KEY` 仍兼容。`ADMIN_PASSWORD` 用于后台登录，`ADMIN_COOKIE_SECRET` 用于签名 httpOnly cookie，`CRON_SECRET` 用于保护定时任务接口。`AUTO_DRAFT_LIMIT` 控制每日候选上限，默认 20；`AUTO_DRAFT_MIN_CANDIDATES` 是每日候选目标，默认 10。`AUTO_DRAFT_RETENTION_DAYS` 可选，默认 7，超过天数仍未发布的草稿会自动移出候选池。`AUTO_DRAFT_MAX_SOURCE_AGE_DAYS` 可选，默认 7，超过该时效窗口的来源文章会被判定为旧闻并拒绝进入候选；已发布文章不受这个窗口影响。口碑厂牌与趣闻雷达只改变题材优先级，不放宽 7 天时效。Instagram radar 需要官方 Graph API token；未配置时会跳过，不影响其它来源。

## 后台流程

1. 投稿页 `/submit` 接收公开 URL，重复 URL 不会重复进入队列。
2. 访问 `/admin` 会先进入 `/admin/login`，登录后才能操作后台和 `/api/admin/*`。
3. 后台 `/admin` 的“投稿队列”查看 `PENDING`、`ANALYZED`、`PUBLISHED`。
4. pending 投稿可以单条“抓取并分析”，也可以勾选后批量分析。
5. 分析结果只进入草稿，管理员编辑摘要、分类、标签、评分和点评后手动发布。
6. 发布前必须保留来源链接；前台只展示摘要和原文入口，不全文转载。
7. 前台展示和默认排序使用新闻源原文时间；本站发布时间只作为后台运营记录。
8. 已发布内容可以在后台“已发布”队列下线，下线后文章移出前台但保留记录，并回到可编辑候选状态。

## 内容源雷达

后台 `/admin?tab=sources` 可以维护 RSS/Atom 来源：

- 添加来源名称、主页 URL、RSS/Atom URL。
- 启用或停用来源。
- 单独扫描某个来源，或扫描全部启用来源。
- 扫描只会把新链接放入 pending 队列，不会自动抓取正文、AI 分析或发布。
- 来源卡片会展示上次扫描、新增数量、成功/失败消息。
- 除 RSS/Atom 外，也支持指定 HTML、泛 EDM RSS、YouTube 频道 RSS 和 Instagram hashtag radar。
- 无扫描入口 URL 的来源不会参与自动扫描，可作为待补充/观察名单保留。

内置建议来源：

- TranceFix：论坛 RSS，`https://www.trancefix.nl/forums/-/index.rss?order=post_date`。
- Resident Advisor Trance News：扫描 `https://ra.co/news?genres=trance`。
- Beatportal：扫描 `https://www.beatportal.com/`，只保留 Trance/大牌/厂牌相关的文章链接。
- 泛 EDM Radar：EDMTunes、EDM Life、Dancing Astronaut 等会先按 Trance / Anjuna / ASOT / Dreamstate / Armada / Black Hole / FSOE / Enhanced / 关键艺人词过滤。
- 厂牌/节目源：Pure Trance、A State of Trance、Enhanced Music 等能提供 RSS 的来源可直接扫描；口碑厂牌雷达会优先收厂牌新章节、艺人专题、幕后故事与周年内容，不把普通发歌当新闻。
- 趣闻雷达：We Rave You、MusicTech、Electronic Groove 等补充争议回应、现场文化、制作人故事、合成器/制作工具逸闻与社区话题，仍需人工审核发布。
- YouTube 频道 RSS：需要真实 `channel_id`，格式是 `https://www.youtube.com/feeds/videos.xml?channel_id=...`；当前默认停用未验证频道，避免扫描全部超时。
- Instagram hashtag radar：仅走官方 Graph API hashtag recent media，结果只进 pending 线索，不自动发布；不做网页抓取和模拟登录。

Beatport 主站发行页当前会对服务端抓取返回 403，本项目不绕过限制；如需抓 Beatport releases/charts，后续应接官方 API。

## 无人值守草稿模式

推荐使用“自动候选草稿，不自动发布”：

1. 在后台 `/admin?tab=sources` 添加并启用 RSS/Atom 来源。
2. 配置 AI key，推荐 `AI_PROVIDER=deepseek` + `AI_MODEL=deepseek-v4-flash`；否则会使用本地启发式兜底生成较粗略的摘要和评分。
3. 配置 `CRON_SECRET`，部署到 Vercel 后由 `vercel.json` 每天触发一次。
4. 自动任务会扫描来源、抓取网页、AI 分析，以 `AUTO_DRAFT_MIN_CANDIDATES` 条为每日目标、`AUTO_DRAFT_LIMIT` 条为上限生成资讯 + 趣闻候选草稿，默认目标 10 条、上限 20 条。
5. 自动任务会跳过 weekly mix、mixtape、歌单、榜单、普通周更、普通单曲、普通 remix、EP preview、普通发布和普通官宣等低新闻性内容；泛 EDM 和社交源还必须命中 Trance 相关词，优先保留争议、反转、取消、复出、改名、重启、关闭、社区热议、现场事故、厂牌变化、重大现场和大牌公开表态等更有事件性/趣味性的内容。
6. 草稿会进入后台“已分析”队列，仍需管理员编辑后手动发布；建议每天从候选池里精选 3 条发布。
7. 超过 `AUTO_DRAFT_RETENTION_DAYS` 天仍未发布的草稿会在下一次自动任务中归档，并从候选池移走；已发布内容不受影响。
8. 原文发布时间超过 `AUTO_DRAFT_MAX_SOURCE_AGE_DAYS`，或标题 / URL 明显指向早于当前年份的旧事件，会被自动拒绝，避免旧闻混入每日候选；口碑厂牌和趣闻雷达同样遵守这条时效规则。没有发布时间的内容会降低优先级，并在抓取分析时复核。
9. `AUTO_DRAFT_LIMIT=20` 是候选上限，不是硬性凑满；如果当天没有足够有戏的新内容，候选少于 20 属于正常质量控制。TranceFix 这类社区源默认作为线索雷达，普通发歌帖不会自动进入候选池。
10. 自动清理只影响未发布草稿；已发布内容不会因为 7 天抓取窗口被下线或归档。

自动草稿接口：

```bash
GET /api/cron/auto-draft
Authorization: Bearer $CRON_SECRET
```

本地测试：

```bash
curl "http://localhost:3001/api/cron/auto-draft?secret=$CRON_SECRET"
```

仓库包含 `vercel.json`，默认每天 UTC 01:00 触发一次自动草稿任务，约等于北京时间上午 9 点。自动任务不会发布文章，前台仍只展示 `PUBLISHED` 内容。

## Vercel 部署

生产环境使用 PostgreSQL，不要把本地 SQLite 文件部署到 Vercel。

1. 将仓库推送到私有 GitHub 仓库，并在 Vercel 导入该仓库。
2. 在 Vercel 的 Production 环境变量中填写 `DATABASE_URL`、`DIRECT_URL`、`AI_PROVIDER`、`AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`、`ADMIN_PASSWORD`、`ADMIN_COOKIE_SECRET`、`CRON_SECRET`、`AUTO_DRAFT_LIMIT=20`、`AUTO_DRAFT_MIN_CANDIDATES=10`、`AUTO_DRAFT_RETENTION_DAYS=7` 和 `AUTO_DRAFT_MAX_SOURCE_AGE_DAYS=7`。
3. `DATABASE_URL` 使用 Supavisor transaction pooler（`6543`，运行期访问）；`DIRECT_URL` 使用 session pooler（`5432`，供 Prisma 同步 schema）。Vercel 会使用 `npm run build:vercel`，在构建时同步空 Supabase 数据库表结构、生成 PostgreSQL Prisma Client、幂等写入默认内容源，再构建 Next.js。应用早期采用 `db push` 保持上线步骤轻量；后续引入正式 migration 后再切换为 `prisma migrate deploy`。
4. `vercel.json` 会每天 UTC 01:00（北京时间约 09:00）调用自动草稿任务。任务只生成候选草稿，绝不自动发布。
   自动草稿路由配置为 60 秒，来源扫描并发执行，以适配 Vercel Hobby 的函数时限；分析仍逐条进行，避免对来源和 AI 服务造成突发压力。

首次上线可手动调用一次 14 天补抓，随后所有日常任务仍使用默认 7 天窗口：

```bash
curl "https://YOUR_PROJECT.vercel.app/api/cron/auto-draft?bootstrapDays=14&secret=$CRON_SECRET"
```

`bootstrapDays` 只允许 8 到 14，且仅在本次请求中生效；不带该参数的 Vercel Cron 永远遵守 `AUTO_DRAFT_MAX_SOURCE_AGE_DAYS=7`。

## 定时扫描

定时扫描接口：

```bash
GET /api/cron/scan-sources
Authorization: Bearer $CRON_SECRET
```

也可以本地测试：

```bash
curl "http://localhost:3001/api/cron/scan-sources?secret=$CRON_SECRET"
```

这个接口只扫描来源并创建 pending 投稿，不会抓取正文、AI 分析或发布。它保留为手动排查和备用任务。

## Supabase / PostgreSQL

本地 MVP 继续使用 `prisma/schema.prisma` 的 SQLite 配置。生产环境使用 `prisma/schema.postgres.prisma`：

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/postgres?sslmode=require"
npm run prisma:generate:prod
npm run db:push:prod
```

在 Supabase 项目中复制连接串到生产环境变量即可。首次上线建议先在空库执行 `npm run db:push:prod`，确认表结构创建成功后再部署。

## AI 分析

没有 AI key 时会使用本地启发式兜底，保证本地 MVP 可运行。有 key 时会通过 OpenAI-compatible 接口生成中文转译标题、中文短摘要、完整摘要、标签、分类、三维评分、评分解释和简短点评。

推荐便宜配置：

```bash
AI_PROVIDER="deepseek"
AI_API_KEY="sk-..."
AI_BASE_URL="https://api.deepseek.com"
AI_MODEL="deepseek-v4-flash"
```

OpenAI 配置：

```bash
AI_PROVIDER="openai"
AI_API_KEY="sk-..."
AI_MODEL="gpt-4o-mini"
```
