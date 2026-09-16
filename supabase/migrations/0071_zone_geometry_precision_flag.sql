-- Explicit per-zone precision flag instead of a blanket "demo/advisory"
-- banner: 179 of 185 aip_reference_zones rows now carry exact geometry from
-- the official AIP (see 0037_a17_official_geometry_rebuild.sql and
-- 0068_fix_llp12_llr24_geometry.sql) — only 6 codes still fall back to an
-- approximate circle, for the specific documented reasons in those
-- migrations (self-intersecting arc geometry, or the code doesn't appear
-- under that identity in the current AIP edition at all). The UI shows a
-- small footnote only for these, not a global disclaimer.
alter table aip_reference_zones
  add column geometry_precise boolean not null default true;

update aip_reference_zones
set geometry_precise = false
where code in ('LLP16', 'LLP41', 'LLP42', 'LLR82', 'LLU22', 'LLP172');
