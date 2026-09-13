import { LoginForm } from "./LoginForm";
import { MetisOpsLogo } from "@/components/layout/MetisOpsLogo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <MetisOpsLogo className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">MetisOps</h1>
          <p className="text-sm text-muted-foreground">
            ניהול תפעול, מרחב אווירי ורישוי מטיסי רחפנים
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
