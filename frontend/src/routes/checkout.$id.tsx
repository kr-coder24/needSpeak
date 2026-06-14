import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Package } from "lucide-react";
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
      // Step 1: Create payment intent
      const intentRes = await fetch("/api/payment/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId, customer_email: customerEmail }),
      });

      const intentData = await intentRes.json();
      
      // Step 2: For Razorpay, open payment modal
      if ((window as any).Razorpay) {
        const options = {
          key: "YOUR_RAZORPAY_KEY_ID", // TODO: Get from env or backend
          amount: intentData.amount * 100,
          currency: intentData.currency,
          order_id: intentData.client_secret,
          name: "NeedSpeak",
          description: "Smart Shopping Cart",
          handler: async (response: any) => {
            // Payment successful
            await fetch("/api/payment/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reservation_id: reservationId,
                payment_id: response.razorpay_payment_id,
              }),
            });

            // Navigate to confirmation
            navigate({ to: "/order-confirmed", search: { reservation: reservationId } });
          },
          prefill: { email: customerEmail },
          theme: { color: "#6366f1" },
        };

        const razorpay = new ((window as any).Razorpay)(options);
        razorpay.open();
      } else {
        alert("Payment gateway not loaded. Please refresh.");
      }
    } catch (err) {
      console.error("Payment error:", err);
      alert("Payment failed. Please try again.");
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
