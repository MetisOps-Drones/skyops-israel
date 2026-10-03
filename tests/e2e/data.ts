import type { AipReferenceZone } from "../../src/hooks/useAipReferenceZones";

/**
 * Read-only access to the real aip_reference_zones / coordination_authorities
 * data for the audit specs (airspace-rules, coordination-desk). Uses the
 * service-role key from .env.local — never from a browser — and only ever
 * issues SELECTs / the read-only find_coordination_authority RPC. A spec
 * skips itself when the key isn't configured.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasServiceKey = Boolean(url && key);

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key!, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function loadAipZones(): Promise<AipReferenceZone[]> {
  return request("aip_reference_zones?select=*&limit=2000");
}

export interface AuthorityRow {
  id: string;
  name: string;
  unit_type: string;
  phone: string;
  backup_phone: string | null;
  whatsapp_phone: string | null;
  contacts: unknown;
  center_lng: number;
  center_lat: number;
  radius_m: number;
}

export async function loadAuthorities(): Promise<AuthorityRow[]> {
  return request("coordination_authorities?select=*&order=name");
}

export async function findAuthorities(lng: number, lat: number): Promise<AuthorityRow[]> {
  return request("rpc/find_coordination_authority", { method: "POST", body: JSON.stringify({ lng, lat }) });
}
