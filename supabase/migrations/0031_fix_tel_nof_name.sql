-- LLEK is Tel Nof airbase's own ICAO code ("תל נוף"), not the nearby town
-- of Ekron — 0028_plain_hebrew_zone_names.sql mislabeled it "עקרון". This
-- is why the user couldn't find "תל נוף" as a CTR: it was there all along,
-- just under the wrong name.
update aip_reference_zones set name = 'תל נוף' where code = 'LLEK';
