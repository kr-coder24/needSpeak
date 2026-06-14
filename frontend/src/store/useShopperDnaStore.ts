import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BudgetFingerprintResult, FingerprintTrait } from "@/lib/budget-fingerprint";

export interface ShopperDnaState {
  /** Last computed fingerprint (from most recent cart) */
  currentFingerprint: BudgetFingerprintResult | null;
  /** Rolling history of archetypes (last 10 sessions) */
  archetypeHistory: string[];
  /** Cumulative trait occurrence counts */
  traitCounts: Record<string, number>;
  /** Number of carts analyzed */
  totalSessions: number;
  /** Timestamp of last update */
  lastUpdated: string;
  /** Top recurring traits across sessions (derived) */
  topTraits: FingerprintTrait[];

  // Actions
  updateFingerprint: (fingerprint: BudgetFingerprintResult, userId?: string) => void;
  /** Hydrate from backend (called on login when AWS mode is active) */
  hydrateFromBackend: (userId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  currentFingerprint: null as BudgetFingerprintResult | null,
  archetypeHistory: [] as string[],
  traitCounts: {} as Record<string, number>,
  totalSessions: 0,
  lastUpdated: "",
  topTraits: [] as FingerprintTrait[],
};

/**
 * Sync the current store state to the backend (fire-and-forget).
 * Works in both AWS and mock mode — backend handles the routing.
 */
async function syncToBackend(state: ShopperDnaState, userId: string): Promise<void> {
  try {
    await fetch("/api/shopper-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        archetype_history: state.archetypeHistory,
        trait_counts: state.traitCounts,
        total_sessions: state.totalSessions,
        top_traits: state.topTraits,
        current_fingerprint: state.currentFingerprint,
      }),
    });
  } catch {
    // Silently fail — localStorage is the primary source in non-AWS mode
  }
}

export const useShopperDnaStore = create<ShopperDnaState>()(
  persist(
    (set, get) => ({
      ...initialState,

      updateFingerprint: (fingerprint: BudgetFingerprintResult, userId?: string) => {
        const state = get();

        // Update archetype history (keep last 10)
        const newHistory = [...state.archetypeHistory, fingerprint.archetype].slice(-10);

        // Accumulate trait counts
        const newTraitCounts = { ...state.traitCounts };
        for (const trait of fingerprint.traits) {
          newTraitCounts[trait.label] = (newTraitCounts[trait.label] || 0) + 1;
        }

        // Derive top traits (sorted by frequency)
        const topTraits = Object.entries(newTraitCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([label, count]) => {
            const match = fingerprint.traits.find((t) => t.label === label);
            return {
              label,
              emoji: match?.emoji || "📊",
              description: match?.description || `Seen ${count} times`,
              confidence: Math.min(1, count / (state.totalSessions + 1)),
            };
          });

        const newState = {
          currentFingerprint: fingerprint,
          archetypeHistory: newHistory,
          traitCounts: newTraitCounts,
          totalSessions: state.totalSessions + 1,
          lastUpdated: new Date().toISOString(),
          topTraits,
        };

        set(newState);

        // If user is logged in, also persist to backend (DynamoDB in AWS mode, in-memory in mock)
        if (userId) {
          syncToBackend({ ...get(), ...newState } as ShopperDnaState, userId);
        }
      },

      hydrateFromBackend: async (userId: string) => {
        try {
          const res = await fetch(`/api/shopper-profile/${userId}`);
          if (!res.ok) return;
          const data = await res.json();
          if (!data || !data.total_sessions) return;

          const localState = get();
          // Only hydrate if backend has more data than local (e.g., new device)
          if (data.total_sessions > localState.totalSessions) {
            set({
              archetypeHistory: data.archetype_history || [],
              traitCounts: data.trait_counts || {},
              totalSessions: data.total_sessions || 0,
              topTraits: data.top_traits || [],
              currentFingerprint: data.current_fingerprint || null,
              lastUpdated: data.last_updated_at || "",
            });
          }
        } catch {
          // Backend unavailable — rely on local Zustand persist
        }
      },

      reset: () => set({ ...initialState }),
    }),
    {
      name: "needspeak-shopper-dna",
    },
  ),
);
