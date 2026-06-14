import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Phase = "idle" | "thinking" | "cart";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatStore {
  phase: Phase;
  text: string;
  messages: ChatMessage[];
  cartData: any;
  errorMsg: string | null;
  budgetInput: string;
  quantities: Record<string, number>;
  removedKeys: string[];
  intentGroups: any[];

  // Actions
  setPhase: (phase: Phase) => void;
  setText: (text: string | ((prev: string) => string)) => void;
  setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  setCartData: (updater: any | ((prev: any) => any)) => void;
  setErrorMsg: (msg: string | null) => void;
  setBudgetInput: (val: string) => void;
  setQuantities: (updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  setRemovedKeys: (updater: string[] | ((prev: string[]) => string[])) => void;
  setIntentGroups: (updater: any[] | ((prev: any[]) => any[])) => void;

  clearStore: () => void;
}

const initialState = {
  phase: "idle" as Phase,
  text: "",
  messages: [
    {
      role: "assistant" as const,
      text: "Describe your occasion or paste a recipe, and I'll build a cart for you.",
    },
  ],
  cartData: null,
  errorMsg: null,
  budgetInput: "",
  quantities: {},
  removedKeys: [],
  intentGroups: [],
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      setPhase: (phase) => set({ phase }),
      setText: (text) => set({ text: typeof text === 'function' ? text(get().text) : text }),
      setMessages: (updater) => set({ messages: typeof updater === 'function' ? updater(get().messages) : updater }),
      setCartData: (updater) => set({ cartData: typeof updater === 'function' ? updater(get().cartData) : updater }),
      setErrorMsg: (errorMsg) => set({ errorMsg }),
      setBudgetInput: (budgetInput) => set({ budgetInput }),
      setQuantities: (updater) => set({ quantities: typeof updater === 'function' ? updater(get().quantities) : updater }),
      setRemovedKeys: (updater) => set({ removedKeys: typeof updater === 'function' ? updater(get().removedKeys) : updater }),
      setIntentGroups: (updater) => set({ intentGroups: typeof updater === 'function' ? updater(get().intentGroups) : updater }),
      clearStore: () => set({ ...initialState }),
    }),
    {
      name: 'needspeak-chat-store',
    }
  )
);
