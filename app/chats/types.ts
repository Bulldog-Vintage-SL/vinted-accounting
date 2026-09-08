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
}

// TODO: sustituir por fetch a /api/chats cuando exista la colección
export const MOCK_CHATS: Chat[] = [
  {
    id: "1",
    platform: "vinted",
    contactName: "Marta G.",
    listingTitle: "Chaqueta vaquera Levi's",
    lastMessagePreview: "¿Aún está disponible en talla M?",
    lastMessageAt: "2026-09-07T09:12:00Z",
    unreadCount: 2,
    messages: [
      {
        id: "m1",
        senderId: "marta",
        senderName: "Marta G.",
        content: "Hola! ¿Aún está disponible en talla M?",
        createdAt: "2026-09-07T09:10:00Z",
        isOwn: false,
      },
      {
        id: "m2",
        senderId: "marta",
        senderName: "Marta G.",
        content: "¿Aceptas envío urgente?",
        createdAt: "2026-09-07T09:12:00Z",
        isOwn: false,
      },
    ],
  },
  {
    id: "2",
    platform: "wallapop",
    contactName: "Javier R.",
    listingTitle: "Zapatillas New Balance 574",
    lastMessagePreview: "Perfecto, hecho el pago",
    lastMessageAt: "2026-09-06T18:40:00Z",
    unreadCount: 0,
    messages: [
      {
        id: "m1",
        senderId: "me",
        senderName: "Tú",
        content: "Claro, te lo reservo hasta mañana",
        createdAt: "2026-09-06T18:30:00Z",
        isOwn: true,
      },
      {
        id: "m2",
        senderId: "javier",
        senderName: "Javier R.",
        content: "Perfecto, hecho el pago",
        createdAt: "2026-09-06T18:40:00Z",
        isOwn: false,
      },
    ],
  },
  {
    id: "3",
    platform: "depop",
    contactName: "sophie.thrift",
    listingTitle: "Bolso Longchamp vintage",
    lastMessagePreview: "Thanks, looks great!",
    lastMessageAt: "2026-09-05T11:05:00Z",
    unreadCount: 0,
    messages: [
      {
        id: "m1",
        senderId: "sophie",
        senderName: "sophie.thrift",
        content: "Thanks, looks great!",
        createdAt: "2026-09-05T11:05:00Z",
        isOwn: false,
      },
    ],
  },
];