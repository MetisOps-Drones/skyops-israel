select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'pilot_pricing', 'portfolio_items', 'marketplace_bookings',
    'booking_messages', 'chat_phrase_stats'
  )
order by table_name;
