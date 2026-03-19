import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getChatRooms, getChatMessages, getOrCreateGeneralRoom, getAllUsers } from "@/lib/chat/service";
import { ChatShell } from "@/components/chat/ChatShell";
import type { Role } from "@/lib/rbac/roles";

export default async function ChatPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const userId = session.user.id!;
  const role   = (session.user as Record<string, unknown>).role as Role;

  // Ensure General room exists
  await withDbRetry(() => getOrCreateGeneralRoom(userId));

  const [rooms, allUsers] = await Promise.all([
    withDbRetry(() => getChatRooms(userId)),
    withDbRetry(() => getAllUsers()),
  ]);

  // Load messages for the first room (General)
  const firstRoom      = rooms[0];
  const initialMessages = firstRoom
    ? await withDbRetry(() => getChatMessages(firstRoom.id, 100))
    : [];

  return (
    <ChatShell
      initialRooms={rooms as Parameters<typeof ChatShell>[0]["initialRooms"]}
      initialMessages={initialMessages as Parameters<typeof ChatShell>[0]["initialMessages"]}
      currentUserId={userId}
      currentUserRole={role}
      allUsers={allUsers}
    />
  );
}
