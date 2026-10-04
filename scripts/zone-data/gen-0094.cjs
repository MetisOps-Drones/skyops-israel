const turf = require("@turf/turf");
const fs = require("fs");
const { parseKml } = require("./kml-parse.cjs");
const { q } = require("./dbzones.cjs");

const r5 = (n) => Math.round(n * 1e5) / 1e5;
function cleanRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [r5(x), r5(y)];
    const l = out[out.length - 1];
    if (!l || l[0] !== p[0] || l[1] !== p[1]) out.push(p);
  }
  const a = out[0], b = out[out.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1]]);
  return out;
}
const toPoly = (ring) => turf.rewind(turf.polygon([cleanRing(ring)]), { reverse: false });
const km2 = (f) => turf.area(f) / 1e6;
function iou(a, b) {
  let i; try { i = turf.intersect(turf.featureCollection([a, b])); } catch { return 0; }
  const ia = i ? km2(i) : 0;
  return ia / (km2(a) + km2(b) - ia);
}
function uncoveredShare(poly, covers) {
  let rest = poly;
  for (const c of covers) {
    if (!rest) break;
    try { rest = turf.difference(turf.featureCollection([rest, c])); } catch { }
  }
  return rest ? km2(rest) / km2(poly) : 0;
}

(async () => {
  const f = parseKml(process.argv[2]);
  const gen = f[6].pms, pro = f[5].pms;
  const db = await q("aip_reference_zones?select=id,code,name,kind,min_altitude_ft,max_altitude_ft,geom_geojson&limit=2000");
  const dbPoly = (z) => turf.polygon(z.geom_geojson.coordinates);
  const TAG = "caai_drone_map_2026_10_geometry";
  const q1 = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  const log = [];

  // 1) Official outlines for prohibited / restricted / dangerous areas replace the rougher ones we hold.
  const updates = [];
  for (const p of pro) {
    const code = p.fields.designator;
    const ring = p.rings[0];
    if (!code || !ring || ring.length < 4) continue;
    const row = db.find((z) => z.code === code && ["PROHIBITED", "RESTRICTED", "DANGER"].includes(z.kind));
    if (!row) continue;
    const off = toPoly(ring);
    const sim = iou(off, dbPoly(row));
    if (sim >= 0.999) continue;
    updates.push({ code, name: p.fields.name, sim, offKm2: km2(off), dbKm2: km2(dbPoly(row)), geom: off.geometry });
  }

  // 2) Ground-based controlled airspace in the official layer that our layer doesn't cover yet: add, never remove.
  const ground = db.filter((z) => ["CTR", "ATZ", "TMA", "CTA"].includes(z.kind) && (z.min_altitude_ft ?? 0) <= 0).map(dbPoly);
  const inserts = [];
  const seen = {};
  for (const p of gen) {
    const ring = p.rings[0];
    if (!ring || ring.length < 4) { log.push(`skip ${p.id} ${p.name}: no outline in the file`); continue; }
    const m = /^(\S.*?)\s+(\d+)\s*-\s*(\d+)\s*$/.exec((p.name || "").trim());
    const minFt = m ? Number(m[2]) : Number(p.fields.minAlt), maxFt = m ? Number(m[3]) : null;
    if (minFt > 0) { log.push(`skip ${p.id} ${p.name}: floor ${minFt} ft (above a drone)`); continue; }
    const off = toPoly(ring);
    const unc = uncoveredShare(off, ground);
    if (unc < 0.03) { log.push(`have ${p.id} ${p.name}: ${(100 - unc * 100).toFixed(0)}% already covered`); continue; }
    const code = p.fields.designator;
    seen[code] = (seen[code] || 0) + 1;
    inserts.push({
      name: `${p.fields.HebrewName || p.fields.name}${/Weekend/i.test(p.fields.name) && !/סופ/.test(p.fields.HebrewName || "") ? " (סוף שבוע)" : ""}${/TM\/AP|APP/.test(code) ? " — גישה/TMA" : " — מרחב מבוקר"} (מפת רת"א)`,
      code: `CAAI-${code.replace(/\s+/g, "-")}-${seen[code]}`,
      altText: maxFt ? `${minFt} - ${maxFt} ft (מפת רת"א)` : `מהקרקע (מפת רת"א)`,
      minFt, maxFt, kind: "CTR", geom: off.geometry, offKm2: km2(off), unc,
    });
  }

  for (const u of updates) log.push(`UPDATE ${u.code} ${u.name}: IoU ${u.sim.toFixed(2)}, ${u.dbKm2.toFixed(1)} -> ${u.offKm2.toFixed(1)} km2`);
  for (const i of inserts) log.push(`INSERT ${i.code} ${i.name}: ${i.offKm2.toFixed(0)} km2, ${(i.unc * 100).toFixed(0)}% new, ${i.altText}`);
  console.log(log.join("\n"));

  const sql = `-- Brings the geometry of the zone layer in line with the official CAAI drone map (KMZ).
--
-- 1) Prohibited / restricted / dangerous areas whose official outline differs from ours
--    (${updates.length}): the outline is replaced; name, code, altitudes and kind are untouched.
-- 2) Ground-based controlled airspace (CTR/ATZ) the official map has and our layer does not cover
--    (${inserts.length} polygons: the Ben Gurion CTR, second parts of Ovda, Eilat-Ramon, Tel Nof, ...):
--    added as new rows -- nothing is removed, so a point inside either outline still asks for coordination.
--    Official polygons whose floor is above the ground (ACC sectors, TMA bands) are left out: they never
--    touch a drone, and with unknown terrain they'd mark half the country.
-- Idempotent: the updates set fixed outlines; the inserted rows carry a source tag and are replaced on re-run.

${updates
    .map((u) => `update aip_reference_zones set geom_geojson = ${q1(JSON.stringify(u.geom))}::jsonb, geometry_precise = true where code = ${q1(u.code)} and kind in ('PROHIBITED','RESTRICTED','DANGER'); -- ${u.name}`)
    .join("\n")}

delete from aip_reference_zones where source_sheet = ${q1(TAG)};

insert into aip_reference_zones
  (name, code, kind, altitude_text, min_altitude_ft, max_altitude_ft, geom_geojson, source_sheet, source_edition, geometry_precise)
values
${inserts
    .map((i) => `  (${q1(i.name)}, ${q1(i.code)}, 'CTR', ${q1(i.altText)}, ${i.minFt}, ${i.maxFt === null ? "null" : i.maxFt}, ${q1(JSON.stringify(i.geom))}::jsonb, ${q1(TAG)}, '2026-09-10', true)`)
    .join(",\n")};
`;
  fs.writeFileSync(process.argv[3], sql, "utf8");
  console.log("written", updates.length, "updates,", inserts.length, "inserts,", sql.length, "bytes");
})();
