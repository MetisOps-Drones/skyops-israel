"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from "@/hooks/useClients";
import type { Tables } from "@/lib/types/database.types";

type Client = Tables<"clients">;

function ClientDialog({
  client,
  open,
  onOpenChange,
}: {
  client: Client | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const isPending = createClient.isPending || updateClient.isPending;

  function handleOpenChange(v: boolean) {
    if (v) {
      setName(client?.name ?? "");
      setPhone(client?.phone ?? "");
      setNotes(client?.notes ?? "");
    }
    onOpenChange(v);
  }

  async function handleSave() {
    if (!name.trim()) return;
    try {
      if (client) {
        await updateClient.mutateAsync({ id: client.id, name: name.trim(), phone: phone.trim() || null, notes: notes.trim() || null });
        toast.success("פרטי הלקוח עודכנו");
      } else {
        await createClient.mutateAsync({ name: name.trim(), phone: phone.trim() || undefined, notes: notes.trim() || undefined });
        toast.success("הלקוח נוסף");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "השמירה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? "עריכת לקוח" : "לקוח חדש"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-name">שם</Label>
            <Input id="client-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-phone">טלפון</Label>
            <Input id="client-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-notes">הערות</Label>
            <Textarea id="client-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            שמירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteClientDialog({
  client,
  open,
  onOpenChange,
}: {
  client: Client | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const deleteClient = useDeleteClient();

  async function handleConfirm() {
    if (!client) return;
    try {
      await deleteClient.mutateAsync(client.id);
      toast.success("הלקוח הוסר");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ההסרה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הסרת {client?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          רשומות טיסה קיימות שמשויכות ללקוח זה יישארו, ללא שיוך ללקוח. הפעולה אינה הפיכה.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleteClient.isPending}>
            {deleteClient.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            הסרה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientsPanel() {
  const { data: clients = [], isLoading } = useClients();
  const [dialogClient, setDialogClient] = useState<Client | null | undefined>(undefined);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </span>
          הלקוחות שלי
        </CardTitle>
        <Button size="sm" onClick={() => setDialogClient(null)}>
          <Plus className="h-4 w-4" />
          לקוח חדש
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>הערות</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  אין עדיין לקוחות שמורים — נוצרים אוטומטית גם דרך &ldquo;לקוח חדש&rdquo; ברשומת טיסה
                </TableCell>
              </TableRow>
            )}
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell dir="ltr" className="text-end">
                  {client.phone ?? "—"}
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-muted-foreground">{client.notes ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDialogClient(client)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingClient(client)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <ClientDialog client={dialogClient ?? null} open={dialogClient !== undefined} onOpenChange={(v) => !v && setDialogClient(undefined)} />
      <DeleteClientDialog client={deletingClient} open={deletingClient !== null} onOpenChange={(v) => !v && setDeletingClient(null)} />
    </Card>
  );
}
