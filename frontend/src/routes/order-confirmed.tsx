import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Download, Home, Package } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import confetti from "canvas-confetti";

export const Route = createFileRoute("/order-confirmed")({
  component: OrderConfirmedPage,
});

function OrderConfirmedPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const reservationId = (searchParams as any)?.reservation;
  const [reservation, setReservation] = useState<any>(null);

  useEffect(() => {
    // Celebration confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Load reservation details
    if (reservationId) {
      fetch(`/api/reservation/${reservationId}`)
        .then((res) => res.json())
        .then((data) => setReservation(data))
        .catch((err) => console.error(err));
    }
  }, [reservationId]);

  const downloadReceipt = () => {
    if (!reservation) return;

    const receipt = `
NeedSpeak Order Receipt
========================
Reservation ID: ${reservation.reservation_id}
Date: ${new Date(reservation.created_at).toLocaleString()}
Status: ${reservation.status}

Items:
${reservation.reserved_items
  .map((item: any) => `- ${item.name} × ${item.qty} = ₹${item.total}`)
  .join("\n")}

Total: ₹${reservation.total_amount}

Thank you for shopping with NeedSpeak!
    `.trim();

    const blob = new Blob([receipt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `needspeak_receipt_${reservation.reservation_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl text-center">
          {/* Success Icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-success/20 to-success/10 shadow-lg shadow-success/20 animate-bounce-in">
            <Check className="h-10 w-10 text-success" />
          </div>

          <h1 className="mt-8 text-4xl font-bold">Order Confirmed! 🎉</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Your items have been reserved and payment is complete.
          </p>

          {/* Order Details */}
          {reservation && (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-6 text-left shadow-xl">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <Package className="h-5 w-5 text-brand" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Reservation ID</p>
                  <p className="font-mono text-sm font-bold">{reservation.reservation_id}</p>
                </div>
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

              <div className="mt-4 border-t border-border pt-4 flex justify-between text-lg font-bold">
                <span>Total Paid</span>
                <span className="text-brand">₹{reservation.total_amount.toFixed(2)}</span>
              </div>

              <button
                onClick={downloadReceipt}
                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold transition hover:bg-surface"
              >
                <Download className="h-4 w-4" />
                Download Receipt
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="mt-10 flex justify-center gap-4">
            <button
              onClick={() => navigate({ to: "/" })}
              className="flex h-12 items-center gap-2 rounded-xl bg-foreground px-6 font-semibold text-background transition hover:opacity-90 shadow-md"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </button>
          </div>

          <p className="mt-8 text-xs text-muted-foreground font-medium">
            A confirmation email has been sent to your registered email address.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
