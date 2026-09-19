"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractIdentityFields } from "@/lib/ocr/extractExpiration";
import type { Tables } from "@/lib/types/database.types";

export interface UploadIdCardResult {
  success: boolean;
  error?: string;
  documentId?: string;
  ocrMethod?: "ocr" | "simulated";
}

/** Uploads a ת"ז (Israeli ID card) photo — same private `licenses` bucket and per-user RLS scoping as pilot license documents (see 0009_documents_and_notifications.sql). */
export async function uploadIdCardDocument(formData: FormData): Promise<UploadIdCardResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "לא נבחרה תמונה" };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { success: false, error: "הקובץ גדול מ-15MB" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "יש להתחבר מחדש" };

  const storagePath = `${user.id}/idcard-${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("licenses").upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { success: false, error: `העלאת התמונה נכשלה: ${uploadError.message}` };

  const identityFields = await extractIdentityFields(file, file.name);

  const { data: document, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      kind: "id_card",
      storage_path: storagePath,
      ocr_status: "completed",
      ocr_extracted_name: identityFields.name,
      ocr_extracted_id_number: identityFields.idNumber,
    })
    .select()
    .single();

  if (insertError) return { success: false, error: `שמירת המסמך נכשלה: ${insertError.message}` };

  revalidatePath("/profile");
  return { success: true, documentId: document.id, ocrMethod: identityFields.method };
}

function normalizeName(name: string | null): string | null {
  if (!name) return null;
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True if either name contains the other, tolerating "first last" vs "last first" order and OCR line noise — never a strict equality check, since both sides are OCR guesses. */
function namesRoughlyMatch(a: string | null, b: string | null): boolean | null {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return null;
  return na.includes(nb) || nb.includes(na);
}

function idNumbersMatch(a: string | null, b: string | null): boolean | null {
  if (!a || !b) return null;
  return a === b;
}

export interface IdentityVerificationResult {
  success: boolean;
  error?: string;
  verification?: Tables<"identity_verifications">;
}

/**
 * Text cross-check between the pilot's most recently uploaded license and ID
 * card documents (see documents.ocr_extracted_name/ocr_extracted_id_number,
 * populated by uploadPilotLicenseDocument/uploadIdCardDocument). Creates the
 * identity_verifications row with face fields left at "not_run" — the face
 * comparison itself runs client-side (face-api.js needs a browser) and is
 * recorded afterwards via recordFaceMatchResult.
 */
export async function runIdentityTextVerification(): Promise<IdentityVerificationResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "יש להתחבר מחדש" };

  const { data: licenseDoc } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .eq("kind", "pilot_license")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: idCardDoc } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .eq("kind", "id_card")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!licenseDoc || !idCardDoc) {
    return { success: false, error: "יש להעלות גם רישיון וגם תעודת זהות לפני ההשוואה" };
  }

  const { data: verification, error } = await supabase
    .from("identity_verifications")
    .insert({
      user_id: user.id,
      license_document_id: licenseDoc.id,
      id_card_document_id: idCardDoc.id,
      name_text_match: namesRoughlyMatch(licenseDoc.ocr_extracted_name, idCardDoc.ocr_extracted_name),
      id_number_text_match: idNumbersMatch(licenseDoc.ocr_extracted_id_number, idCardDoc.ocr_extracted_id_number),
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/profile");
  return { success: true, verification };
}

/** Persists the client-computed face-api.js similarity for an already-created identity_verifications row. */
export async function recordFaceMatchResult(
  verificationId: string,
  faceSimilarity: number,
  faceMatchResult: Tables<"identity_verifications">["face_match_result"]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "יש להתחבר מחדש" };

  const { error } = await supabase
    .from("identity_verifications")
    .update({ face_similarity: faceSimilarity, face_match_result: faceMatchResult, method: "face_api_client" })
    .eq("id", verificationId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/profile");
  return { success: true };
}
