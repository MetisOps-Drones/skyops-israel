"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ScanFace, Loader2, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentCameraCapture } from "@/components/shared/DocumentCameraCapture";
import { useMyDocumentsByKind, useMyIdentityVerifications, useInvalidateIdentityVerification } from "@/hooks/useIdentityVerification";
import { uploadIdCardDocument } from "@/actions/identity-verification";
import { runIdentityTextVerification, recordFaceMatchResult } from "@/actions/identity-verification";
import { getLicenseDocumentSignedUrl } from "@/actions/documents";
import { computeFaceDescriptor, compareFaceDescriptors, loadImageFromBlob, loadImageFromUrl } from "@/lib/face-match/faceMatch";
import type { Tables } from "@/lib/types/database.types";

function MatchBadge({ value, label }: { value: boolean | null; label: string }) {
  if (value === null) {
    return (
      <Badge variant="outline" className="gap-1">
        <HelpCircle className="h-3 w-3" />
        {label}: לא ניתן להשוואה
      </Badge>
    );
  }
  return (
    <Badge variant={value ? "success" : "destructive"} className="gap-1">
      {value ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}: {value ? "תואם" : "לא תואם"}
    </Badge>
  );
}

const FACE_RESULT_LABEL: Record<Tables<"identity_verifications">["face_match_result"], string> = {
  match: "תואם",
  no_match: "לא תואם",
  inconclusive: "לא חד משמעי",
  not_run: "טרם נבדק",
};

export function IdentityVerificationCard() {
  const { data: licenseDocs = [] } = useMyDocumentsByKind("pilot_license");
  const { data: idCardDocs = [] } = useMyDocumentsByKind("id_card");
  const { data: verifications = [] } = useMyIdentityVerifications();
  const invalidate = useInvalidateIdentityVerification();

  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [uploadingIdCard, setUploadingIdCard] = useState(false);
  const [comparingFace, setComparingFace] = useState(false);

  const hasLicense = licenseDocs.length > 0;
  const latestIdCard = idCardDocs[0];
  const latestVerification = verifications[0];

  async function handleUploadIdCard() {
    if (!idCardFile) return;
    setUploadingIdCard(true);
    try {
      const formData = new FormData();
      formData.set("file", idCardFile);
      const result = await uploadIdCardDocument(formData);
      if (!result.success) {
        toast.error(result.error ?? "העלאת תעודת הזהות נכשלה");
        return;
      }
      const textResult = await runIdentityTextVerification();
      if (!textResult.success) {
        toast.error(textResult.error ?? "השוואת הפרטים נכשלה");
        return;
      }
      toast.success(
        result.ocrMethod === "simulated"
          ? "תעודת הזהות הועלתה והושוותה (OCR מדומה — יש לוודא ידנית)"
          : "תעודת הזהות הועלתה והושוותה לרישיון"
      );
      setIdCardFile(null);
      invalidate();
    } finally {
      setUploadingIdCard(false);
    }
  }

  async function handleFaceMatch(selfieFile: File) {
    if (!latestVerification || !latestIdCard) return;
    setComparingFace(true);
    try {
      const signedUrlResult = await getLicenseDocumentSignedUrl(latestIdCard.storage_path);
      if (!signedUrlResult.success || !signedUrlResult.url) {
        toast.error(signedUrlResult.error ?? "לא ניתן היה לטעון את תמונת תעודת הזהות");
        return;
      }

      const [idCardImage, selfieImage] = await Promise.all([
        loadImageFromUrl(signedUrlResult.url),
        loadImageFromBlob(selfieFile),
      ]);
      const [idCardFace, selfieFace] = await Promise.all([
        computeFaceDescriptor(idCardImage),
        computeFaceDescriptor(selfieImage),
      ]);

      if (!idCardFace.descriptor || !selfieFace.descriptor) {
        await recordFaceMatchResult(latestVerification.id, 0, "inconclusive");
        toast.warning("לא זוהו פנים באחת התמונות — יש לצלם שוב באור טוב ובמבט ישיר למצלמה");
        invalidate();
        return;
      }

      const { similarity, result } = compareFaceDescriptors(idCardFace.descriptor, selfieFace.descriptor);
      await recordFaceMatchResult(latestVerification.id, similarity, result);
      toast.success(`השוואת הפנים הסתיימה: ${FACE_RESULT_LABEL[result]} (${Math.round(similarity * 100)}% דמיון)`);
      invalidate();
    } catch {
      toast.error("השוואת הפנים נכשלה — יש לנסות שוב");
    } finally {
      setComparingFace(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
            <ScanFace className="h-4 w-4" />
          </span>
          אימות זהות
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          השוואת פרטי הרישיון מול תעודת זהות, וזיהוי פנים מול תמונת תעודת הזהות — בדיקת עזר, לא תחליף לאימות אנושי.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!hasLicense && <p className="text-sm text-muted-foreground">יש להעלות רישיון טיס תחילה (למעלה בעמוד זה).</p>}

        {hasLicense && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">שלב 1: תעודת זהות</p>
            <DocumentCameraCapture
              facingMode="environment"
              guideShape="card"
              label="מקמו את תעודת הזהות בתוך המסגרת וצלמו"
              onCapture={setIdCardFile}
            />
            {idCardFile && (
              <Button size="sm" onClick={handleUploadIdCard} disabled={uploadingIdCard}>
                {uploadingIdCard && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                העלאה והשוואת פרטים
              </Button>
            )}
          </div>
        )}

        {latestVerification && (
          <div className="flex flex-wrap gap-2">
            <MatchBadge value={latestVerification.name_text_match} label="שם" />
            <MatchBadge value={latestVerification.id_number_text_match} label="מספר זהות" />
          </div>
        )}

        {latestVerification && latestIdCard && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <p className="text-sm font-medium">שלב 2: זיהוי פנים</p>
            {latestVerification.face_match_result === "not_run" ? (
              <DocumentCameraCapture
                facingMode="user"
                guideShape="circle"
                label="מבט ישיר למצלמה, באור טוב"
                onCapture={handleFaceMatch}
              />
            ) : (
              <Badge
                variant={
                  latestVerification.face_match_result === "match"
                    ? "success"
                    : latestVerification.face_match_result === "no_match"
                      ? "destructive"
                      : "outline"
                }
                className="w-fit gap-1"
              >
                {FACE_RESULT_LABEL[latestVerification.face_match_result]}
                {latestVerification.face_similarity !== null &&
                  ` (${Math.round(latestVerification.face_similarity * 100)}% דמיון)`}
              </Badge>
            )}
            {comparingFace && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                משווה פנים בדפדפן...
              </p>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          זיהוי הפנים פועל כולו בדפדפן ואינו נשלח לשרת חיצוני, אך אינו כולל בדיקת &quot;חיות&quot; (Liveness) — אינו
          יכול לזהות תמונה של תמונה. זוהי בדיקת עזר בלבד, ולא תחליף לאימות אנושי או לשירות אימות זהות מקצועי.
        </p>
      </CardContent>
    </Card>
  );
}
