import type { Client, Message } from "discord.js"
import { MessageFlags, MessageReferenceType } from "discord.js"
import { logger } from "@/util/logger"

export interface MessageSource {
  attachmentUrl: string
  originalMessageId: string
  /** undefined means the original author could not be resolved (forward from inaccessible channel) */
  originalAuthorId: string | undefined
}

function findVideoUrl(value: any, visited = new Set()): string | undefined {
  if (!value || typeof value !== "object" || visited.has(value)) return undefined
  visited.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUrl(item, visited)
      if (found) return found
    }
    return undefined
  }

  const contentType = value.content_type ?? value.contentType
  if (contentType?.startsWith("video/") || contentType?.startsWith("audio/")) {
    const url = value.proxy_url ?? value.proxyUrl ?? value.url
    logger.debug({ contentType, url }, "findVideoUrl: found media")
    return url
  }

  for (const val of Object.values(value)) {
    const found = findVideoUrl(val, visited)
    if (found) return found
  }
}

/**
 * Resolves the transcription source for a message, handling forwards and components v2.
 * Returns null if no transcribable attachment is found.
 */
export async function resolveMessageSource(message: Message, client: Client): Promise<MessageSource | null> {
  const isForward = message.reference?.type === MessageReferenceType.Forward
  const isComponentsV2 = message.flags.has(MessageFlags.IsComponentsV2)

  logger.debug(
    {
      messageId: message.id,
      flags: message.flags.bitfield,
      isForward,
      isComponentsV2,
      attachmentCount: message.attachments.size,
      componentCount: message.components.length,
      hasMessageSnapshots: message.messageSnapshots.size > 0
    },
    "resolveMessageSource: starting"
  )

  let originalAuthorId: string | undefined = message.author.id
  let originalMessageId = message.id
  let attachmentUrl: string | undefined

  if (isForward) {
    const { channelId, messageId } = message.reference!
    originalMessageId = messageId ?? message.id
    logger.debug({ channelId, messageId }, "resolveMessageSource: handling forward")

    try {
      const refChannel = await client.channels.fetch(channelId)
      if (refChannel?.isTextBased()) {
        const originalMessage = await refChannel.messages.fetch(messageId)
        originalAuthorId = originalMessage.author.id
      }
    } catch (err) {
      logger.warn({ err, channelId, messageId }, "resolveMessageSource: failed to fetch forwarded channel/message")
      originalAuthorId = undefined
    }

    attachmentUrl = message.messageSnapshots.first()?.attachments.first()?.url
    logger.debug({ attachmentUrl }, "resolveMessageSource: forward attachment url")
  } else if (isComponentsV2) {
    logger.debug({ componentCount: message.components.length, components: JSON.stringify(message.components).slice(0, 500) }, "resolveMessageSource: searching components for media")
    attachmentUrl = findVideoUrl(message.components)
    logger.debug({ attachmentUrl }, "resolveMessageSource: componentsV2 result")
  } else {
    attachmentUrl = message.attachments.first()?.url
    logger.debug({ attachmentUrl, attachmentCount: message.attachments.size }, "resolveMessageSource: plain attachment")
  }

  if (!attachmentUrl) {
    logger.debug({ messageId: message.id, isForward, isComponentsV2 }, "resolveMessageSource: no attachment url found, returning null")
    return null
  }

  logger.debug({ attachmentUrl, originalMessageId, originalAuthorId }, "resolveMessageSource: resolved source")
  return { attachmentUrl, originalMessageId, originalAuthorId }
}
