"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Images, Upload, Trash2, Loader2, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMyPortfolioItems, usePortfolioSignedUrls, useDeletePortfolioItem, type PortfolioItem } from "@/hooks/usePortfolio";
import { uploadPortfolioItem } from "@/actions/portfolio";

function PortfolioTile({ item, canManage }: { item: PortfolioItem; canManage: boolean }) {
  const { data: urls } = usePortfolioSignedUrls([item.storage_path]);
  const deleteItem = useDeletePortfolioItem();
  const url = urls?.[item.storage_path];

  return (
    <div className="group relative overflow-hidden rounded-lg border">
      <div className="aspect-video w-full bg-muted">
        {url && item.media_type === "image" && <img src={url} alt={item.title} className="h-full w-full object-cover" />}
        {url && item.media_type === "video" && (
          <video src={url} controls className="h-full w-full object-cover" />
        )}
        {!url && (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            {item.media_type === "video" ? <PlayCircle className="h-8 w-8" /> : <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-medium">{item.title}</p>
        {item.description && <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
      </div>
      {canManage && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          aria-label={`מחיקת "${item.title}" מתיק העבודות`}
          className="absolute end-2 top-2 h-7 w-7 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          disabled={deleteItem.isPending}
          onClick={() => deleteItem.mutate({ id: item.id, storagePath: item.storage_path })}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function UploadPortfolioDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { refetch } = useMyPortfolioItems();

  async function handleSubmit(formData: FormData) {
    if (!file) {
      toast.error("יש לבחור קובץ");
      return;
    }
    formData.set("file", file);
    setSubmitting(true);
    try {
      const result = await uploadPortfolioItem(formData);
      if (!result.success) {
        toast.error(result.error ?? "ההעלאה נכשלה");
        return;
      }
      toast.success("הפריט נוסף לתיק העבודות");
      setOpen(false);
      setFile(null);
      refetch();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="h-4 w-4" />
          הוספת עבודה
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת עבודה לתיק העבודות</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">כותרת</Label>
            <Input id="title" name="title" required placeholder="לדוגמה: סקר קרקע לחקלאות" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">תיאור קצר (אופציונלי)</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">תמונה או סרטון</Label>
            <Input
              id="file"
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              העלה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shown on the pilot's own profile (edit mode) and on the marketplace profile page (view mode, via PortfolioGallery below). */
export function PortfolioCard() {
  const { data: items = [], isLoading } = useMyPortfolioItems();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
            <Images className="h-4 w-4" />
          </span>
          תיק עבודות
        </CardTitle>
        <UploadPortfolioDialog />
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            עדיין לא הועלו עבודות. תיק עבודות עוזר לארגונים להתרשם מהיכולות שלכם לפני שהם שוכרים אתכם.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <PortfolioTile key={item.id} item={item} canManage />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
