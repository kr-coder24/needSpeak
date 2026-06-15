import { create } from "zustand";

export type PriceHistoryPoint = {
  date: string;
  price_inr: number;
};

export type PriceStatus = {
  status: "best" | "fair" | "high";
  color_key: "green" | "yellow" | "red";
  label: string;
  explanation: string;
  confidence: number;
  thirty_day_low_inr: number;
  thirty_day_high_inr: number;
  current_price_inr: number;
  deal_status?: string;
  deal_color?: string;
  deal_label?: string;
};

export type WatchlistItem = {
  id: string; // we map sku to id for compatibility
  sku: string;
  name: string;
  brand?: string;
  current_price_inr: number;
  target_price_inr?: number;
  price_history?: PriceHistoryPoint[];
  price_status?: PriceStatus;
  image_url?: string;
};

export type Notification = {
  id: string;
  message: string;
  read: boolean;
  time: number;
};

type WishlistState = {
  wishlist: WatchlistItem[];
  notifications: Notification[];
  fetchWishlist: (userId: string) => Promise<void>;
  addToWishlist: (userId: string, item: Partial<WatchlistItem> & { id: string, name: string, current_price_inr: number }) => Promise<void>;
  simulateRestock: (userId: string) => Promise<void>;
  markAsRead: () => void;
};

export const useWishlistStore = create<WishlistState>((set, get) => ({
  wishlist: [],
  notifications: [],
  fetchWishlist: async (userId: string) => {
    try {
      const res = await fetch(`/api/watchlist/${userId}`);
      if (res.ok) {
        const data = await res.json();
        // Map backend 'sku' back to 'id' for the frontend compatibility
        const mapped = data.map((d: any) => ({
          ...d,
          id: d.sku
        }));
        set({ wishlist: mapped });
      }
    } catch (e) {
      console.error("Failed to fetch watchlist", e);
    }
  },
  addToWishlist: async (userId: string, item) => {
    try {
      const res = await fetch(`/api/watchlist/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: item.id,
          name: item.name,
          current_price_inr: item.current_price_inr,
          brand: item.brand,
          target_price_inr: item.target_price_inr
        })
      });
      if (res.ok) {
        const data = await res.json();
        data.id = data.sku;
        set((state) => {
          const exists = state.wishlist.some(w => w.id === data.id);
          if (exists) {
            return { wishlist: state.wishlist.map(w => w.id === data.id ? data : w) };
          }
          return { wishlist: [data, ...state.wishlist] };
        });
      }
    } catch (e) {
      console.error("Failed to add to watchlist", e);
    }
  },
  simulateRestock: async (userId: string) => {
    try {
      const res = await fetch(`/api/watchlist/demo-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });
      if (res.ok) {
        const data = await res.json();
        const events = data.events || [];
        
        // Refresh the watchlist to get new prices
        await get().fetchWishlist(userId);
        
        set((state) => {
          const newNotifications = events.map((evt: any) => ({
            id: evt.id,
            message: `Alert: ${evt.name} dropped to ₹${evt.new_price}!`,
            read: false,
            time: Date.now()
          }));
          
          // Dedup notifications by id
          const existingIds = new Set(state.notifications.map(n => n.id));
          const filteredNew = newNotifications.filter((n: any) => !existingIds.has(n.id));
          
          return {
            notifications: [...filteredNew, ...state.notifications]
          };
        });
      }
    } catch (e) {
      console.error("Failed to simulate restock", e);
    }
  },
  markAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
}));
