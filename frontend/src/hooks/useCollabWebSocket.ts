import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  BudgetSplit,
  CollabSession,
  ProductSuggestion,
  SuggestedRequest,
} from "../lib/collab-api";

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

interface UseCollabWebSocketReturn {
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

export function useCollabWebSocket(
  sessionId: string | undefined,
  contributorId: string | undefined,
): UseCollabWebSocketReturn {
  const [session, setSession] = useState<CollabSession | null>(null);
  const [splits, setSplits] = useState<BudgetSplit[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedRequest[]>([]);
  const [notice, setNotice] = useState<CollabNotice | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnect = useRef(true);
  const maxRetries = 4;

  const applyState = useCallback((data: any) => {
    if (data?.session) setSession(data.session);
    if (Array.isArray(data?.splits)) setSplits(data.splits);
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !contributorId || typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/collab/${sessionId}/ws?contributor_id=${encodeURIComponent(contributorId)}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setError(null);
      retryCount.current = 0;
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "session_state":
            applyState(message.data);
            break;
          case "contributor_joined":
            applyState(message.data);
            setNotice({
              kind: "success",
              message: `${message.data.contributor?.name || "A contributor"} joined live.`,
            });
            break;
          case "items_added":
            applyState(message.data);
            setNotice({
              kind: "success",
              message: "Demand resolved and merged into the live cart.",
            });
            break;
          case "item_removed":
          case "budget_updated":
          case "quantity_updated":
          case "substitution_accepted":
          case "substitution_rejected":
            applyState(message.data);
            break;
          case "budget_warning":
            applyState(message.data);
            setNotice({
              kind: "warning",
              message: `Shared budget exceeded by Rs ${Number(message.data.overage).toFixed(0)}.`,
            });
            toast.warning(`Budget exceeded by Rs ${Number(message.data.overage).toFixed(0)}`);
            break;
          case "item_suggestions":
            setSuggestions(message.data.requests || []);
            setNotice({
              kind: "warning",
              message: "That exact product is not in the catalog. Pick a close match.",
            });
            break;
          case "items_not_found": {
            const names = (message.data.items || []).join(", ");
            const text = `Product not found: ${names}`;
            setNotice({ kind: "error", message: text });
            toast.error("Product not found", { description: names });
            break;
          }
          case "error":
            setNotice({ kind: "error", message: message.data.message });
            toast.error("Could not update cart", {
              description: message.data.message,
            });
            break;
          default:
            console.warn("Unknown collaboration message:", message.type);
        }
      } catch (messageError) {
        console.error("Could not parse collaboration message:", messageError);
      }
    };

    socket.onerror = () => {
      setError("The live connection hit an error.");
    };

    socket.onclose = () => {
      if (wsRef.current === socket) wsRef.current = null;
      setIsConnected(false);
      if (!shouldReconnect.current) return;
      if (retryCount.current < maxRetries) {
        retryCount.current += 1;
        reconnectTimer.current = setTimeout(connect, Math.min(750 * 2 ** retryCount.current, 5000));
      } else {
        setError("Live sync could not reconnect. Refresh the page to retry.");
      }
    };
  }, [applyState, contributorId, sessionId]);

  useEffect(() => {
    shouldReconnect.current = true;
    connect();
    return () => {
      shouldReconnect.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendMessage = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
      return;
    }
    setNotice({
      kind: "error",
      message: "Live sync is offline. Wait for reconnection before editing.",
    });
  }, []);

  const addItems = useCallback(
    (items: AddItemInput[]) => {
      setNotice(null);
      setSuggestions([]);
      sendMessage("add_items", {
        items: items.map((item) => ({
          ...item,
          category: item.category || "general",
          estimated_price_inr: 0,
        })),
      });
    },
    [sendMessage],
  );

  const addSuggestion = useCallback(
    (request: SuggestedRequest["request"], suggestion: ProductSuggestion) => {
      addItems([
        {
          name: suggestion.name,
          quantity: request.quantity,
          unit: request.unit,
          category: request.category,
          notes: `Suggested for ${request.name}`,
        },
      ]);
    },
    [addItems],
  );

  const dismissSuggestions = useCallback(() => setSuggestions([]), []);
  const removeItem = useCallback(
    (itemId: string) => sendMessage("remove_item", { item_id: itemId }),
    [sendMessage],
  );
  const updateBudget = useCallback(
    (newBudget: number) => sendMessage("update_budget", { new_budget_inr: newBudget }),
    [sendMessage],
  );
  const updateQuantity = useCallback(
    (itemId: string, newQty: number) =>
      sendMessage("update_quantity", { item_id: itemId, quantity: newQty }),
    [sendMessage],
  );
  const acceptSubstitution = useCallback(
    (itemId: string) => sendMessage("accept_substitution", { item_id: itemId }),
    [sendMessage],
  );
  const rejectSubstitution = useCallback(
    (itemId: string) => sendMessage("reject_substitution", { item_id: itemId }),
    [sendMessage],
  );

  return {
    session,
    splits,
    suggestions,
    notice,
    isConnected,
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
