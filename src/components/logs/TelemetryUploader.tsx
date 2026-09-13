"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useDrones } from "@/hooks/useDrones";
import { useCreateFlightLog } from "@/hooks/useFlightLogs";
import { useClients } from "@/hooks/useClients";
import { createClient } from "@/lib/supabase/client";
import { ClientPicker } from "@/components/logs/ClientPicker";

interface TelemetryParseResponse {
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  maxAltitudeM: number;
  maxDistanceM: number;
  minBatteryPercent: number | null;
  sampleCount: number;
  telemetryData: Record<string, unknown>;
}

export function TelemetryUploader() {
  const { data: drones = [] } = useDrones();
  const { data: clients = [] } = useClients();
  const [droneId, setDroneId] = useState<string | undefined>();
  const [clientId, setClientId] = useState<string | undefined>();
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<{ fileName: string; result: TelemetryParseResponse } | null>(null);
  const createLog = useCreateFlightLog();

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/telemetry/parse", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.error ?? "פענוח קובץ הטלמטריה נכשל");
        return;
      }
      setPreview({ fileName: file.name, result: json });
    } catch {
      toast.error("שגיאה בהעלאת הקובץ");
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  async function confirmImport() {
    if (!preview || !droneId) {
      toast.error("יש לבחור כלי טיס");
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("יש להתחבר מחדש");
      return;
    }

    const { result } = preview;
    if (!result.startTime || !result.endTime) {
      toast.error("לא ניתן לקבוע זמני התחלה/סיום מהקובץ. יש להוסיף רשומה ידנית.");
      return;
    }

    const selectedClient = clients.find((c) => c.id === clientId);

    try {
      await createLog.mutateAsync({
        user_id: user.id,
        drone_id: droneId,
        start_time: result.startTime,
        end_time: result.endTime,
        max_altitude_m: result.maxAltitudeM,
        max_distance_m: result.maxDistanceM,
        telemetry_data: result.telemetryData as never,
        telemetry_source: "dji_csv",
        notes: `יובא מקובץ טלמטריה: ${preview.fileName}`,
        client_id: clientId ?? null,
        client_name: selectedClient?.name ?? null,
      });
      toast.success("יומן הטיסה יובא בהצלחה");
      setPreview(null);
      setClientId(undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ייבוא הרשומה נכשל");
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>כלי טיס ליבוא</Label>
            <Select value={droneId} onValueChange={setDroneId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר כלי טיס" />
              </SelectTrigger>
              <SelectContent>
                {drones.map((drone) => (
                  <SelectItem key={drone.id} value={drone.id}>
                    {drone.nickname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>לקוח (אופציונלי)</Label>
            <ClientPicker value={clientId} onChange={setClientId} />
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-input"
          )}
        >
          {parsing ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">גרור לכאן קובץ טלמטריית DJI (CSV/TXT)</p>
          <p className="text-xs text-muted-foreground">או</p>
          <Button variant="outline" size="sm" asChild>
            <label>
              בחר קובץ
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
          </Button>
        </div>

        {preview && (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">{preview.fileName}</span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
              <span className="text-muted-foreground">משך</span>
              <span>{preview.result.durationMinutes} דק׳</span>
              <span className="text-muted-foreground">גובה מרבי</span>
              <span>{Math.round(preview.result.maxAltitudeM)} מ׳</span>
              <span className="text-muted-foreground">מרחק מרבי</span>
              <span>{Math.round(preview.result.maxDistanceM)} מ׳</span>
              <span className="text-muted-foreground">דגימות</span>
              <span>{preview.result.sampleCount}</span>
            </div>
            <Button onClick={confirmImport} disabled={createLog.isPending}>
              {createLog.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              ייבוא לרשומת טיסה
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
