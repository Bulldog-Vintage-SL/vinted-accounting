export function buildFetchDepopChatsSteps(): any[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'GET_DEPOP_CHATS',
      platform: 'depop',
      request: {
        url: `https://webapi.depop.com/presentation/api/v1/conversations/?limit=24&unreadOnly=false`,
        method: 'GET'
      }
    },
    {
      id: crypto.randomUUID(),
      type: 'GET_DEPOP_OFFER_PRODUCTS',
      platform: 'depop',
      request: {
        url: `https://webapi.depop.com/presentation/api/v1/offers/me/products/?`,
        method: 'GET'
      }
    }
  ]
}

export function buildFetchDepopChatMessagesSteps(conversationId: string): any[] {
  return [{
    id: crypto.randomUUID(),
    type: 'GET_DEPOP_CHAT',
    platform: 'depop',
    request: {
      url: `https://webapi.depop.com/presentation/api/v1/conversations/${conversationId}/messages/?limit=24`,
      method: 'GET'
    }
  }]
}

// recipientUserId: el user_id del OTRO usuario de la conversación (no el
// conversation_id) — así identifica Depop tanto el token de verificación
// como el envío del mensaje, según las trazas que compartiste.
export function buildSendDepopChatMessageSteps(
  recipientUserId: string | number,
  text: string
): any[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'GET_DEPOP_CHAT_VERIFICATION_TOKEN',
      platform: 'depop',
      request: {
        url: 'https://webapi.depop.com/presentation/api/v1/conversations/verification/',
        method: 'POST',
        body: { user_id: recipientUserId }
      }
    },
    {
      id: crypto.randomUUID(),
      type: 'SEND_DEPOP_CHAT_REPLY',
      platform: 'depop',
      request: {
        url: `https://www.depop.com/presentation/api/v1/conversations/messages/?verification=true`,
        method: 'POST',
        body: {
          idempotency_key: crypto.randomUUID(),
          text,
          user_id: recipientUserId
        }
      }
    }
  ]
}