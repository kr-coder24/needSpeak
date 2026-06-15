import { create } from "zustand";

export type WishlistItem = {
  id: string;
  name: string;
  image_url?: string;
};

export type Notification = {
  id: string;
  message: string;
  read: boolean;
  time: number;
  source?: "wishlist" | "price_guardian";
};

const demoNotifications: Notification[] = [
  {
    id: "price-demo-best",
    message: "Sony WH-1000XM5 is at a 30-day low. Email notification sent.",
    read: false,
    time: Date.now() - 1000 * 60 * 8,
    source: "price_guardian",
  },
  {
    id: "price-demo-neighbor",
    message: "Philips Airfryer has a nearby neighbor deal with lower logistics cost.",
    read: false,
    time: Date.now() - 1000 * 60 * 23,
    source: "price_guardian",
  },
  {
    id: "price-demo-watch",
    message: "Acer monitor is being watched against Flipkart and Reliance Digital.",
    read: false,
    time: Date.now() - 1000 * 60 * 41,
    source: "price_guardian",
  },
];

type WishlistState = {
  wishlist: WishlistItem[];
  notifications: Notification[];
  addToWishlist: (item: WishlistItem) => void;
  addNotification: (notification: { id?: string; message: string; source?: Notification["source"] }) => void;
  simulateRestock: () => void;
  markAsRead: () => void;
};

export const useWishlistStore = create<WishlistState>((set) => ({
  wishlist: [],
  notifications: demoNotifications,
  addToWishlist: (item) =>
    set((state) => {
      if (state.wishlist.find((w) => w.id === item.id)) return state;
      return { wishlist: [...state.wishlist, item] };
    }),
  addNotification: (notification) =>
    set((state) => {
      const id = notification.id || Math.random().toString();
      if (state.notifications.some((existing) => existing.id === id)) return state;
      return {
        notifications: [
          {
            id,
            message: notification.message,
            read: false,
            time: Date.now(),
            source: notification.source || "wishlist",
          },
          ...state.notifications,
        ],
      };
    }),
  simulateRestock: () =>
    set((state) => {
      if (state.wishlist.length === 0) return state;
      const item = state.wishlist[0];
      const newNotification: Notification = {
        id: Math.random().toString(),
        message: `Great news! ${item.name} is back in stock.`,
        read: false,
        time: Date.now(),
        source: "wishlist",
      };
      return {
        wishlist: state.wishlist.slice(1),
        notifications: [newNotification, ...state.notifications],
      };
    }),
  markAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
}));
