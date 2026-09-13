import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Tables } from "@/lib/types/database.types";

// react-pdf's built-in "Helvetica" has no Hebrew glyphs, so report text is
// kept in English/numerals rather than bundling a custom Hebrew font.
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { color: "#555" },
  value: { fontWeight: 700 },
  table: { display: "flex", width: "100%", marginTop: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e5e5", paddingVertical: 4 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#333", paddingVertical: 4 },
  th: { flex: 1, fontWeight: 700, fontSize: 9 },
  td: { flex: 1, fontSize: 9 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#888", textAlign: "center" },
});

export interface FlightReportData {
  pilot: Pick<Tables<"profiles">, "full_name" | "phone">;
  licenses: Tables<"pilot_licenses">[];
  drones: Tables<"drones">[];
  flightLogs: (Tables<"flight_logs"> & { droneName: string })[];
  generatedAt: Date;
  rangeLabel: string;
}

function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-GB");
}

export function FlightReportDocument({ data }: { data: FlightReportData }) {
  const totalMinutes = data.flightLogs.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0);

  return (
    <Document title={`MetisOps Flight Report - ${data.pilot.full_name}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>MetisOps — Regulatory Flight Report</Text>
        <Text style={styles.subtitle}>
          Generated {formatDate(data.generatedAt)} · Period: {data.rangeLabel}
        </Text>

        <Text style={styles.sectionTitle}>Pilot</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Full name</Text>
          <Text style={styles.value}>{data.pilot.full_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{data.pilot.phone ?? "—"}</Text>
        </View>

        <Text style={styles.sectionTitle}>Licenses on file</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.th}>Type</Text>
            <Text style={styles.th}>Number</Text>
            <Text style={styles.th}>Expires</Text>
            <Text style={styles.th}>Status</Text>
          </View>
          {data.licenses.map((license) => (
            <View style={styles.tableRow} key={license.id}>
              <Text style={styles.td}>{license.license_type}</Text>
              <Text style={styles.td}>{license.license_number}</Text>
              <Text style={styles.td}>{formatDate(license.expires_at)}</Text>
              <Text style={styles.td}>{license.status}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Airframes</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.th}>Nickname</Text>
            <Text style={styles.th}>Model</Text>
            <Text style={styles.th}>Serial</Text>
            <Text style={styles.th}>Total minutes</Text>
            <Text style={styles.th}>Status</Text>
          </View>
          {data.drones.map((drone) => (
            <View style={styles.tableRow} key={drone.id}>
              <Text style={styles.td}>{drone.nickname}</Text>
              <Text style={styles.td}>{drone.model}</Text>
              <Text style={styles.td}>{drone.serial_number}</Text>
              <Text style={styles.td}>{drone.total_flight_minutes}</Text>
              <Text style={styles.td}>{drone.status}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>
          Flight log ({data.flightLogs.length} flights, {Math.round((totalMinutes / 60) * 10) / 10} total hours)
        </Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.th}>Date</Text>
            <Text style={styles.th}>Drone</Text>
            <Text style={styles.th}>Duration (min)</Text>
            <Text style={styles.th}>Max alt (m)</Text>
            <Text style={styles.th}>Max dist (m)</Text>
          </View>
          {data.flightLogs.map((log) => (
            <View style={styles.tableRow} key={log.id}>
              <Text style={styles.td}>{formatDate(log.start_time)}</Text>
              <Text style={styles.td}>{log.droneName}</Text>
              <Text style={styles.td}>{log.duration_minutes}</Text>
              <Text style={styles.td}>{log.max_altitude_m ?? "—"}</Text>
              <Text style={styles.td}>{log.max_distance_m ?? "—"}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Generated by MetisOps for regulatory inspection purposes. This document reflects data logged by the
          pilot and connected telemetry sources as of the generation date above.
        </Text>
      </Page>
    </Document>
  );
}
