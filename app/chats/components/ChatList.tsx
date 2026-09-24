"use client";

import { useEffect, useRef, useState } from "react";
import { Chat } from "../types";
import { PlatformBadge } from "./PlatformBadge";
import { RefreshCw, ChevronDown } from "lucide-react";

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
  onSyncPlatform: (platform: Platform) => void;
  syncingPlatform: Platform | null;
  hideOnMobile?: boolean;
}

export function ChatList({
  chats,
  selectedChatId,
  onSelect,
  onSyncPlatform,
  syncingPlatform,
  hideOnMobile = false,
}: ChatListProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const syncing = syncingPlatform !== null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePick = (platform: Platform) => {
    setMenuOpen(false);
    onSyncPlatform(platform);
  };

  const syncingLabel = syncingPlatform
    ? SYNC_OPTIONS.find((o) => o.platform === syncingPlatform)?.label
    : null;

  return (
    <div
      className={`${
        hideOnMobile ? "hidden lg:flex" : "flex"
      } w-full lg:w-80 shrink-0 border-r border-base-300 bg-base-100 h-full flex-col`}
    >
      <div className="h-16 flex items-center justify-between gap-2 px-4 border-b border-base-300 shrink-0">
        <h2 className="font-bold text-lg">Chats</h2>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-base-300 hover:bg-base-200 transition disabled:opacity-50"
            title="Sincronizar chats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? `Sincronizando ${syncingLabel}...` : "Sincronizar"}
            {!syncing && <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {menuOpen && !syncing && (
            <ul className="absolute right-0 z-10 mt-1 w-52 rounded-md border border-base-300 bg-base-100 shadow-lg overflow-hidden">
              {SYNC_OPTIONS.map((opt) => (
                <li key={opt.platform}>
                  <button
                    onClick={() => handlePick(opt.platform)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-base-200 transition"
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <p className="text-sm text-base-content/60 text-center py-10 px-4">
            {syncing
              ? `Cargando conversaciones de ${syncingLabel}...`
              : "No hay conversaciones. Pulsa Sincronizar y elige una cuenta (con sesión iniciada)."}
          </p>
        ) : (
          chats.map((chat) => {
            const active = chat.id === selectedChatId;
            return (
              <button
                key={chat.id}
                onClick={() => onSelect(chat.id)}
                className={`w-full text-left px-4 py-3 flex gap-3 items-start border-b border-base-300 transition-colors duration-200 ${
                  active ? "bg-base-300" : "hover:bg-base-200"
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
            );
          })
        )}
      </div>
    </div>
  );
}