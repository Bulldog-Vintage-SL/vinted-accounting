/*
  Helpers de chats por plataforma, compartidos entre la página de chats
  y el executor de la cola (replyChat).
  Ajusta el import de tipos a la ruta real de tu carpeta de chats.
*/

import type { Chat } from '@/app/chats/types'
import {
  fetchVestiaireChatMessages,
  sendVestiaireChatMessage,
  fetchVintedChatMessages,
  sendVintedChatMessage,
  fetchDepopChatMessages,
  sendDepopChatMessage,
  fetchWallapopChatMessages,
  sendWallapopChatMessage,
} from '@/lib/external-integrations'

export type ChatMessage = Chat['messages'][number]

export interface ReplyChatResult {
  replied?: true
  skipped?: true
  reason?: string
  reply?: string
  sent?: ChatMessage
  messages?: ChatMessage[]
}

export type ReplyChatOptions = {
  replyToOwn: boolean;
  instructions?: string;
};

export type ReplyChatEntity = {
  chat: Chat;
  options?: ReplyChatOptions;
};

export function loadChatMessages(chat: Chat) {
  const channel = chat.channelId || chat.id
  switch (chat.platform) {
    case 'vinted':
      return fetchVintedChatMessages(channel)
    case 'depop':
      return fetchDepopChatMessages(channel, chat.ownUserId)
    case 'wallapop':
      return fetchWallapopChatMessages(channel)
    default:
      return fetchVestiaireChatMessages(channel)
  }
}

export function sendChatMessage(chat: Chat, text: string) {
  const channel = chat.channelId || chat.id
  switch (chat.platform) {
    case 'vinted':
      return sendVintedChatMessage(channel, text)
    case 'depop':
      return sendDepopChatMessage(channel, chat.recipientUserId as string | number, text)
    case 'wallapop':
      return sendWallapopChatMessage(channel, text, {
        toUserHash: chat.senderId,
        fromUserHash: chat.ownUserHash,
      })
    default:
      return sendVestiaireChatMessage(channel, text)
  }
}

// Contexto que se manda a /api/response-suggestions
export function buildResponseContext(messages: ChatMessage[]) {
  return messages
    .filter((m) => !m.systemEvent)
    .map((m) => ({
      role: m.isOwn ? ('own' as const) : ('contact' as const),
      content: m.offer
        ? `${m.content} [Oferta: ${m.offer.price} — ${m.offer.statusTitle}]`
        : m.content,
      createdAt: m.createdAt,
    }))
}