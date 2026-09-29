"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import type { Chat } from "./types";
import { useAccountSelector } from "@/hooks/useAccountSelector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  fetchWallapopChats,
  fetchWallapopChatMessages,
  sendWallapopChatMessage,
} from "@/lib/external-integrations";

// Antes "rl:vestiaire-chats" / "rl:chats": bump de versión para invalidar
// cachés con nombres genéricos ("Usuario de Wallapop") o hilos vacíos del mapper viejo.
const CACHE_VERSION = 2
const STORAGE_KEY = `rl:chats:v${CACHE_VERSION}`

// Rango de días que se puede elegir al sincronizar (se filtra por lastMessageAt)
const MAX_SYNC_DAYS = 20;
const DEFAULT_SYNC_DAYS = 7;

type Platform = "vestiaire" | "vinted" | "depop" | "wallapop";

function loadCachedChats(): Chat[] {
  if (typeof window === "undefined") return [];
  try {
    sessionStorage.removeItem("rl:chats");
    sessionStorage.removeItem("rl:vestiaire-chats");
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CACHE_VERSION) return [];
    return Array.isArray(parsed?.chats) ? parsed.chats : [];
  } catch {
    return [];
  }
}

function saveCachedChats(chats: Chat[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CACHE_VERSION, chats }));
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
  wallapop: "Wallapop",
};

const SYNCABLE_PLATFORMS = new Set<Platform>([
  "vestiaire",
  "vinted",
  "depop",
  "wallapop",
]);

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  // Solo una plataforma puede sincronizar a la vez; null = ninguna sincronizando
  const [syncingPlatform, setSyncingPlatform] = useState<Platform | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const loadingChatIdRef = useRef<string | null>(null);
  const failedLoadIdsRef = useRef<Set<string>>(new Set());

  // Modal previo al selector de cuentas: cuántos días hacia atrás importar
  const [daysModalOpen, setDaysModalOpen] = useState(false);
  const [daysInput, setDaysInput] = useState(String(DEFAULT_SYNC_DAYS));
  // Días confirmados pendientes de abrir el selector de cuentas. El selector
  // se abre en onCloseAutoFocus, cuando el modal de días ya se ha cerrado del
  // todo; si se abriera en el mismo tick, la devolución de foco de Radix al
  // botón de sincronizar cerraría el selector recién abierto.
  const pendingDaysRef = useRef<number | null>(null);

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
    accountId: string,
    sinceTs: number
  ): Promise<{ chats: Chat[] } | null> => {
    setSyncingPlatform(platform);
    try {
      let res;
      if (platform === "vestiaire") {
        res = await fetchVestiaireChats();
      } else if (platform === "vinted") {
        res = await fetchVintedChats({ sinceTs });
      } else if (platform === "wallapop") {
        res = await fetchWallapopChats({ sinceTs });
      } else {
        const ownExternalId = await resolveAccountExternalId(platform, accountId);
        res = await fetchDepopChats(ownExternalId, { sinceTs });
      }

      if (!res.ok) {
        toast.error(
          res.message ||
            `Asegúrate de tener la pestaña de ${PLATFORM_LABELS[platform]} abierta e iniciada sesión.`
        );
        return null;
      }

      toast.success(res.message);

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
    async (accounts: { accountId: string; platform: string }[], days: number) => {
      const relevant = accounts.filter(
        (a): a is { accountId: string; platform: Platform } =>
          SYNCABLE_PLATFORMS.has(a.platform as Platform)
      );
      if (relevant.length === 0) return;

      const byPlatform = new Map<Platform, string>();
      for (const a of relevant) {
        if (!byPlatform.has(a.platform)) byPlatform.set(a.platform, a.accountId);
      }

      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

      let working = chats;
      for (const [platform, accountId] of byPlatform) {
        const result = await syncPlatform(platform, accountId, cutoff);
        if (!result) continue;

        const recent = result.chats.filter(
          (c) => isOfferChat(c) || lastMessageTs(c) >= cutoff
        );

        working = [
          ...working.filter((c) => c.platform !== platform),
          ...recent,
        ].sort(byLastMessageDesc);
      }

      setChats(working);
      saveCachedChats(working);
      failedLoadIdsRef.current.clear();
      setSelectedChatId((current) =>
        current && working.some((chat) => chat.id === current)
          ? current
          : working[0]?.id ?? null
      );
    },
    [chats]
  );

  // Paso 1: al pulsar sincronizar se pregunta primero el nº de días
  const handleSync = () => {
    if (syncingPlatform) return;
    pendingDaysRef.current = null;
    setDaysModalOpen(true);
  };

  // Paso 2: se validan los días (1..MAX_SYNC_DAYS), se guardan y se cierra el
  // modal. El selector de cuentas se abre en onCloseAutoFocus del DialogContent.
  const confirmDays = () => {
    const parsed = Math.floor(Number(daysInput));
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error("Introduce un número de días válido");
      return;
    }
    const days = Math.min(parsed, MAX_SYNC_DAYS);
    setDaysInput(String(days));
    pendingDaysRef.current = days;
    setDaysModalOpen(false);
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
              : chat.platform === "wallapop"
                ? await fetchWallapopChatMessages(channel)
                : await fetchVestiaireChatMessages(channel);
        if (!res.ok) {
          failedLoadIdsRef.current.add(chat.id);
          if (!silent) toast.error(res.message);
          return;
        }

        failedLoadIdsRef.current.delete(chat.id);
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
        failedLoadIdsRef.current.add(chat.id);
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

  // Polling: cada 30s se refresca en silencio la conversación abierta.
  // No se polla si el último load falló (hasta que el usuario vuelva a
  // seleccionar el chat) ni si la pestaña está en segundo plano.
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (syncingPlatformRef.current || sendingRef.current) return;

      const currentId = selectedChatIdRef.current;
      if (!currentId || failedLoadIdsRef.current.has(currentId)) return;

      const chat = chatsRef.current.find((c) => c.id === currentId);
      if (!chat || isOfferChat(chat) || !chat.messagesLoaded) return;

      void loadMessages(chat, { force: true, silent: true });
    }, 30000);

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
            : selectedChat.platform === "wallapop"
              ? await sendWallapopChatMessage(channel, text, {
                  toUserHash: selectedChat.senderId,
                  fromUserHash: selectedChat.ownUserHash,
                })
              : await sendVestiaireChatMessage(channel, text);
      if (!res.ok || !res.sent) {
        toast.error(res.message || "No se pudo enviar el mensaje");
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
        onSelect={(chatId) => {
          failedLoadIdsRef.current.delete(chatId);
          setSelectedChatId(chatId);
          const chat = chats.find((c) => c.id === chatId);
          if (chat && !chat.messagesLoaded && !isOfferChat(chat)) {
            void loadMessages(chat);
          }
        }}
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

      <Dialog open={daysModalOpen} onOpenChange={setDaysModalOpen}>
        <DialogContent
          className="!max-w-[400px] w-full rounded-xl p-0 overflow-hidden"
          onCloseAutoFocus={(e) => {
            const days = pendingDaysRef.current;
            if (days === null) return; // cerrado con Cancelar/Escape: comportamiento normal
            e.preventDefault(); // evita que el foco vuelva al botón y cierre el selector
            pendingDaysRef.current = null;
            openSelector((accounts) => handleAccountsSelected(accounts, days));
          }}
        >
          <div className="p-6 border-b border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-800">
                Importar chats de los últimos…
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Máximo {MAX_SYNC_DAYS} días.
              </p>
            </DialogHeader>
          </div>

          <div className="p-6 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={MAX_SYNC_DAYS}
              value={daysInput}
              autoFocus
              onChange={(e) => setDaysInput(e.target.value)}
              onBlur={() => {
                const n = Math.floor(Number(daysInput));
                if (Number.isFinite(n))
                  setDaysInput(String(Math.min(Math.max(n, 1), MAX_SYNC_DAYS)));
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.repeat || e.nativeEvent.isComposing) return;
                e.preventDefault();
                confirmDays();
              }}
              className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <span className="text-sm text-gray-600">días</span>
          </div>

          <div className="p-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={() => setDaysModalOpen(false)}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition cursor-pointer font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDays}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer font-medium"
            >
              Continuar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}