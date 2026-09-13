"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { uploadPilotLicenseDocument } from "@/actions/documents";

const LICENSE_TYPE_LABELS: Record<string, string> = {
  hobby: "תחביב",
  commercial_25kg: "מסחרי עד 25 ק״ג",
  heavy_2000kg: "כבד עד 2000 ק״ג",
};

/** תוקף רישיון מטיס (מסחרי/כבד) הוא שנתיים, עם מבחן עיוני חוזר במערכת הבחינה והרישום של רת"א — לא חל על רישיון מטיסן (תחביב), שאינו כפוף לאותה תקנת חידוש. */
const COMMERCIAL_LICENSE_TYPES = new Set(["commercial_25kg", "heavy_2000kg"]);
const COMMERCIAL_LICENSE_VALIDITY_YEARS = 2;

function suggestedCommercialExpiry(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + COMMERCIAL_LICENSE_VALIDITY_YEARS);
  return date.toISOString().slice(0, 10);
}

export function LicenseUploadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [licenseType, setLicenseType] = useState("hobby");
  const [expiresAt, setExpiresAt] = useState("");

  function handleLicenseTypeChange(value: string) {
    setLicenseType(value);
    // Suggest the legal default only when the pilot hasn't already typed a real expiry —
    // never overwrite a manual entry or an already-suggested date they may have adjusted.
    if (COMMERCIAL_LICENSE_TYPES.has(value) && !expiresAt) {
      setExpiresAt(suggestedCommercialExpiry());
    }
  }

  async function handleSubmit(formData: FormData) {
    if (!file) {
      toast.error("יש לבחור קובץ");
      return;
    }
    formData.set("file", file);
    setSubmitting(true);
    try {
      const result = await uploadPilotLicenseDocument(formData);
      if (!result.success) {
        toast.error(result.error ?? "העלאה נכשלה");
        return;
      }
      toast.success(
        result.ocrMethod === "simulated"
          ? `הועלה. תאריך תפוגה משוער (OCR מדומה): ${result.expiresAt}`
          : `הועלה. תאריך תפוגה שזוהה: ${result.expiresAt}`
      );
      setOpen(false);
      setFile(null);
      setLicenseType("hobby");
      setExpiresAt("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload />
          העלאת רישיון
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>העלאת מסמך רישיון</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="licenseType">סוג רישיון</Label>
            <Select name="licenseType" value={licenseType} onValueChange={handleLicenseTypeChange}>
              <SelectTrigger id="licenseType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LICENSE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="licenseNumber">מספר רישיון</Label>
            <Input id="licenseNumber" name="licenseNumber" required dir="ltr" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expiresAtOverride">תאריך תפוגה (אופציונלי – עוקף OCR)</Label>
            <Input
              id="expiresAtOverride"
              name="expiresAtOverride"
              type="date"
              dir="ltr"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            {COMMERCIAL_LICENSE_TYPES.has(licenseType) && (
              <p className="text-xs text-muted-foreground">
                תוקף רישיון מטיס (מסחרי/כבד) הוא {COMMERCIAL_LICENSE_VALIDITY_YEARS} שנים — הוצע תאריך תפוגה בהתאם, ניתן לשנות לפי הרישיון בפועל.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">קובץ (PDF/JPG/PNG)</Label>
            <Input
              id="file"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "מעלה..." : "העלה וזהה תוקף"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
