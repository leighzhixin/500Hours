# Supabase 灾难恢复手册

本项目的网页源码、数据库结构和恢复步骤都保存在 Git 仓库中。即使免费版 Supabase 项目被暂停或删除，也可以重建同样的产品结构和账号隔离规则。

## 日常备份

1. 登录网站，在任一语言页底部点击“导出 JSON”。
2. 将下载的 `500hours-YYYY-MM-DD-backup.json` 保存到个人云盘或其他安全位置。
3. JSON 包含当前账号已加载的学习记录和里程碑验收状态，不包含密码、登录令牌、数据库密钥或迁移标记。
4. CSV 只适合查看，不用于完整恢复。

建议每月或完成一批重要学习记录后导出一次 JSON。不要把包含个人学习数据的 JSON 提交到 Git。

## 项目被暂停时

先在 Supabase Dashboard 恢复原项目。只要项目仍可恢复，就不需要新建项目或迁移数据，网站连接信息通常也无需变化。

## 项目被删除时

1. 在原组织创建一个 Free 项目，区域选择 `ap-southeast-1`。
2. 按文件名顺序执行 `supabase/migrations/` 中的全部 SQL migration。
3. 确认 `study_entries` 和 `milestone_checks` 都启用了 RLS，且各有 SELECT、INSERT、UPDATE、DELETE 四条仅限 `authenticated` 且满足 `auth.uid() = user_id` 的策略。
4. 在 Authentication → URL Configuration 中设置：
   - Site URL：`https://500-hours-delta.vercel.app`
   - Redirect URLs：`https://500-hours-delta.vercel.app/**`、`http://localhost:4173/**`
5. 从项目 Connect 页面复制 Project URL 和启用中的 publishable key，替换 `app.js` 顶部的 `SUPABASE_URL` 与 `SUPABASE_PUBLISHABLE_KEY`。前端禁止使用 secret 或 service-role key。
6. 运行仓库测试，提交并推送 `main`，等待 Vercel 自动部署。
7. 在新项目中用原邮箱重新注册账号并完成邮箱确认。Supabase Auth 密码和旧用户 ID 不包含在数据备份中，不能从 JSON 恢复。
8. 登录网站，点击“导入 JSON”选择最近的备份。导入采用合并策略：同一备份可重复导入，不会重复创建学习记录；相同语言和小时节点的里程碑状态会更新为备份值。

## 验证命令

```bash
node --check domain.js
node --check app.js
node tests/domain.test.js
node tests/migrations.test.js
git diff --check
```

另外要在真实浏览器验证“注册/登录 → 导入 JSON → 刷新 → 英语/日语数据核对 → 新增并删除一条记录 → 导出 JSON → 退出”。

## 当前重建记录

- 重建日期：2026-09-05
- 项目名称：`500Hours`
- 项目 ref：`lqjjzcuptepzfbeuegba`
- 区域：`ap-southeast-1`
- 费用：Free，0 美元/月

项目 URL 和 publishable key 已同步到 `app.js`。如再次重建，项目 ref 和公开连接信息会改变，应更新本节与 `app.js`。
