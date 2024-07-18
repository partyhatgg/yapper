import { env } from "node:process";
import { format } from "node:util";
import type { APIInteraction, APIMessage } from "@discordjs/core";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { dockerCGroupV1Detector } from "@opentelemetry/resource-detector-docker";
import { Resource } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import PrismaInstrumentation from "@prisma/instrumentation";
import * as Sentry from "@sentry/node";
import type { HonoRequest } from "hono";
import botConfig from "../../config/bot.config";

function initSentry(): typeof Sentry & {
	captureWithExtras(error: any, extras: Record<string, any>): Promise<string>;
	captureWithInteraction(error: any, interaction: APIInteraction): Promise<string>;
	captureWithMessage(error: any, message: APIMessage): Promise<string>;
	captureWithRequest(
		error: any,
		request: HonoRequest,
		response: Response,
		query: Record<string, string>,
	): Promise<string>;
} {
	Sentry.init({
		tracesSampleRate: 1,
		dsn: env.SENTRY_DSN,
		skipOpenTelemetrySetup: true, // we're doing that oureslves
	});

	return {
		...Sentry,

		/**
		 * Capture a Sentry error about an interaction.
		 *
		 * @param error The error to capture.
		 * @param interaction The interaction that caused the error.
		 * @return The sentry error ID.
		 */
		captureWithInteraction: async (error: any, interaction: APIInteraction): Promise<string> => {
			return new Promise((resolve) => {
				Sentry.withScope((scope) => {
					scope.setExtra("Environment", env.NODE_ENV);
					scope.setUser({
						username: (interaction.member?.user ?? interaction.user!).username,
						id: (interaction.member ?? interaction).user!.id,
					});
					scope.setExtra("Interaction", format(interaction));

					resolve(Sentry.captureException(error));
				});
			});
		},

		/**
		 * Capture a Sentry error about a message.
		 *
		 * @param error The error to capture.
		 * @param message The message that caused the error.
		 * @return The sentry error ID.
		 */
		captureWithMessage: async (error: any, message: APIMessage): Promise<string> => {
			return new Promise((resolve) => {
				Sentry.withScope((scope) => {
					scope.setExtra("Environment", env.NODE_ENV);
					scope.setUser({
						username: `${message.author.username}#${message.author.discriminator}`,
						id: message.author.id,
					});
					scope.setExtra("Message", format(message));

					resolve(Sentry.captureException(error));
				});
			});
		},

		captureWithRequest: async (
			error: any,
			request: HonoRequest,
			response: Response,
			query: Record<string, string>,
		): Promise<string> => {
			return new Promise((resolve) => {
				Sentry.withScope((scope) => {
					scope.setExtra("Environment", env.NODE_ENV);
					scope.setExtra("Method", request.method);
					scope.setExtra("X-Forwarded-For", request.header("X-Forwarded-For"));

					scope.setExtra("User Agent", request.header("user-agent"));

					if (request.url) {
						scope.setExtra("Path", request.url.split("?")[0]);
						scope.setExtra("Path + Query", request.url);
						scope.setExtra("Query", JSON.stringify(query, null, 4));
					}

					scope.setExtra("Request", JSON.stringify(request, null, 4));
					scope.setExtra("Response", JSON.stringify(response, null, 4));
					scope.setExtra("Cookie", request.raw.headers.get("cookie"));

					resolve(Sentry.captureException(error));
				});
			});
		},

		/**
		 * Capture a Sentry error with extra details.
		 *
		 * @param error The error to capture.
		 * @param extras Extra details to add to the error.
		 * @return The sentry error ID.
		 */
		captureWithExtras: async (error: any, extras: Record<string, any>) => {
			return new Promise((resolve) => {
				Sentry.withScope((scope) => {
					scope.setExtra("Environment", env.NODE_ENV);
					for (const [key, value] of Object.entries(extras)) scope.setExtra(key, format(value));
					resolve(Sentry.captureException(error));
				});
			});
		},
	};
}

const sentry = initSentry();

const otel = new NodeSDK({
	traceExporter: new OTLPTraceExporter({
		url: "http://172.17.0.1:4310/v1/traces",
	}),
	metricReader: new PeriodicExportingMetricReader({
		exporter: new OTLPMetricExporter({
			url: "http://172.17.0.1:4310/v1/metrics",
		}),
	}),
	instrumentations: [new PrismaInstrumentation.PrismaInstrumentation()],
	resource: new Resource({
		[SEMRESATTRS_SERVICE_NAME]: botConfig.botName,
		[SEMRESATTRS_SERVICE_VERSION]: botConfig.version,
	}),
	resourceDetectors: [dockerCGroupV1Detector],
});

otel.start();

// Incase something goes wrong, take a look under the hood with:
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

export { sentry };
