"use client";

import { Chat } from "../types";
import { PlatformBadge } from "./PlatformBadge";

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d`;
}

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelect: (chatId: string) => void;
}

export function ChatList({ chats, selectedChatId, onSelect }: ChatListProps) {
  return (
    <div className="w-full lg:w-80 shrink-0 border-r border-base-300 bg-base-100 h-full flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-base-300 shrink-0">
        <h2 className="font-bold text-lg">Chats</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <p className="text-sm text-base-content/60 text-center py-10 px-4">
            No hay conversaciones todavía.
          </p>
        ) : (
          chats.map((chat) => {
            const active = chat.id === selectedChatId;
            return (
              <button
                key={chat.id}
                onClick={() => onSelect(chat.id)}
                className={`w-full text-left px-4 py-3 flex gap-3 items-start border-b border-base-300 transition-colors duration-200 ${
                  active
                    ? "bg-base-300"
                    : "hover:bg-base-200"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center shrink-0 text-sm font-medium">
                  {chat.contactName.charAt(0)}
                </div>

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
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}