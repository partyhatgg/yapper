import { env } from "node:process";
import { setInterval } from "node:timers";
import { API, ButtonStyle, ComponentType } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { serve } from "@hono/node-server";
import { InfrastructureUsed, PrismaClient } from "@prisma/client";
import { Hono } from "hono";
import Stripe from "stripe";
import type { RunPodRunSyncResponse } from "../../typings/index.js";
import Functions, { TranscriptionState } from "../utilities/functions.js";
import Logger from "./Logger.js";

export default class Server {
	/**
	 * The port the server should run on.
	 */
	private readonly port: number;

	/**
	 * Our Hono instance.
	 */
	private readonly router: Hono;

	/**
	 * Our Prisma client, this is an ORM to interact with our PostgreSQL instance.
	 */
	public readonly prisma: PrismaClient<{
		errorFormat: "pretty";
		log: (
			| {
					emit: "event";
					level: "query";
			  }
			| {
					emit: "stdout";
					level: "error";
			  }
			| {
					emit: "stdout";
					level: "warn";
			  }
		)[];
	}>;

	/**
	 * Our interface to the Discord API.
	 */
	private readonly discordApi = new API(new REST({ version: "10" }).setToken(env.DISCORD_TOKEN));

	/**
	 * Create our Hono server.
	 *
	 * @param port The port the server should run on.
	 */
	public constructor(port: number) {
		this.port = port;

		this.router = new Hono();

		this.prisma = new PrismaClient({
			errorFormat: "pretty",
			log: [
				{
					level: "warn",
					emit: "stdout",
				},
				{
					level: "error",
					emit: "stdout",
				},
				{ level: "query", emit: "event" },
			],
		});

		// I forget what this is even used for, but Vlad from https://github.com/vladfrangu/highlight uses it and recommended me to use it a while ago.
		if (env.NODE_ENV === "development") {
			this.prisma.$on("query", (event) => {
				try {
					const paramsArray = JSON.parse(event.params);
					const newQuery = event.query.replaceAll(/\$(?<captured>\d+)/g, (_, number) => {
						const value = paramsArray[Number(number) - 1];

						if (typeof value === "string") return `"${value}"`;
						else if (Array.isArray(value)) return `'${JSON.stringify(value)}'`;

						return String(value);
					});

					Logger.debug("prisma:query", newQuery);
				} catch {
					Logger.debug("prisma:query", event.query, "PARAMETERS", event.params);
				}
			});

			this.prisma.$use(async (params, next) => {
				const before = Date.now();
				// eslint-disable-next-line n/callback-return
				const result = await next(params);
				const after = Date.now();

				Logger.debug("prisma:query", `${params.model}.${params.action} took ${String(after - before)}ms`);

				return result;
			});
		}
	}

	/**
	 * Start the server.
	 */
	public async start() {
		this.registerRoutes();

		// eslint-disable-next-line promise/prefer-await-to-callbacks
		serve({ fetch: this.router.fetch, port: this.port }, (info) => {
			// if (error) {
			// 	Logger.error(error);
			// 	Logger.sentry.captureException(error);
			// 	exit(1);
			// }

			Logger.info(`Hono server started, listening on ${info.address}.`);
		});

		setInterval(async () => {
			const jobs = await this.prisma.job.findMany({});

			return Promise.all(
				jobs
					.map(async (job) => {
						const jobStatus = await Functions.getJobStatus(
							job.id,
							job.infrastructureUsed.toLowerCase() as "endpoint" | "serverless",
						);

						if (!jobStatus) return this.prisma.job.delete({ where: { id: job.id } });

						if (jobStatus.status === TranscriptionState.COMPLETED) {
							return fetch(`http://127.0.0.1:${this.port}/job_complete?secret=${env.SECRET}`, {
								method: "POST",
								body: JSON.stringify(jobStatus),
							});
						}

						return null;
					})
					.filter(Boolean),
			);
		}, 5_000);
	}

	/**
	 * Register our routes.
	 */
	private registerRoutes() {
		this.router.get("/ping", (context) => context.text("PONG!"));

		this.router.get("/", (context) => context.redirect("https://polar.blue"));

		this.router.post("/job_complete", async (context) => {
			let body: RunPodRunSyncResponse;

			try {
				body = await context.req.json();
			} catch {
				return context.json({ ack: true, runpod: false });
			}

			const job = await this.prisma.job.findUnique({ where: { id: body.id } });

			if (!job) {
				context.status(400);
				return context.json({ message: "Job not found." });
			}

			await this.prisma.job.delete({ where: { id: job.id } });

			if (body.output.transcription.length > 2_000) {
				const message = job.interactionId
					? await this.discordApi.interactions.getOriginalReply(env.APPLICATION_ID, job.interactionToken!)
					: await this.discordApi.channels.getMessage(job.channelId!, job.initialMessageId);

				const splitTranscription = body.output.transcription.match(/.{1,1997}/g);
				if (!splitTranscription) {
					context.status(500);
					return context.json({ message: "Failed to split transcription." });
				}

				const threadName = `${(message.interaction?.user ?? message.author).username}${
					(message.interaction?.user ?? message.author).discriminator === "0"
						? ""
						: `#${(message.interaction?.user ?? message.author).discriminator}`
				}: ${body.output.transcription}`;

				const firstTranscription = splitTranscription.shift();

				const thread = await this.discordApi.channels.createThread(
					job.channelId,
					{
						name: threadName.length > 100 ? `${threadName.slice(0, 97)}...` : threadName,
					},
					job.id,
				);

				if (job.interactionId)
					await this.discordApi.interactions.editReply(env.APPLICATION_ID, job.interactionToken!, {
						content: firstTranscription!.endsWith(" ") ? `🗣️ ${firstTranscription}` : `🗣️ ${firstTranscription}—`,
						allowed_mentions: { parse: [] },
						components: [
							{
								components: [
									{
										type: ComponentType.Button,
										style: ButtonStyle.Link,
										url: `https://discord.com/channels/${job.guildId}/${job.channelId}/${job.initialMessageId}`,
										label: "Transcribed Message",
									},
								],
								type: ComponentType.ActionRow,
							},
						],
					});
				else
					await this.discordApi.channels.editMessage(job.channelId!, job.initialMessageId, {
						content: firstTranscription!.endsWith(" ") ? `🗣️ ${firstTranscription}` : `🗣️ ${firstTranscription}—`,
						allowed_mentions: { parse: [] },
					});

				for (let index = 0; index < splitTranscription.length; index++) {
					await this.discordApi.channels.createMessage(thread.id, {
						content:
							index === splitTranscription.length - 1 || splitTranscription[index]?.endsWith(" ")
								? `🗣️ ${splitTranscription[index]}${
										index === splitTranscription.length - 1 && body.output.model === "base"
											? "\n\n⚡ A higher quality message is currently being transcribed."
											: ""
								  }`
								: `🗣️ ${splitTranscription[index]}—`,
						allowed_mentions: { parse: [] },
						components:
							index === splitTranscription.length - 1
								? [
										{
											components: [
												{
													type: ComponentType.Button,
													style: ButtonStyle.Link,
													url: `https://discord.com/channels/${job.guildId}/${job.channelId}/${job.initialMessageId}`,
													label: "Transcribed Message",
												},
											],
											type: ComponentType.ActionRow,
										},
								  ]
								: [],
					});
				}

				if (body.output.model === "base") {
					const newJob = await Functions.transcribeAudio(job.attachmentUrl, "serverless", "run", "large-v2");

					await Promise.all([
						this.prisma.transcription.upsert({
							where: { initialMessageId: job.initialMessageId },
							create: {
								initialMessageId: job.initialMessageId,
								responseMessageId: job.responseMessageId,
								threadId: thread.id,
							},
							update: {
								threadId: thread.id,
							},
						}),
						this.discordApi.channels.edit(thread.id, {
							locked: true,
							archived: true,
						}),
						this.prisma.job.create({
							data: {
								...job,
								id: newJob.id,
								infrastructureUsed: InfrastructureUsed.SERVERLESS,
							},
						}),
					]);
				} else
					await Promise.all([
						this.prisma.transcription.upsert({
							where: { initialMessageId: job.initialMessageId },
							create: {
								initialMessageId: job.initialMessageId,
								responseMessageId: job.responseMessageId,
								threadId: thread.id,
							},
							update: {
								threadId: thread.id,
							},
						}),
						this.discordApi.channels.edit(thread.id, {
							locked: true,
							archived: true,
						}),
					]);

				return context.text("Success");
			}

			if (body.output.model === "base") {
				const newJob = await Functions.transcribeAudio(job.attachmentUrl, "serverless", "run", "large-v2");

				await Promise.all([
					this.prisma.transcription.upsert({
						where: { initialMessageId: job.initialMessageId },
						create: {
							initialMessageId: job.initialMessageId,
							responseMessageId: job.responseMessageId,
						},
						update: {},
					}),
					job.interactionId
						? this.discordApi.interactions.editReply(env.APPLICATION_ID, job.interactionToken!, {
								content: `${body.output.transcription}\n\n⚡ A higher quality message is currently being transcribed.`,
								allowed_mentions: { parse: [] },
								components: [
									{
										components: [
											{
												type: ComponentType.Button,
												style: ButtonStyle.Link,
												url: `https://discord.com/channels/${job.guildId}/${job.channelId}/${job.initialMessageId}`,
												label: "Transcribed Message",
											},
										],
										type: ComponentType.ActionRow,
									},
								],
						  })
						: this.discordApi.channels.editMessage(job.channelId!, job.responseMessageId, {
								content: `${body.output.transcription}\n\n⚡ A higher quality message is currently being transcribed.`,
								allowed_mentions: { parse: [] },
						  }),
					this.prisma.job.create({
						data: {
							...job,
							id: newJob.id,
							infrastructureUsed: InfrastructureUsed.SERVERLESS,
						},
					}),
				]);
			} else
				await Promise.all([
					this.prisma.transcription.upsert({
						where: { initialMessageId: job.initialMessageId },
						create: {
							initialMessageId: job.initialMessageId,
							responseMessageId: job.responseMessageId,
						},
						update: {},
					}),
					job.interactionId
						? this.discordApi.interactions.editReply(env.APPLICATION_ID, job.interactionToken!, {
								content: body.output.transcription,
								allowed_mentions: { parse: [] },
								components: [
									{
										components: [
											{
												type: ComponentType.Button,
												style: ButtonStyle.Link,
												url: `https://discord.com/channels/${job.guildId}/${job.channelId}/${job.initialMessageId}`,
												label: "Transcribed Message",
											},
										],
										type: ComponentType.ActionRow,
									},
								],
						  })
						: this.discordApi.channels.editMessage(job.channelId!, job.responseMessageId, {
								content: body.output.transcription,
								allowed_mentions: { parse: [] },
						  }),
				]);

			return context.text("Success");
		});
	}
}
