import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Package, Leaf, Truck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

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
  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "eco_merge">("standard");

  const carbonData = reservation?.metadata?.carbon_breakdown;
  const deliveryFee = 40;
  const ecoDiscount = 20;
  
  const finalTotal = reservation?.total_amount 
    ? reservation.total_amount + deliveryFee - (deliveryMethod === "eco_merge" ? ecoDiscount : 0)
    : 0;

  useEffect(() => {
    fetch(`/api/reservation/${reservationId}`)
      .then((res) => res.json())
      .then((data) => setReservation(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [reservationId]);

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
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
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
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    {item.name} × {item.qty}
                  </span>
                  <span className="font-semibold">₹{item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-4 flex justify-between text-sm">
              <span>Delivery Fee</span>
              <span>₹{deliveryFee.toFixed(2)}</span>
            </div>
            {deliveryMethod === "eco_merge" && (
              <div className="mt-2 flex justify-between text-sm text-green-600 font-medium">
                <span>Eco-Merge Discount</span>
                <span>-₹{ecoDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="mt-4 border-t border-border pt-4 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-brand">₹{finalTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Delivery Options */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold mb-4">
              <Truck className="h-5 w-5 text-brand" />
              Delivery Options
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Standard */}
              <button
                onClick={() => setDeliveryMethod("standard")}
                className={`relative flex flex-col items-start rounded-xl border-2 p-4 transition-all ${
                  deliveryMethod === "standard"
                    ? "border-brand bg-brand/5 shadow-md"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <div className="flex w-full justify-between items-center mb-1">
                  <span className="font-semibold">Standard Delivery</span>
                  {deliveryMethod === "standard" && <Check className="h-5 w-5 text-brand" />}
                </div>
                <span className="text-sm text-muted-foreground">Within 30 mins</span>
                <span className="mt-2 font-medium">₹{deliveryFee}</span>
              </button>

              {/* Eco-Merge */}
              <button
                onClick={() => setDeliveryMethod("eco_merge")}
                className={`relative flex flex-col items-start rounded-xl border-2 p-4 transition-all overflow-hidden ${
                  deliveryMethod === "eco_merge"
                    ? "border-green-500 bg-green-500/10 shadow-md ring-4 ring-green-500/20"
                    : "border-green-200 bg-card hover:border-green-300"
                }`}
              >
                {deliveryMethod === "eco_merge" && (
                  <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-green-500/20 blur-xl animate-pulse" />
                )}
                <div className="flex w-full justify-between items-center mb-1">
                  <span className="font-semibold text-green-700 flex items-center gap-1">
                    <Leaf className="h-4 w-4" /> Eco-Merge
                  </span>
                  {deliveryMethod === "eco_merge" && <Check className="h-5 w-5 text-green-600" />}
                </div>
                <span className="text-sm text-green-800/70">Batch with community</span>
                <span className="mt-2 font-medium text-green-600">₹{deliveryFee - ecoDiscount} (Save ₹{ecoDiscount})</span>
              </button>
            </div>

            {/* Carbon Offset Visualizer Badge */}
            {deliveryMethod === "eco_merge" && carbonData && (
              <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 p-4 border border-green-500/30 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                  <div className="flex items-start gap-3 relative z-10">
                    <div className="mt-1 rounded-full bg-green-500 p-2 shadow-lg shadow-green-500/30 animate-bounce">
                      <Leaf className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-green-900 tracking-tight">You're making a difference!</h3>
                      <p className="text-sm text-green-800 mt-1">
                        By batching your order with a neighbor's Community Bulk-Buy, you just saved <strong className="text-green-700 text-base">{carbonData.total_co2_kg}kg of CO₂ emissions</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                    Pay ₹{finalTotal.toFixed(2)}
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
