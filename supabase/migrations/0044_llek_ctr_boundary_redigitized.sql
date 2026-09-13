-- The existing LLEK (Tel Nof) CTR polygon was a rough 4-point approximation from the original
-- ICD KML import, small enough that the airbase itself sat right at its southern edge — visibly
-- wrong once compared against the real CTR chart the user shared (a much larger hexagonal
-- boundary running roughly בית עובד/יבנה מזרח in the north down to כפר מנחם/חצור in the south,
-- and east past route 6 toward חולדה). Re-digitized from that chart, landmark-anchored (town
-- coordinates, not pixel-perfect chart georeferencing — flagged as a visual approximation, same
-- as this whole reference layer's documented status). Sized generously rather than tightly,
-- since under-covering a hard-blocked CTR is the unsafe direction of error.
update aip_reference_zones
set geom_geojson = '{"type":"Polygon","coordinates":[[[34.748,31.878],[34.800,31.878],[34.850,31.870],[34.875,31.850],[34.865,31.800],[34.830,31.760],[34.760,31.765],[34.745,31.815],[34.748,31.878]]]}'::jsonb
where code = 'LLEK';
