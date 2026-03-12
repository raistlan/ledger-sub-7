import { useState } from "react";
import { useFetcher } from "react-router";
import type { Entry } from "~/types/api";

export function useEditEntryDialog() {
  const fetcher = useFetcher();
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const isOpen = editingEntry !== null;

  function open(entry: Entry) {
    setEditingEntry(entry);
  }

  function close() {
    setEditingEntry(null);
    fetcher.reset();
  }

  function save(updates: { amount: number; type: "expense" | "credit"; memo: string }) {
    if (!editingEntry) return;
    const form = new FormData();
    form.set("intent", "update");
    form.set("entryId", editingEntry.id);
    form.set("amount", String(updates.amount));
    form.set("type", updates.type);
    form.set("memo", updates.memo);
    form.set("date", editingEntry.date);
    fetcher.submit(form, { method: "post" });
    close();
  }

  return { editingEntry, isOpen, open, close, save, fetcher };
}
