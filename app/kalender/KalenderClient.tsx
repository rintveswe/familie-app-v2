"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { EventClickArg } from "@fullcalendar/core";
import { CalendarEvent } from "@/lib/shared/types";
import { findUser, isUserId, USERS, UserId } from "@/lib/shared/users";

type ModalState =
  | { type: "create"; date: string }
  | { type: "details"; eventId: string }
  | null;

const STORAGE_KEY_USER = "familie-app-user-v1";

export default function KalenderClient() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<UserId | null>(loadInitialUser());
  const [modal, setModal] = useState<ModalState>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftStartTime, setDraftStartTime] = useState("09:00");
  const [draftEndTime, setDraftEndTime] = useState("10:00");
  const [isAllDay, setIsAllDay] = useState(false);
  const [createError, setCreateError] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testPushMessage, setTestPushMessage] = useState("");
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const selectedEvent = useMemo(() => {
    if (!modal || modal.type !== "details") {
      return null;
    }
    return events.find((event) => event.id === modal.eventId) ?? null;
  }, [events, modal]);

  const currentUser = USERS.find((user) => user.id === currentUserId) ?? null;

  useEffect(() => {
    void refreshEvents();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let mounted = true;
    const setup = async () => {
      if (!("serviceWorker" in navigator)) {
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        if (!mounted) {
          return;
        }
        swRegistrationRef.current = registration;
      } catch {
        // Ignore service worker registration failures.
      }
    };
    void setup();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const enabled = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    setPushEnabled(enabled);
  }, []);

  const refreshEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { events: CalendarEvent[] };
      setEvents(Array.isArray(data.events) ? data.events : []);
    } finally {
      setLoadingEvents(false);
    }
  };

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

  const createEvent = async () => {
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

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        start: isAllDay ? draftDate : startIso,
        end: isAllDay ? undefined : endIso,
        allDay: isAllDay,
        ownerId: currentUserId,
      }),
    });

    if (!res.ok) {
      setCreateError("Kunne ikke lagre avtalen.");
      return;
    }

    setModal(null);
    await refreshEvents();
  };

  const deleteEvent = async () => {
    if (!modal || modal.type !== "details") {
      return;
    }

    await fetch(`/api/events/${modal.eventId}`, { method: "DELETE" });
    setModal(null);
    await refreshEvents();
  };

  const selectUser = async (userId: UserId) => {
    setCurrentUserId(userId);
    localStorage.setItem(STORAGE_KEY_USER, userId);
    if (notificationPermission === "granted") {
      await subscribeCurrentDevice(userId);
    }
  };

  const logout = async () => {
    await removeCurrentSubscription();
    setCurrentUserId(null);
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted" && currentUserId) {
      await subscribeCurrentDevice(currentUserId);
    }
  };

  const sendTestPush = async () => {
    if (!currentUserId) {
      return;
    }
    setTestingPush(true);
    setTestPushMessage("");
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (!res.ok) {
        setTestPushMessage("Kunne ikke sende test push.");
        return;
      }
      const data = (await res.json()) as { sent?: number };
      setTestPushMessage(`Test sendt til ${data.sent ?? 0} enhet(er).`);
    } finally {
      setTestingPush(false);
    }
  };

  const subscribeCurrentDevice = async (userId: UserId) => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey || !swRegistrationRef.current) {
      return;
    }

    const subscription = await swRegistrationRef.current.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        subscription: subscription.toJSON(),
      }),
    });
  };

  const removeCurrentSubscription = async () => {
    if (!swRegistrationRef.current) {
      return;
    }
    const subscription = await swRegistrationRef.current.pushManager.getSubscription();
    if (!subscription) {
      return;
    }
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
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
              onClick={() => void selectUser(user.id)}
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
            onClick={() => void requestNotificationPermission()}
            disabled={!pushEnabled}
            className="rounded-xl border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {notificationPermission === "granted" ? "Push aktiv" : "Aktiver push"}
          </button>
          <button
            type="button"
            onClick={() => void sendTestPush()}
            disabled={!pushEnabled || testingPush}
            className="rounded-xl border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testingPush ? "Sender..." : "Test push naa"}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-xl border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-white/5"
          >
            Bytt bruker
          </button>
        </div>
      </div>
      {testPushMessage && <p className="mb-4 text-xs text-zinc-300">{testPushMessage}</p>}

      {loadingEvents ? (
        <div className="rounded-2xl border border-white/10 bg-[#121a2a] p-6 text-sm text-zinc-300">Laster kalender...</div>
      ) : (
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
      )}

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
                    onClick={() => void createEvent()}
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
                    onClick={() => void deleteEvent()}
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

function loadInitialUser(): UserId | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = localStorage.getItem(STORAGE_KEY_USER);
  return isUserId(value) ? value : null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
