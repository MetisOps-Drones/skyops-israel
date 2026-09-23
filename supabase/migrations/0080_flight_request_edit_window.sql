-- Pilots can edit a flight_request for 30 minutes after submitting it —
-- fixing a typo'd altitude or a wrong end time shouldn't require
-- cancelling and re-submitting from scratch. The edit window closes the
-- moment a dispatcher actually opens the request, even if under 30
-- minutes have passed — once someone is looking at it, changing it out
-- from under them would be actively confusing. See
-- src/actions/flight-requests.ts (updateFlightRequest) and
-- src/actions/dispatcher.ts (markFlightRequestViewedByDispatcher).

alter table flight_requests
  add column first_viewed_by_dispatcher_at timestamptz;
