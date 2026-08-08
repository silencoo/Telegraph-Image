# Configuration reference

Set sensitive values as Cloudflare Pages Secrets. Bind storage resources in Pages Functions settings or use `npm run setup` for the primary KV binding.

## Required for Telegram storage

| Name | Description |
| --- | --- |
| `TG_Bot_Token` | Telegram Bot API token |
| `TG_Chat_ID` | Channel or group ID where the bot can send files |

Telegram configuration is not required when `STORAGE_PROVIDER=r2` and `img_r2` is bound.

## Bindings

| Binding | Type | Description |
| --- | --- | --- |
| `img_url` | KV namespace | Upload metadata, dashboard records, short links, moderation cache |
| `img_r2` | R2 bucket | File storage when `STORAGE_PROVIDER=r2` |
| `AI` | Workers AI | Built-in image moderation |

The KV resource can have any Cloudflare title. Only the binding variable used by the application must be `img_url`.

## Authentication

| Name | Description |
| --- | --- |
| `BASIC_USER` / `BASIC_PASS` | Dashboard login; set both together |
| `UPLOAD_BASIC_USER` / `UPLOAD_BASIC_PASS` | Upload endpoint protection; set both together |
| `HIDE_ADMIN_ENTRY` | Set to `true` to hide the homepage dashboard link |

## Storage and links

| Name | Default | Description |
| --- | --- | --- |
| `STORAGE_PROVIDER` | `telegram` | `telegram` or `r2` |
| `ENABLE_SHORT_URLS` | `false` | Return short `/file/...` links; requires `img_url` |
| `SHORT_URL_LENGTH` | `6` | Short ID length from 4 to 16 |

Files remember their storage provider, so Telegram and R2 links continue working after switching the default.

## Site and access

| Name | Description |
| --- | --- |
| `SITE_NAME` | Header site name |
| `SITE_TITLE` | Browser tab title |
| `SITE_BACKGROUND` | Optional background image URL |
| `ALLOWED_REFERERS` | Comma-separated anti-hotlink hostname allowlist; supports `*.example.com` |
| `WhiteList_Mode` | Set to `true` to serve only whitelisted records |
| `disable_telemetry` | Set to `true` to disable project telemetry |

## Moderation

| Name | Description |
| --- | --- |
| `MODERATION_PROVIDER` | `cloudflare-ai`, `moderatecontent`, or `none` |
| `MODERATION_AI_MODEL` | Optional pinned Workers AI vision model |
| `CF_ACCOUNT_ID` / `CF_API_TOKEN` | Optional live Workers AI model discovery credentials |
| `ModerateContentApiKey` | Legacy ModerateContent provider key |

With an `AI` binding and no explicit provider, Cloudflare AI is selected automatically. Moderation results are cached in `img_url`.
