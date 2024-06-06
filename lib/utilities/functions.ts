/* eslint-disable n/no-sync */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { env } from "node:process";
import Config from "../../config/bot.config.js";
import type {
	ChatterRunSyncResponse,
	RunPodHealthResponse,
	RunPodRunSyncResponse,
	RunResponse,
} from "../../typings/index.js";
import type Language from "../classes/Language.js";
import Logger from "../classes/Logger.js";
import type ExtendedClient from "../extensions/ExtendedClient.js";
import { InfrastructureUsed, Job } from "@prisma/client";

export enum TranscriptionState {
	CANCELLED = "CANCELLED",
	COMPLETED = "COMPLETED",
	FAILED = "FAILED",
	IN_PROGRESS = "IN_PROGRESS",
	IN_QUEUE = "IN_QUEUE",
}

export default class Functions {
	/**
	 * Our extended client.
	 */
	private readonly client: ExtendedClient;

	/**
	 * One second in milliseconds.
	 */
	private SEC = 1e3;

	/**
	 * One minute in milliseconds.
	 */
	private MIN = this.SEC * 60;

	/**
	 * One hour in milliseconds.
	 */
	private HOUR = this.MIN * 60;

	/**
	 * One day in milliseconds.
	 */
	private DAY = this.HOUR * 24;

	/**
	 * One year in milliseconds.
	 */
	private YEAR = this.DAY * 365.25;

	public constructor(client: ExtendedClient) {
		this.client = client;
	}

	/**
	 * Get all of the files in a directory.
	 *
	 * @param directory The directory to get all of the files from.
	 * @param fileExtension The file extension to search for, leave blank to get all files.
	 * @param createDirectoryIfNotFound Whether or not the directory we want to search for should be created if it doesn't already exist.
	 * @returns The files within the directory.
	 */
	public getFiles(directory: string, fileExtension: string, createDirectoryIfNotFound = false) {
		if (createDirectoryIfNotFound && !existsSync(directory)) mkdirSync(directory);

		return readdirSync(directory).filter((file) => file.endsWith(fileExtension));
	}

	/**
	 * Parses the input string, returning the number of milliseconds.
	 *
	 * @param input The human-readable time string; eg: 10min, 10m, 10 minutes.
	 * @param language The language to use for the parsing.
	 * @returns The parsed value.
	 */
	public parse(input: string, language?: Language) {
		if (!language) language = this.client.languageHandler.getLanguage("en-US");

		const RGX =
			// eslint-disable-next-line unicorn/no-unsafe-regex, prefer-named-capture-group
			/^(-?(?:\d+)?\.?\d+) *(m(?:illiseconds?|s(?:ecs?)?))?(s(?:ec(?:onds?|s)?)?)?(m(?:in(?:utes?|s)?)?)?(h(?:ours?|rs?)?)?(d(?:ays?)?)?(w(?:eeks?|ks?)?)?(y(?:ears?|rs?)?)?$/;
		// language.get("PARSE_REGEX");

		// eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
		const arr = input.toLowerCase().match(RGX);
		let num: number;
		// eslint-disable-next-line no-cond-assign
		if (arr !== null && (num = Number.parseFloat(arr[1] || ""))) {
			if (arr[3] !== null) return num * this.SEC;
			if (arr[4] !== null) return num * this.MIN;
			if (arr[5] !== null) return num * this.HOUR;
			if (arr[6] !== null) return num * this.DAY;
			if (arr[7] !== null) return num * this.DAY * 7;
			if (arr[8] !== null) return num * this.YEAR;
			return num;
		}

		return null;
	}

	private _format(
		value: number,
		prefix: string,
		type: "day" | "hour" | "minute" | "ms" | "second" | "year",
		long: boolean,
		language: Language,
	) {
		const number = Math.trunc(value) === value ? value : Math.trunc(value + 0.5);

		if (type === "ms") return `${prefix}${number}ms`;

		return `${prefix}${number}${
			long
				? ` ${language.get(
						(number === 1 ? `${type}_ONE` : `${type}_OTHER`).toUpperCase() as Uppercase<
							`${typeof type}_ONE` | `${typeof type}_OTHER`
						>,
					)}`
				: language.get(`${type}_SHORT`.toUpperCase() as Uppercase<`${typeof type}_SHORT`>)
		}`;
	}

	/**
	 * Formats the millisecond count to a human-readable time string.
	 *
	 * @param milli The number of milliseconds.
	 * @param long Whether or not the output should use the interval's long/full form; eg hour or hours instead of h.
	 * @param language The language to use for formatting.
	 * @returns The formatting count.
	 */
	public format(milli: number, long = true, language?: Language) {
		if (!language) language = this.client.languageHandler.defaultLanguage!;

		const prefix = milli < 0 ? "-" : "";
		const abs = milli < 0 ? -milli : milli;

		if (abs < this.SEC) return `${milli}${long ? " ms" : "ms"}`;
		if (abs < this.MIN) return this._format(abs / this.SEC, prefix, "second", long, language);
		if (abs < this.HOUR) return this._format(abs / this.MIN, prefix, "minute", long, language);
		if (abs < this.DAY) return this._format(abs / this.HOUR, prefix, "hour", long, language);
		if (abs < this.YEAR) return this._format(abs / this.DAY, prefix, "day", long, language);

		return this._format(abs / this.YEAR, prefix, "year", long, language);
	}

	/**
	 * Generate a unix timestamp for Discord to be rendered locally per user.
	 *
	 * @param options - The options to use for the timestamp.
	 * @param options.timestamp - The timestamp to use, defaults to the current time.
	 * @param options.type - The type of timestamp to generate, defaults to "f".
	 * @return The generated timestamp.
	 */
	public generateTimestamp(options?: {
		timestamp?: Date | number;
		type?: "D" | "d" | "F" | "f" | "R" | "T" | "t";
	}): string {
		let timestamp = options?.timestamp ?? new Date();
		const type = options?.type ?? "f";
		if (timestamp instanceof Date) timestamp = timestamp.getTime();
		return `<t:${Math.floor(timestamp / 1_000)}:${type}>`;
	}

	/**
	 * Generate a unix timestamp for Discord to be rendered locally per user.
	 *
	 * @param options The options to use for the timestamp.
	 * @param options.timestamp The timestamp to use, defaults to the current time.
	 * @param options.type The type of timestamp to generate, defaults to "f".
	 * @return The generated timestamp.
	 */
	// eslint-disable-next-line sonarjs/no-identical-functions
	public static generateTimestamp(options?: {
		timestamp?: Date | number;
		type?: "D" | "d" | "F" | "f" | "R" | "T" | "t";
	}): string {
		let timestamp = options?.timestamp ?? new Date();
		const type = options?.type ?? "f";
		if (timestamp instanceof Date) timestamp = timestamp.getTime();
		return `<t:${Math.floor(timestamp / 1_000)}:${type}>`;
	}

	/**
	 * Upload content to a hastebin server.
	 *
	 * @param content The content to upload to the hastebin server.
	 * @param options The options to use for the upload.
	 * @param options.server The server to upload to, defaults to the client's configured hastebin server.
	 * @param options.type The type of the content, defaults to "md".
	 * @returns The URL to the uploaded content.
	 */
	public async uploadToHastebin(content: string, options?: { server?: string; type?: string }) {
		try {
			const response = await fetch(`${options?.server ?? this.client.config.hastebin}/documents`, {
				method: "POST",
				body: content,
				headers: {
					"User-Agent": `${this.client.config.botName.toLowerCase().split(" ").join("_")}/${
						this.client.config.version
					}`,
				},
			});

			const responseJSON = await response.json();

			return `${options?.server ?? this.client.config.hastebin}/${responseJSON.key}.${options?.type ?? "md"}`;
		} catch (error) {
			this.client.logger.error(error);
			await this.client.logger.sentry.captureWithExtras(error, {
				Hastebin: options?.server ?? this.client.config.hastebin,
				Content: content,
			});

			return null;
		}
	}

	/**
	 * Upload content to a hastebin server. This is a static method.
	 *
	 * @param content The content to upload to the hastebin server.
	 * @param options The options to use for the upload.
	 * @param options.server The server to upload to, defaults to the client's configured hastebin server.
	 * @param options.type The type of the content, defaults to "md".
	 * @returns The URL to the uploaded content.
	 */
	public static async uploadToHastebin(content: string, options?: { server?: string; type?: string }) {
		try {
			const response = await fetch(`${options?.server ?? Config.hastebin}/documents`, {
				method: "POST",
				body: content,
				headers: {
					"User-Agent": `${Config.botName.toLowerCase().split(" ").join("_")}/${Config.version}`,
				},
			});

			const responseJSON = await response.json();

			return `${options?.server ?? Config.hastebin}/${responseJSON.key}.${options?.type ?? "md"}`;
		} catch (error) {
			Logger.error(error);
			await Logger.sentry.captureWithExtras(error, {
				Hastebin: options?.server ?? Config.hastebin,
				Content: content,
			});

			return null;
		}
	}

	/**
	 * Verify if the input is a function.
	 *
	 * @param input The input to verify.
	 * @returns Whether the input is a function or not.
	 */
	public isFunction(input: any): boolean {
		return typeof input === "function";
	}

	/**
	 * Verify if an object is a promise.
	 *
	 * @param input The object to verify.
	 * @returns Whether the object is a promise or not.
	 */
	public isThenable(input: any): boolean {
		if (!input) return false;
		return (
			input instanceof Promise ||
			(input !== Promise.prototype && this.isFunction(input.then) && this.isFunction(input.catch))
		);
	}

	/**
	 * Hash a string into SHA256.
	 *
	 * @param string The string to hash.
	 * @return The hashed string.
	 */
	public hash(string: string): string {
		return createHash("sha256").update(string).digest("hex");
	}

	/**
	 * Get the status of a RunPod endpoint.
	 *
	 * @returns The status of the RunPod endpoint.
	 */
	public static async getEndpointHealth() {
		const response = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/health`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
			},
		});

		return response.json() as Promise<RunPodHealthResponse>;
	}

	/**
	 * Get the status of a Chatter job.
	 *
	 * @param jobId The job ID to get the status of.
	 * @returns The status of the Chatter job.
	 */
	public static async getChatterJobStatus(jobId: string) {
		const response = await fetch(`${env.CHATTER_URL}/job/${jobId}`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: `${env.CHATTER_API_KEY}`,
			},
		});

		if (response.status !== 200) return null;

		return response.json() as Promise<ChatterRunSyncResponse | RunResponse>;
	}

	/**
	 * Get the status of a RunPod job.
	 *
	 * @param jobId The job ID to get the status of.
	 * @returns The status of the RunPod job.
	 */
	public static async getRunpodJobStatus(jobId: string) {
		const response = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${jobId}`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
			},
		});

		if (response.status !== 200) return null;

		return response.json() as Promise<RunPodRunSyncResponse | RunResponse>;
	}

	/**
	 * Get the status of a job whose source you do not know.
	 *
	 * @param job The Prisma Job to get a status of
	 * @returns The respective platform status response.
	 */
	public static async getJobStatus(job: Job): Promise<RunResponse | null> {
		let res;
		if (job.infrastructureUsed === InfrastructureUsed.SERVERLESS) {
			res = await this.getRunpodJobStatus(job.id);
		} else {
			res = await this.getChatterJobStatus(job.id);
		}

		return res;
	}

	/**
	 * Cancel a RunPod job.
	 *
	 * @param jobId The job ID to cancel.
	 * @returns The status of the RunPod job.
	 */
	public async cancelJob(jobId: string) {
		const response = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/cancel/${jobId}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
			},
		});

		return response.json() as Promise<RunResponse & { status: TranscriptionState.CANCELLED }>;
	}

	/**
	 * Transcribe an attachment using Chatter
	 *
	 * @param attachmentUrl The attachment to transcribe.
	 */
	public static async transcribeAudio(attachmentUrl: string) {
		const response = await fetch(`${env.CHATTER_URL}/transcribe`, {
			method: "POST",
			body: JSON.stringify({
				url: attachmentUrl,
			}),
			headers: {
				"Content-Type": "application/json",
				Authorization: `${env.CHATTER_API_KEY}`,
			},
		});

		const data: RunResponse = await response.json();

		return data;
	}

	/**
	 * Transcribe an attachment using RunPod.
	 *
	 * @param attachmentUrl The attachment to transcribe.
	 * @param endpointType Run will return a job ID and state, runsync will try to return the transcription, if it fails to do so within 90 seconds then it will return a job ID and state.
	 * @param model The model to use for the transcription. Different models will have different accuracies and speeds.
	 * @returns The job ID and state, or the transcription.
	 */
	public static async transcribeAudioRunPod(
		attachmentUrl: string,
		endpointType: "run" | "runsync",
		model: "base" | "large-v1" | "large-v2" | "large-v3" | "medium" | "small" | "tiny",
	) {
		const response = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/${endpointType}`, {
			method: "POST",
			body: JSON.stringify({
				input: {
					audio: attachmentUrl,
					model,
					transcription: "plain_text",
					translate: true,
					temperature: 0,
				},
				enable_vad: false,
				webhook: `${env.BASE_URL}/job_complete${env.SECRET}`,
			}),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
			},
		});

		const data: RunResponse = await response.json();

		if (endpointType === "runsync" && data.status === TranscriptionState.COMPLETED) {
			const typedData = data as RunPodRunSyncResponse;

			return {
				id: data.id,
				status: data.status,
				queueTime: typedData.delayTime,
				executionTime: typedData.executionTime,
				language: typedData.output.detected_language,
				transcription: typedData.output.transcription,
				translation: typedData.output.translation,
			};
		}

		return data;
	}
}
