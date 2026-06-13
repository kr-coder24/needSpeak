import { useEffect, useState, useRef, useCallback } from "react";
import { CollabSession, CollabCartItem } from "../lib/collab-api";
import { toast } from "sonner";

interface UseCollabWebSocketReturn {
  session: CollabSession | null;
  isConnected: boolean;
  error: string | null;
  sendMessage: (type: string, data: any) => void;
  addItems: (items: any[]) => void;
  removeItem: (itemId: string) => void;
  updateBudget: (newBudget: number) => void;
}

export function useCollabWebSocket(
  sessionId: string | undefined,
  contributorId: string | undefined
): UseCollabWebSocketReturn {
  const [session, setSession] = useState<CollabSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

  const connect = useCallback(() => {
    if (!sessionId || !contributorId) return;

    // Use ws:// for local development, wss:// for production
    const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    const wsUrl = `ws://${host}:8000/api/collab/${sessionId}/ws?contributor_id=${contributorId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      retryCount.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        switch (msg.type) {
          case "session_state":
            setSession(msg.data);
            break;
          case "contributor_joined":
          case "items_added":
          case "item_removed":
          case "budget_updated":
            if (msg.data.session) {
              setSession(msg.data.session);
            }
            break;
          case "items_unavailable":
            if (msg.data.unavailable_items && msg.data.unavailable_items.length > 0) {
              const names = msg.data.unavailable_items.map((i: any) => i.name).join(", ");
              toast.error(`Could not add items`, {
                description: `Not found in catalog or out of stock: ${names}`
              });
            }
            break;
          case "error":
            if (msg.data && msg.data.message) {
              toast.error("Error", { description: msg.data.message });
            }
            break;
          default:
            console.warn("Unknown message type:", msg.type);
        }
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    ws.onerror = () => {
      setError("WebSocket error occurred.");
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current += 1;
        setTimeout(() => {
          connect();
        }, Math.min(1000 * Math.pow(2, retryCount.current), 5000));
      } else {
        setError("Connection lost. Please refresh the page.");
      }
    };
  }, [sessionId, contributorId]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((type: string, data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    } else {
      console.error("Cannot send message, WS not connected.");
    }
  }, []);

  const addItems = useCallback(
    (items: any[]) => {
      sendMessage("add_items", { items });
    },
    [sendMessage]
  );

  const removeItem = useCallback(
    (itemId: string) => {
      sendMessage("remove_item", { item_id: itemId });
    },
    [sendMessage]
  );

  const updateBudget = useCallback(
    (newBudget: number) => {
      sendMessage("update_budget", { new_budget_inr: newBudget });
    },
    [sendMessage]
  );

  return { session, isConnected, error, sendMessage, addItems, removeItem, updateBudget };
}
