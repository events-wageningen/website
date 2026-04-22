import type { Event, EventsFile } from "@/types/event";
import eventsData from "../data/events.json";

export function getEvents(): Event[] {
  const data = eventsData as EventsFile;
  return data.events.sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
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
