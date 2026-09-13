import { OrgPageClient } from "./OrgPageClient";

export default function OrgPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">הארגון שלי</h1>
        <p className="text-sm text-muted-foreground">שיוך לארגונים, מעבר בין ארגונים, ואישור בקשות הצטרפות</p>
      </div>
      <OrgPageClient />
    </div>
  );
}
