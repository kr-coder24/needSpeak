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
import { MOCK_WATCHES, MOCK_STATS } from "@/lib/watchlist-mock";

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
      let watches: WatchedItem[] = [];
      let stats: WatchStats = emptyStats;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const [w, s] = await Promise.all([
          getWatches(userId),
          getWatchStats(userId),
        ]);
        clearTimeout(timeout);
        watches = w;
        stats = s;
        seedDemoNotifications();
      } catch {
        // API unavailable or timed out — use mocks
      }
      if (!watches || watches.length === 0) {
        watches = MOCK_WATCHES;
        stats = MOCK_STATS;
        seedDemoNotifications();
      }
      set({ watches, stats, loading: false });
    } catch {
      set({ watches: MOCK_WATCHES, stats: MOCK_STATS, loading: false });
    }
  },
  addWatch: async (data, screenshot) => {
    const payload = { ...data, user_id: data.user_id || "demo_user" };
    try {
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
    } catch {
      // API failed — add locally with mock data for demo
      const mockWatch: WatchedItem = {
        watch_id: `local-${Date.now()}`,
        sku: payload.sku,
        name: payload.name,
        brand: payload.brand || "",
        current_price_inr: payload.current_price_inr,
        target_price_inr: payload.target_price_inr || Math.round(payload.current_price_inr * 0.85),
        competitor_price_inr: Math.round(payload.current_price_inr * 1.1),
        competitor_source: "Flipkart",
        status: "watching",
        created_at: new Date().toISOString(),
        price_history: Array.from({ length: 30 }, (_, i) => ({
          day: i + 1,
          price: Math.round(payload.current_price_inr * (0.95 + Math.random() * 0.1)),
        })),
        neighbor_match: null,
        co2_saved_kg: 0,
        logistics_saved_inr: 0,
        email: payload.email || "",
        email_sent: false,
        price_status: {
          status: "fair" as const,
          color_key: "yellow" as const,
          label: "Fair price",
          explanation: "Price is stable over the last 30 days.",
          confidence: 70,
          thirty_day_low_inr: Math.round(payload.current_price_inr * 0.9),
          thirty_day_high_inr: Math.round(payload.current_price_inr * 1.1),
          current_price_inr: payload.current_price_inr,
          deal_status: "fair" as const,
          deal_color: "yellow" as const,
          deal_label: "Fair price",
        },
      };
      set((state) => ({
        watches: upsertWatch(state.watches, mockWatch),
        stats: {
          ...state.stats,
          count: state.stats.count + 1,
        },
      }));
      toast.success("Price Guardian is watching this item.");
      return mockWatch;
    }
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
