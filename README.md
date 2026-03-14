# Yapper

A Discord bot that transcribes voice messages using Faster Whisper (LARGEV3 turbo) via Runpod.

## Features

- **Auto-transcription** — automatically transcribes Discord native voice messages in guilds that have it enabled
- **Context menu commands** — "Transcribe" (public) and "Transcribe Privately" (ephemeral) on any message
- **User-installable** — context menu commands work in any server, even without bot presence
- **Long transcription handling** — threads for threadable channels, `.txt` file attachment fallback elsewhere
- **Opt-out** — users can toggle themselves out of transcription globally via `/yapper ignore`

## Stack

- [discord.js](https://discord.js.org/) + [@hijuno/botkit](https://jsr.io/@hijuno/botkit) for command handling
- [Drizzle ORM](https://orm.drizzle.team/) + PostgreSQL for persistence
- [Hono](https://hono.dev/) for the webhook HTTP server
- [Pino](https://getpino.io/) for logging
- [OpenTelemetry](https://opentelemetry.io/) (OTLP) for metrics
- [Biome](https://biomejs.dev/) for linting and formatting

## Commands

| Command | Description |
|---|---|
| `/yapper ping` | Latency check |
| `/yapper ignore` | Toggle opt-out of transcription (global) |
| `/yapper config auto-transcript-voice-messages` | Enable/disable auto-transcription for the guild (requires Manage Guild) |
| "Transcribe" (message menu) | Transcribe a voice message publicly |
| "Transcribe Privately" (message menu) | Transcribe a voice message ephemerally |

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Discord bot token + application
- Runpod account with a Faster Whisper async endpoint

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
NODE_ENV=development
TOKEN=                        # Discord bot token
CLIENT_ID=                    # Discord application ID
DATABASE_URL=                 # PostgreSQL connection string
PORT=3000                     # Hono server port

# Runpod
RUNPOD_ENDPOINT_ID=           # Async endpoint ID (LARGEV3/turbo)
RUNPOD_API_KEY=               # Runpod API key
BASE_URL=                     # Publicly reachable URL for Runpod webhooks

# Observability (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=  # OTLP collector endpoint
GUILD_LOG_WEBHOOK_URL=        # Discord webhook for guild join/leave logs
```

### Installation

```bash
pnpm install
pnpm run migrate
pnpm run dev
```

### Production

```bash
pnpm run build
pnpm start
```

## Development

```bash
pnpm run dev
```

### Local Database

```bash
docker run -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
```

Then run migrations:

```bash
pnpm run migrate
```

### Local Webhook Tunnel

Runpod needs a publicly reachable URL to POST transcription results back to. Use a tunnel for local development:

https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel

Set `BASE_URL` in your `.env` to the tunnel URL.
