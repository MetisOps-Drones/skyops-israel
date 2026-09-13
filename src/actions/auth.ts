"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(8, "סיסמה חייבת להכיל לפחות 8 תווים"),
});

export interface AuthActionResult {
  error?: string;
  success?: boolean;
}

export async function signInWithPassword(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "אימייל או סיסמה שגויים" };
  }

  return { success: true };
}

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2, "יש להזין שם מלא"),
  role: z.enum(["pilot_hobby", "pilot_pro"]).optional(),
  planCode: z.string().optional(),
  professionalCategory: z.string().optional(),
  freelanceAvailable: z.boolean().optional(),
});

/**
 * The signup wizard (/auth/signup's SignupWizard) collects the customer's self-classification and a
 * couple of follow-up answers *before* creating the account, and passes the resulting role/plan
 * recommendation straight into auth.signUp's metadata — the handle_new_user() trigger (migration
 * 0040) reads it from there, so the recommended plan is live immediately rather than needing a
 * follow-up profile update after signup. The business/org path is the exception: it still needs
 * a separate create_organization_as_owner() RPC call once a session exists, since org creation
 * can't happen from inside the trigger.
 */
export async function signUpWithPassword(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    role: formData.get("role") || undefined,
    planCode: formData.get("planCode") || undefined,
    professionalCategory: formData.get("professionalCategory") || undefined,
    freelanceAvailable: formData.get("freelanceAvailable") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        role: parsed.data.role,
        plan_code: parsed.data.planCode,
        professional_category: parsed.data.professionalCategory,
        freelance_available: parsed.data.freelanceAvailable,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
