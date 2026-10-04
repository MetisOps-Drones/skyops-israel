const fs = require("fs");
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

async function q(path) {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
module.exports = { q };

if (require.main === module) {
  (async () => {
    const rows = await q("aip_reference_zones?select=*&limit=3000");
    console.log("columns:", Object.keys(rows[0]));
    console.log("aip_reference_zones total:", rows.length);
    const by = {};
    for (const r of rows) by[r.kind] = (by[r.kind] || 0) + 1;
    console.log("by kind:", by);
    const src = {};
    for (const r of rows) src[r.source] = (src[r.source] || 0) + 1;
    console.log("by source:", src);
    console.log(rows.filter((r) => ["PROHIBITED", "DANGER", "RESTRICTED"].includes(r.kind)).slice(0, 12));
    try {
      const az = await q("airspace_zones?select=id,name,type&limit=500");
      console.log("airspace_zones:", az.length, az.slice(0, 5));
    } catch (e) {
      console.log("airspace_zones err", String(e).slice(0, 200));
    }
  })();
}
