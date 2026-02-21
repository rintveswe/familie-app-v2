"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { EventClickArg, EventInput } from "@fullcalendar/core";

type ModalState =
  | { type: "create"; date: string }
  | { type: "details"; eventId: string }
  | null;

export default function KalenderClient() {
  const [events, setEvents] = useState<EventInput[]>([
    {
      id: "demo-1",
      title: "Familiemiddag",
      start: "2026-02-22T18:00:00",
      end: "2026-02-22T19:30:00",
    },
  ]);
  const [modal, setModal] = useState<ModalState>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftStartTime, setDraftStartTime] = useState("09:00");
  const [draftEndTime, setDraftEndTime] = useState("10:00");
  const [isAllDay, setIsAllDay] = useState(false);
  const [createError, setCreateError] = useState("");

  const selectedEvent = useMemo(() => {
    if (!modal || modal.type !== "details") {
      return null;
    }
    return events.find((event) => String(event.id) === modal.eventId) ?? null;
  }, [events, modal]);

  const handleDateClick = (info: DateClickArg) => {
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
    setModal({ type: "create", date: date });
  };

  const handleEventClick = (info: EventClickArg) => {
    setModal({ type: "details", eventId: info.event.id });
  };

  const createEvent = () => {
    const title = draftTitle.trim();
    if (!title || !modal || modal.type !== "create") {
      return;
    }
    if (!draftDate) {
      setCreateError("Velg en gyldig dato.");
      return;
    }

    const startIso = `${draftDate}T${draftStartTime}:00`;
    const endIso = `${draftDate}T${draftEndTime}:00`;
    if (!isAllDay && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setCreateError("Sluttid må være senere enn starttid.");
      return;
    }

    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title,
        start: isAllDay ? draftDate : startIso,
        end: isAllDay ? undefined : endIso,
        allDay: isAllDay,
      },
    ]);
    setModal(null);
  };

  const deleteEvent = () => {
    if (!modal || modal.type !== "details") {
      return;
    }
    setEvents((prev) => prev.filter((event) => String(event.id) !== modal.eventId));
    setModal(null);
  };

  return (
    <section className="relative rounded-3xl border border-white/10 bg-[#0f1320]/90 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.5)] md:p-6">
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
                <p className="mt-2 text-sm text-zinc-400">Trykk lagre for a legge inn avtalen i kalenderen.</p>
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

function formatDateTime(value: unknown) {
  if (!value) {
    return "-";
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
