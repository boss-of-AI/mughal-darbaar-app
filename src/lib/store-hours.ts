// ============================================================
// src/lib/store-hours.ts
// Evaluates whether the restaurant is currently live & accepting
// orders based on Admin/Staff configured Order Accepting Timings (IST).
// ============================================================

export interface DaySchedule {
  open: string; // "HH:MM" 24h
  close: string; // "HH:MM" 24h
  closed: boolean;
}

export type WeeklySchedule = Record<
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
  DaySchedule
>;

export const DAYS_ORDER: (keyof WeeklySchedule)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DAY_LABELS: Record<keyof WeeklySchedule, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: { open: "12:00", close: "23:30", closed: false },
  tuesday: { open: "12:00", close: "23:30", closed: false },
  wednesday: { open: "12:00", close: "23:30", closed: false },
  thursday: { open: "12:00", close: "23:30", closed: false },
  friday: { open: "12:00", close: "23:30", closed: false },
  saturday: { open: "11:00", close: "23:59", closed: false },
  sunday: { open: "11:00", close: "23:59", closed: false },
};

export function normalizeWeeklySchedule(raw: unknown): WeeklySchedule {
  const result: WeeklySchedule = { ...DEFAULT_WEEKLY_SCHEDULE };
  if (!raw || typeof raw !== "object") return result;

  const obj = raw as Record<string, unknown>;
  for (const day of DAYS_ORDER) {
    const entry = obj[day];
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      const open =
        typeof e.open === "string" && /^\d{2}:\d{2}$/.test(e.open)
          ? e.open
          : DEFAULT_WEEKLY_SCHEDULE[day].open;
      const close =
        typeof e.close === "string" && /^\d{2}:\d{2}$/.test(e.close)
          ? e.close
          : DEFAULT_WEEKLY_SCHEDULE[day].close;
      const closed = Boolean(e.closed);
      result[day] = { open, close, closed };
    }
  }
  return result;
}

export function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  if (h === 0 && m === 0) return "12:00 AM (Midnight)";
  if (h === 23 && m === 59) return "12:00 AM (Midnight)";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Returns the YYYY-MM-DD date string in Asia/Kolkata (IST) timezone.
 * Used across server and client to consistently classify Today's Orders vs Past Orders.
 */
export function getIstDateKey(dateInput: Date | string = new Date()): string {
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

/**
 * Returns a Date representing 00:00:00.000 of the current day in Asia/Kolkata (IST).
 */
export function getTodayIstStart(now: Date = new Date()): Date {
  const istKey = getIstDateKey(now);
  return new Date(`${istKey}T00:00:00.000+05:30`);
}

export interface StoreAvailabilityResult {
  isOpenNow: boolean;
  isAcceptingOrdersSwitch: boolean;
  statusReason: "open" | "manual_paused" | "closed_today" | "outside_hours";
  headline: string;
  subline: string;
  todayDay: keyof WeeklySchedule;
  todayLabel: string;
  todayOpen: string;
  todayClose: string;
  todayFormattedWindow: string;
  currentIstTimeFormatted: string;
  schedule: {
    dayKey: keyof WeeklySchedule;
    dayLabel: string;
    open: string;
    close: string;
    closed: boolean;
    formatted: string;
    isToday: boolean;
  }[];
}

export function evaluateStoreStatus(input?: {
  isAcceptingOrders?: boolean | null;
  openingHours?: unknown;
  now?: Date;
}): StoreAvailabilityResult {
  const isAcceptingOrdersSwitch = input?.isAcceptingOrders ?? true;
  const weekly = normalizeWeeklySchedule(input?.openingHours);
  const now = input?.now ?? new Date();

  // Extract IST (Asia/Kolkata) weekday, hour, and minute
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekdayRaw = (
    parts.find((p) => p.type === "weekday")?.value || "Monday"
  ).toLowerCase() as keyof WeeklySchedule;
  const todayDay: keyof WeeklySchedule = DAYS_ORDER.includes(weekdayRaw)
    ? weekdayRaw
    : "monday";

  const hourNum = Number(parts.find((p) => p.type === "hour")?.value ?? 12) % 24;
  const minNum = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const currentMinutes = hourNum * 60 + minNum;
  const currentHHMM = `${String(hourNum).padStart(2, "0")}:${String(minNum).padStart(2, "0")}`;
  const currentIstTimeFormatted = formatTime12h(currentHHMM);

  const todaySched = weekly[todayDay];
  const openMins = toMinutes(todaySched.open);
  // Treat "00:00" close as end-of-day (1440 mins)
  const rawCloseMins = toMinutes(todaySched.close);
  const closeMins = rawCloseMins === 0 ? 24 * 60 : rawCloseMins;

  let withinHours = false;
  if (!todaySched.closed) {
    if (closeMins > openMins) {
      withinHours = currentMinutes >= openMins && currentMinutes <= closeMins;
    } else {
      // Overnight window (e.g., 12:00 to 02:00 next day)
      withinHours = currentMinutes >= openMins || currentMinutes <= closeMins;
    }
  }

  const todayFormattedWindow = todaySched.closed
    ? "Closed Today"
    : `${formatTime12h(todaySched.open)} – ${formatTime12h(todaySched.close)}`;

  let isOpenNow = true;
  let statusReason: StoreAvailabilityResult["statusReason"] = "open";
  let headline = "We Are Live & Accepting Orders";
  let subline = `Today's Order Timings: ${todayFormattedWindow}`;

  if (!isAcceptingOrdersSwitch) {
    isOpenNow = false;
    statusReason = "manual_paused";
    headline = "Restaurant is Currently Closed / Not Accepting Orders";
    subline = `Orders are temporarily paused by restaurant staff. Regular timings today: ${todayFormattedWindow}`;
  } else if (todaySched.closed) {
    isOpenNow = false;
    statusReason = "closed_today";
    headline = "Restaurant is Closed Today";
    subline = "Please check our weekly order accepting timings below.";
  } else if (!withinHours) {
    isOpenNow = false;
    statusReason = "outside_hours";
    headline = "Restaurant is Currently Closed";
    subline = `We accept orders today between ${todayFormattedWindow} (IST).`;
  }

  const schedule = DAYS_ORDER.map((dayKey) => {
    const d = weekly[dayKey];
    return {
      dayKey,
      dayLabel: DAY_LABELS[dayKey],
      open: d.open,
      close: d.close,
      closed: d.closed,
      formatted: d.closed
        ? "Closed"
        : `${formatTime12h(d.open)} – ${formatTime12h(d.close)}`,
      isToday: dayKey === todayDay,
    };
  });

  return {
    isOpenNow,
    isAcceptingOrdersSwitch,
    statusReason,
    headline,
    subline,
    todayDay,
    todayLabel: DAY_LABELS[todayDay],
    todayOpen: todaySched.open,
    todayClose: todaySched.close,
    todayFormattedWindow,
    currentIstTimeFormatted,
    schedule,
  };
}
