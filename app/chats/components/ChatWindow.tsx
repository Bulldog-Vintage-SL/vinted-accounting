"use client";

import { useState } from "react";
import { Send, MessageCircle } from "lucide-react";
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
}

export function ChatWindow({ chat }: ChatWindowProps) {
  const [draft, setDraft] = useState("");

  if (!chat) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center gap-3 text-base-content/50 bg-base-200">
        <MessageCircle className="w-10 h-10" />
        <p className="text-sm">Selecciona una conversación para empezar</p>
      </div>
    );
  }

  const handleSend = () => {
    if (!draft.trim()) return;
    // TODO: enviar mensaje al backend cuando exista la colección `chats`
    setDraft("");
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-base-200">
      {/* Cabecera */}
      <div className="h-16 shrink-0 flex items-center gap-3 px-6 border-b border-base-300 bg-base-100">
        <div className="w-9 h-9 rounded-full bg-base-300 flex items-center justify-center text-sm font-medium shrink-0">
          {chat.contactName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{chat.contactName}</p>
          {chat.listingTitle && (
            <p className="text-xs text-base-content/60 truncate">
              {chat.listingTitle}
            </p>
          )}
        </div>
        <PlatformBadge platform={chat.platform} />
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {chat.messages.map((message) => (
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
              <p>{message.content}</p>
              <p
                className={`text-[10px] mt-1 ${
                  message.isOwn ? "text-primary-content/70" : "text-base-content/50"
                }`}
              >
                {formatTime(message.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-base-300 bg-base-100 p-4 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Escribe un mensaje..."
          className="flex-1 rounded-full border border-base-300 bg-base-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          onClick={handleSend}
          className="w-9 h-9 rounded-full bg-primary text-primary-content flex items-center justify-center shrink-0 hover:opacity-90 transition"
          aria-label="Enviar mensaje"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}