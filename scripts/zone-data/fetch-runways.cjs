const fs = require("fs");

const query = `[out:json][timeout:90];
way["aeroway"="runway"](29.3,34.1,33.5,36.0);
out tags geom;
(
  node["aeroway"="aerodrome"](29.3,34.1,33.5,36.0);
  way["aeroway"="aerodrome"](29.3,34.1,33.5,36.0);
);
out tags center;`;

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

(async () => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "MetisimRunwayImport/1.0 (+https://metis-ops.com)" },
        body: `data=${encodeURIComponent(query)}`,
      });
      console.error("attempt", attempt, url, "status", r.status);
      if (!r.ok) { await new Promise((res) => setTimeout(res, 4000)); continue; }
      const j = await r.json();
      const rw = j.elements.filter((e) => e.tags?.aeroway === "runway");
      console.error("runways", rw.length, "with geometry", rw.filter((e) => e.geometry).length);
      if (rw.filter((e) => e.geometry).length === 0) continue;
      fs.writeFileSync(process.argv[2], JSON.stringify(j));
      return;
    } catch (e) {
      console.error("attempt", attempt, "error", String(e).slice(0, 120));
      await new Promise((res) => setTimeout(res, 4000));
    }
  }
  process.exit(1);
})();
