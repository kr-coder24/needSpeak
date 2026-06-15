import { toast } from "sonner";
import { create } from "zustand";
import {
  createWatch,
  createWatchWithImage,
  getDemoWatchEvents,
  getWatchStats,
  getWatches,
  removeWatch,
  simulateNextDay,
  type SimulateResponse,
  type WatchCreatePayload,
  type WatchEvent,
  type WatchStats,
  type WatchedItem,
} from "@/lib/watchlist-api";
import { useWishlistStore } from "@/store/useWishlistStore";

type WatchState = {
  watches: WatchedItem[];
  stats: WatchStats;
  currentDay: number;
  loading: boolean;
  simulating: boolean;
  fetchWatches: (userId: string) => Promise<void>;
  addWatch: (data: WatchCreatePayload, screenshot?: File | null) => Promise<WatchedItem>;
  removeWatch: (userId: string, watchId: string) => Promise<void>;
  simulateDay: (userId: string) => Promise<SimulateResponse>;
};

let seededDemoNotifications = false;

const emptyStats: WatchStats = {
  total_saved_inr: 0,
  total_co2_saved_kg: 0,
  count: 0,
  alerts: 0,
};

function publishEvents(events: WatchEvent[]) {
  const addNotification = useWishlistStore.getState().addNotification;
  events.forEach((event) => {
    addNotification({
      id: event.id,
      message: event.email_sent ? `${event.message} Email notification sent.` : event.message,
      source: "price_guardian",
    });
    toast.success(event.message, {
      description: event.email_sent ? "Email notification sent and added to the bell." : "Added to the notification bell.",
    });
  });
}

function upsertWatch(watches: WatchedItem[], watch: WatchedItem) {
  const existingIndex = watches.findIndex(
    (item) => item.watch_id === watch.watch_id || item.sku === watch.sku,
  );
  if (existingIndex === -1) return [watch, ...watches];
  const next = [...watches];
  next[existingIndex] = watch;
  return next;
}

async function seedDemoNotifications() {
  if (seededDemoNotifications) return;
  seededDemoNotifications = true;
  try {
    const events = await getDemoWatchEvents();
    const addNotification = useWishlistStore.getState().addNotification;
    events.forEach((event) => {
      addNotification({
        id: event.id,
        message: event.email_sent ? `${event.message} Email notification sent.` : event.message,
        source: "price_guardian",
      });
    });
  } catch (error) {
    seededDemoNotifications = false;
    console.error("Could not seed demo notifications", error);
  }
}

export const useWatchStore = create<WatchState>((set, get) => ({
  watches: [],
  stats: emptyStats,
  currentDay: 0,
  loading: false,
  simulating: false,
  fetchWatches: async (userId) => {
    set({ loading: true });
    try {
      const [watches, stats] = await Promise.all([getWatches(userId), getWatchStats(userId), seedDemoNotifications()]);
      set({ watches, stats });
    } finally {
      set({ loading: false });
    }
  },
  addWatch: async (data, screenshot) => {
    const payload = { ...data, user_id: data.user_id || "demo_user" };
    if (screenshot) {
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
      });
      form.append("competitor_screenshot", screenshot);
      const imageWatch = await createWatchWithImage(form);
      const stats = await getWatchStats(payload.user_id || "demo_user");
      set((state) => ({ watches: upsertWatch(state.watches, imageWatch), stats }));
      toast.success("Price Guardian is watching this item.");
      return imageWatch;
    }

    const watch = await createWatch(payload);
    const stats = await getWatchStats(payload.user_id || "demo_user");
    set((state) => ({ watches: upsertWatch(state.watches, watch), stats }));
    toast.success("Price Guardian is watching this item.");
    return watch;
  },
  removeWatch: async (userId, watchId) => {
    await removeWatch(userId, watchId);
    const stats = await getWatchStats(userId);
    set((state) => ({ watches: state.watches.filter((item) => item.watch_id !== watchId), stats }));
  },
  simulateDay: async (userId) => {
    set({ simulating: true });
    try {
      const result = await simulateNextDay(userId);
      publishEvents(result.events);
      const stats = await getWatchStats(userId);
      set({ watches: result.watches, currentDay: result.current_day, stats });
      if (result.events.length === 0) {
        toast.message("No new Price Guardian alerts today.");
      }
      return result;
    } finally {
      set({ simulating: false });
    }
  },
}));
