import { env } from "node:process"
import { metrics } from "@opentelemetry/api"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"

const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: "yapper" })

if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const exporter = new OTLPMetricExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT })
  const provider = new MeterProvider({
    resource,
    readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 })]
  })
  metrics.setGlobalMeterProvider(provider)
}

const meter = metrics.getMeter("yapper")

export const transcriptionsTotal = meter.createCounter("yapper.transcriptions.total", {
  description: "Total number of transcriptions"
})

export const transcriptionsDurationMs = meter.createHistogram("yapper.transcriptions.duration_ms", {
  description: "Duration of transcription jobs in milliseconds",
  unit: "ms"
})

export const transcriptionsErrors = meter.createCounter("yapper.transcriptions.errors", {
  description: "Total number of transcription errors"
})

export const guildsGauge = meter.createGauge("yapper.guilds", {
  description: "Number of guilds the bot is in"
})

export const usersGauge = meter.createGauge("yapper.users", {
  description: "Approximate number of users the bot can see"
})
