"use client";

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Truck,
  MapPin,
  User,
  Package,
} from "lucide-react";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Footer } from "@/components/footer";

interface Order {
  id: string;
  createdAt?: any;
  customerId: string;
  deliveryMethod: string;
  shippingAddress: string;
  status: string;
  totalAmount: number;
}

interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  img_link?: string;
}

interface CombinedItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

const formatTimestamp = (ts: any | undefined): string => {
  if (!ts) return "";
  if (ts.seconds) {
    return new Date(ts.seconds * 1000).toLocaleString();
  }
  return new Date(ts).toLocaleString();
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
      return "bg-blue-100 text-blue-800";
    case "delivered":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
};

export default function DeliveryDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<CombinedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      // 1. Fetch order
      const orderRef = doc(db, "order", String(orderId));
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        setNotFound(true);
        setOrder(null);
        setItems([]);
        return;
      }

      const orderData = orderSnap.data() as any;
      const orderObj: Order = {
        id: orderSnap.id,
        createdAt: orderData.createdAt,
        customerId: String(orderData.customerId ?? ""),
        deliveryMethod: orderData.deliveryMethod ?? "unknown",
        shippingAddress: orderData.shippingAddress ?? "",
        status: String(orderData.status ?? "pending"),
        totalAmount: Number(orderData.totalAmount ?? 0),
      };

      // Optional: customer restriction – main list already checks,
      // but we double-guard for safety
      if (
        user &&
        user.role === "customer" &&
        user.customerId &&
        String(user.customerId) !== orderObj.customerId
      ) {
        setError("This order does not belong to your account.");
        setOrder(null);
        setItems([]);
        return;
      }

      setOrder(orderObj);

      // 2. Fetch order items
      const orderItemRef = collection(db, "orderItem");
      const q = query(orderItemRef, where("orderId", "==", orderObj.id));
      const orderItemSnap = await getDocs(q);

      const orderItems: OrderItem[] = orderItemSnap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          orderId: String(data.orderId ?? orderObj.id),
          productId: String(data.productId),
          quantity: Number(data.quantity ?? 0),
          unitPrice: Number(data.unitPrice ?? data.price ?? 0),
        };
      });

      // 3. Fetch related products
      const productIds = Array.from(
        new Set(orderItems.map((oi) => oi.productId))
      );
      const products: Product[] = [];

      await Promise.all(
        productIds.map(async (pid) => {
          try {
            const pRef = doc(db, "product", pid);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              const pData = pSnap.data() as any;
              products.push({
                id: pSnap.id,
                name: pData.name ?? `Product ${pSnap.id}`,
                price: Number(pData.price ?? 0),
                img_link: pData.img_link,
              });
            }
          } catch (e) {
            console.error("Error fetching product", pid, e);
          }
        })
      );

      const combined: CombinedItem[] = orderItems.map((oi) => {
        const product = products.find((p) => p.id === oi.productId);
        const unitPrice = oi.unitPrice || product?.price || 0;
        return {
          id: oi.id,
          productId: oi.productId,
          productName: product?.name ?? `Product ${oi.productId}`,
          quantity: oi.quantity,
          unitPrice,
          totalPrice: oi.quantity * unitPrice,
        };
      });

      setItems(combined);
    } catch (err: any) {
      console.error("Error loading delivery details:", err);
      setError(err?.message ?? "Failed to load delivery details.");
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  useEffect(() => {
    if (user !== undefined) {
      loadData();
    }
  }, [loadData, user]);

  const itemsTotal = useMemo(
    () => items.reduce((sum, i) => sum + i.totalPrice, 0),
    [items]
  );

  /* ---- Auth guards ---- */

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-700">
          <div className="w-6 h-6 rounded-full border-2 border-b-transparent border-yellow-400 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50">
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-zinc-900 mb-3">
              Please sign in
            </h1>
            <p className="text-zinc-600">
              You need to be signed in to view delivery details.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  /* ---- Main UI ---- */

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => router.push("/delivery")}
          className="inline-flex items-center gap-2 text-sm text-zinc-700 hover:text-yellow-400 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Deliveries
        </button>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-b-transparent border-yellow-400 animate-spin" />
            <span className="ml-3 text-zinc-600 text-sm">
              Loading delivery details...
            </span>
          </div>
        ) : notFound ? (
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center">
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Order not found
            </h2>
            <p className="text-zinc-600">
              We couldn&apos;t find any order with ID{" "}
              <span className="font-mono">{String(orderId)}</span>.
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-red-700 mb-2">
              Error
            </h2>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        ) : order ? (
          <>
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">
              Order:{" "}
              <span className="font-mono text-yellow-500">
                #{order.id}
              </span>
            </h1>
            <p className="text-sm text-zinc-500 mb-6">
              Track the status and details of this delivery.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.3fr] gap-6">
              {/* Order summary card */}
              <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
                      <Clock className="w-4 h-4" />
                      <span>Order time</span>
                    </div>
                    <div className="font-medium text-zinc-900">
                      {formatTimestamp(order.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${getStatusColor(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-zinc-700">
                    <Truck className="w-4 h-4 text-zinc-500" />
                    <span className="font-medium">
                      Method:
                    </span>
                    <span className="capitalize">
                      {order.deliveryMethod}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-zinc-700">
                    <User className="w-4 h-4 text-zinc-500" />
                    <span className="font-medium">
                      Customer ID:
                    </span>
                    <span className="font-bold text-xs">
                      {order.customerId}
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-zinc-700">
                    <MapPin className="w-4 h-4 mt-0.5 text-zinc-500" />
                    <div>
                      <span className="font-medium">
                        Address:
                      </span>{" "}
                      <span>{order.shippingAddress}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-200 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-zinc-700">
                        Items total
                      </span>
                      <span className="font-medium text-zinc-900">
                        {itemsTotal.toLocaleString("vi-VN")} ₫
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-zinc-500">
                        Shipping fee
                      </span>
                      <span className="text-zinc-700">
                        {Math.max(order.totalAmount - itemsTotal, 0).toLocaleString(
                          "vi-VN"
                        )}{" "}
                        ₫
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <span className="font-semibold text-zinc-900">
                        Total
                      </span>
                      <span className="text-lg font-bold text-yellow-500">
                        {order.totalAmount.toLocaleString("vi-VN")} ₫
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Items card */}
              <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Items
                  </h2>
                  <div className="inline-flex items-center gap-1 text-xs text-zinc-500">
                    <Package className="w-3 h-3" />
                    <span>{items.length} item(s)</span>
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No items found for this order.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-start border border-zinc-100 rounded-xl px-4 py-3"
                      >
                        <div>
                          <div className="font-medium text-sm text-zinc-900">
                            {item.productName}
                          </div>
                          <div className="text-xs text-zinc-500">
                            ID: {item.productId}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            Qty: {item.quantity}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-semibold text-zinc-900">
                            {item.totalPrice.toLocaleString("vi-VN")} ₫
                          </div>
                          <div className="text-xs text-zinc-500">
                            {item.unitPrice.toLocaleString("vi-VN")} ₫ / unit
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="pt-3 border-t border-zinc-100 flex justify-between text-sm font-medium text-zinc-900">
                      <span>Subtotal</span>
                      <span>{itemsTotal.toLocaleString("vi-VN")} ₫</span>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
