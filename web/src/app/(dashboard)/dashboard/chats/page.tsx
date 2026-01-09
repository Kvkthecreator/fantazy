"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollRow } from "@/components/ui/scroll-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageCircle, Clock, MoreVertical, RotateCcw, Zap, History } from "lucide-react";
import { ResetChatModal } from "@/components/chat/ResetChatModal";
import type { ChatItem } from "@/types";

export default function MyChatsPage() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resetModal, setResetModal] = useState<{
    open: boolean;
    characterId: string;
    characterName: string;
  }>({ open: false, characterId: "", characterName: "" });

  const loadData = async () => {
    try {
      const data = await api.episodes.getUserChats(50);
      setItems(data.items);
    } catch (err) {
      console.error("Failed to load chats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResetComplete = () => {
    // Remove the reset chat from the list
    setItems((prev) => prev.filter((item) => item.character_id !== resetModal.characterId));
  };

  // Group by active vs inactive for scroll rows
  const activeChats = useMemo(() => items.filter((item) => item.is_active), [items]);
  const recentChats = useMemo(() => items.filter((item) => !item.is_active), [items]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="flex-shrink-0 w-[300px] h-24 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="flex-shrink-0 w-[300px] h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Just Chat</h1>
        <p className="text-muted-foreground">
          {items.length} open {items.length === 1 ? "conversation" : "conversations"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">No free chats yet</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Start a free chat from any series page
          </p>
          <Button asChild>
            <Link href="/discover">Discover Series</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Chats */}
          {activeChats.length > 0 && (
            <ScrollRow
              title="Active"
              icon={<Zap className="h-5 w-5 text-green-500" />}
            >
              {activeChats.map((item) => (
                <div
                  key={item.session_id}
                  className="flex-shrink-0 snap-start w-[300px] sm:w-[340px]"
                >
                  <ChatCard
                    item={item}
                    onReset={() =>
                      setResetModal({
                        open: true,
                        characterId: item.character_id,
                        characterName: item.character_name,
                      })
                    }
                  />
                </div>
              ))}
            </ScrollRow>
          )}

          {/* Recent Chats */}
          {recentChats.length > 0 && (
            <ScrollRow
              title="Recent"
              icon={<History className="h-5 w-5 text-muted-foreground" />}
            >
              {recentChats.map((item) => (
                <div
                  key={item.session_id}
                  className="flex-shrink-0 snap-start w-[300px] sm:w-[340px]"
                >
                  <ChatCard
                    item={item}
                    onReset={() =>
                      setResetModal({
                        open: true,
                        characterId: item.character_id,
                        characterName: item.character_name,
                      })
                    }
                  />
                </div>
              ))}
            </ScrollRow>
          )}
        </div>
      )}

      <ResetChatModal
        open={resetModal.open}
        onClose={() => setResetModal({ open: false, characterId: "", characterName: "" })}
        characterId={resetModal.characterId}
        characterName={resetModal.characterName}
        onResetComplete={handleResetComplete}
      />
    </div>
  );
}

interface ChatCardProps {
  item: ChatItem;
  onReset: () => void;
}

function ChatCard({ item, onReset }: ChatCardProps) {
  // Free chat goes to /chat/[characterId] without episode param
  const chatUrl = `/chat/${item.character_id}`;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all group h-full">
      <CardContent className="p-0">
        <div className="flex h-full">
          {/* Character Avatar - larger for visual impact */}
          <Link
            href={chatUrl}
            className="relative h-24 w-20 sm:w-24 shrink-0 overflow-hidden"
          >
            {item.character_avatar_url ? (
              <img
                src={item.character_avatar_url}
                alt={item.character_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center text-2xl font-semibold text-white">
                {item.character_name[0]}
              </div>
            )}
            {/* Active indicator */}
            {item.is_active && (
              <div className="absolute top-1.5 right-1.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
            )}
          </Link>

          {/* Content */}
          <Link
            href={chatUrl}
            className="flex-1 p-3 flex flex-col justify-between min-w-0"
          >
            <div>
              <h3 className="font-semibold text-sm truncate">{item.character_name}</h3>
              <p className="text-xs text-muted-foreground truncate">
                <span className="capitalize">{item.character_archetype || "Character"}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <MessageCircle className="h-3 w-3" />
                {item.message_count}
              </span>
              {item.last_message_at && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(item.last_message_at)}
                  </span>
                </>
              )}
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-start p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReset();
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
