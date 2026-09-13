"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Link2, Loader2, MapPinned, Layers, Ban, Check, Radar, Code2, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useLayerOverrides, useSetLayerOverride } from "@/hooks/useApiKeys";
import type { ApiLayer, Tables } from "@/lib/types/database.types";

const LAYER_INFO: Record<ApiLayer, { title: string; description: string; icon: typeof MapPinned; endpoint: string | null }> = {
  map: {
    title: "שכבה 1 — מפה + כרטיסיית דקירת מיקום",
    description: "בדיקת מרחב אווירי בנקודה: רמת חסימה, סיבות, תקרת גובה ידועה.",
    icon: MapPinned,
    endpoint: "GET /api/public/v1/map/inspect?lat=&lon=",
  },
  zones: {
    title: "שכבה 2 — אזורים",
    description: "כל שכבות האזורים (מרחב אווירי + AIP) כ-GeoJSON אחד.",
    icon: Layers,
    endpoint: "GET /api/public/v1/zones",
  },
  actions: {
    title: "שכבה 3 — כפתורי פעולה (תיאום, הרשאות לרכישה)",
    description: "בקשות תיאום ורכישת הרשאות מיוחדות דרך API חיצוני.",
    icon: KeyRound,
    endpoint: null,
  },
  live_ops: {
    title: "שכבה 4 — תפעול חי (מיועד לרת\"א ולשותפי מודיעין תעופתי)",
    description: "כל הבועות המאושרות/ממתינות הפעילות כרגע או בקרוב, כ-GeoJSON — ללא פרטי מטיס, לצורך מצג תמונת מצב.",
    icon: Radar,
    endpoint: "GET /api/public/v1/live-ops",
  },
  map_embed: {
    title: "הטמעת מפה — כל השכבות",
    description: "עמוד מפה עצמאי (ללא מסגרת האפליקציה) להטמעה ב-iframe באתר שותף: אזורי מרחב אווירי, AIP ומקרא — לצפייה בלבד.",
    icon: Code2,
    endpoint: "GET /embed/map?key=",
  },
  marketplace_embed: {
    title: "הטמעת מרקטפלייס — כל השכבות",
    description: "עמוד מרקטפלייס עצמאי להטמעה ב-iframe: חיפוש, סינון לפי אזור/תפקיד/התמחות, וכרטיסי מטיסים מלאים.",
    icon: Store,
    endpoint: "GET /embed/marketplace?key=",
  },
};

const LAYERS: ApiLayer[] = ["map", "zones", "actions", "live_ops", "map_embed", "marketplace_embed"];

function NewKeyDialog({ layer, rawKey, onClose }: { layer: ApiLayer; rawKey: string | null; onClose: () => void }) {
  return (
    <Dialog open={rawKey !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מפתח API חדש — {LAYER_INFO[layer].title}</DialogTitle>
          <DialogDescription>
            המפתח מוצג פעם אחת בלבד. יש להעתיק ולשמור אותו במקום בטוח — לא ניתן יהיה לראות אותו שוב.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
          <code dir="ltr" className="flex-1 overflow-x-auto text-xs">
            {rawKey}
          </code>
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(rawKey ?? "");
              toast.success("הועתק");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LayerSection({
  layer,
  keys,
  overrideUrl,
}: {
  layer: ApiLayer;
  keys: Tables<"api_keys">[];
  overrideUrl: string | null;
}) {
  const info = LAYER_INFO[layer];
  const Icon = info.icon;
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const setOverride = useSetLayerOverride();

  const [newLabel, setNewLabel] = useState("");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [overrideInput, setOverrideInput] = useState(overrideUrl ?? "");

  async function handleCreate() {
    if (!newLabel.trim()) {
      toast.error("יש לתת שם למפתח");
      return;
    }
    const result = await createKey.mutateAsync({ layer, label: newLabel.trim() });
    if (result.success) {
      setNewRawKey(result.rawKey);
      setNewLabel("");
    } else {
      toast.error(result.error);
    }
  }

  async function handleRevoke(id: string) {
    const result = await revokeKey.mutateAsync(id);
    if (!result.success) toast.error(result.error ?? "ביטול המפתח נכשל");
  }

  async function handleSaveOverride() {
    const result = await setOverride.mutateAsync({ layer, overrideUrl: overrideInput.trim() || null });
    if (result.success) toast.success("מקור הנתונים לשכבה עודכן");
    else toast.error(result.error ?? "העדכון נכשל");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {info.title}
        </CardTitle>
        <CardDescription>{info.description}</CardDescription>
        {info.endpoint ? (
          <code dir="ltr" className="w-fit rounded bg-muted px-2 py-1 text-xs">
            {info.endpoint}
          </code>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <Ban className="h-3.5 w-3.5" />
            הנפקת מפתחות זמינה, אך ה-endpoint טרם מחובר — פעולה בשם משתמש דרך API חיצוני דורשת החלטה על מודל אמון בין
            השותף למשתמש (איך מזהים באיזה חשבון לפעול), ולא ממומש כדי לא לפתוח פרצת אבטחה.
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">מפתחות API</p>
          {keys.length === 0 && <p className="text-xs text-muted-foreground">אין מפתחות עדיין.</p>}
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{key.label}</p>
                <code dir="ltr" className="text-xs text-muted-foreground">
                  {key.key_prefix}...
                </code>
              </div>
              <div className="flex items-center gap-2">
                {key.revoked_at ? (
                  <Badge variant="secondary">בוטל</Badge>
                ) : (
                  <>
                    <Badge variant="success">פעיל</Badge>
                    <Button size="sm" variant="outline" onClick={() => handleRevoke(key.id)} disabled={revokeKey.isPending}>
                      ביטול
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor={`new-key-${layer}`}>שם למפתח חדש</Label>
            <Input
              id={`new-key-${layer}`}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="לדוגמה: שותף X — סביבת בדיקה"
            />
          </div>
          <Button onClick={handleCreate} disabled={createKey.isPending}>
            {createKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            הנפקת מפתח
          </Button>
        </div>

        <div className="flex flex-col gap-1.5 border-t pt-4">
          <Label htmlFor={`override-${layer}`} className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            מקור נתונים חלופי (API של שותף) לשכבה זו
          </Label>
          <p className="text-xs text-muted-foreground">
            כשמוגדר, האפליקציה תשלוף את השכבה הזו מכתובת זו במקום מהנתונים הפנימיים.
          </p>
          <div className="flex items-center gap-2">
            <Input
              id={`override-${layer}`}
              dir="ltr"
              value={overrideInput}
              onChange={(e) => setOverrideInput(e.target.value)}
              placeholder="https://partner.example.com/api/zones"
            />
            <Button size="sm" variant="outline" onClick={handleSaveOverride} disabled={setOverride.isPending}>
              {setOverride.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              שמירה
            </Button>
          </div>
        </div>
      </CardContent>

      <NewKeyDialog layer={layer} rawKey={newRawKey} onClose={() => setNewRawKey(null)} />
    </Card>
  );
}

export function AdminApiPageClient() {
  const { data: keys = [], isLoading: keysLoading } = useApiKeys();
  const { data: overrides = [], isLoading: overridesLoading } = useLayerOverrides();

  if (keysLoading || overridesLoading) {
    return <p className="text-sm text-muted-foreground">טוען...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {LAYERS.map((layer) => (
        <LayerSection
          key={layer}
          layer={layer}
          keys={keys.filter((k) => k.layer === layer)}
          overrideUrl={overrides.find((o) => o.layer === layer)?.override_url ?? null}
        />
      ))}
    </div>
  );
}
