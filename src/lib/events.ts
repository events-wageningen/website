import type { Event } from "@/types/event";

const modules = import.meta.glob<Event>("../data/events/*.json", {
  eager: true,
});

export function getEvents(): Event[] {
  return Object.values(modules).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("nl-NL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
