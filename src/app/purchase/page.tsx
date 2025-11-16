"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Footer } from "@/components/footer";
import Link from "next/link";

interface CartItem {
  productId: string;
  quantity: number;
  name: string;
  price: number;
  description: string;
  img_link?: string;
}

export default function PurchasePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerData, setCustomerData] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
  });

  const [deliveryMethod, setDeliveryMethod] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState("");

  /* ===========================================================
     ✅ Fetch CART + PRODUCT info
  =========================================================== */
  const fetchCart = async () => {
    try {
      if (!user?.customerId) return;

      const qSnap = await getDocs(
        query(collection(db, "cart"), where("customerId", "==", user.customerId))
      );

      const cartList = qSnap.docs.map((d) => ({
        cartDocId: d.id,
        productId: d.data().productId,
        quantity: d.data().quantity ?? 1,
      }));

      // fetch products
      const productsSnap = await getDocs(collection(db, "product"));
      const productMap: Record<string, any> = {};

      productsSnap.forEach((d) => {
        productMap[d.id] = { ...d.data(), productId: d.id };
      });

      const fullCart: CartItem[] = cartList.map((item) => {
        const p = productMap[item.productId];
        return {
          productId: item.productId,
          quantity: item.quantity,
          name: p?.name ?? "",
          price: Number(p?.price ?? 0),
          description: p?.description ?? "",
          img_link: p?.img_link ?? "",
        };
      });

      setCartItems(fullCart);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [user]);

  /* ===========================================================
     ✅ Checkout Summary
  =========================================================== */
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const tax = subtotal * 0.1;
  const deliveryFee =
    deliveryMethod === "express" ? 30000 : deliveryMethod === "overnight" ? 60000 : 0;

  const total = subtotal + tax + deliveryFee;

  /* ===========================================================
     ✅ PLACE ORDER
  =========================================================== */
  const handlePlaceOrder = async () => {
    if (!user?.customerId) {
      alert("Please login first.");
      return;
    }

    if (!customerData.fullName || !customerData.address) {
      alert("Please fill your shipping information.");
      return;
    }

    if (!paymentMethod) {
      alert("Please select payment method.");
      return;
    }

    try {
      // ✅ Update customer info if needed
      await updateDoc(doc(db, "customer", String(user.customerId)), {
        name: customerData.fullName,
        email: customerData.email,
        phoneNumber: customerData.phone,
        address: customerData.address,
      });

      // ✅ Create order
      const orderRef = await addDoc(collection(db, "order"), {
        customerId: user.customerId,
        totalAmount: total,
        status: "Pending",
        shippingAddress: customerData.address,
        deliveryMethod,
        createdAt: new Date(),
      });

      const orderId = orderRef.id;

      // ✅ Create order items
      await Promise.all(
        cartItems.map((item) =>
          addDoc(collection(db, "orderItem"), {
            orderId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.price,
          })
        )
      );

      // ✅ Create payment
      await addDoc(collection(db, "payment"), {
        orderId,
        method: paymentMethod === "card" ? "CreditCard" : "Cash",
        status: "Success",
        createdAt: new Date(),
      });

      // ✅ Delete cart
      const qSnap = await getDocs(
        query(collection(db, "cart"), where("customerId", "==", user.customerId))
      );

      await Promise.all(qSnap.docs.map((d) => deleteDoc(doc(db, "cart", d.id))));

      router.push(`/payment?orderId=${orderId}`);

    } catch (e) {
      console.error(e);
      alert("Failed to place order");
    }
  };

  /* ===========================================================
     ✅ UI
  =========================================================== */

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (cartItems.length === 0) {
    return (
      <div className="p-6 text-center">
        <h2>Your cart is empty.</h2>
        <Link href="/products">
          <Button className="mt-4">Browse Products</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ✅ Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {["fullName", "email", "phone", "address"].map((field) => (
                <div key={field}>
                  <Label className="capitalize">{field}</Label>
                  <Input
                    value={(customerData as any)[field]}
                    onChange={(e) =>
                      setCustomerData({ ...customerData, [field]: e.target.value })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ✅ Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* ✅ ITEMS */}
              {cartItems.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span>
                    {item.name} x{item.quantity}
                  </span>
                  <span>{(item.price * item.quantity).toLocaleString()}₫</span>
                </div>
              ))}

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{subtotal.toLocaleString()}₫</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (10%):</span>
                  <span>{tax.toLocaleString()}₫</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery:</span>
                  <span>{deliveryFee === 0 ? "Free" : `${deliveryFee.toLocaleString()}₫`}</span>
                </div>

                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>{total.toLocaleString()}₫</span>
                </div>
              </div>

              {/* ✅ Delivery Option */}
              <Label className="font-semibold">Delivery Method</Label>
              <RadioGroup
                value={deliveryMethod}
                onValueChange={setDeliveryMethod}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id="standard" />
                  <Label htmlFor="standard">Standard — Free</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="express" id="express" />
                  <Label htmlFor="express">Express — 30,000₫</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="overnight" id="overnight" />
                  <Label htmlFor="overnight">Overnight — 60,000₫</Label>
                </div>
              </RadioGroup>

              {/* ✅ Payment Method */}
                <Label className="font-semibold">Payment Method</Label>
                <RadioGroup
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="space-y-3"
                >
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash">Cash</Label>
                </div>

                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card">Credit Card</Label>
                </div>

                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ewallet" id="ewallet" />
                    <Label htmlFor="ewallet">E-Wallet</Label>
                </div>
                </RadioGroup>

              {/* ✅ Place Order */}
              <Button onClick={handlePlaceOrder} className="w-full bg-yellow-500">
                Place Order
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}
