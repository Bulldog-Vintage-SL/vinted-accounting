/*
  Workflows de chats de Wallapop.
  Inbox: GET /bff/messaging/inbox
  Token IM: GET /api/v3/instant-messaging/token
  Envío: PubNub publish (mismo canal que la web).
*/

import type { WorkflowStep } from '../types'
import type { Chat, ChatMessage } from '@/app/chats/types'

export const WALLA_PUBNUB_ORIGIN = 'https://ps14.pndsn.com'
export const WALLA_PUBNUB_PUBLISH_KEY = 'pub-c-255dc549-86f5-4abd-8b9e-921d5a02fde7'
export const WALLA_PUBNUB_SUBSCRIBE_KEY = 'sub-c-89405e27-d4df-4d87-aca1-d6e9118f0a0d'
export const WALLA_INBOX_PAGE_SIZE = 30
export const WALLA_INBOX_MAX_PAGES = 4
export const WALLA_CHAT_SEARCH_MAX_PAGES = 8
export const WALLA_CHAT_APP_VERSION = '8.2784.0'

const CHAT_BACKGROUND_REQUEST = {
  skipDelay: true,
  runInBackground: true,
} as const

export function buildWallapopInboxUrl(nextFrom?: string, maxMessages = WALLA_INBOX_PAGE_SIZE) {
  const params = new URLSearchParams({
    page_size: String(WALLA_INBOX_PAGE_SIZE),
    max_messages: String(maxMessages),
  })
  if (nextFrom) params.set('from', nextFrom)
  return `https://api.wallapop.com/bff/messaging/inbox?${params.toString()}`
}

export function buildFetchWallapopChatsSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'GET_USER_ME',
      request: {
        url: 'https://api.wallapop.com/api/v3/users/me',
        method: 'GET',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'GET_WALLA_CHATS',
      request: {
        url: buildWallapopInboxUrl(),
        method: 'GET',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
  ]
}

export function buildWallapopConversationUrl(conversationHash: string) {
  return (
    `https://api.wallapop.com/bff/messaging/conversations/${encodeURIComponent(conversationHash)}` +
    `?max_messages=50`
  )
}

export function buildFetchWallapopChatMessagesSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'GET_USER_ME',
      request: {
        url: 'https://api.wallapop.com/api/v3/users/me',
        method: 'GET',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'GET_WALLA_CHAT',
      request: {
        url: buildWallapopInboxUrl(undefined, 50),
        method: 'GET',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
  ]
}

export function buildSendWallapopChatMessageSteps(): WorkflowStep[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'GET_USER_ME',
      request: {
        url: 'https://api.wallapop.com/api/v3/users/me',
        method: 'GET',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'GET_WALLA_CHAT_TOKEN',
      request: {
        url: 'https://api.wallapop.com/api/v3/instant-messaging/token',
        method: 'GET',
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
    {
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'SEND_WALLA_CHAT_MESSAGE',
      request: {
        url: '',
        method: 'GET',
        noAuth: true,
        ...CHAT_BACKGROUND_REQUEST,
      },
    },
  ]
}

export function buildWallapopPublishUrl(opts: {
  publishKey: string
  subscribeKey: string
  token: string
  fromUserHash: string
  toUserHash: string
  conversationHash: string
  text: string
  origin?: string
}) {
  const channel = `chat.${opts.toUserHash}.${opts.conversationHash}.${opts.fromUserHash}`
  const message = encodeURIComponent(
    JSON.stringify({
      id: crypto.randomUUID(),
      payload: { text: opts.text },
    })
  )
  const params = new URLSearchParams({
    meta: JSON.stringify({
      type: 'text',
      sender: {
        platform: {
          app_version: WALLA_CHAT_APP_VERSION,
          os_version: '0',
        },
      },
      to_user_hash: opts.toUserHash,
      from_user_hash: opts.fromUserHash,
      conversation_hash: opts.conversationHash,
    }),
    uuid: opts.fromUserHash,
    requestid: crypto.randomUUID(),
    pnsdk: 'PubNub-JS-Web/10.2.6',
    auth: opts.token,
  })

  return (
    `${opts.origin || WALLA_PUBNUB_ORIGIN}/publish/${opts.publishKey}/${opts.subscribeKey}/0/` +
    `${channel}/0/${message}?${params.toString()}`
  )
}

export function asWallaInboxList(result: any): any[] {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.conversations)) return result.conversations
  if (Array.isArray(result?.data?.conversations)) return result.data.conversations
  if (Array.isArray(result?.inbox)) return result.inbox
  if (Array.isArray(result?.items)) return result.items
  if (Array.isArray(result?.data)) return result.data
  return []
}

export function extractWallaInboxNext(result: any): string | undefined {
  const next =
    result?.next_from ??
    result?.nextFrom ??
    result?.next_page ??
    result?.nextPage ??
    result?.next ??
    result?.cursor ??
    result?.meta?.next ??
    result?.pagination?.next ??
    result?.pagination?.next_from
  return typeof next === 'string' && next.length > 0 ? next : undefined
}

export function extractWallaChatToken(result: any): {
  token?: string
  publishKey?: string
  subscribeKey?: string
  userHash?: string
  origin?: string
} {
  const token =
    (typeof result === 'string' && result) ||
    (typeof result?.token === 'string' && result.token) ||
    (typeof result?.token?.token === 'string' && result.token.token) ||
    (typeof result?.auth_key === 'string' && result.auth_key) ||
    (typeof result?.authKey === 'string' && result.authKey) ||
    (typeof result?.auth === 'string' && result.auth) ||
    (typeof result?.access_token === 'string' && result.access_token) ||
    (typeof result?.data === 'string' && result.data) ||
    (typeof result?.data?.token === 'string' && result.data.token) ||
    (typeof result?.data?.auth_key === 'string' && result.data.auth_key) ||
    (typeof result?.data?.authKey === 'string' && result.data.authKey) ||
    undefined

  const origin =
    result?.origin ??
    result?.publish_origin ??
    result?.publishOrigin ??
    result?.data?.origin ??
    result?.data?.publish_origin

  return {
    token,
    publishKey:
      result?.publish_key ??
      result?.publishKey ??
      result?.data?.publish_key ??
      result?.data?.publishKey,
    subscribeKey:
      result?.subscribe_key ??
      result?.subscribeKey ??
      result?.data?.subscribe_key ??
      result?.data?.subscribeKey,
    userHash:
      result?.user_hash ??
      result?.userHash ??
      result?.hash ??
      result?.data?.user_hash ??
      result?.data?.hash,
    origin: typeof origin === 'string' && origin.length ? origin : undefined,
  }
}

function userHash(user: any): string | undefined {
  if (!user) return undefined
  const hash = user.hash ?? user.user_hash ?? user.userHash ?? user.id
  return hash ? String(hash) : undefined
}

function conversationHash(conv: any): string | null {
  const hash =
    conv?.hash ??
    conv?.conversation_hash ??
    conv?.conversationHash ??
    conv?.conversation_id ??
    conv?.conversationId ??
    conv?.id ??
    conv?.conversation?.hash
  return hash ? String(hash) : null
}

function otherUser(conv: any, ownHash?: string) {
  const direct =
    conv?.with_user ??
    conv?.withUser ??
    conv?.other_user ??
    conv?.otherUser ??
    conv?.user ??
    conv?.counterpart ??
    null
  if (direct) return direct

  const users = conv?.users ?? conv?.participants ?? []
  if (Array.isArray(users) && users.length) {
    const other = ownHash
      ? users.find((u: any) => userHash(u) && userHash(u) !== ownHash)
      : users[0]
    if (other) return other
  }
  return null
}

export function asWallaMessages(conv: any): any[] {
  if (!conv) return []
  if (Array.isArray(conv.messages?.messages)) return conv.messages.messages
  if (Array.isArray(conv.messages)) return conv.messages
  if (Array.isArray(conv.last_messages)) return conv.last_messages
  if (Array.isArray(conv.lastMessages)) return conv.lastMessages
  if (Array.isArray(conv.data?.messages)) return conv.data.messages
  const last = conv.last_message ?? conv.lastMessage
  return last ? [last] : []
}

export function wallaConversationHasMessages(conv: any): boolean {
  return asWallaMessages(conv).length > 0
}

function itemFromConv(conv: any) {
  return conv?.item ?? conv?.product ?? conv?.listing ?? null
}

function imageUrl(source: any): string | undefined {
  if (!source) return undefined
  if (typeof source === 'string') return source
  return (
    source.urls?.small ??
    source.urls?.medium ??
    source.small ??
    source.medium ??
    source.url ??
    source.uri ??
    undefined
  )
}

function toIso(value: any): string {
  if (value == null || value === '') return new Date().toISOString()
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function messageText(message: any): string {
  return (
    (typeof message?.text === 'string' && message.text) ||
    (typeof message?.payload?.text === 'string' && message.payload.text) ||
    (typeof message?.body === 'string' && message.body) ||
    (typeof message?.content === 'string' && message.content) ||
    (typeof message?.message === 'string' && message.message) ||
    ''
  )
}

function messageSenderHash(message: any): string {
  return String(
    message?.from_user_hash ??
      message?.fromUserHash ??
      message?.from_user ??
      message?.fromUser ??
      message?.user_hash ??
      message?.userHash ??
      message?.sender?.hash ??
      message?.sender_hash ??
      message?.user?.hash ??
      ''
  )
}

export function extractWallaConversation(result: any, conversationHashValue?: string): any | null {
  if (!result) return null
  if (result.conversation) return result.conversation
  if (result.data?.conversation) return result.data.conversation

  const list = asWallaInboxList(result)
  if (conversationHashValue && list.length) {
    const found = list.find((c) => conversationHash(c) === String(conversationHashValue))
    if (found) return found
  }

  if (conversationHash(result) && (
    !conversationHashValue || conversationHash(result) === String(conversationHashValue)
  )) {
    return result
  }
  if (list.length === 1) return list[0]
  return null
}

export function mapWallapopInbox(inbox: any[], ownHash?: string): Chat[] {
  const chats: Chat[] = []

  for (const conv of inbox ?? []) {
    const hash = conversationHash(conv)
    if (!hash) continue

    const other = otherUser(conv, ownHash)
    const item = itemFromConv(conv)
    const messages = mapWallapopMessages(conv, ownHash)
    const last = messages[messages.length - 1]
    const lastAt =
      last?.createdAt ??
      toIso(
        conv.modified_at ??
          conv.modifiedAt ??
          conv.updated_at ??
          conv.updatedAt ??
          conv.last_message_at
      )
    const preview =
      last?.content ??
      conv.last_message?.text ??
      conv.lastMessage?.text ??
      conv.description ??
      ''
    const contactName =
      other?.name ??
      other?.micro_name ??
      other?.microName ??
      other?.username ??
      'Usuario de Wallapop'

    chats.push({
      id: `wallapop-${hash}`,
      platform: 'wallapop',
      contactName,
      contactAvatarUrl: imageUrl(other?.image ?? other?.avatar ?? other?.photo),
      listingTitle: item?.title ?? item?.name ?? undefined,
      listingImageUrl: imageUrl(item?.image ?? item?.images?.[0] ?? item?.photo),
      lastMessagePreview: preview,
      lastMessageAt: lastAt,
      unreadCount: Number(conv.unread_count ?? conv.unreadCount ?? (conv.unread ? 1 : 0)),
      messages,
      messagesLoaded: messages.length > 0,
      channelId: hash,
      senderId: userHash(other),
      ownUserHash: ownHash,
      externalUrl: `https://es.wallapop.com/app/chat/${hash}`,
    })
  }

  return chats.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )
}

export function mapWallapopMessages(conv: any, ownHash?: string): ChatMessage[] {
  const raw = asWallaMessages(conv)

  const other = otherUser(conv, ownHash)
  const otherName =
    other?.name ?? other?.micro_name ?? other?.microName ?? other?.username ?? 'Usuario'
  const otherHash = userHash(other)

  return raw
    .map((message: any) => {
      const fromSelf = message?.from_self === true || message?.fromSelf === true
      const senderId = fromSelf
        ? String(ownHash ?? 'me')
        : (messageSenderHash(message) || otherHash || '')
      const isOwn = ownHash ? senderId === ownHash : fromSelf
      const content = messageText(message)
      return {
        id: String(message.id ?? message.hash ?? `${message.timestamp ?? message.created_at ?? ''}-${senderId}`),
        senderId,
        senderName: isOwn ? 'Tú' : otherName,
        content,
        createdAt: toIso(
          message.created_at ??
            message.createdAt ??
            message.created ??
            message.timestamp ??
            message.sent_at
        ),
        isOwn,
      } as ChatMessage
    })
    .filter((message: ChatMessage) => message.content.length > 0)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}

export function isWallapopPublishOk(result: any): boolean {
  return Array.isArray(result) && (result[0] === 1 || result[0] === '1')
}

export function mapWallapopSendResult(result: any, text: string, ownHash?: string): ChatMessage | null {
  if (!isWallapopPublishOk(result)) return null

  return {
    id: `local-${Date.now()}`,
    senderId: String(ownHash ?? 'me'),
    senderName: 'Tú',
    content: text,
    createdAt: new Date().toISOString(),
    isOwn: true,
  }
}
