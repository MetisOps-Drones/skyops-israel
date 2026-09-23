"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { extractExpirationDate, extractIdentityFields } from "@/lib/ocr/extractExpiration";
import { validateAgainstGovernmentRegistry } from "@/lib/government-validation";

const uploadSchema = z.object({
  licenseType: z.enum(["hobby", "commercial_25kg", "heavy_2000kg"]),
  licenseNumber: z.string().trim().min(2, "מספר רישיון חובה"),
  /** Optional manual override — if omitted, the OCR-extracted date is used. */
  expiresAtOverride: z.string().optional(),
});

export interface UploadDocumentResult {
  success: boolean;
  error?: string;
  expiresAt?: string;
  ocrMethod?: "ocr" | "simulated";
  ocrConfidence?: number;
}

/**
 * Module D: uploads a license document to the private `licenses` Storage
 * bucket, runs it through OCR to extract an expiration date, and upserts
 * the corresponding `pilot_licenses` row (the `pilot_licenses_recompute_status`
 * trigger then derives active/expiring_soon/expired from that date).
 */
export async function uploadPilotLicenseDocument(formData: FormData): Promise<UploadDocumentResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "לא נבחר קובץ" };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { success: false, error: "הקובץ גדול מ-15MB" };
  }

  const parsed = uploadSchema.safeParse({
    licenseType: formData.get("licenseType"),
    licenseNumber: formData.get("licenseNumber"),
    expiresAtOverride: formData.get("expiresAtOverride") ?? undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }
  const data = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "יש להתחבר מחדש" };
  }

  const storagePath = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("licenses").upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return { success: false, error: `העלאת הקובץ נכשלה: ${uploadError.message}` };
  }

  const ocrResult = await extractExpirationDate(file, file.name);
  const identityFields = await extractIdentityFields(file, file.name);
  const expiresAt = data.expiresAtOverride ? new Date(data.expiresAtOverride) : ocrResult.expiresAt;

  if (!expiresAt) {
    return {
      success: false,
      error: "לא ניתן היה לזהות תאריך תפוגה במסמך. יש להזין תאריך תפוגה ידנית.",
    };
  }

  // The `licenses` bucket is private, so `document_url` stores the storage
  // path rather than a public URL — generate a signed URL on demand
  // (see `getLicenseDocumentSignedUrl` below) whenever the file needs to be
  // displayed or downloaded.
  const { data: license, error: upsertError } = await supabase
    .from("pilot_licenses")
    .upsert(
      {
        user_id: user.id,
        license_type: data.licenseType,
        license_number: data.licenseNumber,
        document_url: storagePath,
        expires_at: expiresAt.toISOString().slice(0, 10),
        ocr_extracted_at: new Date().toISOString(),
        ocr_raw_text: ocrResult.rawText,
      },
      { onConflict: "user_id,license_type,license_number" }
    )
    .select()
    .single();

  if (upsertError) {
    return { success: false, error: `שמירת הרישיון נכשלה: ${upsertError.message}` };
  }

  await supabase.from("documents").insert({
    user_id: user.id,
    kind: "pilot_license",
    storage_path: storagePath,
    linked_license_id: license.id,
    ocr_status: "completed",
    ocr_extracted_expires_at: expiresAt.toISOString().slice(0, 10),
    ocr_confidence: ocrResult.confidence,
    ocr_extracted_name: identityFields.name,
    ocr_extracted_id_number: identityFields.idNumber,
  });

  // Opens a government-validation trail for the license number — see
  // src/lib/government-validation (no live endpoint configured yet, so
  // this always records `not_configured` for now; never blocks the upload).
  const validation = await validateAgainstGovernmentRegistry({
    entityType: "pilot_license",
    entityId: license.id,
    submittedValue: data.licenseNumber,
  });
  await supabase.from("government_validation_requests").insert({
    entity_type: "pilot_license",
    entity_id: license.id,
    submitted_value: data.licenseNumber,
    status: validation.status,
    provider: validation.provider,
    response: validation.response as never,
    requested_by: user.id,
    checked_at: validation.status !== "not_configured" ? new Date().toISOString() : null,
  });

  revalidatePath("/dashboard");

  return {
    success: true,
    expiresAt: expiresAt.toISOString().slice(0, 10),
    ocrMethod: ocrResult.method,
    ocrConfidence: ocrResult.confidence,
  };
}

/** Generates a short-lived signed URL for a license document stored at `storagePath` (a `pilot_licenses.document_url` value). RLS on `storage.objects` still applies to whoever the current session is. */
export async function getLicenseDocumentSignedUrl(
  storagePath: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("licenses").createSignedUrl(storagePath, 60 * 5);

  if (error || !data) {
    return { success: false, error: error?.message ?? "יצירת קישור נכשלה" };
  }

  return { success: true, url: data.signedUrl };
}
