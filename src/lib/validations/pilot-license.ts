import { z } from "zod";

export const pilotLicenseSchema = z.object({
  license_type: z.enum(["hobby", "commercial_25kg", "heavy_2000kg"]),
  license_number: z.string().trim().min(2, "מספר רישיון חובה").max(60),
  issued_at: z.coerce.date().optional(),
  expires_at: z.coerce.date(),
});

export type PilotLicenseInput = z.infer<typeof pilotLicenseSchema>;

export const documentUploadSchema = z.object({
  kind: z.enum(["pilot_license", "drone_registration", "insurance_certificate"]),
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 15 * 1024 * 1024, "הקובץ גדול מ-15MB")
    .refine(
      (file) => ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type),
      "פורמט קובץ לא נתמך (PDF/JPG/PNG בלבד)"
    ),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
