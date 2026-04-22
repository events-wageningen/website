-- Run this once in the Supabase SQL editor to set up the events table.

CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  start_date    TIMESTAMPTZ NOT NULL,
  end_date      TIMESTAMPTZ NOT NULL,
  location_name TEXT NOT NULL DEFAULT '',
  location_city TEXT NOT NULL DEFAULT '',
  category      TEXT[] NOT NULL DEFAULT '{}',
  tags          TEXT[] NOT NULL DEFAULT '{}',
  url           TEXT NOT NULL DEFAULT '',
  price         TEXT NOT NULL CHECK (price IN ('free', 'paid', 'donation')),
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon key, website build) to read events
CREATE POLICY "public_read" ON events
  FOR SELECT USING (true);

-- Service role (bot, Supabase dashboard) bypasses RLS automatically —
-- no extra policy needed for INSERT / UPDATE / DELETE.

-- ── Categories ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT ''
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON categories
  FOR SELECT USING (true);
