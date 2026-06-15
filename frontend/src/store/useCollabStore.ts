/**
 * Frontend-only collaborative cart store (Option B — bulletproof demo).
 *
 * No backend, no WebSocket, no LLM. Everything runs client-side and persists
 * to localStorage. Two users are simulated via a contributor switcher in the UI.
 *
 * Mirrors the CollabSession / CollabCartItem / BudgetSplit shapes from
 * collab-api.ts so the existing collab page UI renders unchanged.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CollabSession,
  CollabCartItem,
  CollabDemand,
  Contributor,
  BudgetSplit,
} from "@/lib/collab-api";

// ---------------------------------------------------------------------------
// Local catalog matcher (instant, no LLM)
// ---------------------------------------------------------------------------

interface CatalogProduct {
  sku: string;
  name: string;
  brand: string;
  price_per_unit_inr: number;
  unit: string;
  unit_quantity: number;
  category: string;
  carbon_per_unit_kg: number;
}

const LOCAL_CATALOG: Record<string, CatalogProduct> = {
  milk: { sku: "DRY-MILK", name: "Amul Gold Full Cream Milk", brand: "Amul", price_per_unit_inr: 72, unit: "ml", unit_quantity: 1000, category: "dairy", carbon_per_unit_kg: 0.18 },
  bread: { sku: "BAK-BREAD", name: "Britannia Whole Wheat Bread", brand: "Britannia", price_per_unit_inr: 50, unit: "g", unit_quantity: 400, category: "bakery", carbon_per_unit_kg: 0.12 },
  buns: { sku: "BAK-BUNS", name: "Burger Buns (Pack of 6)", brand: "Britannia", price_per_unit_inr: 45, unit: "pack", unit_quantity: 6, category: "bakery", carbon_per_unit_kg: 0.14 },
  "burger buns": { sku: "BAK-BUNS", name: "Burger Buns (Pack of 6)", brand: "Britannia", price_per_unit_inr: 45, unit: "pack", unit_quantity: 6, category: "bakery", carbon_per_unit_kg: 0.14 },
  eggs: { sku: "NV-EGGS", name: "Farm Fresh Eggs (Pack of 12)", brand: "Fresh Farm", price_per_unit_inr: 84, unit: "piece", unit_quantity: 12, category: "non_veg", carbon_per_unit_kg: 0.45 },
  paneer: { sku: "DRY-PANEER", name: "Amul Fresh Paneer", brand: "Amul", price_per_unit_inr: 90, unit: "g", unit_quantity: 200, category: "dairy", carbon_per_unit_kg: 0.32 },
  butter: { sku: "DRY-BUTTER", name: "Amul Butter", brand: "Amul", price_per_unit_inr: 56, unit: "g", unit_quantity: 100, category: "dairy", carbon_per_unit_kg: 0.21 },
  rice: { sku: "GRN-RICE", name: "India Gate Basmati Rice", brand: "India Gate", price_per_unit_inr: 189, unit: "g", unit_quantity: 1000, category: "grains", carbon_per_unit_kg: 0.55 },
  atta: { sku: "GRN-ATTA", name: "Aashirvaad Whole Wheat Atta", brand: "Aashirvaad", price_per_unit_inr: 269, unit: "g", unit_quantity: 5000, category: "grains", carbon_per_unit_kg: 0.6 },
  chips: { sku: "SNK-CHIPS", name: "Lays Classic Salted Chips", brand: "Lays", price_per_unit_inr: 20, unit: "g", unit_quantity: 52, category: "snacks", carbon_per_unit_kg: 0.08 },
  coke: { sku: "BEV-COKE", name: "Coca-Cola 2L PET Bottle", brand: "Coca-Cola", price_per_unit_inr: 95, unit: "ml", unit_quantity: 2000, category: "beverages", carbon_per_unit_kg: 0.25 },
  cola: { sku: "BEV-COKE", name: "Coca-Cola 2L PET Bottle", brand: "Coca-Cola", price_per_unit_inr: 95, unit: "ml", unit_quantity: 2000, category: "beverages", carbon_per_unit_kg: 0.25 },
  pepsi: { sku: "BEV-PEPSI", name: "Pepsi 2L PET Bottle", brand: "Pepsi", price_per_unit_inr: 90, unit: "ml", unit_quantity: 2000, category: "beverages", carbon_per_unit_kg: 0.25 },
  juice: { sku: "BEV-JUICE", name: "Real Mixed Fruit Juice", brand: "Real", price_per_unit_inr: 99, unit: "ml", unit_quantity: 1000, category: "beverages", carbon_per_unit_kg: 0.2 },
  water: { sku: "BEV-WATER", name: "Bisleri Mineral Water 1L", brand: "Bisleri", price_per_unit_inr: 20, unit: "ml", unit_quantity: 1000, category: "beverages", carbon_per_unit_kg: 0.05 },
  namkeen: { sku: "SNK-BHUJIA", name: "Haldiram Aloo Bhujia", brand: "Haldiram", price_per_unit_inr: 85, unit: "g", unit_quantity: 400, category: "snacks", carbon_per_unit_kg: 0.1 },
  maggi: { sku: "SNK-MAGGI", name: "Maggi 2-Minute Noodles (4-pack)", brand: "Maggi", price_per_unit_inr: 52, unit: "g", unit_quantity: 280, category: "snacks", carbon_per_unit_kg: 0.15 },
  biscuits: { sku: "SNK-PARLEG", name: "Parle-G Biscuits", brand: "Parle", price_per_unit_inr: 10, unit: "g", unit_quantity: 79, category: "snacks", carbon_per_unit_kg: 0.06 },
  chocolate: { sku: "SNK-CADBURY", name: "Cadbury Dairy Milk", brand: "Cadbury", price_per_unit_inr: 40, unit: "g", unit_quantity: 50, category: "snacks", carbon_per_unit_kg: 0.12 },
  oil: { sku: "OIL-SUNFLOWER", name: "Fortune Sunflower Oil 1L", brand: "Fortune", price_per_unit_inr: 185, unit: "ml", unit_quantity: 1000, category: "oils", carbon_per_unit_kg: 0.4 },
  sugar: { sku: "GRN-SUGAR", name: "Sugar 1kg", brand: "Local", price_per_unit_inr: 45, unit: "g", unit_quantity: 1000, category: "grains", carbon_per_unit_kg: 0.3 },
  salt: { sku: "SPC-SALT", name: "Tata Salt", brand: "Tata", price_per_unit_inr: 20, unit: "g", unit_quantity: 1000, category: "spices", carbon_per_unit_kg: 0.05 },
  curd: { sku: "DRY-CURD", name: "Mother Dairy Dahi", brand: "Mother Dairy", price_per_unit_inr: 45, unit: "ml", unit_quantity: 400, category: "dairy", carbon_per_unit_kg: 0.18 },
  chicken: { sku: "NV-CHICKEN", name: "Fresh Chicken Breast 500g", brand: "Fresh Farm", price_per_unit_inr: 280, unit: "g", unit_quantity: 500, category: "non_veg", carbon_per_unit_kg: 1.2 },
  tomato: { sku: "VEG-TOMATO", name: "Fresh Tomato 1kg", brand: "Local Farm", price_per_unit_inr: 40, unit: "g", unit_quantity: 1000, category: "vegetables", carbon_per_unit_kg: 0.09 },
  onion: { sku: "VEG-ONION", name: "Fresh Onion 1kg", brand: "Local Farm", price_per_unit_inr: 35, unit: "g", unit_quantity: 1000, category: "vegetables", carbon_per_unit_kg: 0.09 },
  potato: { sku: "VEG-POTATO", name: "Fresh Potato 1kg", brand: "Local Farm", price_per_unit_inr: 30, unit: "g", unit_quantity: 1000, category: "vegetables", carbon_per_unit_kg: 0.09 },
};

const UNIT_TO_BASE: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
  piece: { base: "piece", factor: 1 },
  pack: { base: "pack", factor: 1 },
};

function matchProduct(name: string): CatalogProduct | null {
  const key = name.trim().toLowerCase();
  if (LOCAL_CATALOG[key]) return LOCAL_CATALOG[key];
  // partial match
  for (const [k, product] of Object.entries(LOCAL_CATALOG)) {
    if (key.includes(k) || k.includes(key)) return product;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomCode(len = 6): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function toBaseAmount(quantity: number, unit: string): { amount: number; base: string } {
  const conv = UNIT_TO_BASE[unit] || { base: unit, factor: 1 };
  return { amount: quantity * conv.factor, base: conv.base };
}

function recalcItem(item: CollabCartItem): void {
  // Sum compatible base amounts; compute package count
  const compatible = item.demands.map((d) => {
    const conv = UNIT_TO_BASE[d.requested_unit] || { base: d.requested_unit, factor: 1 };
    return { amount: d.requested_quantity * conv.factor, base: conv.base };
  });
  const itemBase = (UNIT_TO_BASE[item.unit]?.base) || item.unit;
  const allCompatible = compatible.every((c) => c.base === itemBase || (c.base === "g" && itemBase === "ml") || (c.base === "ml" && itemBase === "g"));

  let standaloneUnits = 0;
  for (const d of item.demands) standaloneUnits += d.standalone_quantity_units;

  if (allCompatible && compatible.length > 0) {
    const totalNeeded = compatible.reduce((s, c) => s + c.amount, 0);
    item.quantity = Math.max(1, Math.ceil(totalNeeded / item.unit_quantity));
  } else {
    item.quantity = Math.max(1, standaloneUnits);
  }
  item.merge_savings_inr = Math.max(0, (standaloneUnits - item.quantity) * item.estimated_price_inr);
  item.matched_from = item.demands.map(
    (d) => `${d.contributor_name}: ${d.requested_quantity} ${d.requested_unit} ${d.requested_name}`,
  );
  item.carbon_co2_kg = item.quantity * (item as any)._carbon_per_unit || item.carbon_co2_kg;
}

function computeSplits(session: CollabSession): BudgetSplit[] {
  const active = session.contributors.filter((c) => c.status === "active");
  if (active.length === 0) return [];

  const total = session.items.reduce((s, it) => s + it.estimated_price_inr * it.quantity, 0);
  const equalShare = total / active.length;
  const owed: Record<string, number> = {};
  const saved: Record<string, number> = {};
  active.forEach((c) => { owed[c.id] = 0; saved[c.id] = 0; });

  for (const item of session.items) {
    const itemTotal = item.estimated_price_inr * item.quantity;
    const weights = item.demands.map((d) => ({ id: d.contributor_id, w: d.standalone_quantity_units }));
    const totalW = weights.reduce((s, x) => s + x.w, 0);
    if (totalW <= 0) continue;
    for (const { id, w } of weights) {
      if (owed[id] === undefined) continue;
      const share = w / totalW;
      owed[id] += itemTotal * share;
      saved[id] += item.merge_savings_inr * share;
    }
  }

  return active.map((c) => ({
    contributor_id: c.id,
    name: c.name,
    items_added: session.items.filter((it) => it.demands.some((d) => d.contributor_id === c.id)).length,
    amount_spent: owed[c.id],
    fair_share: equalShare,
    owes: owed[c.id],
    amount_owed: owed[c.id],
    percent_of_total: total ? (owed[c.id] / total) * 100 : 0,
    merge_savings_inr: saved[c.id],
  }));
}

function refreshCarbon(session: CollabSession): void {
  session.carbon_score_kg = session.items.reduce((s, it) => s + (it.carbon_co2_kg || 0), 0);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface CollabStoreState {
  sessions: Record<string, CollabSession>;
  codeToSession: Record<string, string>;

  createSession: (name: string, hostName: string, budget: number, communityCode?: string, communityName?: string) => { session: CollabSession; contributor: Contributor };
  joinSession: (sessionId: string, name: string) => Contributor | null;
  resolveCode: (code: string) => string | null;
  getSession: (sessionId: string) => CollabSession | null;
  getSplits: (sessionId: string) => BudgetSplit[];

  addItems: (sessionId: string, contributorId: string, items: { name: string; quantity: number; unit: string }[]) => { merged: boolean; notFound: string[] };
  removeItem: (sessionId: string, itemId: string, contributorId: string) => void;
  updateBudget: (sessionId: string, newBudget: number) => void;
  updateQuantity: (sessionId: string, itemId: string, contributorId: string, qty: number) => void;
}

export const useCollabStore = create<CollabStoreState>()(
  persist(
    (set, get) => ({
      sessions: {},
      codeToSession: {},

      createSession: (name, hostName, budget, communityCode = "", communityName = "") => {
        const sessionId = uuid();
        const code = randomCode();
        const host: Contributor = {
          id: uuid(),
          name: hostName,
          role: "host",
          status: "active",
          joined_at: new Date().toISOString(),
          items_added: 0,
          budget_contribution_inr: 0,
        };
        const session: CollabSession = {
          session_id: sessionId,
          name,
          created_at: new Date().toISOString(),
          host_id: host.id,
          host_name: hostName,
          total_budget_inr: budget,
          contributors: [host],
          items: [],
          share_code: code,
          community_code: communityCode,
          community_name: communityName,
          carbon_score_kg: 0,
          is_active: true,
        };
        set((s) => ({
          sessions: { ...s.sessions, [sessionId]: session },
          codeToSession: { ...s.codeToSession, [code]: sessionId },
        }));
        return { session, contributor: host };
      },

      joinSession: (sessionId, name) => {
        const session = get().sessions[sessionId];
        if (!session) return null;
        // Reuse existing contributor with same name (re-join)
        const existing = session.contributors.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.status = "active";
          set((s) => ({ sessions: { ...s.sessions, [sessionId]: { ...session } } }));
          return existing;
        }
        const contributor: Contributor = {
          id: uuid(),
          name,
          role: "contributor",
          status: "active",
          joined_at: new Date().toISOString(),
          items_added: 0,
          budget_contribution_inr: 0,
        };
        session.contributors.push(contributor);
        set((s) => ({ sessions: { ...s.sessions, [sessionId]: { ...session } } }));
        return contributor;
      },

      resolveCode: (code) => get().codeToSession[code.toUpperCase()] || null,

      getSession: (sessionId) => get().sessions[sessionId] || null,

      getSplits: (sessionId) => {
        const session = get().sessions[sessionId];
        return session ? computeSplits(session) : [];
      },

      addItems: (sessionId, contributorId, items) => {
        const session = get().sessions[sessionId];
        if (!session) return { merged: false, notFound: [] };
        const contributor = session.contributors.find((c) => c.id === contributorId);
        if (!contributor) return { merged: false, notFound: [] };

        const notFound: string[] = [];
        let merged = false;

        for (const input of items) {
          const product = matchProduct(input.name);
          if (!product) {
            notFound.push(input.name);
            continue;
          }
          const base = toBaseAmount(input.quantity, input.unit);
          // standalone units this person would buy alone
          const standalone = Math.max(1, Math.ceil(base.amount / product.unit_quantity));

          const demand: CollabDemand = {
            contributor_id: contributorId,
            contributor_name: contributor.name,
            requested_name: input.name,
            requested_quantity: input.quantity,
            requested_unit: input.unit,
            requested_base_amount: base.amount,
            requested_base_unit: base.base,
            standalone_quantity_units: standalone,
          };

          const existing = session.items.find((it) => it.sku === product.sku);
          if (existing) {
            const sameContrib = existing.demands.find(
              (d) => d.contributor_id === contributorId && d.requested_unit === input.unit,
            );
            if (sameContrib) {
              sameContrib.requested_quantity += input.quantity;
              sameContrib.requested_base_amount += base.amount;
              sameContrib.standalone_quantity_units += standalone;
            } else {
              existing.demands.push(demand);
            }
            recalcItem(existing);
          } else {
            const newItem: CollabCartItem = {
              id: uuid(),
              sku: product.sku,
              name: product.name,
              brand: product.brand,
              quantity: 1,
              unit: product.unit,
              unit_quantity: product.unit_quantity,
              category: product.category,
              estimated_price_inr: product.price_per_unit_inr,
              added_by: contributorId,
              added_by_name: contributor.name,
              matched_from: [],
              demands: [demand],
              merge_savings_inr: 0,
              carbon_co2_kg: 0,
              carbon_origin: "Regional DC",
            };
            (newItem as any)._carbon_per_unit = product.carbon_per_unit_kg;
            recalcItem(newItem);
            newItem.carbon_co2_kg = newItem.quantity * product.carbon_per_unit_kg;
            session.items.push(newItem);
          }
          merged = true;
        }

        // recompute contributor stats + carbon
        refreshCarbon(session);
        const splits = computeSplits(session);
        session.contributors.forEach((c) => {
          c.items_added = session.items.filter((it) => it.demands.some((d) => d.contributor_id === c.id)).length;
          const sp = splits.find((s) => s.contributor_id === c.id);
          c.budget_contribution_inr = sp ? sp.amount_owed : 0;
        });

        set((s) => ({ sessions: { ...s.sessions, [sessionId]: { ...session } } }));
        return { merged, notFound };
      },

      removeItem: (sessionId, itemId, contributorId) => {
        const session = get().sessions[sessionId];
        if (!session) return;
        const item = session.items.find((it) => it.id === itemId);
        if (!item) return;
        const own = item.demands.filter((d) => d.contributor_id === contributorId);
        if (own.length > 0) {
          item.demands = item.demands.filter((d) => d.contributor_id !== contributorId);
          if (item.demands.length > 0) recalcItem(item);
          else session.items = session.items.filter((it) => it.id !== itemId);
        } else if (session.host_id === contributorId) {
          session.items = session.items.filter((it) => it.id !== itemId);
        }
        refreshCarbon(session);
        set((s) => ({ sessions: { ...s.sessions, [sessionId]: { ...session } } }));
      },

      updateBudget: (sessionId, newBudget) => {
        const session = get().sessions[sessionId];
        if (!session) return;
        session.total_budget_inr = newBudget;
        set((s) => ({ sessions: { ...s.sessions, [sessionId]: { ...session } } }));
      },

      updateQuantity: (sessionId, itemId, contributorId, qty) => {
        const session = get().sessions[sessionId];
        if (!session || qty <= 0) return;
        const item = session.items.find((it) => it.id === itemId);
        if (!item) return;
        const demand = item.demands.find((d) => d.contributor_id === contributorId);
        if (!demand) return;
        const ratio = qty / demand.requested_quantity;
        demand.requested_quantity = qty;
        demand.requested_base_amount *= ratio;
        demand.standalone_quantity_units = Math.max(1, Math.ceil(demand.requested_base_amount / item.unit_quantity));
        recalcItem(item);
        refreshCarbon(session);
        set((s) => ({ sessions: { ...s.sessions, [sessionId]: { ...session } } }));
      },
    }),
    { name: "needspeak-collab-store" },
  ),
);
