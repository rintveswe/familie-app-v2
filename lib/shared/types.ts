import { UserId } from "./users";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  ownerId: UserId;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
};

export type CreateEventInput = {
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  ownerId: UserId;
};

export type PushSubscriptionRecord = {
  userId: UserId;
  subscription: PushSubscriptionJSON;
  createdAt: string;
};

export type AppData = {
  events: CalendarEvent[];
  subscriptions: PushSubscriptionRecord[];
  sentReminders: string[];
};
