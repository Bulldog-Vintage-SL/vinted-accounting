"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle, Loader2, ArrowLeft, Info } from "lucide-react";
import { Chat } from "../types";
import { PlatformBadge } from "./PlatformBadge";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ChatWindowProps {
  chat: Chat | null;
  messagesLoading?: boolean;
  sending?: boolean;
  // Conversaciones que no admiten respuesta de texto (p. ej. ofertas de Depop)
  readOnly?: boolean;
  onSend?: (text: string) => Promise<void> | void;
  onBack?: () => void;
}

export function ChatWindow({
  chat,
  messagesLoading = false,
  sending = false,
  readOnly = false,
  onSend,
  onBack,
}: ChatWindowProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft("");
  }, [chat?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.id, chat?.messages.length, messagesLoading]);

  if (!chat) {
    return (
      <div className="hidden lg:flex flex-1 h-full flex-col items-center justify-center gap-3 text-base-content/50 bg-base-200">
        <MessageCircle className="w-10 h-10" />
        <p className="text-sm">Selecciona una conversación para empezar</p>
      </div>
    );
  }

  const handleSend = async () => {
    const text = draft.trim();
    if (readOnly || !text || sending) return;
    setDraft("");
    await onSend?.(text);
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-base-200 min-w-0">
      <div className="h-16 shrink-0 flex items-center gap-3 px-4 lg:px-6 border-b border-base-300 bg-base-100">
        {onBack && (
          <button
            onClick={onBack}
            className="lg:hidden p-1 rounded-md hover:bg-base-200"
            aria-label="Volver a la lista"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {chat.contactAvatarUrl ? (
          <img
            src={chat.contactAvatarUrl}
            alt={chat.contactName}
            className="w-9 h-9 rounded-full object-cover shrink-0 bg-base-300"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-base-300 flex items-center justify-center text-sm font-medium shrink-0">
            {chat.contactName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{chat.contactName}</p>
          {chat.listingTitle && (
            <p className="text-xs text-base-content/60 truncate">
              {chat.listingTitle}
            </p>
          )}
        </div>
        {chat.listingImageUrl && (
          <img
            src={chat.listingImageUrl}
            alt={chat.listingTitle || "Producto"}
            className="w-9 h-9 rounded-md object-cover shrink-0 bg-base-300"
          />
        )}
        <PlatformBadge platform={chat.platform} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messagesLoading && chat.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-base-content/50">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          chat.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  message.isOwn
                    ? "bg-primary text-primary-content rounded-br-sm"
                    : "bg-base-100 text-base-content rounded-bl-sm border border-base-300"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    message.isOwn ? "text-primary-content/70" : "text-base-content/50"
                  }`}
                >
                  {formatTime(message.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        {messagesLoading && chat.messages.length > 0 && (
          <div className="flex justify-center py-2 text-base-content/40">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {readOnly ? (
        <div className="shrink-0 border-t border-base-300 bg-base-100 px-4 py-4 flex items-center gap-2 text-sm text-base-content/60">
          <Info className="w-4 h-4 shrink-0" />
          <p>Las ofertas no admiten respuesta desde aquí.</p>
        </div>
      ) : (
        <div className="shrink-0 border-t border-base-300 bg-base-100 p-4 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Escribe un mensaje..."
            disabled={sending}
            className="flex-1 rounded-full border border-base-300 bg-base-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="w-9 h-9 rounded-full bg-primary text-primary-content flex items-center justify-center shrink-0 hover:opacity-90 transition disabled:opacity-50"
            aria-label="Enviar mensaje"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}