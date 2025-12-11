import { ChatContainer } from "@/components/chat/ChatContainer";

interface ChatPageProps {
  params: Promise<{
    characterId: string;
  }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { characterId } = await params;

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ChatContainer characterId={characterId} />
    </div>
  );
}
