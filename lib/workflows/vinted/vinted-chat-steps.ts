export function buildFetchVintedChatsSteps(): any[] {
  return [{
    id: crypto.randomUUID(),
    type: 'GET_CHATS',
    platform: 'vinted',
    request: { url: `https://www.vinted.es/api/v2/inbox?page=1&per_page=20`, method: 'GET' }
  }]
}

export function buildFetchVintedChatMessagesSteps(conversationId: string | number): any[] {
  return [{
    id: crypto.randomUUID(),
    type: 'GET_CHAT',
    platform: 'vinted',
    request: { url: `https://www.vinted.es/api/v2/conversations/${conversationId}`, method: 'GET' }
  }]
}

export function buildSendVintedChatMessageSteps(
  conversationId: string | number,
  text: string,
  photoTempUuids: string[] | null = null
): any[] {
  return [{
    id: crypto.randomUUID(),
    type: 'SEND_CHAT_REPLY',
    platform: 'vinted',
    request: {
      url: `https://www.vinted.es/api/v2/conversations/${conversationId}/replies`,
      method: 'POST',
      body: {
        reply: {
          body: text,
          photo_temp_uuids: photoTempUuids,
          is_personal_data_sharing_check_skipped: false
        }
      }
    }
  }]
}