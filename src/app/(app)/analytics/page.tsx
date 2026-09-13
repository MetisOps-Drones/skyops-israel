import { AnalyticsPageClient } from "./AnalyticsPageClient";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">אנליטיקס</h1>
        <p className="text-sm text-muted-foreground">פעילות משתמשים והתראות תפעוליות</p>
      </div>
      <AnalyticsPageClient />
    </div>
  );
}
