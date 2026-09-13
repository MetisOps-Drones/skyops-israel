import { AdminPlatformPageClient } from "./AdminPlatformPageClient";

export default function AdminPlatformPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">ניהול פלטפורמה</h1>
        <p className="text-sm text-muted-foreground">כל הארגונים וכל המשתמשים ב-MetisOps, במקום אחד</p>
      </div>
      <AdminPlatformPageClient />
    </div>
  );
}
