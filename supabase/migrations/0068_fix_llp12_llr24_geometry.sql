-- Two more zones from the 0037 "kept as-is pending manual fix" list, now
-- resolved against the current AIP edition (א'-17, AIRAC AMDT 001/2026,
-- 06 AUG 2026, ENR 5.1 appendix B coordinate tables):
--   - LLP12 ("שטח אש 209"): 0037 flagged this as having "at least one vertex
--     that doesn't fit a simple polygon" — the current edition's vertex list
--     parses clean (turf.kinks: 0 self-intersections), so that was likely an
--     artifact of the older source text, not a real self-intersecting shape.
--   - LLR24 ("שטח אש 24"): a plain 5-vertex polygon in the current edition,
--     no arc — straightforward to extract correctly.
-- Both verified with turf.kinks before this migration was written.
--
-- Still unresolved (not fixed here, left on their existing approximate
-- circle): LLP172 (the arc-based boundary still produces a self-intersection
-- even with correct arc interpolation — a genuinely harder case, not just a
-- missed edge); LLP16, LLP41, LLP42, LLU22, LLR82 don't appear under those
-- codes anywhere in the current AIP edition's ENR 5.1 tables at all — they
-- were evidently renumbered or retired since whichever earlier
-- edition/source these codes were first seeded from, and matching them to
-- their current identity would need the visual chart, not just the text
-- tables this migration is built from.

update aip_reference_zones
set geom_geojson = '{"type":"Polygon","coordinates":[[[34.87972222222222,31.747777777777777],[34.922777777777775,31.70638888888889],[34.93416666666666,31.704166666666666],[34.956944444444446,31.71],[34.973333333333336,31.7475],[34.93694444444444,31.759166666666665],[34.896388888888886,31.790555555555557],[34.87694444444445,31.80527777777778],[34.85666666666667,31.773055555555555],[34.85138888888889,31.74888888888889],[34.87972222222222,31.747777777777777]]]}'::jsonb,
  source_sheet = 'aip_pmat_a17_1_26',
  source_edition = '2026-08-06'
where code = 'LLP12';

update aip_reference_zones
set geom_geojson = '{"type":"Polygon","coordinates":[[[34.56472222222222,31.969166666666666],[34.737500000000004,31.97722222222222],[34.72138888888889,31.932222222222222],[34.5325,31.915277777777778],[34.56472222222222,31.969166666666666]]]}'::jsonb,
  source_sheet = 'aip_pmat_a17_1_26',
  source_edition = '2026-08-06'
where code = 'LLR24';
