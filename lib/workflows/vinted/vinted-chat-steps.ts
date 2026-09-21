export function buildSyncChatsSteps(): any[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'GET_CHATS',
      platform: 'vinted',
      request: { url: `https://www.vinted.es/api/v2/inbox?page=1&per_page=20`, method: 'GET' }
    },
    {
      id: crypto.randomUUID(),
      type: 'GET_CHAT',
      platform: 'vinted',
      request: { method: 'GET' }
    }
  ]
}

export function buildMarkChatReadSteps(conversationId: string | number): any[] {
  return [{
    id: crypto.randomUUID(),
    type: 'MARK_CHAT_READ',
    platform: 'vinted',
    request: {
      url: `https://www.vinted.es/api/v2/conversations/${conversationId}/mark_as_read`,
      method: 'PUT'
    }
  }]
}

export function buildSendChatReplySteps(
  conversationId: string | number,
  body: string,
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
        body,
        photo_temp_uuids: photoTempUuids,
        is_personal_data_sharing_check_skipped: false
      }
    }
  }]
}