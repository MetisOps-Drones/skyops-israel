-- The Eilat-Ramon airport authority was stored at longitude 35.281, ~27 km east of the airport
-- (its runway, per OpenStreetMap, runs along longitude 35.01, latitude 29.71-29.74). Found when the official
-- Eilat-Ramon control zone was added (0094): a point inside it had no coordination authority within reach.
-- Idempotent: sets a fixed location.
update coordination_authorities
set center_lng = 35.0125, center_lat = 29.724
where name = 'נמל התעופה אילת-רמון (CTR אילת רמון)';
