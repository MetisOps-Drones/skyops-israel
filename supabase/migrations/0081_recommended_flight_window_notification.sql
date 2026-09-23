-- New notification kind for the "recommended flight window" feature —
-- surfaces a good upcoming wind/precipitation window for a pilot's usual
-- flying areas and their current live location. See
-- src/actions/flight-window-recommendation.ts.
alter type notification_kind add value 'recommended_flight_window';
