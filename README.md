# Yapper

Welcome to the repository for Yapper, a Discord bot created to transcribe Discord voice messages.

## Self Hosting

To run this bot you need to be on at least node.js `v18`, from there make sure you have
PNPM installed and run `pnpm install` to install all of our dependencies.

Once all of our dependencies are installed please duplicate `.env.example` to `.env.prod`
and `.env.dev`, then modify all the values accordingly, and the same for `./prisma/.env`.

To run the production version of this bot please run `pnpm start`, if any errors come
out feel free to contact the developer (`@polar.blue` on Discord) if he still works on the project! (Make sure to compile
your TypeScript files first with `tsc`)

If you want to run the development version run `pnpm build`.

The only difference between the production and development version is that the development
has debug logs to assist with development, and uses guild commands in the development server
instead of global commands.
