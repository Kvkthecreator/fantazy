"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageCircle, Clock, ChevronRight, MoreVertical, RotateCcw } from "lucide-react";
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Group by active vs inactive
  const activeChats = items.filter((item) => item.is_active);
  const recentChats = items.filter((item) => !item.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Just Chat</h1>
        <p className="text-muted-foreground">
          Open conversations outside of story episodes. For story-based chats, visit{" "}
          <Link href="/dashboard" className="text-primary hover:underline">Dashboard</Link>.
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
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Active
              </h2>
              <div className="space-y-2">
                {activeChats.map((item) => (
                  <ChatCard
                    key={item.session_id}
                    item={item}
                    onReset={() =>
                      setResetModal({
                        open: true,
                        characterId: item.character_id,
                        characterName: item.character_name,
                      })
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recent Chats */}
          {recentChats.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Recent
              </h2>
              <div className="space-y-2">
                {recentChats.map((item) => (
                  <ChatCard
                    key={item.session_id}
                    item={item}
                    onReset={() =>
                      setResetModal({
                        open: true,
                        characterId: item.character_id,
                        characterName: item.character_name,
                      })
                    }
                  />
                ))}
              </div>
            </section>
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
    <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          {/* Character Avatar - clickable */}
          <Link href={chatUrl} className="relative shrink-0">
            {item.character_avatar_url ? (
              <img
                src={item.character_avatar_url}
                alt={item.character_name}
                className="h-12 w-12 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center text-lg font-semibold text-white">
                {item.character_name[0]}
              </div>
            )}
            {/* Active indicator */}
            {item.is_active && (
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />
            )}
          </Link>

          {/* Content - clickable */}
          <Link href={chatUrl} className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{item.character_name}</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                Just Chat
              </span>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              Playing as <span className="capitalize">{item.character_archetype || "Character"}</span>
            </p>

            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {item.message_count} messages
              </span>
              {item.last_message_at && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(item.last_message_at)}
                  </span>
                </>
              )}
            </div>
          </Link>

          {/* Arrow indicator - clickable */}
          <Link
            href={chatUrl}
            className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>

          {/* Actions menu */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
