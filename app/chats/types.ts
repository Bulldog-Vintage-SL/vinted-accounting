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

export type ChatPlatform = "vinted" | "wallapop" | "depop" | "vestiaire" | "shopify";

// Prenda vinculada a una conversación. Cada plataforma rellena lo que pueda:
// el mapper de mensajes da la referencia (id, título, precio) y el
// enriquecedor (lib/chats/listing.ts) completa descripción y precio actual.
export interface ListingContext {
  platform: ChatPlatform;
  externalId?: string;        // id de la prenda en la plataforma
  externalIds?: string[];     // solo si es un lote
  isBundle?: boolean;
  title?: string;
  description?: string;
  price?: number | null;
  currency?: string;
  url?: string;
  userSide?: "seller" | "buyer";
}

// Resultado común de todos los fetchers de mensajes
export interface ChatMessagesResult {
  ok: boolean;
  message: string;
  messages?: ChatMessage[];
  listing?: ListingContext;
}

export interface Chat {
  id: string;
  platform: ChatPlatform;
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
  ownUserHash?: string;
  externalUrl?: string;
  messagesLoaded?: boolean;
  isOffer?: boolean;
  recipientUserId?: string | number;
  ownUserId?: string | number;
  listing?: ListingContext;   // referencia de la prenda (sin enriquecer)
}