-- Replaces bare ICAO/LL codes as the *displayed* name with plain Hebrew
-- place names, identified from the zone's centroid (cross-referenced
-- against known Israeli airfield locations) rather than the code alone —
-- LLEK doesn't mean anything to a pilot who hasn't memorized NOTAM
-- shorthand. The code itself is kept in the `code` column and still shown
-- in parentheses in the UI for anyone who does read it.
--
-- Confidence varies: most of these are well-known airfields matched with
-- high confidence; four (LLTA/LLSC/LLBO/LLKZ) couldn't be pinned to a
-- specific named site, so they get a general area label instead of a
-- guessed identity.

update aip_reference_zones set name = 'חצור' where code = 'LLHS';
update aip_reference_zones set name = 'חצרים' where code = 'LLHB';
update aip_reference_zones set name = 'רמון (בסיס חיל האוויר)' where code = 'LLRM';
update aip_reference_zones set name = 'נבטים' where code = 'LLNV';
update aip_reference_zones set name = 'פלמחים' where code = 'LLPL';
update aip_reference_zones set name = 'אילת (שדה התעופה הישן)' where code = 'LLET';
update aip_reference_zones set name = 'הרצליה' where code = 'LLHZ';
update aip_reference_zones set name = 'מצדה (שדה בר יהודה)' where code = 'LLMZ';
update aip_reference_zones set name = 'ראש פינה' where code = 'LLIB';
update aip_reference_zones set name = 'באר שבע (תימן)' where code = 'LLBS';
update aip_reference_zones set name = 'בן גוריון' where code = 'LLBG';
update aip_reference_zones set name = 'עין יהב' where code = 'LLEY';
update aip_reference_zones set name = 'פיק' where code = 'LLFK';
update aip_reference_zones set name = 'עין שמר' where code = 'LLES';
update aip_reference_zones set name = 'קריית שמונה' where code = 'LLKS';
update aip_reference_zones set name = 'ערד' where code = 'LLAR';
update aip_reference_zones set name = 'גבולות' where code = 'LLGV';
update aip_reference_zones set name = 'מגידו' where code = 'LLMG';
update aip_reference_zones set name = 'חיפה' where code = 'LLHA';
update aip_reference_zones set name = 'עובדה' where code = 'LLOV';
update aip_reference_zones set name = 'יטבתה' where code = 'LLYO';
update aip_reference_zones set name = 'רמון (נמל תעופה)' where code = 'LLER';
update aip_reference_zones set name = 'רמת דוד' where code = 'LLRD';
update aip_reference_zones set name = 'עקרון' where code = 'LLEK';

update aip_reference_zones set name = 'אזור בקרה — תל אביב (מגזר עליון)' where code = 'LLTA';
update aip_reference_zones set name = 'מגזר בקרה — ערבה מרכזית' where code = 'LLSC';
update aip_reference_zones set name = 'אזור בקרה — חוף הכרמל' where code = 'LLBO';
update aip_reference_zones set name = 'אזור בקרה — רמת הנגב המערבית' where code = 'LLKZ';
