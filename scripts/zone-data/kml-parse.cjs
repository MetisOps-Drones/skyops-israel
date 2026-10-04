const fs = require("fs");

function parseKml(path) {
  const xml = fs.readFileSync(path, "utf8");
  const folders = [];
  const folderRe = /<Folder id="(FeatureLayer\d+)">\s*<name>([^<]*)<\/name>([\s\S]*?)(?=<Folder id="FeatureLayer|<\/Folder>\s*<\/Folder>|$)/g;
  let fm;
  while ((fm = folderRe.exec(xml))) {
    const [, id, name, body] = fm;
    const pms = [];
    for (const pm of body.matchAll(/<Placemark id="([^"]*)">([\s\S]*?)<\/Placemark>/g)) {
      const b = pm[2];
      const pname = (b.match(/<name>([^<]*)<\/name>/) || [])[1];
      const style = (b.match(/<styleUrl>#?([^<]+)<\/styleUrl>/) || [])[1];
      const rings = [...b.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)].map((c) =>
        c[1].trim().split(/\s+/).map((p) => p.split(",").slice(0, 2).map(Number))
      );
      const fields = {};
      for (const tr of b.matchAll(/<tr[^>]*>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/g)) fields[tr[1].trim()] = tr[2].trim();
      pms.push({ id: pm[1], name: pname, style, rings, fields });
    }
    folders.push({ id, name, pms });
  }
  return folders;
}

function pip(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

module.exports = { parseKml, pip };

if (require.main === module) {
  const folders = parseKml(process.argv[2]);
  for (const f of folders) {
    const styles = {};
    for (const p of f.pms) styles[p.style] = (styles[p.style] || 0) + 1;
    console.log(f.id, JSON.stringify(f.name), "placemarks:", f.pms.length, JSON.stringify(styles));
    const sample = f.pms[0];
    if (sample) console.log("   sample:", sample.name, JSON.stringify(sample.fields).slice(0, 400));
  }
}
