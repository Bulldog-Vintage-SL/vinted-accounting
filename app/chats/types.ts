export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string; // ISO date
  isOwn: boolean;
}

export interface Chat {
  id: string;
  platform: "vinted" | "wallapop" | "depop" | "vestiaire" | "shopify";
  contactName: string;
  contactAvatarUrl?: string;
  listingTitle?: string;
  listingImageUrl?: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: ChatMessage[];
  channelId?: string;
  senderId?: string;
  externalUrl?: string;
  messagesLoaded?: boolean;
}
