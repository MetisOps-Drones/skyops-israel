"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MitisanTrack } from "@/components/academy/MitisanTrack";
import { CommercialTrack } from "@/components/academy/CommercialTrack";

export function AcademyPageClient() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">אקדמיה — לימוד תיאוריה ובחינות</h1>
        <p className="text-sm text-muted-foreground">הכנה לבחינות רישוי טיסת רחפנים</p>
      </div>

      <Tabs defaultValue="hobby" dir="rtl">
        <TabsList>
          <TabsTrigger value="hobby">רישיון מטיסן</TabsTrigger>
          <TabsTrigger value="commercial">מטיס מסחרי</TabsTrigger>
        </TabsList>

        <TabsContent value="hobby">
          <MitisanTrack />
        </TabsContent>

        <TabsContent value="commercial">
          <CommercialTrack />
        </TabsContent>
      </Tabs>
    </div>
  );
}
