"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { EventClickArg, EventInput } from "@fullcalendar/core";

const USERS = [
  { id: "rino", name: "Rino", color: "#22d3ee", textColor: "#001016" },
  { id: "iselin", name: "Iselin", color: "#f59e0b", textColor: "#1f1300" },
  { id: "fia", name: "Fia", color: "#a3e635", textColor: "#132000" },
  { id: "rakel", name: "Rakel", color: "#fb7185", textColor: "#22040a" },
  { id: "hugo", name: "Hugo", color: "#818cf8", textColor: "#060c25" },
] as const;

type User = (typeof USERS)[number];
type UserId = User["id"];
type ModalState =
  | { type: "create"; date: string }
  | { type: "details"; eventId: string }
  | null;

type CalendarEvent = EventInput & { id: string; ownerId: UserId };

const STORAGE_KEYS = {
  user: "familie-app-user-v1",
  events: "familie-app-events-v1",
  reminders: "familie-app-reminders-v1",
} as const;

export default function KalenderClient() {
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadInitialEvents());
  const [currentUserId, setCurrentUserId] = useState<UserId | null>(() => loadInitialUser());
  const [modal, setModal] = useState<ModalState>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftStartTime, setDraftStartTime] = useState("09:00");
  const [draftEndTime, setDraftEndTime] = useState("10:00");
  const [isAllDay, setIsAllDay] = useState(false);
  const [createError, setCreateError] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    loadNotificationPermission(),
  );
  const firedRemindersRef = useRef<Set<string>>(loadReminderKeys());

  const selectedEvent = useMemo(() => {
    if (!modal || modal.type !== "details") {
      return null;
    }
    return events.find((event) => event.id === modal.eventId) ?? null;
  }, [events, modal]);

  const currentUser = USERS.find((user) => user.id === currentUserId) ?? null;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    if (notificationPermission !== "granted" || !currentUserId) {
      return;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();

      for (const event of events) {
        if (event.ownerId !== currentUserId || event.allDay) {
          continue;
        }

        const startDate = parseEventDate(event.start);
        if (!startDate) {
          continue;
        }

        const reminderAt = startDate.getTime() - 60 * 60 * 1000;
        const reminderKey = `${currentUserId}:${event.id}:${reminderAt}`;

        if (firedRemindersRef.current.has(reminderKey)) {
          continue;
        }

        if (now >= reminderAt && now < startDate.getTime()) {
          new Notification(`Paaminnelse for ${findUser(event.ownerId)?.name ?? "bruker"}`, {
            body: `${event.title} starter ${formatDateTime(startDate)}`,
          });
          firedRemindersRef.current.add(reminderKey);
          localStorage.setItem(STORAGE_KEYS.reminders, JSON.stringify([...firedRemindersRef.current]));
        }
      }
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [events, currentUserId, notificationPermission]);

  const handleDateClick = (info: DateClickArg) => {
    if (!currentUserId) {
      return;
    }

    const clickDate = info.date;
    const date = clickDate.toISOString().slice(0, 10);
    const hour = String(clickDate.getHours()).padStart(2, "0");
    const minute = String(clickDate.getMinutes()).padStart(2, "0");
    const nextHour = String((clickDate.getHours() + 1) % 24).padStart(2, "0");

    setDraftTitle("");
    setDraftDate(date);
    setDraftStartTime(`${hour}:${minute}`);
    setDraftEndTime(`${nextHour}:${minute}`);
    setIsAllDay(info.allDay);
    setCreateError("");
    setModal({ type: "create", date });
  };

  const handleEventClick = (info: EventClickArg) => {
    setModal({ type: "details", eventId: info.event.id });
  };

  const createEvent = () => {
    const title = draftTitle.trim();
    if (!title || !modal || modal.type !== "create" || !currentUserId) {
      return;
    }
    if (!draftDate) {
      setCreateError("Velg en gyldig dato.");
      return;
    }

    const startIso = `${draftDate}T${draftStartTime}:00`;
    const endIso = `${draftDate}T${draftEndTime}:00`;

    if (!isAllDay && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setCreateError("Sluttid maa vaere senere enn starttid.");
      return;
    }

    const owner = findUser(currentUserId);
    if (!owner) {
      return;
    }

    setEvents((prev) => [
      ...prev,
      buildEvent({
        id: crypto.randomUUID(),
        title,
        ownerId: owner.id,
        start: isAllDay ? draftDate : startIso,
        end: isAllDay ? undefined : endIso,
        allDay: isAllDay,
      }),
    ]);
    setModal(null);
  };

  const deleteEvent = () => {
    if (!modal || modal.type !== "details") {
      return;
    }
    setEvents((prev) => prev.filter((event) => event.id !== modal.eventId));
    setModal(null);
  };

  const selectUser = (userId: UserId) => {
    setCurrentUserId(userId);
    localStorage.setItem(STORAGE_KEYS.user, userId);
  };

  const logout = () => {
    setCurrentUserId(null);
    localStorage.removeItem(STORAGE_KEYS.user);
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined") {
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  if (!currentUser) {
    return (
      <section className="rounded-3xl border border-white/10 bg-[#0f1320]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <h2 className="text-2xl font-semibold text-zinc-100">Velg bruker</h2>
        <p className="mt-2 text-sm text-zinc-400">Logg inn uten passord ved aa velge navn.</p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {USERS.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user.id)}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-[#141a29] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-white/30"
            >
              <span className="font-medium text-zinc-100">{user.name}</span>
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: user.color }} />
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="relative rounded-3xl border border-white/10 bg-[#0f1320]/90 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.5)] md:p-6">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#131a2a]/80 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: currentUser.color }} />
          <p className="text-sm text-zinc-200">
            Innlogget som <span className="font-semibold">{currentUser.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={requestNotificationPermission}
            className="rounded-xl border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-white/5"
          >
            {notificationPermission === "granted" ? "Varsel: aktiv" : "Aktiver varsel"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-white/5"
          >
            Bytt bruker
          </button>
        </div>
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={events}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        editable={false}
        selectable
        nowIndicator
        height="auto"
      />

      {modal && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="modal-card w-full max-w-md rounded-2xl border border-white/10 bg-[#161b28] p-6">
            {modal.type === "create" ? (
              <>
                <h2 className="text-xl font-semibold text-zinc-100">Opprett avtale</h2>
                <p className="mt-2 text-sm text-zinc-400">Bruker: {currentUser.name}</p>
                <label className="mt-4 block text-sm font-medium text-zinc-300" htmlFor="eventTitle">
                  Tittel
                </label>
                <input
                  id="eventTitle"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="F.eks. Legetime"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1320] px-4 py-2 text-zinc-100 outline-none ring-cyan-400/50 transition focus:ring"
                />
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-zinc-300" htmlFor="eventDate">
                      Dato
                    </label>
                    <input
                      id="eventDate"
                      type="date"
                      value={draftDate}
                      onChange={(e) => setDraftDate(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1320] px-4 py-2 text-zinc-100 outline-none ring-cyan-400/50 transition focus:ring"
                    />
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0f1320] px-3 py-2 text-sm text-zinc-200 sm:col-span-3">
                    <input
                      type="checkbox"
                      checked={isAllDay}
                      onChange={(e) => setIsAllDay(e.target.checked)}
                      className="h-4 w-4 accent-cyan-500"
                    />
                    Heldagsavtale
                  </label>
                  {!isAllDay && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300" htmlFor="startTime">
                          Start
                        </label>
                        <input
                          id="startTime"
                          type="time"
                          value={draftStartTime}
                          onChange={(e) => setDraftStartTime(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1320] px-4 py-2 text-zinc-100 outline-none ring-cyan-400/50 transition focus:ring"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300" htmlFor="endTime">
                          Slutt
                        </label>
                        <input
                          id="endTime"
                          type="time"
                          value={draftEndTime}
                          onChange={(e) => setDraftEndTime(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1320] px-4 py-2 text-zinc-100 outline-none ring-cyan-400/50 transition focus:ring"
                        />
                      </div>
                    </>
                  )}
                </div>
                {createError && <p className="mt-3 text-sm text-rose-300">{createError}</p>}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-xl border border-white/15 px-4 py-2 text-zinc-300 transition hover:bg-white/5"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={createEvent}
                    className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black transition hover:bg-cyan-400"
                  >
                    Lagre avtale
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-zinc-100">Avtaledetaljer</h2>
                <p className="mt-3 text-zinc-200">{selectedEvent?.title ?? "Ukjent avtale"}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  Eier: {selectedEvent ? findUser(selectedEvent.ownerId)?.name ?? "Ukjent" : "Ukjent"}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {selectedEvent?.allDay
                    ? `Heldag: ${String(selectedEvent.start).slice(0, 10)}`
                    : `Start: ${formatDateTime(selectedEvent?.start)}`}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {selectedEvent?.allDay ? "Slutt: -" : `Slutt: ${formatDateTime(selectedEvent?.end)}`}
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-xl border border-white/15 px-4 py-2 text-zinc-300 transition hover:bg-white/5"
                  >
                    Lukk
                  </button>
                  <button
                    type="button"
                    onClick={deleteEvent}
                    className="rounded-xl bg-rose-500 px-4 py-2 font-medium text-white transition hover:bg-rose-400"
                  >
                    Slett avtale
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function findUser(userId: UserId) {
  return USERS.find((user) => user.id === userId);
}

function isUserId(value: string | null): value is UserId {
  return USERS.some((user) => user.id === value);
}

function buildEvent(input: {
  id: string;
  title: string;
  ownerId: UserId;
  start: string;
  end?: string;
  allDay?: boolean;
}): CalendarEvent {
  const owner = findUser(input.ownerId);
  return {
    id: input.id,
    title: input.title,
    start: input.start,
    end: input.end,
    allDay: input.allDay,
    ownerId: input.ownerId,
    backgroundColor: owner?.color,
    borderColor: owner?.color,
    textColor: owner?.textColor,
  };
}

function loadInitialUser(): UserId | null {
  if (typeof window === "undefined") {
    return null;
  }
  const storedUser = localStorage.getItem(STORAGE_KEYS.user);
  return isUserId(storedUser) ? storedUser : null;
}

function loadInitialEvents(): CalendarEvent[] {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEYS.events);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CalendarEvent[];
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => isUserId(String(item.ownerId)));
        }
      } catch {
        // Ignore malformed local storage and fall back to seed events.
      }
    }
  }

  return [
    buildEvent({
      id: "demo-rino",
      title: "Fotballtrening",
      ownerId: "rino",
      start: "2026-02-22T17:00:00",
      end: "2026-02-22T18:30:00",
    }),
    buildEvent({
      id: "demo-iselin",
      title: "Foreldremote",
      ownerId: "iselin",
      start: "2026-02-23T19:00:00",
      end: "2026-02-23T20:00:00",
    }),
  ];
}

function loadNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "default";
  }
  return Notification.permission;
}

function loadReminderKeys() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  const raw = localStorage.getItem(STORAGE_KEYS.reminders);
  if (!raw) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set<string>();
  }
}

function parseEventDate(value: unknown) {
  if (!value) {
    return null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function formatDateTime(value: unknown) {
  const date = parseEventDate(value);
  if (!date) {
    return "-";
  }
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
