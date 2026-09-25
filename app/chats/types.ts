export type OfferStatusKind = "pending" | "accepted" | "rejected" | "other";

export interface OfferInfo {
  price: string;
  originalPrice?: string;
  statusTitle: string;
  statusKind: OfferStatusKind;
}

// Estilo visual que Vinted ya indica en el JSON (template.style) para
// mensajes de sistema (venta, cancelación, valoración automática, etc.)
export type SystemEventStyle = "neutral" | "warning" | "danger";

export interface SystemEventInfo {
  title: string;
  subtitle?: string;
  style: SystemEventStyle;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string; // ISO date
  isOwn: boolean;
  offer?: OfferInfo; // presente cuando el mensaje es una oferta de precio
  systemEvent?: SystemEventInfo; // presente para status_message / action_message
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
  isOffer?: boolean;
  recipientUserId?: string | number;
  ownUserId?: string | number;
}