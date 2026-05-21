-- Seed data: the 5 events migrated from events.json.
-- Run AFTER schema.sql in the Supabase SQL editor.

-- ── Categories ────────────────────────────────────────────────────────────────
INSERT INTO categories (id, label, emoji) VALUES
  ('music',      'Music',      '🎵'),
  ('talks',      'Talks',      '🎤'),
  ('movies',     'Movies',     '🎬'),
  ('dance',      'Dance',      '💃'),
  ('workshops',  'Workshops',  '🔧'),
  ('nature',     'Nature',     '🌿'),
  ('yoga',       'Yoga',       '🧘'),
  ('meditation', 'Meditation', '🕯'),
  ('sport',      'Sport',      '⚽'),
  ('politics',   'Politics',   '🗳'),
  ('art',        'Art',        '🎨'),
  ('games',      'Games',      '🎮'),
  ('markets',    'Markets',    '🛒'),
  ('food',       'Food',       '🍕')
ON CONFLICT (id) DO NOTHING;


INSERT INTO events (id, name, slug, description, start_date, end_date, location_name, location_city, category, tags, url, price, status)
VALUES
(
  'koningsdag-2026',
  'King''s Day Street Festival',
  'koningsdag-2026',
  'Celebrate King''s Day with live music, flea markets, and orange-clad festivities across the city centre. A day of national celebration filled with street performances, food stalls, and community fun for all ages.',
  '2026-04-27T10:00:00+02:00',
  '2026-04-27T22:00:00+02:00',
  'Markt',
  'Wageningen',
  ARRAY['music', 'markets', 'food'],
  ARRAY['outdoor', 'family', 'national-holiday'],
  '',
  'free',
  'scheduled'
),
(
  'morning-yoga-may-2026',
  'Morning Yoga in the City Park',
  'morning-yoga-may-2026',
  'Start your weekend with a refreshing outdoor yoga session in Wageningen''s beautiful city park. Suitable for all levels — from complete beginners to experienced practitioners. Bring your own mat and a water bottle.',
  '2026-05-02T09:00:00+02:00',
  '2026-05-02T10:30:00+02:00',
  'Stadspark',
  'Wageningen',
  ARRAY['yoga', 'nature'],
  ARRAY['outdoor', 'wellness', 'beginners-welcome'],
  '',
  'donation',
  'scheduled'
),
(
  'science-pub-quiz-may-2026',
  'Science Pub Quiz Night',
  'science-pub-quiz-may-2026',
  'Test your knowledge at Wageningen''s favourite science pub quiz. Teams of up to four compete across rounds covering biology, climate, food science, and general trivia. Prizes for the top three teams.',
  '2026-05-08T19:30:00+02:00',
  '2026-05-08T22:30:00+02:00',
  'Café De Zaaier',
  'Wageningen',
  ARRAY['games', 'talks'],
  ARRAY['indoor', 'students', 'teams'],
  '',
  'paid',
  'scheduled'
),
(
  'open-air-cinema-may-2026',
  'Open Air Cinema: Classics Under the Stars',
  'open-air-cinema-may-2026',
  'Enjoy a handpicked selection of classic films projected on a large outdoor screen. Bring a blanket, grab a drink from the bar, and settle in for a magical evening under the stars in Nudepark.',
  '2026-05-22T21:00:00+02:00',
  '2026-05-22T23:30:00+02:00',
  'Nudepark',
  'Wageningen',
  ARRAY['movies'],
  ARRAY['outdoor', 'film', 'evening'],
  '',
  'paid',
  'scheduled'
),
(
  'summer-music-festival-2026',
  'Wageningen Summer Music Festival',
  'summer-music-festival-2026',
  'The city''s biggest summer event returns with two days of live music across multiple stages. Featuring local bands and international acts alongside food villages and art installations throughout the park.',
  '2026-06-20T14:00:00+02:00',
  '2026-06-21T23:00:00+02:00',
  'Stadspark',
  'Wageningen',
  ARRAY['music', 'art', 'food'],
  ARRAY['outdoor', 'multi-day', 'family'],
  '',
  'paid',
  'scheduled'
)
ON CONFLICT (id) DO NOTHING;
