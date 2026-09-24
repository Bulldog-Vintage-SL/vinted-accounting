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
  fetchWallapopChats,
  fetchWallapopChatMessages,
  sendWallapopChatMessage,
} from "@/lib/external-integrations";

// Antes "rl:vestiaire-chats": ahora la caché guarda chats de varias plataformas
const STORAGE_KEY = "rl:chats";

type Platform = "vestiaire" | "vinted" | "wallapop";

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

const PLATFORM_LABELS: Record<Platform, string> = {
  vestiaire: "Vestiaire Collective",
  vinted: "Vinted",
  wallapop: "Wallapop",
};

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  // Solo una plataforma puede sincronizar a la vez; null = ninguna sincronizando
  const [syncingPlatform, setSyncingPlatform] = useState<Platform | null>(null);
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

  const handleSync = async (platform: Platform) => {
    // Bloquea si ya hay una sincronización en curso (de esta u otra plataforma)
    if (syncingPlatform) return;

    setSyncingPlatform(platform);
    try {
      // Vestiaire / Vinted / Wallapop: misma fusión de lista, avisos solo en Vinted.
      const res =
        platform === "vestiaire"
          ? await fetchVestiaireChats()
          : platform === "vinted"
            ? await fetchVintedChats()
            : await fetchWallapopChats();

      if (!res.ok) {
        toast.error(
          res.message ||
            `Asegúrate de tener la pestaña de ${PLATFORM_LABELS[platform]} abierta e iniciada sesión.`
        );
        return;
      }

      const next = [
        ...chats.filter((c) => c.platform !== platform),
        ...(res.chats ?? []),
      ].sort(byLastMessageDesc);

      setChats(next);
      saveCachedChats(next);
      setSelectedChatId((current) =>
        current && next.some((chat) => chat.id === current)
          ? current
          : next[0]?.id ?? null
      );

      toast.success(res.message);

      if (platform === "vinted" && "notices" in res) {
        // Avisos de Vinted (p. ej. cuenta restringida)
        res.notices
          ?.filter((n) => /restring/i.test(n.text))
          .forEach((n) =>
            toast.error(n.text, { id: `vinted-notice-${n.id}`, duration: 8000 })
          );
      }
    } catch (err: any) {
      toast.error(err?.message ?? `Error al sincronizar ${PLATFORM_LABELS[platform]}`);
    } finally {
      setSyncingPlatform(null);
    }
  };

  const loadMessages = useCallback(
    async (chat: Chat, opts?: { force?: boolean; silent?: boolean }) => {
      const { force = false, silent = false } = opts ?? {};
      // "force" se usa para el polling: ignora la caché de messagesLoaded.
      // "silent" evita el spinner y los toasts de error, para no molestar
      // con una petición de fondo que el usuario no ha pedido.
      if (chat.messagesLoaded && !force) return;
      if (loadingChatIdRef.current === chat.id) return;

      loadingChatIdRef.current = chat.id;
      if (!silent) setMessagesLoading(true);
      try {
        const channel = chat.channelId || chat.id;
        const res =
          chat.platform === "vinted"
            ? await fetchVintedChatMessages(channel)
            : chat.platform === "wallapop"
              ? await fetchWallapopChatMessages(channel)
              : await fetchVestiaireChatMessages(channel);
        if (!res.ok) {
          if (!silent) toast.error(res.message);
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
        if (!silent) toast.error(err?.message ?? "Error al cargar el hilo");
      } finally {
        if (loadingChatIdRef.current === chat.id) loadingChatIdRef.current = null;
        if (!silent) setMessagesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedChat) return;
    void loadMessages(selectedChat);
  }, [selectedChat, loadMessages]);

  // Refs con el valor más reciente para poder leerlos dentro del intervalo
  // de polling sin tener que recrearlo (y así no perder el "cada 10s") cada
  // vez que cambia el chat seleccionado, el estado de sincronización, etc.
  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const selectedChatIdRef = useRef(selectedChatId);
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  const syncingPlatformRef = useRef(syncingPlatform);
  useEffect(() => {
    syncingPlatformRef.current = syncingPlatform;
  }, [syncingPlatform]);

  const sendingRef = useRef(sending);
  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  // Polling: cada 10s se refresca en silencio la conversación que el usuario
  // tiene abierta, para simular actualizaciones en tiempo real sin recargar
  // toda la lista de chats ni pedir de nuevo la sincronización con la extensión.
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (syncingPlatformRef.current || sendingRef.current) return;

      const currentId = selectedChatIdRef.current;
      if (!currentId) return;

      const chat = chatsRef.current.find((c) => c.id === currentId);
      if (!chat) return;

      void loadMessages(chat, { force: true, silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [loadMessages]);

  const handleSend = async (text: string) => {
    if (!selectedChat) return;
    setSending(true);
    try {
      const channel = selectedChat.channelId || selectedChat.id;
      const res =
        selectedChat.platform === "vinted"
          ? await sendVintedChatMessage(channel, text)
          : selectedChat.platform === "wallapop"
            ? await sendWallapopChatMessage(channel, text, {
                toUserHash: selectedChat.senderId,
                fromUserHash: selectedChat.ownUserHash,
              })
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
        onSyncPlatform={handleSync}
        syncingPlatform={syncingPlatform}
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