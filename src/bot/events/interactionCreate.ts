import type {
	APIInteraction,
	ToEventProps,
	APIMessageComponentButtonInteraction,
	APIMessageComponentSelectMenuInteraction,
	APIMessageComponentInteraction,
} from "@discordjs/core";
import { ComponentType, GatewayDispatchEvents, InteractionContextType, InteractionType } from "@discordjs/core";
import EventHandler from "../../../lib/classes/EventHandler.js";
import type ExtendedClient from "../../../lib/extensions/ExtendedClient.js";
import { interactionsMetric, userLocalesMetric } from "../../../lib/utilities/metrics.js";

export default class InteractionCreate extends EventHandler {
	public constructor(client: ExtendedClient) {
		super(client, GatewayDispatchEvents.InteractionCreate);
	}

	/**
	 * Handle the creation of a new interaction.
	 *
	 * https://discord.com/developers/docs/topics/gateway-events#interaction-create
	 */
	public override async run({ shardId, data }: ToEventProps<APIInteraction>) {
		// This is very cursed, but it works.
		const dd = data.data as any;

		interactionsMetric.add(1, {
			name: dd.name ?? dd.custom_id ?? "null",
			type: data.type,
			context: data.context ? InteractionContextType[data.context] : "UNKNOWN",
			shard: shardId,
		});

		userLocalesMetric.add(1, {
			locale: (data.member ?? data).user?.locale ?? this.client.languageHandler.defaultLanguage?.id,
			shard: shardId,
		});

		if (data.type === InteractionType.ApplicationCommand) {
			return this.client.applicationCommandHandler.handleApplicationCommand({
				data,
				shardId,
			});
		}

		if (data.type === InteractionType.ApplicationCommandAutocomplete) {
			return this.client.autoCompleteHandler.handleAutoComplete({
				data,
				shardId,
			});
		}

		if (data.type === InteractionType.MessageComponent) {
			if (isMessageComponentButtonInteraction(data)) return this.client.buttonHandler.handleButton({ data, shardId });
			if (isMessageComponentSelectMenuInteraction(data))
				return this.client.selectMenuHandler.handleSelectMenu({ data, shardId });
		} else if (data.type === InteractionType.ModalSubmit) {
			return this.client.modalHandler.handleModal({
				data,
				shardId,
			});
		}
	}
}

// https://github.com/discordjs/discord-api-types/blob/189e91d62cb898b418ca11434280558d50948dd8/utils/v10.ts#L137-L159

function isMessageComponentButtonInteraction(
	interaction: APIMessageComponentInteraction,
): interaction is APIMessageComponentButtonInteraction {
	return interaction.data.component_type === ComponentType.Button;
}

function isMessageComponentSelectMenuInteraction(
	interaction: APIMessageComponentInteraction,
): interaction is APIMessageComponentSelectMenuInteraction {
	return [
		ComponentType.StringSelect,
		ComponentType.UserSelect,
		ComponentType.RoleSelect,
		ComponentType.MentionableSelect,
		ComponentType.ChannelSelect,
	].includes(interaction.data.component_type);
}
