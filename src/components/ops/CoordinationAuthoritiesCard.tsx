"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Phone, Plus, Pencil, Trash2, ShieldQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useCoordinationAuthorities,
  useCreateCoordinationAuthority,
  useUpdateCoordinationAuthority,
  useDeleteCoordinationAuthority,
  type CoordinationAuthority,
} from "@/hooks/useCoordinationAuthorities";

interface FormState {
  name: string;
  unit_type: string;
  phone: string;
  backup_phone: string;
  notes: string;
  center_lat: string;
  center_lng: string;
  radius_km: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  unit_type: "",
  phone: "",
  backup_phone: "",
  notes: "",
  center_lat: "",
  center_lng: "",
  radius_km: "",
};

function toFormState(a: CoordinationAuthority): FormState {
  return {
    name: a.name,
    unit_type: a.unit_type,
    phone: a.phone,
    backup_phone: a.backup_phone ?? "",
    notes: a.notes ?? "",
    center_lat: String(a.center_lat),
    center_lng: String(a.center_lng),
    radius_km: String(a.radius_m / 1000),
  };
}

function AuthorityDialog({
  editing,
  open,
  onOpenChange,
}: {
  editing: CoordinationAuthority | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(editing ? toFormState(editing) : EMPTY_FORM);
  const create = useCreateCoordinationAuthority();
  const update = useUpdateCoordinationAuthority();
  const pending = create.isPending || update.isPending;

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    const lat = Number(form.center_lat);
    const lng = Number(form.center_lng);
    const radiusKm = Number(form.radius_km);
    if (!form.name.trim() || !form.unit_type.trim() || !form.phone.trim()) {
      toast.error("יש למלא שם, סוג גורם וטלפון");
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radiusKm) || radiusKm <= 0) {
      toast.error("קואורדינטות/רדיוס לא תקינים");
      return;
    }
    const payload = {
      name: form.name.trim(),
      unit_type: form.unit_type.trim(),
      phone: form.phone.trim(),
      backup_phone: form.backup_phone.trim() || null,
      notes: form.notes.trim() || null,
      center_lat: lat,
      center_lng: lng,
      radius_m: Math.round(radiusKm * 1000),
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast.success("הגורם עודכן");
      } else {
        await create.mutateAsync(payload);
        toast.success("הגורם נוסף");
        setForm(EMPTY_FORM);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "השמירה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "עריכת גורם תיאום" : "הוספת גורם תיאום"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ca-name">שם הגורם</Label>
              <Input id="ca-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="לדוגמה: אוגדת עזה" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ca-type">סוג גורם</Label>
              <Input id="ca-type" value={form.unit_type} onChange={(e) => set("unit_type", e.target.value)} placeholder="יבא / מבא / אוגדה / פיקוח / אחר" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ca-phone">טלפון</Label>
              <Input id="ca-phone" dir="ltr" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="05X-XXXXXXX" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ca-backup-phone">טלפון גיבוי (אופציונלי)</Label>
              <Input id="ca-backup-phone" dir="ltr" value={form.backup_phone} onChange={(e) => set("backup_phone", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ca-lat">קו רוחב (Lat)</Label>
              <Input id="ca-lat" dir="ltr" type="number" step="any" value={form.center_lat} onChange={(e) => set("center_lat", e.target.value)} placeholder="31.77" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ca-lng">קו אורך (Lng)</Label>
              <Input id="ca-lng" dir="ltr" type="number" step="any" value={form.center_lng} onChange={(e) => set("center_lng", e.target.value)} placeholder="35.21" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ca-radius">רדיוס אחריות (ק&quot;מ)</Label>
              <Input id="ca-radius" dir="ltr" type="number" step="any" value={form.radius_km} onChange={(e) => set("radius_km", e.target.value)} placeholder="15" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            מרכז וטווח גס בלבד (עיגול) — לא גבול מדויק. בקשה שנופלת בטווח הזה תוצג עם הגורם הזה במסך התיאום.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ca-notes">הערות (אופציונלי)</Label>
            <Textarea id="ca-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {editing ? "שמירה" : "הוספה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Admin-only ("מוקד תיאום" is already gated server-side to dispatcher_admin) directory of who to call for airspace coordination — phone numbers here never reach the org/pilot side (see 0071). */
export function CoordinationAuthoritiesCard() {
  const { data: authorities = [], isLoading } = useCoordinationAuthorities();
  const deleteAuthority = useDeleteCoordinationAuthority();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CoordinationAuthority | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(a: CoordinationAuthority) {
    setEditing(a);
    setDialogOpen(true);
  }

  async function handleDelete(a: CoordinationAuthority) {
    if (!confirm(`למחוק את "${a.name}"?`)) return;
    try {
      await deleteAuthority.mutateAsync(a.id);
      toast.success("הגורם נמחק");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "המחיקה נכשלה");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldQuestion className="h-4 w-4" />
          </span>
          גורמי תיאום מרחב אווירי
        </CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          הוספת גורם
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          מידע פנימי בלבד — לא מוצג לארגון/למטיס בשום מסך. משמש לזיהוי אוטומטי של הגורם הרלוונטי (יבא/מבא/אוגדה/פיקוח)
          עבור בקשת תיאום לפי מיקומה.
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {!isLoading && authorities.length === 0 && (
          <p className="text-sm text-muted-foreground">
            אין עדיין גורמי תיאום רשומים — עד שיתווספו, בקשות תיאום יוצגו ללא זיהוי גורם אחראי אוטומטי.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {authorities.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {a.name} <span className="text-xs font-normal text-muted-foreground">· {a.unit_type}</span>
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                  <Phone className="h-3 w-3 shrink-0" />
                  {a.phone}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon" variant="ghost" aria-label={`עריכת ${a.name}`} onClick={() => openEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`מחיקת ${a.name}`} onClick={() => handleDelete(a)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <AuthorityDialog
        key={`${dialogOpen}-${editing?.id ?? "new"}`}
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </Card>
  );
}
