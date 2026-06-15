/**
 * Drop-in replacement for useCollabWebSocket — fully frontend (Option B).
 * Same return interface so the collab page UI works unchanged, but backed
 * by the persisted Zustand store. No backend, no WebSocket, no LLM.
 */

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  BudgetSplit,
  CollabSession,
  ProductSuggestion,
  SuggestedRequest,
} from "@/lib/collab-api";
import { useCollabStore } from "@/store/useCollabStore";

export interface CollabNotice {
  kind: "success" | "warning" | "error";
  message: string;
}

interface AddItemInput {
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  notes?: string;
}

interface UseCollabLocalReturn {
  session: CollabSession | null;
  splits: BudgetSplit[];
  suggestions: SuggestedRequest[];
  notice: CollabNotice | null;
  isConnected: boolean;
  error: string | null;
  addItems: (items: AddItemInput[]) => void;
  addSuggestion: (request: SuggestedRequest["request"], suggestion: ProductSuggestion) => void;
  dismissSuggestions: () => void;
  removeItem: (itemId: string) => void;
  updateBudget: (newBudget: number) => void;
  updateQuantity: (itemId: string, newQty: number) => void;
  acceptSubstitution: (itemId: string) => void;
  rejectSubstitution: (itemId: string) => void;
}

export function useCollabLocal(
  sessionId: string | undefined,
  contributorId: string | undefined,
): UseCollabLocalReturn {
  const sessions = useCollabStore((s) => s.sessions);
  const addItemsStore = useCollabStore((s) => s.addItems);
  const removeItemStore = useCollabStore((s) => s.removeItem);
  const updateBudgetStore = useCollabStore((s) => s.updateBudget);
  const updateQuantityStore = useCollabStore((s) => s.updateQuantity);
  const getSplits = useCollabStore((s) => s.getSplits);

  const [notice, setNotice] = useState<CollabNotice | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedRequest[]>([]);

  const session = (sessionId && sessions[sessionId]) || null;
  const splits = useMemo(
    () => (sessionId ? getSplits(sessionId) : []),
    // re-compute whenever the session object changes
    [sessionId, session, getSplits],
  );

  const error = sessionId && !session ? "This group cart does not exist on this device. Create one or join with a code." : null;

  const addItems = useCallback(
    (items: AddItemInput[]) => {
      if (!sessionId || !contributorId) return;
      setNotice(null);
      setSuggestions([]);
      const { merged, notFound } = addItemsStore(
        sessionId,
        contributorId,
        items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
      );
      if (merged) {
        setNotice({ kind: "success", message: "Demand resolved and merged into the live cart." });
      }
      if (notFound.length > 0) {
        setNotice({ kind: "error", message: `Product not found: ${notFound.join(", ")}` });
        toast.error("Product not found", { description: notFound.join(", ") });
      }
      // budget warning
      const s = useCollabStore.getState().sessions[sessionId];
      if (s && s.total_budget_inr > 0) {
        const total = s.items.reduce((sum, it) => sum + it.estimated_price_inr * it.quantity, 0);
        if (total > s.total_budget_inr) {
          const overage = total - s.total_budget_inr;
          setNotice({ kind: "warning", message: `Shared budget exceeded by Rs ${overage.toFixed(0)}.` });
          toast.warning(`Budget exceeded by Rs ${overage.toFixed(0)}`);
        }
      }
    },
    [sessionId, contributorId, addItemsStore],
  );

  const addSuggestion = useCallback(
    (request: SuggestedRequest["request"], suggestion: ProductSuggestion) => {
      addItems([{ name: suggestion.name, quantity: request.quantity, unit: request.unit, category: request.category }]);
    },
    [addItems],
  );

  const dismissSuggestions = useCallback(() => setSuggestions([]), []);

  const removeItem = useCallback(
    (itemId: string) => {
      if (sessionId && contributorId) removeItemStore(sessionId, itemId, contributorId);
    },
    [sessionId, contributorId, removeItemStore],
  );

  const updateBudget = useCallback(
    (newBudget: number) => {
      if (sessionId) updateBudgetStore(sessionId, newBudget);
    },
    [sessionId, updateBudgetStore],
  );

  const updateQuantity = useCallback(
    (itemId: string, newQty: number) => {
      if (sessionId && contributorId) updateQuantityStore(sessionId, itemId, contributorId, newQty);
    },
    [sessionId, contributorId, updateQuantityStore],
  );

  // Substitutions are a no-op stub in the frontend mock (kept for interface parity)
  const acceptSubstitution = useCallback(() => {
    toast.info("Substitution applied.");
  }, []);
  const rejectSubstitution = useCallback(() => {}, []);

  return {
    session,
    splits,
    suggestions,
    notice,
    isConnected: true, // always "connected" in local mode
    error,
    addItems,
    addSuggestion,
    dismissSuggestions,
    removeItem,
    updateBudget,
    updateQuantity,
    acceptSubstitution,
    rejectSubstitution,
  };
}
