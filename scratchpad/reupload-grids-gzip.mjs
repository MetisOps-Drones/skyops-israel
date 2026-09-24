// One-time fix: the proximity-grid/{50,100,150}m.bin files on R2 are stored
// raw/uncompressed (~23MB each) instead of gzip-compressed as the app's own
// code comment assumes. That's why building-proximity checks time out in
// production. This script downloads each file, gzip-compresses it, and
// re-uploads it to the SAME key with Content-Encoding: gzip set, so it stays
// a drop-in replacement — no app code changes needed.
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const envLines = readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n");
function envVar(name) {
  const line = envLines.find((l) => l.startsWith(name + "="));
  if (!line) throw new Error(`missing ${name} in .env.local`);
  return line.slice(name.length + 1).trim();
}

const accountId = envVar("R2_ACCOUNT_ID");
const accessKeyId = envVar("R2_ACCESS_KEY_ID");
const secretAccessKey = envVar("R2_SECRET_ACCESS_KEY");
const bucket = envVar("R2_BUCKET_NAME");
const publicBase = envVar("NEXT_PUBLIC_R2_PUBLIC_URL");

const endpoint = `${accountId}.r2.cloudflarestorage.com`;
const region = "auto";
const service = "s3";

function sha256hex(data) {
  return createHash("sha256").update(data).digest("hex");
}
function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

async function putObject(key, body, contentType, contentEncoding) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body);
  const canonicalUri = `/${bucket}/${key}`;
  const headers = {
    host: endpoint,
    "content-encoding": contentEncoding,
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const sortedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join("");
  const signedHeaders = sortedHeaderNames.join(";");
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${endpoint}${canonicalUri}`, {
    method: "PUT",
    headers: { ...headers, authorization: authorizationHeader },
    body,
  });
  if (!res.ok) {
    throw new Error(`PUT ${key} failed: ${res.status} ${await res.text()}`);
  }
}

for (const name of ["50m.bin", "100m.bin", "150m.bin"]) {
  const key = `proximity-grid/${name}`;
  console.log(`Downloading ${key}...`);
  const res = await fetch(`${publicBase}/${key}`);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const original = Buffer.from(await res.arrayBuffer());

  const compressed = gzipSync(original, { level: 9 });
  console.log(
    `  ${name}: ${(original.length / 1024 / 1024).toFixed(1)}MB -> ${(compressed.length / 1024 / 1024).toFixed(1)}MB gzipped`
  );

  console.log(`  Uploading ${key} with Content-Encoding: gzip...`);
  await putObject(key, compressed, "application/octet-stream", "gzip");
  console.log(`  Done.`);
}

console.log("\nAll 3 grid files re-uploaded. Verify with:");
console.log(
  '  Invoke-WebRequest -Uri "https://pub-80a3f540abef46c8b1535b856664c905.r2.dev/proximity-grid/100m.bin" -Method Head -UseBasicParsing | Select-Object -ExpandProperty Headers'
);
console.log('Should now show "Content-Encoding: gzip".');
