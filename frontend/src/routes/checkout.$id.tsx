import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Package } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DealStatusPill } from "@/components/common/DealStatusIndicator";
import { getPriceStatusBatch, type PriceStatus } from "@/lib/watchlist-api";

export const Route = createFileRoute("/checkout/$id")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { id: reservationId } = Route.useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [priceStatuses, setPriceStatuses] = useState<Record<string, PriceStatus>>({});

  useEffect(() => {
    fetch(`/api/reservation/${reservationId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Reservation fetch failed");
        return res.json();
      })
      .then((data) => {
        if (!data || !data.reserved_items) throw new Error("Invalid reservation data");
        setReservation(data);
      })
      .catch((err) => {
        console.error("Using simulated reservation data:", err);
        
        let localItems = [];
        try {
          const stored = localStorage.getItem(`checkout_items_${reservationId}`);
          if (stored) {
            localItems = JSON.parse(stored);
          }
        } catch(e) {}

        if (localItems && localItems.length > 0) {
          const totalAmount = localItems.reduce((acc: number, item: any) => acc + (item.total_price_inr || item.total || 0), 0);
          setReservation({
            id: reservationId,
            reserved_items: localItems.map((item: any) => ({
              name: item.name || item.sku || "Item",
              qty: item.quantity_units || item.qty || 1,
              total: item.total_price_inr || item.total || 0,
              sku: item.sku || ""
            })),
            total_amount: totalAmount,
          });
        } else {
          // Simulated fallback for demo purposes if nothing is in local storage
          setReservation({
            id: reservationId,
            reserved_items: [
              { name: "Simulated Watch", qty: 1, total: 2999, sku: "sim-1" },
              { name: "Demo AirPods", qty: 2, total: 4000, sku: "sim-2" },
            ],
            total_amount: 6999,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [reservationId]);

  useEffect(() => {
    const items = (reservation?.reserved_items || [])
      .map((item: any) => ({
        sku: String(item.sku || item.name || ""),
        current_price_inr: Number(item.price_per_unit || item.total || 0),
      }))
      .filter((item: any) => item.sku && item.current_price_inr > 0);

    if (items.length === 0) return;

    let cancelled = false;
    getPriceStatusBatch("demo_user", items)
      .then((result) => {
        if (!cancelled) {
          setPriceStatuses(Object.fromEntries(result.items.map((item) => [item.sku, item.price_status])));
        }
      })
      .catch((error) => console.error("Could not load checkout Price Guardian dots", error));

    return () => {
      cancelled = true;
    };
  }, [reservation]);

  const handlePayment = async () => {
    if (!customerEmail.trim()) {
      alert("Please enter your email");
      return;
    }

    setProcessing(true);
    try {
      // Micro-delay for secure initiation experience
      await new Promise((r) => setTimeout(r, 600));
      // Navigate to the demo payment completion page
      navigate({ to: "/payment/$id", params: { id: reservationId } });
    } catch (err) {
      console.error("Payment error:", err);
      alert("Failed to initiate payment. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
        </div>
      </AppShell>
    );
  }

  if (!reservation) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold">Reservation not found</p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="rounded-xl bg-foreground px-4 py-2 text-background font-semibold"
          >
            Go Home
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <p className="mt-2 text-muted-foreground">Complete your order</p>

        <div className="mt-8 space-y-6">
          {/* Order Summary */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Package className="h-5 w-5 text-brand" />
              Order Summary
            </h2>
            <div className="mt-4 space-y-3">
              {reservation.reserved_items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>
                      {item.name} × {item.qty}
                    </span>
                    {priceStatuses[item.sku || item.name] && (
                      <DealStatusPill status={priceStatuses[item.sku || item.name]} />
                    )}
                  </div>
                  <span className="font-semibold">₹{item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-4 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-brand">₹{reservation.total_amount.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Form */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CreditCard className="h-5 w-5 text-brand" />
              Payment Details
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  required
                />
              </div>

              <button
                onClick={handlePayment}
                disabled={processing || !customerEmail.trim()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 shadow-md shadow-brand/20"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Pay ₹{reservation.total_amount.toFixed(2)}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Expires notice */}
          <p className="text-center text-xs font-medium text-muted-foreground">
            Reservation expires at {new Date(reservation.expires_at).toLocaleString()}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
