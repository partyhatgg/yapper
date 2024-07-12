import type {
	APIApplicationCommandInteractionDataBooleanOption,
	APIApplicationCommandInteractionDataIntegerOption,
	APIApplicationCommandInteractionDataMentionableOption,
	APIApplicationCommandInteractionDataNumberOption,
	APIApplicationCommandInteractionDataStringOption,
	APIApplicationCommandInteractionDataSubcommandGroupOption,
	APIApplicationCommandInteractionDataSubcommandOption,
	APIAttachment,
	APIInteractionDataResolvedChannel,
	APIInteractionDataResolvedGuildMember,
	APIRole,
	APIUser,
} from "@discordjs/core";
import type { TranscriptionState } from "../lib/utilities/functions.js";

export interface InteractionArguments {
	attachments?: Record<string, APIAttachment>;
	booleans?: Record<string, APIApplicationCommandInteractionDataBooleanOption>;
	channels?: Record<string, APIInteractionDataResolvedChannel>;
	focused?:
		| APIApplicationCommandInteractionDataIntegerOption
		| APIApplicationCommandInteractionDataNumberOption
		| APIApplicationCommandInteractionDataStringOption;
	integers?: Record<string, APIApplicationCommandInteractionDataIntegerOption>;
	members?: Record<string, APIInteractionDataResolvedGuildMember>;
	mentionables?: Record<string, APIApplicationCommandInteractionDataMentionableOption>;
	numbers?: Record<string, APIApplicationCommandInteractionDataNumberOption>;
	roles?: Record<string, APIRole>;
	strings?: Record<string, APIApplicationCommandInteractionDataStringOption>;
	subCommand?: APIApplicationCommandInteractionDataSubcommandOption;
	subCommandGroup?: APIApplicationCommandInteractionDataSubcommandGroupOption;
	users?: Record<string, APIUser>;
}

export type APIInteractionWithArguments<T> = T & {
	arguments: InteractionArguments;
};

export interface RunResponse {
	id: string;
	status: TranscriptionState;
}

export interface RunPodRunSyncResponse extends RunResponse {
	delayTime: number;
	executionTime: number;
	output: {
		detected_language: string;
		device: string;
		model: string;
		segments: {
			avg_logprob: number;
			compression_ratio: number;
			end: number;
			id: number;
			no_speech_prob: number;
			seek: number;
			start: number;
			temperature: number;
			text: string;
			tokens: number[];
		}[];
		transcription: string;
		translation: string;
	};
	status: TranscriptionState.COMPLETED;
	webhook?: string;
}

export interface RunPodHealthResponse {
	jobs: {
		completed: number;
		failed: number;
		inProgress: number;
		inQueue: number;
		retried: number;
	};
	workers: {
		idle: number;
		initializing: number;
		ready: number;
		running: number;
		throttled: number;
	};
}
