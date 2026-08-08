# 配置参考

敏感值应保存为 Cloudflare Pages Secret。存储资源可以在 Pages Functions 设置中绑定，也可以通过 `npm run setup` 自动配置主要 KV 绑定。

## Telegram 存储必需配置

| 名称 | 说明 |
| --- | --- |
| `TG_Bot_Token` | Telegram Bot API Token |
| `TG_Chat_ID` | Bot 有权发送文件的频道或群组 ID |

当 `STORAGE_PROVIDER=r2` 且已经绑定 `img_r2` 时，不需要 Telegram 配置。

## 资源绑定

| 绑定名称 | 类型 | 说明 |
| --- | --- | --- |
| `img_url` | KV 命名空间 | 上传元数据、后台记录、短链接和审查缓存 |
| `img_r2` | R2 存储桶 | `STORAGE_PROVIDER=r2` 时保存文件 |
| `AI` | Workers AI | 内置图片内容审查 |

KV 资源本身在 Cloudflare 中可以使用任意名称，只有程序访问的绑定变量必须叫 `img_url`。

## 身份验证

| 名称 | 说明 |
| --- | --- |
| `BASIC_USER` / `BASIC_PASS` | 后台登录凭据，必须同时配置 |
| `UPLOAD_BASIC_USER` / `UPLOAD_BASIC_PASS` | 上传接口保护，必须同时配置 |
| `HIDE_ADMIN_ENTRY` | 设为 `true` 后隐藏首页后台入口 |

## 存储与链接

| 名称 | 默认值 | 说明 |
| --- | --- | --- |
| `STORAGE_PROVIDER` | `telegram` | 可选 `telegram` 或 `r2` |
| `ENABLE_SHORT_URLS` | `false` | 返回 `/file/...` 短链接，需要 `img_url` |
| `SHORT_URL_LENGTH` | `6` | 短链接 ID 长度，范围为 4–16 |

每个文件都会记录自己的存储后端，所以切换默认存储后，原有 Telegram 和 R2 链接仍然有效。

## 站点与访问控制

| 名称 | 说明 |
| --- | --- |
| `SITE_NAME` | 首页顶部站点名称 |
| `SITE_TITLE` | 浏览器标签页标题 |
| `SITE_BACKGROUND` | 可选的背景图片 URL |
| `ALLOWED_REFERERS` | 逗号分隔的防盗链域名白名单，支持 `*.example.com` |
| `WhiteList_Mode` | 设为 `true` 后只允许白名单记录访问 |
| `disable_telemetry` | 设为 `true` 后关闭项目遥测 |

## 内容审查

| 名称 | 说明 |
| --- | --- |
| `MODERATION_PROVIDER` | `cloudflare-ai`、`moderatecontent` 或 `none` |
| `MODERATION_AI_MODEL` | 可选的固定 Workers AI 视觉模型 |
| `CF_ACCOUNT_ID` / `CF_API_TOKEN` | 可选的 Workers AI 实时模型发现凭据 |
| `ModerateContentApiKey` | 旧版 ModerateContent 服务密钥 |

存在 `AI` 绑定且没有明确指定服务时，系统会自动选择 Cloudflare AI。审查结果会缓存在 `img_url` 中。
