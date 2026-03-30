"use client";

import { saveLeadsAction, LeadRow } from "@/actions/domain-scrape.actions";
import { FolderPickerModal } from "@/components/shared/FolderPickerModal";
import { useNotifications } from "@/lib/notifications";

interface SaveLeadsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leads: LeadRow[];
  onSaved: (result: { saved: number; duplicates: number; failed: number }) => void;
}

export function SaveLeadsModal({ open, onOpenChange, leads, onSaved }: SaveLeadsModalProps) {
  const { add: addNotif } = useNotifications();

  async function handleConfirm(folderId: string | null) {
    const result = await saveLeadsAction(leads, folderId ?? undefined);
    onSaved(result);
    addNotif({
      type: "success",
      title: `${result.saved} lead${result.saved !== 1 ? "s" : ""} saved`,
      message: `${result.duplicates} duplicate${result.duplicates !== 1 ? "s" : ""} · ${result.failed} failed`,
    });
  }

  return (
    <FolderPickerModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Save ${leads.length} lead${leads.length !== 1 ? "s" : ""}`}
      confirmLabel={`Save ${leads.length} lead${leads.length !== 1 ? "s" : ""} →`}
      onConfirm={handleConfirm}
    />
  );
}
