-- Migration: Add 'unknown' to price check constraint on events table
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_price_check;
ALTER TABLE events ADD CONSTRAINT events_price_check CHECK (price IN ('free', 'paid', 'donation', 'unknown'));
