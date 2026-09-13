-- LLEK (Tel Nof) CTR already existed (kind='CTR', added in the icd_kml import) — this just
-- refreshes its altitude text against the ב'-03 North CVFR chart the user shared, which shows
-- "CTR TEL NOF GND-14,000 QNH" and "CTR TEL NOF GND-11,000 QNH" repeating near different parts
-- of the boundary (a stepped/two-tier CTR, same pattern as the neighboring LLBG TMA on that
-- chart). Kept the higher figure as the ceiling — CTR is a hard block for everyone regardless of
-- altitude (see flight-rules.ts CONTROLLED_AIRSPACE_KINDS), so this doesn't change any legal
-- outcome, only the displayed number.
update aip_reference_zones
set max_altitude_ft = 14000,
    altitude_text = 'GND – 14,000 ft QNH (מקטע נמוך יותר בחלק מהגבול: עד 11,000 ft QNH)'
where code = 'LLEK';
