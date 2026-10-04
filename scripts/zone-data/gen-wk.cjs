const turf = require("@turf/turf");
const fs = require("fs");
const { parseKml } = require("./kml-parse.cjs");
const f = parseKml(process.argv[2]);

const r5 = (n) => Math.round(n * 1e5) / 1e5;
const closeRing = (ring) => {
  const r = ring.map(([x, y]) => [r5(x), r5(y)]);
  const a = r[0], b = r[r.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) r.push([a[0], a[1]]);
  return r;
};
const area = (ring) => turf.area(turf.polygon([ring]));

/** Blocks of one placemark -> Polygons (a block fully inside a bigger block is its hole). */
function polygonsOf(rings) {
  const blocks = rings.map(closeRing).filter((r) => r.length >= 4).sort((a, b) => area(b) - area(a));
  const polys = [];
  for (const ring of blocks) {
    const host = polys.find((p) => ring.every((pt) => turf.booleanPointInPolygon(pt, turf.polygon([p[0]]))));
    if (host) host.push(ring); else polys.push([ring]);
  }
  return polys;
}

const rows = [];
const TAG = "caai_drone_map_weekdays_2026_10";
const layer = (n) => f.find((x) => x.name === n).pms;

let i = 0;
for (const pm of layer("מטווחים"))
  for (const poly of polygonsOf(pm.rings)) {
    i++;
    rows.push({
      name: `מטווח (ימי חול) ${i}`, code: `CAAI-RANGE-${i}`, altText: 'מהקרקע, ימי חול בלבד (מפת רת"א)', cap: null,
      note: 'אזור מטווחים — פעיל בימי חול בלבד לפי מפת רת"א.', coords: poly,
    });
  }

let h = 0;
for (const pm of layer("אזורי מסוקים")) {
  if ((pm.fields.type_ || "").includes("ישן")) continue; // obsolete ("old") helicopter areas
  for (const poly of polygonsOf(pm.rings)) {
    h++;
    const note = pm.fields.notes ? ` ${pm.fields.notes}.` : "";
    rows.push({
      name: `אזור מסוקים — ${pm.name}`, code: `CAAI-HELI-${h}`,
      altText: `תנועת מסוקים נמוכה עד ${pm.fields.high_alt} רגל; ימי חול בלבד (מפת רת"א)`, cap: 60,
      note: `אזור טיסת מסוקים (${pm.fields.type_}) — פעיל בימי חול בלבד. כטב"ם עד 60 מ' מעל הקרקע.${note}`, coords: poly,
    });
  }
}

let t = 0;
for (const pm of layer("אזורי טיסה 100 רגל"))
  for (const poly of polygonsOf(pm.rings)) {
    t++;
    rows.push({
      name: `אזור טיסה 100 רגל (ימי חול) ${t}`, code: `CAAI-100FT-${t}`, altText: 'מגבלת 100 רגל (כ-30 מ\'), ימי חול בלבד (מפת רת"א)', cap: 30,
      note: 'אזור טיסה 100 רגל — פעיל בימי חול בלבד לפי מפת רת"א; כטב"ם עד 30 מ\' מעל הקרקע.', coords: poly,
    });
  }

const q = (s) => "'" + s.replace(/'/g, "''") + "'";
const values = rows.map((r) => {
  const geom = JSON.stringify({ type: "Polygon", coordinates: r.coords });
  return `  (${q(r.name)}, ${q(r.code)}, 'RESTRICTED', ${q(r.altText)}, 0, null, ${q(geom)}::jsonb, ${q(TAG)}, '2026-09-10', true, true, ${r.cap === null ? "null" : r.cap}, ${q(r.note)})`;
});

const sql = `-- Weekday-only areas from the official CAAI drone map (KMZ "ימי חול" edition), which the
-- weekend edition does not contain: the firing ranges, the helicopter-flight areas and the
-- 100-ft area. Every other layer is identical between the two editions.
--
--   weekdays_only        the area exists Sunday-Friday midday only; the map hides it at weekends and a flight
--                        request is checked against the weekdays inside its own time window.
--   drone_max_altitude_m a small drone is only asked to coordinate when it plans to fly above this height
--                        (AGL). Null = the area applies at any height.
--   note                 plain-language note shown with the area.
--
-- Kind is RESTRICTED, i.e. "flyable subject to the area's conditions / the controlling body's
-- sign-off" -- the same coordination path the dispatcher already runs. Old ("ישן") helicopter
-- areas in the KMZ are skipped. Idempotent: re-running replaces only rows carrying this tag.

alter table aip_reference_zones add column if not exists weekdays_only boolean not null default false;
alter table aip_reference_zones add column if not exists drone_max_altitude_m integer;
alter table aip_reference_zones add column if not exists note text;

delete from aip_reference_zones where source_sheet = '${TAG}';

insert into aip_reference_zones
  (name, code, kind, altitude_text, min_altitude_ft, max_altitude_ft, geom_geojson, source_sheet, source_edition, geometry_precise, weekdays_only, drone_max_altitude_m, note)
values
${values.join(",\n")};
`;
fs.writeFileSync(process.argv[3], sql, "utf8");
console.log("rows", rows.length, "ranges", i, "heli", h, "100ft", t, "bytes", sql.length, "with holes:", rows.filter((r) => r.coords.length > 1).length);
