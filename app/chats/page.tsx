"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import type { Chat } from "./types";
import {
  fetchVestiaireChats,
  fetchVestiaireChatMessages,
  sendVestiaireChatMessage,
} from "@/lib/external-integrations";

const STORAGE_KEY = "rl:vestiaire-chats";

function loadCachedChats(): Chat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.chats) ? parsed.chats : [];
  } catch {
    return [];
  }
}

function saveCachedChats(chats: Chat[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ chats }));
  } catch {
    // Ignore quota / private mode.
  }
}

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const loadingChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    const cached = loadCachedChats();
    if (cached.length) {
      setChats(cached);
      setSelectedChatId(cached[0]?.id ?? null);
    }
  }, []);

  const selectedChat = chats.find((c) => c.id === selectedChatId) ?? null;

  const handleSync = async () => {
    loadingChatIdRef.current = null;
    setSyncing(true);
    try {
      const res = await fetchVestiaireChats();
      if (!res.ok) {
        toast.error(
          res.message ||
            "Asegúrate de tener la pestaña de Vestiaire abierta e iniciada sesión."
        );
        return;
      }

      const next = res.chats ?? [];
      setChats(next);
      saveCachedChats(next);
      setSelectedChatId((current) =>
        current && next.some((chat) => chat.id === current)
          ? current
          : next[0]?.id ?? null
      );
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al sincronizar chats de Vestiaire");
    } finally {
      setSyncing(false);
    }
  };

  const loadMessages = useCallback(async (chat: Chat) => {
    if (chat.platform !== "vestiaire" || chat.messagesLoaded) return;
    if (loadingChatIdRef.current === chat.id) return;

    loadingChatIdRef.current = chat.id;
    setMessagesLoading(true);
    try {
      const res = await fetchVestiaireChatMessages(chat.channelId || chat.id);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      setChats((prev) => {
        const next = prev.map((item) =>
          item.id === chat.id
            ? {
                ...item,
                messages: res.messages?.length ? res.messages : item.messages,
                messagesLoaded: true,
                unreadCount: 0,
                lastMessagePreview:
                  res.messages?.[res.messages.length - 1]?.content ??
                  item.lastMessagePreview,
                lastMessageAt:
                  res.messages?.[res.messages.length - 1]?.createdAt ??
                  item.lastMessageAt,
              }
            : item
        );
        saveCachedChats(next);
        return next;
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Error al cargar el hilo");
    } finally {
      if (loadingChatIdRef.current === chat.id) loadingChatIdRef.current = null;
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChat) return;
    void loadMessages(selectedChat);
  }, [selectedChat, loadMessages]);

  const handleSend = async (text: string) => {
    if (!selectedChat) return;
    setSending(true);
    try {
      const res = await sendVestiaireChatMessage(
        selectedChat.channelId || selectedChat.id,
        text
      );
      if (!res.ok || !res.sent) {
        toast.error(res.message);
        return;
      }

      setChats((prev) => {
        const next = prev.map((item) =>
          item.id === selectedChat.id
            ? {
                ...item,
                messages: [
                  ...item.messages.filter((m) => !m.id.endsWith("-preview")),
                  res.sent!,
                ],
                lastMessagePreview: res.sent!.content,
                lastMessageAt: res.sent!.createdAt,
                unreadCount: 0,
                messagesLoaded: true,
              }
            : item
        );
        saveCachedChats(next);
        return next;
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Error al enviar el mensaje");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-screen flex overflow-hidden">
      <ChatList
        chats={chats}
        selectedChatId={selectedChatId}
        onSelect={setSelectedChatId}
        onSync={handleSync}
        syncing={syncing}
        hideOnMobile={Boolean(selectedChatId)}
      />
      <ChatWindow
        chat={selectedChat}
        messagesLoading={messagesLoading}
        sending={sending}
        onSend={handleSend}
        onBack={() => setSelectedChatId(null)}
      />
    </div>
  );
}
