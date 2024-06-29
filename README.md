# Yapper

Welcome to the repository for Yapper, a Discord bot created to transcribe Discord voice messages.

## Self Hosting

### Running with Docker:

Please duplicate `.env.example` to `.env.prod` and `.env.dev`, then modify all the values accordingly and do the same for `./prisma/.env`.

The default fields here are already configured for running in Docker.

Then: `docker compose up` :)


### Running Locally:
To run this bot you will need Node.js `v18.20.2` or higher. Then, using a system installed `pnpm` (or, `pnpm` provided by corepack with `corepack prepare`) run `pnpm install` to install the bot's dependencies.

Then, please duplicate `.env.example` to `.env.prod` and `.env.dev`, then modify all the values accordingly and do the same for `./prisma/.env`.

This bot uses PostgreSQL! The format for a `DATABASE_URL` is:
```
postgresql://[user[:password]@][host][:port][/dbname]
```

### Chatter

Currently, Yapper has a hard dependency on the Chatter service. Transcriptions are sent to a Chatter installation of your choice. 

You can clone and run Chatter as a Docker Container from [partyhatgg/chatter](https://github.com/partyhatgg/chatter).

Chatter mimics the RunPod API in response, so while in theory you could just set the `CHATTER_URL` to a RunPod installation this has not been tested yet. 

<details>
<summary>Using RunPod</summary>
<br>

You will be asked for an `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID`. 

From the [RunPod Console](https://runpod.io/console), select ["Serverless"](https://www.runpod.io/console/serverless), then ["Quick Deploy"](https://www.runpod.io/console/serverless/quick-deploy) and select "Faster Whisper". RunPod will recommend a 24 GB GPU, this is perfectly fine. However, feel free to switch to the "16 GB GPU".

Your `RUNPOD_ENDPOINT_ID` is under the name "Faster Whisper", or whatever custom name you've provided:
![image](docs/runpod_endpoint.png)

Next, select ["Settings"](https://runpod.io/console/serverless/user/settings), expand "API Keys" and create a new API Key with "Read" permission. Write permission allows this API key to modify your account, which is likely not what you want. This is your `RUNPOD_API_KEY`.
</details>

## Running without Docker:

* Ready the Database with `pnpm prisma migrate dev`.

Then, to run the bot in production mode use `pnpm start`.

Or, to run the bot in development mode use `pnpm build`.

> [!TIP]
> Using development mode will provide you with more detailed logs and push guild commands in the specified `DEVELOPMENT_GUILD_ID` instead of global commands.

If you run into any problems with either [please create an issue](/issues/new).

### Need a Tunnel to Develop Locally?

Follow the instructions here:
https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel

After that's complete, use `pnpm tunnel`!
