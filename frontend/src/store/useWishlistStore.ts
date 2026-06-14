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
};

type WishlistState = {
  wishlist: WishlistItem[];
  notifications: Notification[];
  addToWishlist: (item: WishlistItem) => void;
  simulateRestock: () => void;
  markAsRead: () => void;
};

export const useWishlistStore = create<WishlistState>((set) => ({
  wishlist: [],
  notifications: [],
  addToWishlist: (item) =>
    set((state) => {
      if (state.wishlist.find((w) => w.id === item.id)) return state;
      return { wishlist: [...state.wishlist, item] };
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
