/*
  Workflows de chats de Vestiaire Collective.
  El inbox usa notification-feed (la misma API que la web).
  El hilo y el envío van por Stream Chat con el token de /chat/user/token.
*/

import type { WorkflowStep } from '../types'
import type { Chat, ChatMessage } from '@/app/chats/types'

export const VESTIAIRE_STREAM_API_KEY = '2z32xywf24hh'
export const VESTIAIRE_CHAT_FEED_LIMIT = 60
export const VESTIAIRE_STREAM_MESSAGE_LIMIT = 300
export const VESTIAIRE_STREAM_MESSAGE_MAX_PAGES = 10
const BASE = 'https://apiv2.vestiairecollective.com'

export function buildVestiaireChatsUrl(offset = 0) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(VESTIAIRE_CHAT_FEED_LIMIT),
    category: 'messages',
    isoCountry: 'ES',
    'x-siteid': '12',
    'x-language': 'es',
    'x-currency': 'EUR',
  })
  return `${BASE}/notification-feed/v2?${params.toString()}`
}

const CHAT_BACKGROUND_REQUEST = {
  skipDelay: true,
  runInBackground: true,
} as const

export function buildFetchVestiaireChatsSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'GET_VEST_USER_ID',
      request: {
        url: `${BASE}/chat/user/token?isoCountry=ES`,
        method: 'GET',
        extractFromDom: 'userId',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'GET_VEST_CHATS',
      request: {
        url: buildVestiaireChatsUrl(0),
        method: 'GET',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
  ]
}

export function buildFetchVestiaireChatMessagesSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'GET_VEST_USER_ID',
      request: {
        url: `${BASE}/chat/user/token?isoCountry=ES`,
        method: 'GET',
        extractFromDom: 'userId',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'GET_VEST_CHAT_TOKEN',
      request: {
        url: `${BASE}/chat/user/token?isoCountry=ES`,
        method: 'GET',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'GET_VEST_CHAT_MESSAGES',
      request: {
        url: '',
        method: 'POST',
        streamChat: true,
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
  ]
}

export function buildSendVestiaireChatMessageSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'GET_VEST_USER_ID',
      request: {
        url: `${BASE}/chat/user/token?isoCountry=ES`,
        method: 'GET',
        extractFromDom: 'userId',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'GET_VEST_CHAT_TOKEN',
      request: {
        url: `${BASE}/chat/user/token?isoCountry=ES`,
        method: 'GET',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'SEND_VEST_CHAT_MESSAGE',
      request: {
        url: '',
        method: 'POST',
        streamChat: true,
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
  ]
}

export function extractVestiaireChannelId(item: any): string | null {
  const fromMeta = item?.productLink?.meta?.data?.id
  if (fromMeta) return String(fromMeta)

  const path = typeof item?.productLink?.path === 'string' ? item.productLink.path : ''
  const pathMatch = path.match(/[?&]id=([^&]+)/)
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1])

  const mobile = typeof item?.productLink?.mobile === 'string' ? item.productLink.mobile : ''
  const mobileMatch = mobile.match(/channelId=([^&]+)/)
  if (mobileMatch?.[1]) return mobileMatch[1]

  if (typeof item?.id === 'string' && item.id.includes('-')) return item.id
  return null
}

function usableImageUrl(url?: string | null) {
  if (!url) return undefined
  if (url.includes('missing_avatar')) return undefined
  return url
}

export function mapVestiaireFeedItemToChat(item: any): Chat | null {
  const channelId = extractVestiaireChannelId(item)
  if (!channelId) return null

  const contactName = item.contactName || item.senderName || 'Usuario'
  const preview = item.lastChatMessage || item.textBody || ''
  const lastMessageAt = item.date || new Date().toISOString()

  return {
    id: channelId,
    platform: 'vestiaire',
    contactName,
    contactAvatarUrl: usableImageUrl(item.profilePicture?.url),
    listingTitle: item.productTitle || undefined,
    listingImageUrl: usableImageUrl(item.productPicture?.url),
    lastMessagePreview: preview,
    lastMessageAt,
    unreadCount: item.status === 'unread' || item.tapped === false ? 1 : 0,
    messages: preview
      ? [
          {
            id: `${channelId}-preview`,
            senderId: String(item.senderId ?? 'contact'),
            senderName: contactName,
            content: preview,
            createdAt: lastMessageAt,
            isOwn: false,
          },
        ]
      : [],
    channelId,
    senderId: item.senderId ? String(item.senderId) : undefined,
    externalUrl: `https://es.vestiairecollective.com/chat/?id=${encodeURIComponent(channelId)}`,
  }
}

function asChannelList(result: any): any[] {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.channels)) return result.channels
  if (Array.isArray(result?.data?.channels)) return result.data.channels
  return []
}

function channelIdFromApiEntry(entry: any): string | null {
  const raw =
    entry?.channel?.id ??
    entry?.id ??
    entry?.cid ??
    entry?.channelId ??
    extractVestiaireChannelId(entry)
  if (!raw) return null
  return String(raw).replace(/^messaging:/, '')
}

export function mergeVestiaireInbox(
  feedItems: any[] | undefined,
  apiChannels: any[] | undefined
): Chat[] {
  const byId = new Map<string, Chat>()

  for (const item of feedItems ?? []) {
    const chat = mapVestiaireFeedItemToChat(item)
    if (!chat) continue
    const existing = byId.get(chat.id)
    if (!existing || new Date(chat.lastMessageAt) > new Date(existing.lastMessageAt)) {
      byId.set(chat.id, chat)
    }
  }

  for (const entry of asChannelList(apiChannels)) {
    const channelId = channelIdFromApiEntry(entry)
    if (!channelId || byId.has(channelId)) continue

    const channel = entry.channel ?? entry
    const lastMessage =
      entry.messages?.[entry.messages.length - 1] ??
      entry.lastMessage ??
      entry.last_message
    const lastText =
      lastMessage?.text ||
      channel.lastChatMessage ||
      channel.last_message_text ||
      ''
    const lastAt =
      lastMessage?.created_at ||
      channel.last_message_at ||
      channel.updated_at ||
      new Date().toISOString()
    const contactName =
      channel.contactName ||
      channel.name ||
      lastMessage?.user?.name ||
      'Usuario'

    byId.set(channelId, {
      id: channelId,
      platform: 'vestiaire',
      contactName,
      contactAvatarUrl: usableImageUrl(
        lastMessage?.user?.image || channel.image || channel.profilePicture?.url
      ),
      listingTitle: channel.productTitle || channel.product_name || undefined,
      listingImageUrl: usableImageUrl(channel.productPicture?.url || channel.image),
      lastMessagePreview: lastText,
      lastMessageAt: lastAt,
      unreadCount: Number(entry.unread_count ?? entry.unreadCount ?? 0),
      messages: lastText
        ? [
            {
              id: `${channelId}-preview`,
              senderId: String(lastMessage?.user?.id ?? 'contact'),
              senderName: contactName,
              content: lastText,
              createdAt: lastAt,
              isOwn: false,
            },
          ]
        : [],
      channelId,
      externalUrl: `https://es.vestiairecollective.com/chat/?id=${encodeURIComponent(channelId)}`,
    })
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )
}

export function mapStreamMessages(result: any, ownUserId?: string): ChatMessage[] {
  const messages = Array.isArray(result?.messages)
    ? result.messages
    : Array.isArray(result?.message)
      ? result.message
      : []

  return messages
    .filter((message: any) => message && message.type !== 'deleted')
    .map((message: any) => {
      const senderId = String(message.user?.id ?? '')
      const isOwn = ownUserId ? senderId === String(ownUserId) : false
      const attachments = Array.isArray(message.attachments) ? message.attachments : []
      const attachmentFallback = attachments.length
        ? attachments[0]?.title || attachments[0]?.fallback || '[Archivo]'
        : ''
      const content =
        (typeof message.text === 'string' && message.text.trim()) ||
        attachmentFallback ||
        (message.type && message.type !== 'regular' ? `[${message.type}]` : '')

      return {
        id: String(message.id ?? `${message.created_at}-${senderId}`),
        senderId,
        senderName:
          message.user?.name ||
          message.user?.username ||
          (isOwn ? 'Tú' : 'Usuario'),
        content,
        createdAt: message.created_at || new Date().toISOString(),
        isOwn,
      }
    })
    .filter((message: ChatMessage) => message.content.length > 0)
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
}

export function mapStreamSendResult(result: any, ownUserId?: string): ChatMessage | null {
  const message = result?.message ?? result
  if (!message?.text && !message?.id) return null
  const mapped = mapStreamMessages({ messages: [message] }, ownUserId)
  return mapped[0] ?? null
}

export function decodeJwtUserId(token: string): string | undefined {
  try {
    const payload = token.split('.')[1]
    if (!payload) return undefined
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(padded, 'base64').toString('utf8')
    const data = JSON.parse(json)
    return data.user_id ?? data.userId ?? data.sub
  } catch {
    return undefined
  }
}

function findJwtToken(value: any, depth = 0): string | undefined {
  if (value == null || depth > 6) return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.split('.').length === 3 && trimmed.length > 40) return trimmed
    return undefined
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJwtToken(item, depth + 1)
      if (found) return found
    }
    return undefined
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = findJwtToken(item, depth + 1)
      if (found) return found
    }
  }
  return undefined
}

export function extractVestiaireChatToken(result: any): {
  token?: string
  userId?: string
} {
  const token =
    result?.data?.userToken?.token ??
    result?.userToken?.token ??
    result?.data?.token?.token ??
    (typeof result === 'string' ? result : undefined) ??
    result?.token ??
    result?.jwt ??
    result?.data?.token ??
    result?.data?.jwt ??
    (typeof result?.data === 'string' ? result.data : undefined) ??
    findJwtToken(result)

  const userId =
    (typeof token === 'string' ? decodeJwtUserId(token) : undefined) ??
    result?.userId ??
    result?.user_id ??
    result?.user?.id ??
    result?.data?.userId ??
    result?.data?.user_id ??
    result?.data?.user?.id

  return {
    token: typeof token === 'string' ? token : undefined,
    userId: userId ? String(userId) : undefined,
  }
}
