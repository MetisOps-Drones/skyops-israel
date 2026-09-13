-- The commercial academy track ("מטיס מסחרי") now splits into the two real CAAI course tiers —
-- up to 25kg (existing commercial_25kg) and 25kg-2 ton (new) — matching the license_type enum's
-- own heavy_2000kg category (0001_extensions_and_enums.sql) that already existed for the license
-- record itself but had no matching academy course id until now.
alter type lms_course_id add value if not exists 'heavy_2000kg';
