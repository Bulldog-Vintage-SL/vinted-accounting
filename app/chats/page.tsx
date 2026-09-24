"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import type { Chat } from "./types";
import { useAccountSelector } from "@/hooks/useAccountSelector";
import {
  fetchVestiaireChats,
  fetchVestiaireChatMessages,
  sendVestiaireChatMessage,
  fetchVintedChats,
  fetchVintedChatMessages,
  sendVintedChatMessage,
  fetchDepopChats,
  fetchDepopChatMessages,
  sendDepopChatMessage,
} from "@/lib/external-integrations";

// Antes "rl:vestiaire-chats": ahora la caché guarda chats de varias plataformas
const STORAGE_KEY = "rl:chats";

type Platform = "vestiaire" | "vinted" | "depop";

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

// Las ofertas de Depop se mapean como "chats" de un único mensaje ya resuelto
// (ver mapDepopOffers): no tienen endpoint de mensajes, no hay que hacer
// polling sobre ellas y no admiten respuesta de texto.
const isOfferChat = (chat?: Chat | null) => Boolean(chat?.isOffer);

const PLATFORM_LABELS: Record<Platform, string> = {
  vestiaire: "Vestiaire Collective",
  vinted: "Vinted",
  depop: "Depop",
};

const SYNCABLE_PLATFORMS = new Set<Platform>(["vestiaire", "vinted", "depop"]);

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  // Solo una plataforma puede sincronizar a la vez; null = ninguna sincronizando
  const [syncingPlatform, setSyncingPlatform] = useState<Platform | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const loadingChatIdRef = useRef<string | null>(null);

  const { openSelector } = useAccountSelector();

  useEffect(() => {
    const cached = loadCachedChats();
    if (cached.length) {
      setChats(cached);
      setSelectedChatId(cached[0]?.id ?? null);
    }
  }, []);

  const selectedChat = chats.find((c) => c.id === selectedChatId) ?? null;

  // El selector de cuentas solo nos da { accountId, platform }, así que para
  // saber el external_id de la cuenta elegida (necesario para Depop, ver
  // más abajo) hay que resolverlo aparte contra el mismo endpoint que usa
  // AccountSelectorModal.
  const resolveAccountExternalId = async (
    platform: Platform,
    accountId: string
  ): Promise<string | undefined> => {
    try {
      const res = await fetch(`/api/accounts?platform=${platform}`);
      const data = await res.json();
      return data.find((a: any) => a.id === accountId)?.external_id;
    } catch {
      return undefined;
    }
  };

  const syncPlatform = async (
    platform: Platform,
    accountId: string
  ): Promise<{ chats: Chat[] } | null> => {
    setSyncingPlatform(platform);
    try {
      let res;
      if (platform === "vestiaire") {
        res = await fetchVestiaireChats();
      } else if (platform === "vinted") {
        res = await fetchVintedChats();
      } else {
        const ownExternalId = await resolveAccountExternalId(platform, accountId);
        res = await fetchDepopChats(ownExternalId);
      }

      if (!res.ok) {
        toast.error(
          res.message ||
            `Asegúrate de tener la pestaña de ${PLATFORM_LABELS[platform]} abierta e iniciada sesión.`
        );
        return null;
      }

      toast.success(res.message);

      // Avisos (p. ej. cuenta restringida / mensaje oficial de bienvenida)
      if ("notices" in res) {
        res.notices
          ?.filter((n) => /restring/i.test(n.text))
          .forEach((n) =>
            toast.error(n.text, { id: `${platform}-notice-${n.id}`, duration: 8000 })
          );
      }

      return { chats: res.chats ?? [] };
    } catch (err: any) {
      toast.error(err?.message ?? `Error al sincronizar ${PLATFORM_LABELS[platform]}`);
      return null;
    } finally {
      setSyncingPlatform(null);
    }
  };

  const handleAccountsSelected = useCallback(
    async (accounts: { accountId: string; platform: string }[]) => {
      const relevant = accounts.filter(
        (a): a is { accountId: string; platform: Platform } =>
          SYNCABLE_PLATFORMS.has(a.platform as Platform)
      );
      if (relevant.length === 0) return;

      // Si se eligen varias cuentas de la misma plataforma, hoy por hoy solo
      // podemos sincronizar la sesión activa en el navegador (la extensión
      // no soporta multi-cuenta simultánea), así que usamos la primera.
      const byPlatform = new Map<Platform, string>();
      for (const a of relevant) {
        if (!byPlatform.has(a.platform)) byPlatform.set(a.platform, a.accountId);
      }

      let working = chats;
      for (const [platform, accountId] of byPlatform) {
        const result = await syncPlatform(platform, accountId);
        if (!result) continue;
        working = [
          ...working.filter((c) => c.platform !== platform),
          ...result.chats,
        ].sort(byLastMessageDesc);
      }

      setChats(working);
      saveCachedChats(working);
      setSelectedChatId((current) =>
        current && working.some((chat) => chat.id === current)
          ? current
          : working[0]?.id ?? null
      );
    },
    [chats]
  );

  const handleSync = () => {
    if (syncingPlatform) return;
    openSelector(handleAccountsSelected);
  };

  const loadMessages = useCallback(
    async (chat: Chat, opts?: { force?: boolean; silent?: boolean }) => {
      const { force = false, silent = false } = opts ?? {};
      // Las ofertas ya vienen resueltas en el mapeo y no tienen endpoint de
      // mensajes: nunca se cargan, ni siquiera con "force" (polling). Además
      // así no se resetea unreadCount sin que el usuario haya resuelto la oferta.
      if (isOfferChat(chat)) return;
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
            : chat.platform === "depop"
            ? await fetchDepopChatMessages(channel, chat.ownUserId)
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
  // Las ofertas se saltan: no son conversaciones reales y no hay nada que refrescar.
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (syncingPlatformRef.current || sendingRef.current) return;

      const currentId = selectedChatIdRef.current;
      if (!currentId) return;

      const chat = chatsRef.current.find((c) => c.id === currentId);
      if (!chat || isOfferChat(chat)) return;

      void loadMessages(chat, { force: true, silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [loadMessages]);

  const handleSend = async (text: string) => {
    if (!selectedChat) return;
    // Red de seguridad: la UI ya deshabilita el input para las ofertas, pero
    // no hay endpoint de mensajes para ellas (solo aceptar/rechazar/contraofertar).
    if (isOfferChat(selectedChat)) {
      toast.error("Las ofertas de Depop no admiten respuestas por chat.");
      return;
    }
    setSending(true);
    try {
      const channel = selectedChat.channelId || selectedChat.id;
      const res =
        selectedChat.platform === "vinted"
          ? await sendVintedChatMessage(channel, text)
          : selectedChat.platform === "depop"
          ? await sendDepopChatMessage(
              channel,
              selectedChat.recipientUserId as string | number,
              text
            )
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
        syncing={syncingPlatform !== null}
        hideOnMobile={Boolean(selectedChatId)}
      />
      <ChatWindow
        chat={selectedChat}
        messagesLoading={messagesLoading}
        sending={sending}
        readOnly={isOfferChat(selectedChat)}
        onSend={handleSend}
        onBack={() => setSelectedChatId(null)}
      />
    </div>
  );
}