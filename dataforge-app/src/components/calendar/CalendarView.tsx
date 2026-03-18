"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays } from "lucide-react";
import { createEventAction, deleteEventAction } from "@/actions/calendar.actions";

type CalEvent = {
  id: string;
  title: string;
  description: string | null;
  startDate: Date;
  color: string;
  createdBy: { id: string; name: string | null };
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6",
];

function AddEventModal({ date, onClose, onAdded }: { date: Date; onClose: () => void; onAdded: (ev: CalEvent) => void }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState(COLORS[0]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string).trim();
    const description = (fd.get("description") as string).trim() || undefined;

    if (!title) { setError("Title is required."); return; }
    setError(null);

    startTransition(async () => {
      const res = await createEventAction({ title, description, startDate: date.toISOString(), color });
      if (res?.error) { setError(res.error); return; }
      onAdded({ id: crypto.randomUUID(), title, description: description ?? null, startDate: date, color, createdBy: { id: "", name: "You" } });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <p className="text-sm font-semibold">New Event — {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <input name="title" autoFocus required placeholder="Event title" className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <textarea name="description" placeholder="Description (optional)" rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Color</p>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`h-6 w-6 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-1 ring-current" : ""}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded hover:bg-muted">Cancel</button>
            <button type="submit" className="text-sm px-4 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-medium">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CalendarView({ initialEvents, canEdit }: { initialEvents: CalEvent[]; canEdit: boolean }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [events, setEvents] = useState<CalEvent[]>(initialEvents);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addFor, setAddFor] = useState<Date | null>(null);
  const [, startTransition] = useTransition();

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  const firstDOW = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsInMonth = events.filter((ev) => {
    const d = new Date(ev.startDate);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  function eventsOnDay(day: number) {
    return eventsInMonth.filter((ev) => new Date(ev.startDate).getDate() === day);
  }

  const selectedEvents = selectedDay
    ? events.filter((ev) => {
        const d = new Date(ev.startDate);
        return d.getFullYear() === selectedDay.getFullYear() && d.getMonth() === selectedDay.getMonth() && d.getDate() === selectedDay.getDate();
      })
    : [];

  const upcomingEvents = events
    .filter((ev) => new Date(ev.startDate) >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  function handleDelete(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    startTransition(async () => { await deleteEventAction(id); });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Left: Calendar grid */}
      <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          <p className="text-sm font-semibold">{MONTHS[month]} {year}</p>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => setAddFor(new Date(year, month, now.getDate()))} className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                <Plus className="h-3.5 w-3.5" /> Add Event
              </button>
            )}
            <button onClick={nextMonth} className="p-1 rounded hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {/* DOW headers */}
        <div className="grid grid-cols-7 border-b">
          {DOW.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDOW }).map((_, i) => <div key={`pre-${i}`} className="border-b border-r h-20 bg-muted/10" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = eventsOnDay(day);
            const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
            const isSelected = selectedDay?.getDate() === day && selectedDay?.getMonth() === month && selectedDay?.getFullYear() === year;
            return (
              <div
                key={day}
                onClick={() => setSelectedDay(new Date(year, month, day))}
                className={`border-b border-r h-20 p-1.5 cursor-pointer transition-colors hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {day}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div key={ev.id} className="rounded text-[9px] font-medium px-1 py-0.5 truncate text-white" style={{ backgroundColor: ev.color }}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-col gap-4">
        {/* Selected day events */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <p className="text-sm font-semibold">
              {selectedDay
                ? selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
                : "Select a day"}
            </p>
            {selectedDay && canEdit && (
              <button onClick={() => setAddFor(selectedDay)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="h-3 w-3" /> Add
              </button>
            )}
          </div>
          <div className="p-3 space-y-2 min-h-[80px]">
            {!selectedDay ? (
              <p className="text-xs text-muted-foreground text-center py-4">Click a day to see events</p>
            ) : selectedEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No events</p>
            ) : (
              selectedEvents.map((ev) => (
                <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg border">
                  <div className="h-3 w-1 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: ev.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{ev.title}</p>
                    {ev.description && <p className="text-[11px] text-muted-foreground">{ev.description}</p>}
                    <p className="text-[11px] text-muted-foreground/50">By {ev.createdBy.name ?? "Unknown"}</p>
                  </div>
                  {canEdit && (
                    <button onClick={() => handleDelete(ev.id)} className="text-muted-foreground hover:text-rose-500 shrink-0">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming events */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <p className="text-sm font-semibold">Upcoming Events</p>
          </div>
          <div className="divide-y">
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No upcoming events</p>
            ) : (
              upcomingEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <div className="h-8 w-8 rounded-lg flex flex-col items-center justify-center shrink-0 text-white" style={{ backgroundColor: ev.color }}>
                    <span className="text-[9px] font-bold uppercase">{MONTHS[new Date(ev.startDate).getMonth()].slice(0, 3)}</span>
                    <span className="text-sm font-black leading-none">{new Date(ev.startDate).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{ev.title}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(ev.startDate).toLocaleDateString("en-US", { weekday: "short" })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add event modal */}
      {addFor && (
        <AddEventModal
          date={addFor}
          onClose={() => setAddFor(null)}
          onAdded={(ev) => setEvents((prev) => [...prev, ev])}
        />
      )}
    </div>
  );
}
