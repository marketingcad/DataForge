"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays } from "lucide-react";
import { createEventAction, deleteEventAction } from "@/actions/calendar.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type CalEvent = {
  id: string;
  title: string;
  description: string | null;
  startDate: Date;
  color: string;
  createdBy: { id: string; name: string | null };
};

const DOW    = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6"];

function AddEventDialog({
  date, open, onClose, onAdded,
}: { date: Date; open: boolean; onClose: () => void; onAdded: (ev: CalEvent) => void }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState(COLORS[0]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title       = (fd.get("title")       as string).trim();
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            New Event — {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ev-title">Title <span className="text-destructive">*</span></Label>
            <Input id="ev-title" name="title" autoFocus required placeholder="Event title" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea id="ev-desc" name="description" placeholder="Optional description" rows={2} className="resize-none" />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition-all ${color === c ? "scale-125 ring-2 ring-offset-2 ring-current" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Save Event</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarView({ initialEvents, canEdit }: { initialEvents: CalEvent[]; canEdit: boolean }) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents]       = useState<CalEvent[]>(initialEvents);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addFor, setAddFor]           = useState<Date | null>(null);
  const [, startTransition] = useTransition();

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0);  } else setMonth(m => m + 1); }

  const firstDOW    = new Date(year, month, 1).getDay();
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
      {/* ── Calendar grid ── */}
      <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold">{MONTHS[month]} {year}</p>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddFor(new Date(year, month, now.getDate()))}
                className="gap-1.5 text-xs h-8"
              >
                <Plus className="h-3.5 w-3.5" /> Add Event
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b">
          {DOW.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDOW }).map((_, i) => (
            <div key={`pre-${i}`} className="border-b border-r h-20 bg-muted/10" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day       = i + 1;
            const dayEvents = eventsOnDay(day);
            const isToday   = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
            const isSelected = selectedDay?.getDate() === day && selectedDay?.getMonth() === month && selectedDay?.getFullYear() === year;

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(new Date(year, month, day))}
                className={`border-b border-r h-20 p-1.5 cursor-pointer transition-colors hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? "bg-blue-600 text-white" : "text-muted-foreground"}`}>
                  {day}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <Tooltip key={ev.id}>
                      <TooltipTrigger asChild>
                        <div className="rounded text-[9px] font-medium px-1 py-0.5 truncate text-white cursor-pointer" style={{ backgroundColor: ev.color }}>
                          {ev.title}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{ev.title}</TooltipContent>
                    </Tooltip>
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

      {/* ── Right panel ── */}
      <div className="flex flex-col gap-4">
        {/* Selected day */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <p className="text-sm font-semibold">
              {selectedDay
                ? selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
                : "Select a day"}
            </p>
            {selectedDay && canEdit && (
              <Button variant="ghost" size="sm" onClick={() => setAddFor(selectedDay)} className="h-7 gap-1 text-xs">
                <Plus className="h-3 w-3" /> Add
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-52">
            <div className="p-3 space-y-2">
              {!selectedDay ? (
                <p className="text-xs text-muted-foreground text-center py-4">Click a day to see events</p>
              ) : selectedEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No events</p>
              ) : (
                selectedEvents.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2 p-2.5 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className="h-3 w-1 rounded-full mt-1 shrink-0" style={{ backgroundColor: ev.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{ev.title}</p>
                      {ev.description && <p className="text-[11px] text-muted-foreground">{ev.description}</p>}
                      <p className="text-[11px] text-muted-foreground/50">By {ev.createdBy.name ?? "Unknown"}</p>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(ev.id)}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Upcoming events */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
            <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
            <p className="text-sm font-semibold">Upcoming Events</p>
          </div>
          <div className="divide-y">
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No upcoming events</p>
            ) : (
              upcomingEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="h-9 w-9 rounded-lg flex flex-col items-center justify-center shrink-0 text-white" style={{ backgroundColor: ev.color }}>
                    <span className="text-[9px] font-bold uppercase">{MONTHS[new Date(ev.startDate).getMonth()].slice(0, 3)}</span>
                    <span className="text-sm font-black leading-none">{new Date(ev.startDate).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{ev.title}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(ev.startDate).toLocaleDateString("en-US", { weekday: "short" })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Separator className="hidden" />

      {/* Add event dialog */}
      {addFor && (
        <AddEventDialog
          date={addFor}
          open={!!addFor}
          onClose={() => setAddFor(null)}
          onAdded={(ev) => setEvents((prev) => [...prev, ev])}
        />
      )}
    </div>
  );
}
