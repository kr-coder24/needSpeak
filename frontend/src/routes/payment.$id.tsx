import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Package, ShieldCheck, Wallet, ArrowLeft, Landmark, QrCode } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/payment/$id")({
  component: PaymentPage,
});

function PaymentPage() {
  const { id: reservationId } = Route.useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi" | "netbanking">("card");
  
  // Card details state
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [cardName, setCardName] = useState("Aman Kashyap");
  const [upiId, setUpiId] = useState("aman@okhdfcbank");

  useEffect(() => {
    fetch(`/api/reservation/${reservationId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load reservation");
        return res.json();
      })
      .then((data) => setReservation(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [reservationId]);

  const handleSimulatedPayment = async () => {
    setProcessing(true);
    setProcessingStep(1); // Connecting
    
    // Step 1: Simulated processing steps for high-fidelity feel
    await new Promise((r) => setTimeout(r, 1200));
    setProcessingStep(2); // Authorizing
    
    await new Promise((r) => setTimeout(r, 1200));
    setProcessingStep(3); // Capturing
    
    try {
      // Step 2: Call confirm payment endpoint on backend
      const res = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          payment_id: `pay_mock_${Math.random().toString(36).substring(2, 11)}`,
        }),
      });

      if (!res.ok) throw new Error("Payment confirmation failed");
      
      setProcessingStep(4); // Success!
      await new Promise((r) => setTimeout(r, 800));
      
      // Navigate to confirmation page
      navigate({ to: "/order-confirmed", search: { reservation: reservationId } });
    } catch (err) {
      console.error(err);
      alert("Simulated payment failed. Please try again.");
      setProcessing(false);
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
      <div className="mx-auto max-w-4xl px-4 py-12">
        <button
          onClick={() => navigate({ to: `/checkout/${reservationId}` })}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Checkout
        </button>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Payment Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-6 shadow-xl backdrop-blur-xl dark:bg-[#1C1B1A]/80">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">NeedSpeak Secure Payment</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">Demo Sandbox Gateway</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure 256-Bit
                </div>
              </div>

              {/* Payment Methods tabs */}
              <div className="mt-6 grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-xs font-semibold transition ${
                    paymentMethod === "card"
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-border/60 bg-transparent text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  Card
                </button>
                <button
                  onClick={() => setPaymentMethod("upi")}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-xs font-semibold transition ${
                    paymentMethod === "upi"
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-border/60 bg-transparent text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <QrCode className="h-5 w-5" />
                  UPI / QR
                </button>
                <button
                  onClick={() => setPaymentMethod("netbanking")}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-xs font-semibold transition ${
                    paymentMethod === "netbanking"
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-border/60 bg-transparent text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <Landmark className="h-5 w-5" />
                  Netbanking
                </button>
              </div>

              {/* Form Content */}
              <div className="mt-8">
                {paymentMethod === "card" && (
                  <div className="space-y-4">
                    {/* Simulated Credit Card Preview */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-950 p-6 text-white shadow-xl dark:from-neutral-900 dark:to-black">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-bold tracking-widest text-neutral-400">DEMO CARD</span>
                        <div className="h-8 w-12 rounded bg-white/10 backdrop-blur-md flex items-center justify-center font-bold text-xs">VISA</div>
                      </div>
                      <div className="mt-8 font-mono text-xl tracking-widest">{cardNumber || "•••• •••• •••• ••••"}</div>
                      <div className="mt-6 flex justify-between items-end">
                        <div>
                          <p className="text-[10px] uppercase text-neutral-400">Cardholder</p>
                          <p className="font-semibold text-sm truncate max-w-[150px]">{cardName || "Your Name"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-neutral-400">Expires</p>
                          <p className="font-semibold text-sm">{cardExpiry || "MM/YY"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 mt-6">
                      <div>
                        <label className="block text-xs font-bold mb-1.5 text-muted-foreground">Cardholder Name</label>
                        <input
                          type="text"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          className="h-10 w-full rounded-lg border border-border/60 bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1.5 text-muted-foreground">Card Number</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="h-10 w-full rounded-lg border border-border/60 bg-surface px-3 text-sm focus:border-brand focus:outline-none font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-muted-foreground">Expiration Date</label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            className="h-10 w-full rounded-lg border border-border/60 bg-surface px-3 text-sm focus:border-brand focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-muted-foreground">CVV</label>
                          <input
                            type="password"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            maxLength={3}
                            className="h-10 w-full rounded-lg border border-border/60 bg-surface px-3 text-sm focus:border-brand focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === "upi" && (
                  <div className="space-y-6 text-center py-4">
                    <div className="mx-auto max-w-[150px] border border-border/60 bg-surface rounded-xl p-4 flex flex-col items-center justify-center">
                      <QrCode className="h-28 w-28 text-foreground" />
                      <span className="text-[10px] text-muted-foreground mt-2 font-mono">Scan QR to pay</span>
                    </div>
                    
                    <div className="max-w-md mx-auto">
                      <label className="block text-xs font-bold mb-1.5 text-muted-foreground text-left">Or enter UPI ID</label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="h-10 w-full rounded-lg border border-border/60 bg-surface px-3 text-sm focus:border-brand focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "netbanking" && (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-muted-foreground">Select your Bank</label>
                    <div className="grid grid-cols-2 gap-2">
                      {["HDFC Bank", "ICICI Bank", "SBI", "Axis Bank"].map((bank) => (
                        <button
                          key={bank}
                          className="h-12 border border-border/60 bg-surface rounded-xl text-xs font-semibold hover:border-brand transition"
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pay Button / Processing Overlay */}
              <div className="mt-8 border-t border-border/50 pt-6">
                {processing ? (
                  <div className="rounded-xl bg-surface p-4 flex items-center gap-3.5 border border-border/50">
                    <Loader2 className="h-5 w-5 animate-spin text-brand shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-semibold">
                        {processingStep === 1 && "Connecting to bank secure servers..."}
                        {processingStep === 2 && "Authorizing transaction amount..."}
                        {processingStep === 3 && "Receiving confirmation & capturing..."}
                        {processingStep === 4 && "Payment Successful!"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Please do not refresh this page.</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleSimulatedPayment}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white transition hover:opacity-95 shadow-lg shadow-brand/20"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Simulate Payment (₹{reservation.total_amount.toFixed(2)})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Summary */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-6 shadow-xl backdrop-blur-xl dark:bg-[#1C1B1A]/80">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Package className="h-5 w-5 text-brand" />
                Order Summary
              </h2>
              
              <div className="mt-4 border-b border-border/50 pb-4 text-xs text-muted-foreground space-y-1">
                <p>Reservation ID: <span className="font-mono text-foreground font-semibold">{reservation.reservation_id}</span></p>
                <p>Expires: {new Date(reservation.expires_at).toLocaleTimeString()}</p>
              </div>

              <div className="mt-4 space-y-3">
                {reservation.reserved_items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.name} × {item.qty}
                    </span>
                    <span className="font-semibold">₹{item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 border-t border-border/50 pt-4 flex justify-between text-lg font-bold">
                <span>Total Amount</span>
                <span className="text-brand">₹{reservation.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
