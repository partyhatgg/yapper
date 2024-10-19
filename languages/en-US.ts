export default {
	LANGUAGE_ENABLED: true,
	LANGUAGE_ID: "en-US",
	LANGUAGE_NAME: "English, US",

	PARSE_REGEX:
		/^(-?(?:\d+)?\.?\d+) *(m(?:illiseconds?|s(?:ecs?)?))?(s(?:ec(?:onds?|s)?)?)?(m(?:in(?:utes?|s)?)?)?(h(?:ours?|rs?)?)?(d(?:ays?)?)?(w(?:eeks?|ks?)?)?(y(?:ears?|rs?)?)?$/,
	MS_OTHER: "ms",
	SECOND_ONE: "second",
	SECOND_OTHER: "seconds",
	SECOND_SHORT: "s",
	MINUTE_ONE: "minute",
	MINUTE_OTHER: "minutes",
	MINUTE_SHORT: "m",
	HOUR_ONE: "hour",
	HOUR_OTHER: "hours",
	HOUR_SHORT: "h",
	DAY_ONE: "day",
	DAY_OTHER: "days",
	DAY_SHORT: "d",
	YEAR_ONE: "year",
	YEAR_OTHER: "years",
	YEAR_SHORT: "y",

	CreateInstantInvite: "Create Invite",
	KickMembers: "Kick Members",
	BanMembers: "Ban Members",
	Administrator: "Administrator",
	ManageChannels: "Manage Channels",
	ManageGuild: "Manage Server",
	AddReactions: "Add Reactions",
	ViewAuditLog: "View Audit Log",
	PrioritySpeaker: "Priority Speaker",
	Stream: "Video",
	ViewChannel: "View Channels",
	SendMessages: "Send Messages and Create Posts",
	SendTTSMessages: "Send Text-To-Speech Messages",
	ManageMessages: "Manage Messages",
	EmbedLinks: "Embed Links",
	AttachFiles: "Attach Files",
	ReadMessageHistory: "Read Message History",
	MentionEveryone: "Mention @everyone, @here, and All Roles",
	UseExternalEmojis: "Use External Emojis",
	ViewGuildInsights: "View Server Insights",
	Connect: "Connect",
	Speak: "Speak",
	MuteMembers: "Mute Members",
	DeafenMembers: "Deafen Members",
	MoveMembers: "Move Members",
	UseVAD: "Use Voice Activity",
	ChangeNickname: "Change Nickname",
	ManageNicknames: "Manage Nicknames",
	ManageRoles: "Manage Roles",
	ManageWebhooks: "Manage Webhooks",
	ManageEmojisAndStickers: "Manage Emojis and Stickers",
	ManageGuildExpressions: "Manage Expressions",
	UseApplicationCommands: "Use Application Commands",
	RequestToSpeak: "Request to Speak",
	ManageEvents: "Manage Events",
	ManageThreads: "Manage Threads and Posts",
	CreatePublicThreads: "Create Public Threads",
	CreatePrivateThreads: "Create Private Threads",
	UseExternalStickers: "Use External Stickers",
	SendMessagesInThreads: "Send Messages in Threads abd Posts",
	UseEmbeddedActivities: "Use Activities",
	ModerateMembers: "Timeout Members",
	ViewCreatorMonetizationAnalytics: "View Creator Monetization Analytics",
	CreateGuildExpressions: "Create Guild Expressions",
	UseSoundboard: "Use Soundboard",
	CreateEvents: "Create Events",
	UseExternalSounds: "Use External Sounds",
	SendVoiceMessages: "Send Voice Messages",
	SendPolls: "Send Polls",
	UseExternalApps: "Use External Apps",

	INVALID_ARGUMENT_TITLE: "Invalid Argument",

	INVALID_PATH_TITLE: "Invalid Command",
	INVALID_PATH_DESCRIPTION: "I have absolutely no idea how you reached this response.",

	INTERNAL_ERROR_TITLE: "Internal Error Encountered",
	INTERNAL_ERROR_DESCRIPTION:
		"An internal error has occurred, please try again later. This has already been reported to my developers.",
	SENTRY_EVENT_ID_FOOTER: "Sentry Event ID: {{eventId}}",

	NON_EXISTENT_APPLICATION_COMMAND_TITLE: "This {{type}} Does Not Exist",
	NON_EXISTENT_APPLICATION_COMMAND_DESCRIPTION:
		"You've somehow used a {{type}} that doesn't exist. I've removed the command so this won't happen in the future, this has already been reported to my developers.",

	MISSING_PERMISSIONS_BASE_TITLE: "Missing Permissions",
	MISSING_PERMISSIONS_OWNER_ONLY_DESCRIPTION: "This {{type}} can only be used by the owner of this server!",
	MISSING_PERMISSIONS_DEVELOPER_ONLY_DESCRIPTION: "This {{type}} can only be used by my developers!",
	MISSING_PERMISSIONS_USER_PERMISSIONS_ONE_DESCRIPTION:
		"You are missing the {{missingPermissions}} permission, which is required to use this {{type}}!",
	MISSING_PERMISSIONS_USER_PERMISSIONS_OTHER_DESCRIPTION:
		"You are missing the {{missingPermissions}} permissions, which are required to use this {{type}}!",
	MISSING_PERMISSIONS_CLIENT_PERMISSIONS_ONE_DESCRIPTION:
		"I am missing the {{missingPermissions}} permission, which I need to run this {{type}}!",
	MISSING_PERMISSIONS_CLIENT_PERMISSIONS_OTHER_DESCRIPTION:
		"I am missing the {{missingPermissions}} permissions, which I need to run this {{type}}!",

	TYPE_ON_COOLDOWN_TITLE: "{{type}} On Cooldown",
	TYPE_ON_COOLDOWN_DESCRIPTION: "This {{type}} is on cooldown for another {{formattedTime}}!",
	COOLDOWN_ON_TYPE_TITLE: "Cooldown On All {{type}}",
	COOLDOWN_ON_TYPE_DESCRIPTION: "Please wait a second before running another {{type}}!",

	AN_ERROR_HAS_OCCURRED_TITLE: "An Error Has Occurred",
	AN_ERROR_HAS_OCCURRED_DESCRIPTION:
		"An error has occurred, please try again later. This has already been reported to my developers.",

	PING_COMMAND_NAME: "ping",
	PING_COMMAND_DESCRIPTION: "Pong! Get the current ping / latency of Yapper.",

	PING: "Ping?",
	PONG: "Pong! (Host latency of {{hostLatency}}ms)",

	TRANSCRIBE_COMMAND_NAME: "Transcribe",

	PREMIUM_COMMAND_NAME: "premium",
	PREMIUM_COMMAND_DESCRIPTION: "Manage Yapper premium.",
	PREMIUM_COMMAND_INFO_SUB_COMMAND_NAME: "info",
	PREMIUM_COMMAND_INFO_SUB_COMMAND_DESCRIPTION: "Get information about Yapper premium or subscribe.",
	PREMIUM_COMMAND_APPLY_SUB_COMMAND_NAME: "apply",
	PREMIUM_COMMAND_APPLY_SUB_COMMAND_DESCRIPTION: "Apply premium to the current server.",
	PREMIUM_COMMAND_REMOVE_SUB_COMMAND_NAME: "remove",
	PREMIUM_COMMAND_REMOVE_SUB_COMMAND_DESCRIPTION: "Remove premium from a server.",
	PREMIUM_COMMAND_REMOVE_SUB_COMMAND_SERVER_OPTION_NAME: "server",
	PREMIUM_COMMAND_REMOVE_SUB_COMMAND_SERVER_OPTION_DESCRIPTION:
		"The server to remove premium from, defaults to the current server if not specified.",

	PREMIUM_INFO_NO_PRODUCTS_TITLE: "No Products Available",
	PREMIUM_INFO_NO_PRODUCTS_DESCRIPTION:
		"There are currently no products available for purchase, thus Premium is unavailable.",

	PREMIUM_INFO_TITLE: "Yapper Premium",
	PREMIUM_INFO_DESCRIPTION:
		"Yapper Premium offers transcriptions of audio and video attachments, removal of the five minute content length limit, as well as higher quality transcriptions. Subscribe to a plan by choosing one from the dropdown below!{{subscriptionInfo}}",
	SUBSCRIPTION_INFO:
		"\n\nYou are currently subscribed to Yapper Premium and have {{appliedGuildCount}}/{{maxGuildCount}} active premium guilds. Your subscription will renew on {{date}}!",

	CONFIG_COMMAND_NAME: "config",
	CONFIG_COMMAND_DESCRIPTION: "Configure Yapper for your server.",
	CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_NAME: "auto_transcript_voice_messages",
	CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_DESCRIPTION:
		"Manage automatically transcribe voice messages.",
	CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_ENABLE_SUB_COMMAND_NAME: "enable",
	CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_ENABLE_SUB_COMMAND_DESCRIPTION:
		"Enable automatically transcribing voice messages.",
	CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_DISABLE_SUB_COMMAND_NAME: "disable",
	CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_DISABLE_SUB_COMMAND_DESCRIPTION:
		"Disable automatically transcribing voice messages.",

	AUTO_TRANSCRIPT_VOICE_MESSAGES_ENABLED_TITLE: "Auto Transcript Voice Messages Enabled",
	AUTO_TRANSCRIPT_VOICE_MESSAGES_ENABLED_DESCRIPTION:
		"Yapper will now automatically transcribe voice messages in this server.",

	AUTO_TRANSCRIPT_VOICE_MESSAGES_DISABLED_TITLE: "Auto Transcript Voice Messages Disabled",
	AUTO_TRANSCRIPT_VOICE_MESSAGES_DISABLED_DESCRIPTION:
		"Yapper will no longer automatically transcribe voice messages in this server.",

	NO_VALID_ATTACHMENTS_ERROR: ":man_gesturing_no: There are no valid attachments on this message!",
	MESSAGE_STILL_BEING_TRANSCRIBED_ERROR:
		"This message is still being transcribed, please wait a moment and then try again!",
	TRANSCRIBING: ":writing_hand: Transcribing, this may take a moment...",
	READ_MORE_BUTTON_LABEL: "Read More",
	TRANSCRIBED_MESSAGE_BUTTON_LABEL: "Transcribed Message",

	NOT_A_PREMIUM_GUILD_ERROR_TITLE: "Not A Premium Guild",
	NOT_A_PREMIUM_GUILD_CONTEXT_MENU_ERROR_DESCRIPTION:
		"This server is not a premium guild, please upgrade to premium to use context menus.",
	NOT_A_PREMIUM_GUILD_FILES_ERROR_DESCRIPTION:
		"This server is not a premium guild, please upgrade to premium to transcribe files.",

	IGNORE_COMMAND_NAME: "ignore",
	IGNORE_COMMAND_DESCRIPTION: "Configure how Yapper ignores users.",
	IGNORE_COMMAND_CONTEXT_MENU_SUB_COMMAND_NAME: "context_menu",
	IGNORE_COMMAND_CONTEXT_MENU_SUB_COMMAND_DESCRIPTION:
		"Have Yapper ignore when someone else is trying to transcribe your messages with a context menu.",
	IGNORE_COMMAND_AUTO_TRANSCRIPTION_SUB_COMMAND_NAME: "auto_transcription",
	IGNORE_COMMAND_AUTO_TRANSCRIPTION_SUB_COMMAND_DESCRIPTION:
		"Have Yapper ignore your messages when auto transcription is enabled.",
	IGNORE_COMMAND_ALL_SUB_COMMAND_NAME: "all",
	IGNORE_COMMAND_ALL_SUB_COMMAND_DESCRIPTION:
		"Have Yapper ignore your messages completely (unless you use a context menu on your own messages).",

	IGNORED_SUCCESSFULLY_TITLE: "Ignored Successfully",
	IGNORED_SUCCESSFULLY_DESCRIPTION: "Yapper will now ignore messages from you.",

	UNIGORED_SUCCESSFULLY_TITLE: "Unignored Successfully",
	UNIGORED_SUCCESSFULLY_DESCRIPTION: "Yapper will no longer ignore messages from you.",

	USER_IS_IGNORED_ERROR: "This user has opted out of Yapper, their messages can not be transcribed.",

	NOT_A_GUILD_TITLE: "Not A Server",
	NOT_A_GUILD_DESCRIPTION: "You can only use this command in a server!",

	NOT_A_PREMIUM_USER_ERROR_TITLE: "Not A Premium User",
	NOT_A_PREMIUM_USER_ERROR_DESCRIPTION: "You are not a premium user, please subscribe to premium to use this command.",

	MAX_GUILD_COUNT_REACHED_ERROR_TITLE: "Max Guild Count Reached",
	MAX_GUILD_COUNT_REACHED_ERROR_DESCRIPTION:
		"You have reached your maximum guild count, please remove a guild from premium to add another.",

	PREMIUM_APPLIED_TITLE: "Premium Applied",
	PREMIUM_APPLIED_DESCRIPTION: "This server is now a premium guild!",

	PREMIUM_REMOVED_TITLE: "Premium Removed",
	PREMIUM_REMOVED_DESCRIPTION: "I have removed premium from the guild you've provided!",
};
