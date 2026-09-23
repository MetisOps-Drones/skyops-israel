"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { MaintenanceBanner } from "@/components/logs/MaintenanceBanner";
import { FlightLogTable } from "@/components/logs/FlightLogTable";
import { LogEntryModal } from "@/components/logs/LogEntryModal";
import { TelemetryUploader } from "@/components/logs/TelemetryUploader";
import { DronePlatformSyncPanel } from "@/components/logs/DronePlatformSyncPanel";
import { FleetHealthDashboard } from "@/components/logs/FleetHealthDashboard";
import { ExportReportButton } from "@/components/logs/ExportReportButton";
import { DroneFleetTable } from "@/components/logs/DroneFleetTable";
import { MaintenanceLogPanel } from "@/components/logs/MaintenanceLogPanel";
import { InventoryPanel } from "@/components/logs/InventoryPanel";
import { EquipmentCheckoutPanel } from "@/components/logs/EquipmentCheckoutPanel";
import { ProfitabilityPanel } from "@/components/logs/ProfitabilityPanel";
import { ClientsPanel } from "@/components/logs/ClientsPanel";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import { useDrones } from "@/hooks/useDrones";

/** Below this many registered aircraft, fleet-scale tooling (inventory, maintenance
 *  log, profitability) folds behind one "advanced" tab instead of sitting top-level —
 *  a single-drone operator doesn't need the same tab bar as a 20-aircraft fleet. */
const SMALL_FLEET_THRESHOLD = 2;

/**
 * A contractor pilot working for an org's fleet doesn't own or manage that
 * fleet, so they get a checkout/return screen instead of full fleet
 * management. Everyone else (a solo pilot with their own drone(s), a fleet
 * manager, or a dispatcher admin) keeps the full set of tabs — but a solo
 * pilot with a small fleet gets the fleet-management tabs folded together
 * rather than the full 6-tab bar a real fleet manager needs.
 */
export function LogsPageClient() {
  const { data: ctx, isLoading: ctxLoading } = useMyOrgContext();
  const { data: drones = [] } = useDrones();
  const isContractor = Boolean(ctx?.orgId) && !ctx?.isFleetManager;
  const isSmallFleet = !isContractor && drones.length < SMALL_FLEET_THRESHOLD;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">יומן טיסות ובריאות הצי</h1>
          <p className="text-sm text-muted-foreground">
            {isContractor
              ? `יומן הטיסות שלך וציוד ${ctx?.orgName ?? "הארגון"} שברשותך`
              : "יומן טיסות, יבוא טלמטריה ומעקב בלאי חומרה"}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportReportButton />
          <LogEntryModal />
        </div>
      </div>

      <MaintenanceBanner />

      {ctxLoading ? null : isContractor ? (
        <Tabs defaultValue="log">
          <TabsList>
            <TabsTrigger value="log">יומן טיסות</TabsTrigger>
            <TabsTrigger value="import">יבוא טלמטריה</TabsTrigger>
            <TabsTrigger value="equipment">ציוד הארגון</TabsTrigger>
          </TabsList>

          <TabsContent value="log">
            <Card>
              <CardHeader>
                <CardTitle>רשומות טיסה</CardTitle>
              </CardHeader>
              <CardContent>
                <FlightLogTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <div className="flex flex-col gap-4">
              <DronePlatformSyncPanel />
              <TelemetryUploader />
            </div>
          </TabsContent>

          <TabsContent value="equipment">
            <EquipmentCheckoutPanel />
          </TabsContent>
        </Tabs>
      ) : isSmallFleet ? (
        <Tabs defaultValue="log">
          <TabsList>
            <TabsTrigger value="log">יומן טיסות</TabsTrigger>
            <TabsTrigger value="import">יבוא טלמטריה</TabsTrigger>
            <TabsTrigger value="batteries">בריאות הצי</TabsTrigger>
            <TabsTrigger value="clients">לקוחות</TabsTrigger>
            <TabsTrigger value="advanced">ניהול מתקדם</TabsTrigger>
          </TabsList>

          <TabsContent value="log">
            <Card>
              <CardHeader>
                <CardTitle>רשומות טיסה</CardTitle>
              </CardHeader>
              <CardContent>
                <FlightLogTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <div className="flex flex-col gap-4">
              <DronePlatformSyncPanel />
              <TelemetryUploader />
            </div>
          </TabsContent>

          <TabsContent value="batteries">
            <FleetHealthDashboard />
          </TabsContent>

          <TabsContent value="clients">
            <ClientsPanel />
          </TabsContent>

          <TabsContent value="advanced">
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                כלים לניהול צי גדול יותר — פתחו רק את מה שאתם צריכים.
              </p>
              <Disclosure label="כלי טיס">
                <DroneFleetTable />
              </Disclosure>
              <Disclosure label="תחזוקה ומלאי">
                <div className="flex flex-col gap-4">
                  <MaintenanceLogPanel />
                  <InventoryPanel />
                </div>
              </Disclosure>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground">רווחיות</p>
                <ProfitabilityPanel />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="log">
          <TabsList>
            <TabsTrigger value="log">יומן טיסות</TabsTrigger>
            <TabsTrigger value="import">יבוא טלמטריה</TabsTrigger>
            <TabsTrigger value="fleet">צי כלי טיס</TabsTrigger>
            <TabsTrigger value="batteries">בריאות הצי</TabsTrigger>
            <TabsTrigger value="clients">לקוחות</TabsTrigger>
            <TabsTrigger value="maintenance">תחזוקה ומלאי</TabsTrigger>
            <TabsTrigger value="profitability">רווחיות</TabsTrigger>
          </TabsList>

          <TabsContent value="log">
            <Card>
              <CardHeader>
                <CardTitle>רשומות טיסה</CardTitle>
              </CardHeader>
              <CardContent>
                <FlightLogTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <div className="flex flex-col gap-4">
              <DronePlatformSyncPanel />
              <TelemetryUploader />
            </div>
          </TabsContent>

          <TabsContent value="fleet">
            <Card>
              <CardHeader>
                <CardTitle>כלי טיס</CardTitle>
              </CardHeader>
              <CardContent>
                <DroneFleetTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="batteries">
            <FleetHealthDashboard />
          </TabsContent>

          <TabsContent value="clients">
            <ClientsPanel />
          </TabsContent>

          <TabsContent value="maintenance">
            <div className="flex flex-col gap-4">
              <MaintenanceLogPanel />
              <InventoryPanel />
            </div>
          </TabsContent>

          <TabsContent value="profitability">
            <ProfitabilityPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
