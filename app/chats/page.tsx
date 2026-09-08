"use client";

import { useState } from "react";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import { MOCK_CHATS } from "./types";

export default function ChatsPage() {
  // TODO: sustituir MOCK_CHATS por useSWR('/api/chats', fetcher) cuando
  // exista la colección `chats` en el backend.
  const [chats] = useState(MOCK_CHATS);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(
    chats[0]?.id ?? null
  );

  const selectedChat = chats.find((c) => c.id === selectedChatId) ?? null;

  return (
    // El <main> del layout tiene pt-16 en móvil (hueco del botón de
    // menú) y pt-0 en desktop, así que calculamos la altura restante
    // en vez de usar h-screen a pelo (eso desbordaría en móvil).
    <div className="h-[calc(100vh-4rem)] lg:h-screen flex overflow-hidden">
      <ChatList
        chats={chats}
        selectedChatId={selectedChatId}
        onSelect={setSelectedChatId}
      />
      <ChatWindow chat={selectedChat} />
    </div>
  );
}