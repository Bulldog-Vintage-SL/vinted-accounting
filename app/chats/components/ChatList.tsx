"use client";

import { useRef } from "react";
import { Chat } from "../types";
import { PlatformBadge } from "./PlatformBadge";
import { RefreshCw, Sparkles, Check } from "lucide-react";

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d`;
}

type Platform = "vestiaire" | "vinted" | "wallapop";

const SYNC_OPTIONS: { platform: Platform; label: string }[] = [
  { platform: "vestiaire", label: "Vestiaire Collective" },
  { platform: "vinted", label: "Vinted" },
  { platform: "wallapop", label: "Wallapop" },
];

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelect: (chatId: string) => void;
  onSync: () => void;
  syncing: boolean;
  hideOnMobile?: boolean;
  // Selección múltiple
  checkedIds: Set<string>;
  onToggleCheck: (chatId: string) => void;
  onClearChecked: () => void;
  onReplyWithAI: () => void;
}

export function ChatList({
  chats,
  selectedChatId,
  onSelect,
  onSync,
  syncing,
  hideOnMobile = false,
  checkedIds,
  onToggleCheck,
  onClearChecked,
  onReplyWithAI,
}: ChatListProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const checkedCount = checkedIds.size;

  return (
    <div
      className={`${hideOnMobile ? "hidden lg:flex" : "flex"
        } w-full lg:w-80 shrink-0 border-r border-base-300 bg-base-100 h-full flex-col`}
    >
      <div className="h-16 flex items-center justify-between gap-2 px-4 border-b border-base-300 shrink-0">
        <h2 className="font-bold text-lg">Chats</h2>

        <div ref={menuRef} className="relative">
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-base-300 hover:bg-base-200 transition disabled:opacity-50"
            title="Sincronizar chats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </div>

      {/* Barra de selección múltiple */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-base-300 shrink-0">
        <button
          type="button"
          onClick={onReplyWithAI}
          disabled={checkedCount === 0}
          className="flex items-center gap-1.5 text-sm text-purple-600 border border-purple-200 px-3 py-1.5 rounded-md hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Sparkles size={14} />
          Responder con IA{checkedCount > 0 ? ` (${checkedCount})` : ""}
        </button>
        {checkedCount > 0 && (
          <button
            type="button"
            onClick={onClearChecked}
            className="text-xs text-base-content/60 hover:text-base-content transition"
          >
            Deseleccionar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <p className="text-sm text-base-content/60 text-center py-10 px-4">
            {syncing
              ? "Cargando conversaciones..."
              : "No hay conversaciones. Pulsa Sincronizar y elige una cuenta (con sesión iniciada)."}
          </p>
        ) : (
          chats.map((chat) => {
            const active = chat.id === selectedChatId;
            const checked = checkedIds.has(chat.id);
            return (
              <div key={chat.id} className="relative">
                <button
                  onClick={() => onSelect(chat.id)}
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start border-b border-base-300 transition-colors duration-200 ${
                    active ? "bg-base-300" : checked ? "bg-primary/10" : "hover:bg-base-200"
                  }`}
                >
                  {chat.contactAvatarUrl ? (
                    <img
                      src={chat.contactAvatarUrl}
                      alt={chat.contactName}
                      className="w-10 h-10 rounded-full object-cover shrink-0 bg-base-300"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center shrink-0 text-sm font-medium">
                      {chat.contactName.charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate">
                        {chat.contactName}
                      </span>
                      <span className="text-xs text-base-content/50 shrink-0">
                        {formatRelativeTime(chat.lastMessageAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5">
                      <PlatformBadge platform={chat.platform} />
                      {chat.listingTitle && (
                        <span className="text-xs text-base-content/60 truncate">
                          {chat.listingTitle}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-base-content/70 truncate">
                        {chat.lastMessagePreview}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="bg-primary text-primary-content text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {chat.listingImageUrl && (
                    <img
                      src={chat.listingImageUrl}
                      alt={chat.listingTitle || "Producto"}
                      className="w-10 h-10 rounded-md object-cover shrink-0 bg-base-300"
                    />
                  )}
                </button>

                {/* Casilla en la esquina (fuera del <button> para no anidar botones) */}
                {!chat.isOffer && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label="Seleccionar chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCheck(chat.id);
                    }}
                    className={`absolute top-1.5 left-1.5 w-4 h-4 rounded border flex items-center justify-center transition ${
                      checked
                        ? "bg-purple-600 border-purple-600 text-white"
                        : "bg-base-100 border-base-300 hover:border-purple-400"
                    }`}
                  >
                    {checked && <Check size={12} strokeWidth={3} />}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}