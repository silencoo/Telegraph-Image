# Telegraph-Image

Cloudflare Pages file hosting backed by the Telegram Bot API or Cloudflare R2.

English | [中文](README-zh.md)

## Features

- Batch upload by file picker, drag and drop, or clipboard paste
- Original-quality image uploads through Telegram documents
- URL, Markdown, BBCode, and HTML output
- Built-in pastebin for quickly sharing text
- Chinese and English interface
- Upload history and management dashboard backed by Cloudflare KV
- Optional short links, upload authentication, moderation, anti-hotlinking, and R2 storage

## Quick start

Requirements: Node.js, a Cloudflare account, a Telegram bot, and a Telegram channel where the bot is an administrator.

```bash
npm install
npm run setup
```

The setup assistant:

1. selects the Cloudflare Pages project;
2. optionally creates or reuses a dedicated KV namespace;
3. preserves existing admin credentials or securely creates new ones;
4. builds, deploys, and verifies the production site.

Existing KV namespaces and Pages Secrets are reused instead of overwritten. Generated passwords are shown once and are written through Cloudflare Pages Secrets, never to Git or the Wrangler configuration.

Uploads through Telegram require these production secrets:

- `TG_Bot_Token`: token issued by [@BotFather](https://t.me/BotFather)
- `TG_Chat_ID`: channel ID; the bot must be a channel administrator

Add them in Cloudflare Pages settings or with `wrangler pages secret put`, then deploy again.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Interactive first-time setup, resource checks, deployment, and health verification |
| `npm run deploy` | Build and deploy code while keeping existing Cloudflare resources |
| `npm run admin:reset` | Replace the dashboard username and password safely |
| `npm start` | Run locally on port 8080 with local KV/R2 persistence |
| `npm test` | Run the test suite |
| `npm run build` | Type-check and create the production build |

For unattended setup, provide secrets through the environment instead of command arguments:

```bash
TELEGRAPH_ADMIN_USER=admin \
TELEGRAPH_ADMIN_PASSWORD='your-password' \
npm run setup -- --project images --yes
```

## Core configuration

| Name | Purpose |
| --- | --- |
| `img_url` | KV binding used by upload history, dashboard, short links, and moderation metadata |
| `BASIC_USER` / `BASIC_PASS` | Dashboard credentials |
| `UPLOAD_BASIC_USER` / `UPLOAD_BASIC_PASS` | Optional upload endpoint credentials |
| `STORAGE_PROVIDER` | `telegram` by default; use `r2` with an `img_r2` binding |
| `ENABLE_SHORT_URLS` | Return KV-backed short links when set to `true` |
| `SITE_NAME` / `SITE_TITLE` | Site and browser title customization |

See [configuration](docs/configuration.md) for all variables and bindings.

## Documentation

- [Deployment and updates](docs/deployment.md)
- [Configuration reference](docs/configuration.md)
- [Upload API](docs/api.md)

The repository includes `.gitbook.yaml` and `SUMMARY.md` for direct GitBook Git Sync import.

## Limits

Telegram Bot API uploads are subject to Telegram file-size and rate limits. KV, R2, Pages, and Workers Functions are subject to the quotas of your Cloudflare plan. Original-quality images use Telegram's document upload path; the regular image path may be recompressed by Telegram.

## License

[MIT](LICENSE)
