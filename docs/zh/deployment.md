# 部署与更新

## 首次使用 Wrangler 部署

安装依赖并运行初始化向导：

```bash
npm install
npm run setup
```

向导会先读取当前 Pages 项目、KV 命名空间和 Secret 名称，然后显示配置摘要。确认后，它只创建缺少的资源。已经配置的 `BASIC_USER` 和 `BASIC_PASS` 保持加密，默认不会覆盖。

如果还没有后台凭据，向导可以自动生成随机强密码，也可以通过隐藏输入让你连续输入两次密码。密码通过标准输入传给 `wrangler pages secret put`，不会出现在命令参数、Wrangler 配置或 Git 中。

无人值守环境需要通过环境变量传入凭据：

```bash
TELEGRAPH_ADMIN_USER=admin \
TELEGRAPH_ADMIN_PASSWORD='使用-CI-平台保存的密码' \
npm run setup -- --project your-project --yes
```

没有交互式终端时，`--yes` 不会自动生成并打印新密码。

## Telegram 配置

通过 [@BotFather](https://t.me/BotFather) 创建 Bot，将它添加为 Telegram 频道管理员，并取得频道 ID。然后将两个值写入生产环境 Pages Secret：

```bash
npx wrangler pages secret put TG_Bot_Token --project-name your-project
npx wrangler pages secret put TG_Chat_ID --project-name your-project
npm run deploy
```

## 日常更新

只更新代码时运行：

```bash
npm run deploy
```

该命令不会重新创建 KV，也不会更换后台凭据；Pages 项目会保留现有绑定和 Secret。

需要检查或修复资源绑定时，可以再次运行 `npm run setup`。流程是幂等的：同名 KV 和完整的管理员凭据都会被复用。

需要明确更换后台凭据时运行：

```bash
npm run admin:reset
```

## 连接 Git 的 Pages 项目

构建命令填写 `npm run build`，输出目录填写 `dist`。在 Cloudflare Pages 项目设置中添加 Secret 和资源绑定；配置修改会在下一次部署时生效。

## 部署地址

- `your-project.pages.dev` 或 Cloudflare 分配的带后缀域名是生产地址。
- `deployment-id.your-project.pages.dev` 对应一次不可变部署。
- 自定义域名始终指向当前生产部署。

部署完成后，初始化向导会检查 `/api/config` 和 `/api/manage/check`。Cloudflare 边缘节点可能需要几秒钟才能全部切换到新生产版本。
