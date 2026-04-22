import { createClient } from "@supabase/supabase-js";
import type { Event } from "@/types/event";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

export interface Category {
  id: string;
  label: string;
  emoji: string;
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, label, emoji")
    .order("label");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string) ?? "",
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    location: {
      name: row.location_name as string,
      city: row.location_city as string,
    },
    category: row.category as Event["category"],
    tags: (row.tags as string[]) ?? [],
    url: (row.url as string) ?? "",
    price: row.price as Event["price"],
    status: row.status as Event["status"],
    lat: row.lat as number | undefined,
    lon: row.lon as number | undefined,
  }));
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
