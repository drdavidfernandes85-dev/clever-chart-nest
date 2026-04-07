DELETE FROM messages;
DELETE FROM channels;

INSERT INTO channels (name, category) VALUES
  ('trades_room', 'Trading'),
  ('economics', 'Trading'),
  ('news_and_research', 'Research'),
  ('fx', 'Markets'),
  ('indices', 'Markets'),
  ('crypto', 'Markets'),
  ('commodities', 'Markets');