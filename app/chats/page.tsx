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
  fetchVintedChats,
  fetchVintedChatMessages,
  sendVintedChatMessage,
} from "@/lib/external-integrations";

// Antes "rl:vestiaire-chats": ahora la caché guarda chats de varias plataformas
const STORAGE_KEY = "rl:chats";

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

const lastMessageTs = (chat: Chat) =>
  new Date(chat.lastMessageAt ?? 0).getTime() || 0;

const byLastMessageDesc = (a: Chat, b: Chat) => lastMessageTs(b) - lastMessageTs(a);

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
      // Secuencial: las dos plataformas pasan por la misma extensión
      const vest = await fetchVestiaireChats();
      const vinted = await fetchVintedChats();

      if (!vest.ok) {
        toast.error(
          vest.message ||
            "Asegúrate de tener la pestaña de Vestiaire abierta e iniciada sesión."
        );
      }
      if (!vinted.ok) {
        toast.error(
          vinted.message ||
            "Asegúrate de tener la pestaña de Vinted abierta e iniciada sesión."
        );
      }
      if (!vest.ok && !vinted.ok) return;

      // Si una plataforma falla, conservamos sus chats cacheados
      const next = [
        ...(vest.ok
          ? vest.chats ?? []
          : chats.filter((c) => c.platform === "vestiaire")),
        ...(vinted.ok
          ? vinted.chats ?? []
          : chats.filter((c) => c.platform === "vinted")),
      ].sort(byLastMessageDesc);

      setChats(next);
      saveCachedChats(next);
      setSelectedChatId((current) =>
        current && next.some((chat) => chat.id === current)
          ? current
          : next[0]?.id ?? null
      );

      if (vest.ok) toast.success(vest.message);
      if (vinted.ok) toast.success(vinted.message);

      // Avisos de Vinted (p. ej. cuenta restringida)
      if (vinted.ok) {
        vinted.notices
          ?.filter((n) => /restring/i.test(n.text))
          .forEach((n) =>
            toast.error(n.text, { id: `vinted-notice-${n.id}`, duration: 8000 })
          );
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Error al sincronizar chats");
    } finally {
      setSyncing(false);
    }
  };

  const loadMessages = useCallback(async (chat: Chat) => {
    if (chat.messagesLoaded) return;
    if (loadingChatIdRef.current === chat.id) return;

    loadingChatIdRef.current = chat.id;
    setMessagesLoading(true);
    try {
      const channel = chat.channelId || chat.id;
      const res =
        chat.platform === "vinted"
          ? await fetchVintedChatMessages(channel)
          : await fetchVestiaireChatMessages(channel);
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
      const channel = selectedChat.channelId || selectedChat.id;
      const res =
        selectedChat.platform === "vinted"
          ? await sendVintedChatMessage(channel, text)
          : await sendVestiaireChatMessage(channel, text);
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