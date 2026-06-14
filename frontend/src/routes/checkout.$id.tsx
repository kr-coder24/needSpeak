import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Check,
  CreditCard,
  ArrowLeft,
  Truck,
  Lock,
  CheckCircle2,
  Wallet,
  ShoppingBag,
  Loader2,
  ShieldCheck,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/$id")({
  head: () => ({
    meta: [
      { title: "Checkout — NeedSpeak" },
      {
        name: "description",
        content: "Secure checkout for your context-aware cart.",
      },
    ],
  }),
  component: CheckoutPage,
});

type CheckoutStep = "details" | "processing" | "success";

function CheckoutPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Checkout states
  const [step, setStep] = useState<CheckoutStep>("details");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "cod">("upi");
  const [upiProvider, setUpiProvider] = useState<"gpay" | "phonepe" | "paytm" | "other">("gpay");
  const [upiId, setUpiId] = useState("johndoe@okaxis");
  const [cancelling, setCancelling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Prefilled details for demo
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john.doe@example.com");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [address, setAddress] = useState("Flat 402, Sunset Heights, HSR Layout");
  const [city, setCity] = useState("Bangalore");
  const [pincode, setPincode] = useState("560102");

  // Retrieve actual session id
  const sessionId = id.startsWith("res_") ? id.slice(4) : id;

  // Load session from backend
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/session/${sessionId}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Session not found" : `Error ${res.status}`);
        }
        const data = await res.json();
        setSession(data);
      } catch (e: any) {
        setError(e.message || "Failed to load order items");
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  const cartItems = session
    ? (session.resolved_intents ?? []).flatMap((g: any) => g.cart ?? []) ||
      session.cart_items ||
      session.cart ||
      []
    : [];

  const total = session
    ? session.total_price_inr ||
      cartItems.reduce((s: number, it: any) => s + (it.total_price_inr || 0), 0)
    : 0;

  const itemsToCommit = cartItems
    .filter((i: any) => i.sku)
    .map((i: any) => ({
      sku: i.sku,
      qty: i.quantity_units,
    }));

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStep("processing");

    // Simulate 2 seconds of payment authorization
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      // Commit reservation in backend
      const res = await fetch(`/api/cart/${sessionId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToCommit }),
      });

      if (!res.ok) {
        throw new Error("Failed to finalize order.");
      }

      setStep("success");
    } catch (err) {
      setError("Could not complete reservation commit. Please try again.");
      setStep("details");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelCheckout = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      // Release reservation in backend
      await fetch(`/api/cart/${sessionId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToCommit }),
      });
      // Redirect back to cart page
      navigate({ to: `/cart/${sessionId}` });
    } catch (err) {
      console.error("Failed to release reservation:", err);
      // Fallback
      navigate({ to: `/cart/${sessionId}` });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      </AppShell>
    );
  }

  if (error && step === "details") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold">Checkout Error</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              to="/cart/$id"
              params={{ id: sessionId }}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:border-foreground"
            >
              Back to Cart
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell noFooter={step === "processing"}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {step === "details" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
            {/* Left: Forms */}
            <div className="space-y-6">
              {/* Back Link */}
              <button
                onClick={handleCancelCheckout}
                disabled={cancelling}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                {cancelling ? "Releasing items..." : "Cancel & return to cart"}
              </button>

              <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>

              {/* Shipping Address */}
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2.5 mb-4 border-b border-border/50 pb-3">
                  <Truck className="h-5 w-5 text-brand" />
                  <h2 className="text-lg font-medium">Delivery Address</h2>
                </div>

                <form onSubmit={handlePay} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      required
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
                    />
                  </div>
                </form>
              </section>

              {/* Payment Methods */}
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Wallet className="h-5 w-5 text-brand" />
                    <h2 className="text-lg font-medium">Payment Mode</h2>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/15 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="h-3 w-3" /> Secure Payment
                  </span>
                </div>

                <div className="space-y-3">
                  {/* UPI Method */}
                  <label
                    className={`flex flex-col rounded-xl border p-4 cursor-pointer transition-all ${
                      paymentMethod === "upi"
                        ? "border-brand bg-brand/[0.03]"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === "upi"}
                          onChange={() => setPaymentMethod("upi")}
                          className="accent-[var(--color-brand)] h-4 w-4"
                        />
                        <div className="font-medium text-sm">UPI (Instantly pay via app)</div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                        GPay · PhonePe
                      </div>
                    </div>
                    {paymentMethod === "upi" && (
                      <div className="mt-4 pl-7 border-t border-border/40 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex gap-2 flex-wrap mb-3">
                          {[
                            { id: "gpay", label: "Google Pay" },
                            { id: "phonepe", label: "PhonePe" },
                            { id: "paytm", label: "Paytm" },
                          ].map((app) => (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => setUpiProvider(app.id as any)}
                              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                                upiProvider === app.id
                                  ? "bg-brand text-brand-foreground border-brand"
                                  : "border-border hover:bg-surface"
                              }`}
                            >
                              {app.label}
                            </button>
                          ))}
                        </div>
                        <div className="max-w-xs">
                          <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                            Enter UPI ID
                          </label>
                          <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs focus:border-foreground focus:outline-none"
                            placeholder="username@bank"
                          />
                        </div>
                      </div>
                    )}
                  </label>

                  {/* Card Method */}
                  <label
                    className={`flex flex-col rounded-xl border p-4 cursor-pointer transition-all ${
                      paymentMethod === "card"
                        ? "border-brand bg-brand/[0.03]"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === "card"}
                          onChange={() => setPaymentMethod("card")}
                          className="accent-[var(--color-brand)] h-4 w-4"
                        />
                        <div className="font-medium text-sm">Credit / Debit Card</div>
                      </div>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {paymentMethod === "card" && (
                      <div className="mt-4 pl-7 border-t border-border/40 pt-4 grid grid-cols-2 gap-3 max-w-md animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="col-span-2">
                          <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                            Card Number
                          </label>
                          <input
                            type="text"
                            placeholder="4111 2222 3333 4444"
                            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs focus:border-foreground focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                            Expiry (MM/YY)
                          </label>
                          <input
                            type="text"
                            placeholder="12/29"
                            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs focus:border-foreground focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                            CVV
                          </label>
                          <input
                            type="password"
                            placeholder="•••"
                            maxLength={3}
                            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs focus:border-foreground focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </label>

                  {/* Cash on Delivery Method */}
                  <label
                    className={`flex flex-col rounded-xl border p-4 cursor-pointer transition-all ${
                      paymentMethod === "cod"
                        ? "border-brand bg-brand/[0.03]"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === "cod"}
                          onChange={() => setPaymentMethod("cod")}
                          className="accent-[var(--color-brand)] h-4 w-4"
                        />
                        <div className="font-medium text-sm">Cash on Delivery (COD)</div>
                      </div>
                    </div>
                  </label>
                </div>
              </section>
            </div>

            {/* Right: Order Summary Sidebar */}
            <aside className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-6 sticky top-24">
                <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

                {/* Items preview list */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {cartItems.map((it: any, idx: number) => (
                    <div key={it.sku || idx} className="flex justify-between items-start text-xs gap-3">
                      <div className="min-w-0">
                        <span className="font-medium text-foreground block truncate">{it.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {it.quantity_units} × {it.unit_quantity}
                          {it.unit}
                        </span>
                      </div>
                      <span className="font-medium shrink-0">₹{it.total_price_inr}</span>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-border my-4" />

                {/* Costs breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>₹{total}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery</span>
                    <span className="text-success font-medium">FREE</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxes</span>
                    <span>₹0</span>
                  </div>
                  <div className="h-px bg-border/40 my-2" />
                  <div className="flex justify-between text-base font-semibold">
                    <span>Grand Total</span>
                    <span>₹{total}</span>
                  </div>
                </div>

                {/* Primary CTA */}
                <Button
                  onClick={handlePay}
                  disabled={submitting}
                  className="w-full mt-6 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold h-11 rounded-lg"
                >
                  Pay ₹{total}
                </Button>

                <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-muted-foreground text-center">
                  <Lock className="h-3 w-3 text-muted-foreground/70" />
                  Payments are secure and encrypted.
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* PROCESSING SCREEN */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto py-12">
            <div className="relative flex items-center justify-center h-20 w-20">
              <div className="absolute inset-0 rounded-full border-4 border-brand/20 border-t-brand animate-spin" />
              <ShieldCheck className="h-8 w-8 text-brand animate-pulse" />
            </div>
            <h2 className="mt-6 text-xl font-semibold">Processing Your Order</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please do not refresh the page or press the back button. We are secure-charging your{" "}
              {paymentMethod === "upi" ? "UPI Account" : paymentMethod === "card" ? "Card" : "COD order"}.
            </p>
          </div>
        )}

        {/* SUCCESS STATE */}
        {step === "success" && (
          <div className="max-w-2xl mx-auto py-12 px-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success mb-6">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Order Confirmed!</h1>
              <p className="mt-2 text-base text-muted-foreground">
                Thank you for your order. We've reserved your stock and notified the local hub.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 bg-surface px-3 py-1 rounded-full text-xs text-muted-foreground">
                <span>Reservation ID:</span>
                <span className="font-mono text-foreground">{id}</span>
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-border bg-card p-6 space-y-6">
              <h2 className="text-lg font-semibold border-b border-border pb-3">Delivery Information</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Deliver to</span>
                  <span className="font-medium block mt-0.5">{name}</span>
                  <span className="text-muted-foreground text-xs">{address}, {city} - {pincode}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Estimated Delivery</span>
                  <span className="font-semibold block text-brand mt-0.5">Today, by 6:00 PM</span>
                  <span className="text-muted-foreground text-xs">Standard Direct Shipping</span>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Reserved Products
                </h3>
                <div className="divide-y divide-border/40">
                  {cartItems.map((it: any, idx: number) => (
                    <div key={it.sku || idx} className="flex justify-between items-center py-2 text-xs">
                      <div>
                        <span className="font-medium text-foreground">{it.name}</span>
                        <span className="text-muted-foreground block text-[10px]">
                          {it.quantity_units} × {it.unit_quantity}
                          {it.unit}
                        </span>
                      </div>
                      <span className="font-medium text-foreground">₹{it.total_price_inr}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="flex justify-between items-center text-sm font-semibold">
                <span>Total Paid</span>
                <span className="text-lg font-bold">₹{total}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Button
                onClick={() => navigate({ to: "/chat" })}
                className="bg-brand text-brand-foreground font-semibold px-6 h-10 rounded-lg hover:bg-brand/90"
              >
                <ShoppingBag className="mr-2 h-4 w-4" /> Go back to Chat
              </Button>
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="border-border bg-card text-foreground font-semibold px-6 h-10 rounded-lg hover:bg-surface"
              >
                Print Receipt
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
