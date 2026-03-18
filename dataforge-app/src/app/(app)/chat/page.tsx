import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getChatMessages } from "@/lib/chat/service";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { MessageSquare } from "lucide-react";

export default async function ChatPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const messages = await withDbRetry(() => getChatMessages(100));

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Team Chat</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">Real-time messaging with your team</p>
      </div>

      <ChatWindow
        initialMessages={messages as Parameters<typeof ChatWindow>[0]["initialMessages"]}
        currentUserId={session.user.id!}
      />
    </div>
  );
}
