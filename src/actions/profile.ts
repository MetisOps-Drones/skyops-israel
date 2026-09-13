"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const businessHoursSchema = z
  .array(
    z.object({
      day: z.number().min(0).max(6),
      open: z.boolean(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
  )
  .optional();

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "יש להזין שם מלא"),
  phone: z.string().trim().optional(),
  title: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  businessId: z.string().trim().optional(),
  freelanceAvailable: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  planCode: z.string().trim().optional(),
  businessHours: businessHoursSchema,
  /** ISO timestamp — set once, right after signup, when the customer picks the free-trial-week option on a paid org plan. */
  trialEndsAt: z.string().trim().optional(),
});

export interface UpdateProfileResult {
  success: boolean;
  error?: string;
}

/** Single action for every field the profile-settings dialogs edit — each dialog just sends the subset it owns. */
export async function updateProfileDetails(input: z.infer<typeof detailsSchema>): Promise<UpdateProfileResult> {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }
  const data = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "יש להתחבר מחדש" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: data.fullName,
      // Each settings section sends only the fields it owns (see comment above) — a field this
      // particular call omits must stay untouched, not get nulled out by a save from a different
      // section. Only a field actually present in `data` (even as "") gets written.
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.title !== undefined ? { title: data.title || null } : {}),
      ...(data.bio !== undefined ? { bio: data.bio || null } : {}),
      ...(data.businessId !== undefined ? { business_id: data.businessId || null } : {}),
      ...(data.freelanceAvailable !== undefined ? { freelance_available: data.freelanceAvailable } : {}),
      ...(data.notifyEmail !== undefined ? { notify_email: data.notifyEmail } : {}),
      ...(data.notifySms !== undefined ? { notify_sms: data.notifySms } : {}),
      ...(data.planCode !== undefined ? { plan_code: data.planCode } : {}),
      ...(data.businessHours !== undefined ? { business_hours: data.businessHours } : {}),
      ...(data.trialEndsAt !== undefined ? { trial_ends_at: data.trialEndsAt } : {}),
    })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/profile");
  return { success: true };
}

export interface UploadAvatarResult {
  success: boolean;
  error?: string;
  avatarUrl?: string;
}

export async function uploadAvatar(formData: FormData): Promise<UploadAvatarResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { success: false, error: "לא נבחר קובץ" };
  if (file.size > 5 * 1024 * 1024) return { success: false, error: "הקובץ גדול מ-5MB" };
  if (!file.type.startsWith("image/")) return { success: false, error: "יש להעלות קובץ תמונה" };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "יש להתחבר מחדש" };

  const ext = file.name.split(".").pop() ?? "jpg";
  const storagePath = `${user.id}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(storagePath, file, { contentType: file.type, upsert: true });
  if (uploadError) return { success: false, error: `העלאת התמונה נכשלה: ${uploadError.message}` };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(storagePath);
  const avatarUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/profile");
  return { success: true, avatarUrl };
}
