"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients, useCreateClient } from "@/hooks/useClients";

const NONE_VALUE = "__none__";
const NEW_VALUE = "__new__";

/**
 * A closed list is enough for how many clients a solo pilot or small team
 * actually has — no need for a searchable combobox. "+ לקוח חדש" swaps the
 * select for a name+phone pair; saving creates a real client row and
 * selects it, so every job ends up linked to a reusable entity instead of a
 * re-typed string. For anything beyond phone (notes, fixing a typo later),
 * see the "לקוחות" tab — this stays a quick-add, not the full editor.
 */
export function ClientPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (clientId: string | undefined) => void;
}) {
  const { data: clients = [] } = useClients();
  const createClient = useCreateClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;

    // Don't silently create a second "דני כהן" — reuse the existing one instead.
    const existingMatch = clients.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    if (existingMatch) {
      onChange(existingMatch.id);
      setCreating(false);
      setNewName("");
      setNewPhone("");
      toast.message(`נבחר לקוח קיים בשם "${existingMatch.name}"`);
      return;
    }

    try {
      const client = await createClient.mutateAsync({ name, phone: newPhone.trim() || undefined });
      onChange(client.id);
      setCreating(false);
      setNewName("");
      setNewPhone("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הוספת הלקוח נכשלה");
    }
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="שם הלקוח"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <Input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="טלפון (אופציונלי)"
            dir="ltr"
            className="max-w-[160px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
        </div>
        <div className="flex gap-2 self-end">
          <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
            ביטול
          </Button>
          <Button type="button" size="sm" onClick={handleCreate} disabled={createClient.isPending || !newName.trim()}>
            {createClient.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            הוספה
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Select
      value={value ?? NONE_VALUE}
      onValueChange={(v) => {
        if (v === NEW_VALUE) setCreating(true);
        else onChange(v === NONE_VALUE ? undefined : v);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="בחר לקוח (אופציונלי)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>ללא לקוח</SelectItem>
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
        <SelectItem value={NEW_VALUE}>+ לקוח חדש</SelectItem>
      </SelectContent>
    </Select>
  );
}
