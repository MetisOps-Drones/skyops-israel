import Link from "next/link";
import { SignupWizard } from "@/app/auth/login/SignupWizard";
import { MetisOpsLogo } from "@/components/layout/MetisOpsLogo";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-xl rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <MetisOpsLogo className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">הרשמה ל-MetisOps</h1>
          <p className="text-sm text-muted-foreground">כמה שאלות קצרות כדי להתאים לכם את החשבון הנכון</p>
        </div>
        <SignupWizard />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          כבר יש לכם חשבון?{" "}
          <Link href="/auth/login" className="font-medium text-primary underline">
            התחברות
          </Link>
        </p>
      </div>
    </div>
  );
}
