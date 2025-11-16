"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Footer } from "@/components/footer";

import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

/* ---------- Helpers ---------- */
function getDisplayMethod(method: string) {
  switch (method) {
    case "CreditCard":
      return "Credit Card";
    case "Cash":
      return "Cash";
    case "EWallet":
      return "E-Wallet";
    default:
      return method;
  }
}

/* ---------- Screen ---------- */
function PaymentContent() {
  const [status, setStatus] = useState<"processing" | "success" | "failed">(
    "processing"
  );

  const [paymentData, setPaymentData] = useState<{
    orderId: string;
    customerName: string;
    amount: number;
    method: string;
    paymentId: string;
  } | null>(null);

  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");

  useEffect(() => {
    if (orderIdParam) {
      fetchPaymentFirebase(orderIdParam);
    } else {
      setStatus("failed");
    }
  }, [orderIdParam]); // 👈 đảm bảo chạy lại khi URL đổi

  /* ✅ Fetch payment + order + customer từ Firestore (đúng collections/kiểu dữ liệu) */
  const fetchPaymentFirebase = async (orderId: string) => {
    try {
      // 1) Tìm payment theo orderId (orderId là STRING)
      const pQ = query(
        collection(db, "payment"),
        where("orderId", "==", orderId)
      );
      const pSnap = await getDocs(pQ);
      if (pSnap.empty) {
        setStatus("failed");
        return;
      }
      const paymentDoc = pSnap.docs[0];
      const pay = paymentDoc.data() as {
        orderId: string;
        method: string;
        status?: string;
        amount?: number; // phòng khi bạn có lưu
      };

      // 2) Lấy order để có totalAmount + customerId
      const orderRef = doc(db, "order", orderId);
      const orderSnap = await getDoc(orderRef);

      let amount = 0;
      let customerId: string | number | undefined;
      if (orderSnap.exists()) {
        const o = orderSnap.data() as {
          totalAmount?: number;
          customerId?: string | number;
        };
        amount = Number(o?.totalAmount ?? 0);
        customerId = o?.customerId;
      } else {
        // (fallback) nếu không có totalAmount trong order, thử SUM orderItems
        const oiQ = query(
          collection(db, "orderItem"),
          where("orderId", "==", orderId)
        );
        const oiSnap = await getDocs(oiQ);
        amount = 0;
        oiSnap.forEach((d) => {
          const it = d.data() as { unitPrice?: number; quantity?: number };
          const line =
            Number(it?.unitPrice ?? 0) * Number(it?.quantity ?? 1);
          amount += line;
        });
      }

      // 3) Lấy tên customer (nếu có customerId)
      let customerName = "Customer";
      if (customerId !== undefined && customerId !== null) {
        const custRef = doc(db, "customer", String(customerId));
        const custSnap = await getDoc(custRef);
        if (custSnap.exists()) {
          const c = custSnap.data() as { name?: string };
          customerName = c?.name || customerName;
        }
      }

      setPaymentData({
        orderId,
        customerName,
        amount,
        method: pay.method,
        paymentId: paymentDoc.id,
      });
      setStatus("success");
    } catch (err) {
      console.error("Payment fetch failed:", err);
      setStatus("failed");
    }
  };

  /* ====== UI STATES ====== */

  if (status === "processing") {
    return (
      <Wrapper>
        <CardDisplay>
          <Clock className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-spin" />
          <h2 className="text-2xl font-bold mb-2">Processing Payment</h2>
          <p className="text-gray-600 mb-6">Please wait...</p>
        </CardDisplay>
      </Wrapper>
    );
  }

  if (status === "success" && paymentData) {
    return (
      <Wrapper>
        <CardDisplay>
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-2xl font-bold mb-2 text-green-700">
            Payment Successful!
          </h2>
          <p className="text-gray-600 mb-6">
            Your order has been confirmed.
          </p>

          <div className="bg-gray-50 p-4 rounded-lg mb-6 text-sm space-y-2">
            <Row label="Order ID" value={`#${paymentData.orderId}`} />
            <Row label="Name" value={paymentData.customerName} />
            <Row label="Amount" value={`${paymentData.amount.toLocaleString()} đ`} />
            <Row label="Method" value={getDisplayMethod(paymentData.method)} />
            <Row label="Payment ID" value={`#${paymentData.paymentId}`} />
          </div>

          <div className="space-y-3">
            <Link href={`/delivery/${paymentData.orderId}`}>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Track Your Order
              </Button>
            </Link>

            <Link href="/products">
              <Button
                variant="outline"
                className="w-full bg-blue-50 text-blue-700 border-blue-200"
              >
                Continue Shopping
              </Button>
            </Link>
          </div>
        </CardDisplay>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <CardDisplay>
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
        <h2 className="text-2xl font-bold mb-2 text-red-700">
          Payment Failed
        </h2>
        <p className="text-gray-600 mb-6">
          There was an issue processing your payment.
        </p>

        <Link href="/purchase">
          <Button className="w-full bg-yellow-500 text-white hover:bg-yellow-600">
            Back to Checkout
          </Button>
        </Link>
      </CardDisplay>
    </Wrapper>
  );
}

/* ---------- Small UI helpers ---------- */
const Row = ({ label, value }: { label: string; value: any }) => (
  <div className="flex justify-between">
    <span>{label}:</span>
    <span className="font-medium">{value}</span>
  </div>
);

const Wrapper = ({ children }: any) => (
  <div className="min-h-screen flex flex-col">
    <div className="container mx-auto px-4 py-8 flex-1">{children}</div>
    <Footer />
  </div>
);

const CardDisplay = ({ children }: any) => (
  <Card>
    <CardContent className="text-center py-12">{children}</CardContent>
  </Card>
);

function PaymentFallback() {
  return (
    <Wrapper>
      <CardDisplay>
        <Clock className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-spin" />
        <h2 className="text-2xl font-bold mb-2">Loading Payment</h2>
      </CardDisplay>
    </Wrapper>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentFallback />}>
      <PaymentContent />
    </Suspense>
  );
}