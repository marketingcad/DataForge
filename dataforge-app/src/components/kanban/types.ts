import type { KanbanColumn, KanbanPriority } from "@/generated/prisma/enums";

export type KanbanCommentData = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; name: string | null; role: string };
};

export type KanbanTaskData = {
  id: string;
  title: string;
  description: string | null;
  column: KanbanColumn;
  priority: KanbanPriority;
  dueDate: Date | null;
  tags: string[];
  position: number;
  createdBy: { id: string; name: string | null };
  assignee: { id: string; name: string | null; role?: string } | null;
  comments: KanbanCommentData[];
};

export type KanbanUserData = { id: string; name: string | null; role: string };
