# 500Hours 网站开发进度与状态

更新时间：2026-08-18

## 一句话结论

500Hours 当前是一个已经可以使用和验收的在线语言学习有效时间累计器：英语与日语独立分账，学习记录和里程碑状态保存于 Supabase，网站部署在 Vercel，生产站点和本地版本均已完成核心流程验证。

生产站点：[https://500-hours-delta.vercel.app/](https://500-hours-delta.vercel.app/)

GitHub 仓库：[https://github.com/leighzhixin/500Hours](https://github.com/leighzhixin/500Hours)

## 当前版本

- Git 分支：`main`
- 最新提交：`71bd58e Normalize study entry RLS policies`
- 远端状态：`origin/main` 与本地一致
- 工作区：干净，无未提交改动
- 部署方式：GitHub `main` 推送后由现有 Vercel 项目自动部署
- 技术栈：静态 HTML / CSS / JavaScript + Supabase Auth / Postgres
- 运行方式：必须联网；没有离线待同步队列

## 已完成的产品功能

### 语言目标与分账

- 英语目标：500 小时。
- 日语目标：800 小时。
- 英语和日语使用独立记录、统计、进度、热力图、里程碑和记录列表。
- 一种语言的入账不会改变另一种语言的剩余时间。

### UI 与交互

- 已采用 A 方案“静谧专注”视觉方向：绿色单色系、留白、低压力文案、主目标突出。
- 中文为默认界面语言。
- 支持英语 / 日语页签点击、键盘方向键切换。
- 支持桌面端和手机端，无页面级横向溢出。
- 首屏顺序为语言切换、剩余小时、进度和快速入账。

### 入账与记录

- 日期、训练项目、分钟数入账。
- 支持 15 / 30 / 45 / 60 分钟快捷按钮。
- 支持 Enter 提交。
- 分钟数限制为 1–600 的整数。
- 拒绝空值、0、负数、小数、超大值、未来日期和非法日期。
- 支持单条删除和清空云端数据（二次确认）。

英语训练项目：精听、泛听、阅读、复述、Anki。

日语训练项目：影视精听、台词跟读、复述、泛听。

### 统计与复盘

- 累计学习分钟和小时。
- 剩余小时与完成百分比，百分比封顶 100%。
- 学习天数、学习日日均、当前连续天数。
- 使用最近 28 个自然日实际投入估算 ETA；排除未来日期和窗口外记录。
- 累计时间构成：长期项目占比。
- 每日训练节奏：最近 7 / 14 / 30 天的按项目堆叠图。
- 当月绿色学习热力图：颜色随每日分钟数加深，并显示具体分钟数。
- 本月复盘：总时长、学习天数、学习日日均、投入最多项目及上月中性对比。

### 里程碑

- 英语里程碑：100 / 200 / 300 / 400 / 500 小时。
- 日语里程碑：200 / 400 / 600 / 800 小时。
- 到达小时节点后显示“待验收”。
- 用户完成真实能力测试后，可手动标记“验收通过”。
- 验收状态保存于 Supabase，可刷新保留，也可取消。

### 账号与数据管理

- Supabase Auth 注册、登录、退出。
- 忘记密码邮件流程。
- 登录后修改密码，要求新密码至少 8 位。
- 最近记录按月份和训练项目筛选。
- 导出 JSON 备份：学习记录 + 里程碑状态。
- 导出 CSV：便于表格查看学习记录。
- 首次登录兼容旧版 `en500h_v1` 与 `lang_countdown_v2` 本地数据，并通过账号标记避免重复迁移。

## 数据与安全状态

### 数据模型

`study_entries` 主要字段：

- `id`：唯一 UUID。
- `user_id`：关联 Supabase Auth 用户。
- `client_ref`：用于幂等迁移和重复保护。
- `study_date`：用户本地学习日期。
- `language`：`en` 或 `ja`。
- `activity`：训练项目。
- `minutes`：1–600 的正整数。
- `created_at` / `updated_at`：时间戳。

`milestone_checks` 主要字段：

- `user_id`
- `language`
- `milestone_hours`
- `verified_at`
- 主键为 `(user_id, language, milestone_hours)`，避免重复验收记录。

### RLS 与 migration

当前 migration 文件：

- `supabase/migrations/20260808_create_study_entries.sql`
- `supabase/migrations/20260809_create_milestone_checks.sql`
- `supabase/migrations/20260809_normalize_study_entries_rls.sql`

两张表均满足：

- 已启用 Row Level Security。
- 读取、写入、更新、删除策略均限定为 `authenticated`。
- 行级条件限定 `auth.uid() = user_id`。
- 匿名角色无表权限。
- `study_entries` 和 `milestone_checks` 均授予 authenticated 角色所需的最小 CRUD 权限。

最后一次端到端验证结果：

- 匿名 REST 读取两张表：`401`。
- 匿名写入：`401`。
- 登录用户伪造其他 `user_id` 写入：被 `42501` 拒绝。
- `minutes = 601`：被数据库约束 `23514` 拒绝。
- `milestone_hours = 0`：被数据库约束 `23514` 拒绝。
- 登录用户只能读取自己的记录。

### 已发现并修复的问题

验证时发现线上 `study_entries` 曾保留早期控制台创建的旧策略名称，且匿名角色仍有 SELECT 表权限。RLS 当时仍返回空结果，没有产生数据泄露，但会造成：

1. 重跑 migration 时可能产生重复策略。
2. 两张表的匿名访问行为不一致。

已新增并执行 `20260809_normalize_study_entries_rls.sql`：

- 删除旧策略名称和仓库策略名称。
- 重新创建规范化的 4 条 study entry 策略。
- 撤销 anon 权限。
- 重新授予 authenticated 最小 CRUD 权限。

## 已完成的验证

使用临时测试账号完成了本地和生产站的完整流程：

1. 前端注册。
2. Supabase 后台确认测试账号。
3. 本地登录。
4. 英语入账。
5. 日语入账。
6. 刷新后检查云端持久化。
7. 月份 / 项目筛选。
8. JSON / CSV 实际下载并检查文件内容。
9. 单条删除并刷新复核。
10. 累计到英语 100 小时节点。
11. 里程碑标记、刷新保留、取消。
12. 生产站登录并确认跨站同步。
13. 生产站再次入账、刷新、筛选、导出、删除和取消验收。
14. 本地和生产退出登录。
15. 删除临时测试账号，并由外键级联清理测试数据。

测试账号、测试学习记录、测试里程碑状态和临时导出文件均已清理，没有污染正式账号。

## 自动化测试

在项目目录运行：

```bash
node --check domain.js
node --check app.js
node tests/domain.test.js
node tests/migrations.test.js
git diff --check
```

当前结果：全部通过。

- `tests/domain.test.js`：日期、分账、ETA、连续天数、热力等级、每日序列、月度复盘等纯计算。
- `tests/migrations.test.js`：RLS、authenticated 策略、匿名权限撤销、旧策略规范化等静态 migration 约束。

## 可回档版本

修改前备份仍保留在远端：

- `codex/backup-before-ui-a-20260809` → `65d9ca7`
- `codex/backup-before-heatmap-20260809` → `8d138b3`

如需回看当前主版本之前的 UI 或 Supabase 账号版本，可从对应分支恢复。正式回档前应先确认是否需要同时回退数据库 migration。

## 当前尚未实现或可继续优化

这些内容不是当前 MVP 的阻塞项：

- PWA 安装和离线使用。
- 数据导入（目前只有导出）。
- 每周复盘和历史快照。
- Anki 导出或词卡管理。
- 音频、transcript 和精听标注工具。
- 真人或 AI 口语练习反馈。
- 更完整的 CI 浏览器自动化，而不是目前的 Node 纯计算测试 + ego-lite 端到端验收。

## 重要安全说明

- 仓库只包含 Supabase 项目 URL 和 publishable key。
- 不应把数据库密码、service-role key、secret key、access token 或个人学习记录提交到 Git。
- 网站当前是 online-only：没有网络时不会建立本地待同步队列，也不会假装入账成功。
- 任何修改数据库结构或 RLS 的工作，都应同时更新 migration、回归测试和本状态文档。
