import { useState } from "react";
import { toast } from "sonner";

export interface ReservationResponse {
  reservation_id: string;
  status: "reserved" | "partial_failed" | "failed";
  total_amount: number;
  message: string;
}

export function useCheckout(sessionId: string) {
  const [loading, setLoading] = useState(false);
  
  const reserveItems = async (items: {sku: string, qty: number}[]) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart/${sessionId}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reserve items");
      return data as ReservationResponse;
    } finally {
      setLoading(false);
    }
  };
  
  const createPaymentIntent = async (reservationId: string, email?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payment/create-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId, customer_email: email }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to init payment");
      return data;
    } finally {
      setLoading(false);
    }
  };
  
  const confirmPayment = async (reservationId: string, paymentId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payment/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId, payment_id: paymentId }),
      });
      
      if (!res.ok) throw new Error("Failed to confirm payment");
      toast.success("Payment successful!");
      return true;
    } catch (err: any) {
      toast.error(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  return { reserveItems, createPaymentIntent, confirmPayment, loading };
}
