# 墨迹任务面板

个人 PWA 面板：待办任务、生日清单、大佬维护清单、跨端同步和生日邮件提醒。

## 功能

- Android 和 Windows 通过浏览器安装为 PWA 使用。
- Supabase Auth + Postgres 同步数据，RLS 保证每个用户只能访问自己的记录。
- 待办支持状态、优先级、截止日期和详细要求。
- 生日按下一次生日由近到远排序，未来 3 天内每天汇总提醒一次。
- 大佬维护清单记录帮助事项、汇报周期、上次汇报日期和备注。
- 大佬详情支持汇报历史时间线、下次汇报建议和规则生成的汇报草稿。
- 定制模式支持编辑当前界面的静态文案，并随 Supabase 或本地预览数据保存。
- 本地未配置 Supabase 时自动进入 localStorage 预览模式。

## 本地开发

```bash
npm install
npm run dev
```

Windows PowerShell 若拦截 `npm.ps1`，使用：

```bash
npm.cmd run dev
```

常用检查：

```bash
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run check
```

Windows 也可以直接运行脚本：

```powershell
.\scripts\dev.ps1
.\scripts\check.ps1
```

如果想双击启动，使用项目根目录下的 `start-panel.cmd`；双击完整检查使用 `check-panel.cmd`。

## Windows + Edge PWA

本机已经准备了 Edge PWA 安装入口：

```powershell
.\install-edge-pwa.cmd
```

它会完成三件事：

- 启动生产预览服务：`http://127.0.0.1:4173/`
- 在 Windows 启动文件夹创建 `TaskManagerPanelServer.lnk`，下次登录自动启动本地服务。
- 在桌面和开始菜单创建 `Task Manager Panel.lnk`，用 Microsoft Edge 应用模式打开面板。

## 环境变量

复制 `.env.example` 为 `.env.local`，填入前端需要的 Supabase 参数：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Edge Function secrets 在 Supabase 项目中配置：

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
QQ_SMTP_USER=your-qq-email@qq.com
QQ_SMTP_AUTH_CODE=your-qq-mail-smtp-auth-code
REMINDER_TO=2309117485@qq.com
CRON_SECRET=change-this-long-random-token
```

QQ 邮箱需要在邮箱设置中开启 SMTP，并使用授权码，不要使用登录密码。

## Supabase 部署

1. 创建 Supabase 项目，启用 Email/Password 登录。
2. 复制项目 ref、Supabase URL、anon key 后运行本机配置脚本：

```powershell
.\scripts\configure-supabase.ps1 `
  -ProjectRef your-project-ref `
  -SupabaseUrl https://your-project.supabase.co `
  -SupabaseAnonKey your-supabase-anon-key
```

3. 推送数据库迁移，创建表、RLS、定时任务：

```bash
npm.cmd run supabase:db:push
```

4. 部署 Edge Function：

```bash
npm.cmd run supabase:functions:deploy
```

5. 设置 Edge Function secrets。
6. 在数据库执行以下配置，让 `pg_cron` 每天北京时间 20:00 调用云函数：

```sql
alter database postgres set app.settings.supabase_url = 'https://your-project.supabase.co';
alter database postgres set app.settings.cron_secret = 'same-value-as-CRON_SECRET';
```

`20260511125000_schedule_birthday_reminders.sql` 使用 UTC `12:00`，对应北京时间 `20:00`。

## 生日规则

- v1 只支持公历生日。
- 2 月 29 日生日在非闰年按 2 月 28 日计算。
- 同一天同一用户只发送一次生日汇总邮件，发送记录写入 `reminder_logs`。

## 技术栈

- React 19 + TypeScript + Vite
- Vite PWA
- Supabase JS
- Supabase Edge Functions
- Vitest
