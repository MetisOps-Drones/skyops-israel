"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uploadSchema = z.object({
  title: z.string().trim().min(2, "כותרת חובה").max(120),
  description: z.string().trim().max(500).optional(),
});

export interface UploadPortfolioItemResult {
  success: boolean;
  error?: string;
}

/** Uploads one portfolio file to the private `portfolio` bucket and inserts the matching `portfolio_items` row. Same shape as uploadPilotLicenseDocument (src/actions/documents.ts), minus the OCR step. */
export async function uploadPortfolioItem(formData: FormData): Promise<UploadPortfolioItemResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "לא נבחר קובץ" };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { success: false, error: "הקובץ גדול מ-25MB" };
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    return { success: false, error: "יש להעלות תמונה או סרטון בלבד" };
  }

  const parsed = uploadSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "יש להתחבר מחדש" };
  }

  const storagePath = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("portfolio").upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return { success: false, error: `העלאת הקובץ נכשלה: ${uploadError.message}` };
  }

  const { error: insertError } = await supabase.from("portfolio_items").insert({
    pilot_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    storage_path: storagePath,
    media_type: isVideo ? "video" : "image",
  });
  if (insertError) {
    return { success: false, error: `שמירת הפריט נכשלה: ${insertError.message}` };
  }

  revalidatePath("/profile");
  return { success: true };
}

export async function deletePortfolioItem(id: string, storagePath: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error: deleteRowError } = await supabase.from("portfolio_items").delete().eq("id", id);
  if (deleteRowError) {
    return { success: false, error: deleteRowError.message };
  }
  await supabase.storage.from("portfolio").remove([storagePath]);
  revalidatePath("/profile");
  return { success: true };
}

/** Signed URLs (10 min) for rendering portfolio media — the bucket is private, RLS on storage.objects still gates who this succeeds for (owner, org accounts, admins — see 0059). */
export async function getPortfolioSignedUrls(storagePaths: string[]): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};
  const supabase = createClient();
  const result: Record<string, string> = {};
  await Promise.all(
    storagePaths.map(async (path) => {
      const { data } = await supabase.storage.from("portfolio").createSignedUrl(path, 60 * 10);
      if (data) result[path] = data.signedUrl;
    })
  );
  return result;
}
