export type EventCategory =
  | "music"
  | "talks"
  | "movies"
  | "dance"
  | "workshops"
  | "nature"
  | "yoga"
  | "meditation"
  | "sport"
  | "politics"
  | "art"
  | "games"
  | "markets"
  | "food";

export type EventPrice = "free" | "paid" | "donation";

export type EventStatus = "scheduled" | "cancelled";

export interface EventLocation {
  name: string;
  city: string;
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  description: string;
  startDate: string;
  endDate: string;
  location: EventLocation;
  category: EventCategory[];
  tags: string[];
  url: string;
  price: EventPrice;
  status: EventStatus;
  lat?: number;
  lon?: number;
  creatorTelegramId?: number;
}

