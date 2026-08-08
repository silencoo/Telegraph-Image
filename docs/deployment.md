# Deployment and updates

## First-time Wrangler deployment

Install dependencies and run the setup assistant:

```bash
npm install
npm run setup
```

The assistant reads the current Pages project, KV namespaces, and Secret names before making changes. It shows a summary, then creates only missing resources. Existing `BASIC_USER` and `BASIC_PASS` values remain encrypted and are preserved by default.

When dashboard credentials are missing, the assistant can generate a random password or accept a password entered twice through hidden terminal input. The password is sent to `wrangler pages secret put` over standard input.

For non-interactive environments, provide credentials as environment variables:

```bash
TELEGRAPH_ADMIN_USER=admin \
TELEGRAPH_ADMIN_PASSWORD='use-a-secret-from-your-ci-provider' \
npm run setup -- --project your-project --yes
```

`--yes` never generates and prints a new password when no interactive terminal is attached.

## Telegram configuration

Create a bot with [@BotFather](https://t.me/BotFather), add it to a Telegram channel as an administrator, and obtain the channel ID. Add both values as production Pages Secrets:

```bash
npx wrangler pages secret put TG_Bot_Token --project-name your-project
npx wrangler pages secret put TG_Chat_ID --project-name your-project
npm run deploy
```

## Updating

For code-only updates, use:

```bash
npm run deploy
```

This does not recreate KV or rotate credentials. The Pages project keeps its existing bindings and Secrets.

Run `npm run setup` again when repairing resource bindings. It is idempotent: the matching KV namespace and complete admin credentials are reused.

Reset dashboard credentials explicitly with:

```bash
npm run admin:reset
```

## Git-connected Pages projects

Use `npm run build` as the build command and `dist` as the output directory. Set Secrets and bindings in the Cloudflare Pages project settings. Configuration changes take effect on the next deployment.

## Deployment addresses

- `your-project.pages.dev` or its generated variant is the production domain.
- `deployment-id.your-project.pages.dev` identifies one immutable deployment.
- Custom domains point to the production deployment.

The setup assistant verifies both `/api/config` and `/api/manage/check` after deployment. Production may take a few seconds to propagate across Cloudflare's edge.
