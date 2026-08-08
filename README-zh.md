# Telegraph-Image

基于 Cloudflare Pages 的文件托管服务，文件可存储到 Telegram Bot API 或 Cloudflare R2。

[在线文档](https://jetpack-1.gitbook.io/telegraph-image-docs) | [English](README.md) | 中文

## 功能

- 文件选择、拖拽和剪贴板批量上传
- 以 Telegram 文档方式发送图片，保留原始画质
- 输出 URL、Markdown、BBCode 和 HTML
- 内置 Pastebin，直接编辑并分享文字
- 中英文界面
- 基于 Cloudflare KV 的上传记录和管理后台
- 可选短链接、上传鉴权、内容审查、防盗链和 R2 存储

## 快速开始

需要准备 Node.js、Cloudflare 账户、Telegram Bot，以及一个已将 Bot 设为管理员的 Telegram 频道。

```bash
npm install
npm run setup
```

初始化向导会：

1. 选择 Cloudflare Pages 项目；
2. 按需创建或复用项目专用 KV；
3. 保留已有管理员凭据，或安全创建新凭据；
4. 构建、部署并验证生产站点。

已有 KV 和 Pages Secret 默认只复用、不覆盖。自动生成的密码只显示一次，并通过 Cloudflare Pages Secret 写入，不会进入 Git 或 Wrangler 配置。

通过 Telegram 上传需要配置两个生产 Secret：

- `TG_Bot_Token`：从 [@BotFather](https://t.me/BotFather) 获取
- `TG_Chat_ID`：Telegram 频道 ID，同时需要将 Bot 设为频道管理员

可以在 Cloudflare Pages 设置中添加，也可以使用 `wrangler pages secret put`，设置后重新部署。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run setup` | 首次交互式初始化、资源检查、部署和健康验证 |
| `npm run deploy` | 仅构建和部署代码，保留已有 Cloudflare 资源 |
| `npm run admin:reset` | 安全更换后台用户名和密码 |
| `npm start` | 在 8080 端口启动本地开发环境，并持久化本地 KV/R2 |
| `npm test` | 运行测试 |
| `npm run build` | 类型检查并生成生产构建 |

无人值守部署应通过环境变量提供管理员凭据，不要放在命令参数里：

```bash
TELEGRAPH_ADMIN_USER=admin \
TELEGRAPH_ADMIN_PASSWORD='your-password' \
npm run setup -- --project images --yes
```

## 核心配置

| 名称 | 用途 |
| --- | --- |
| `img_url` | KV 绑定，用于上传记录、后台、短链接和审查结果 |
| `BASIC_USER` / `BASIC_PASS` | 管理后台账号和密码 |
| `UPLOAD_BASIC_USER` / `UPLOAD_BASIC_PASS` | 可选的上传接口账号和密码 |
| `STORAGE_PROVIDER` | 默认 `telegram`；绑定 `img_r2` 后可设为 `r2` |
| `ENABLE_SHORT_URLS` | 设为 `true` 后返回基于 KV 的短链接 |
| `SITE_NAME` / `SITE_TITLE` | 自定义站点名称和浏览器标题 |

全部变量和绑定见[配置参考](docs/configuration.md)。

## 文档

- [浏览已发布的 GitBook](https://jetpack-1.gitbook.io/telegraph-image-docs)
- [部署与更新](docs/zh/deployment.md)
- [配置参考](docs/zh/configuration.md)
- [上传 API](docs/zh/api.md)

仓库已包含 `.gitbook.yaml` 和 `SUMMARY.md`，可以直接连接 GitBook Git Sync。

## 限制

Telegram 上传受 Telegram Bot API 的文件大小和频率限制；KV、R2、Pages 和 Workers Functions 受 Cloudflare 套餐额度限制。原画质图片使用 Telegram 文档接口，普通图片接口可能被 Telegram 重新压缩。

## 许可证

[MIT](LICENSE)
