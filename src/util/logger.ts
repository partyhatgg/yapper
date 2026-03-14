import pino from "pino"

const logger = pino({
  transport: {
    targets: [
      {
        level: "trace",
        target: "pino/file",
        options: { destination: "./logs/bot.log" }
      },
      {
        level: "trace",
        target: "pino-pretty",
        options: {
          colorize: true
        }
      }
    ]
  }
})

export { logger }
