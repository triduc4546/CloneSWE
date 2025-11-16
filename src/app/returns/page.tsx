"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import NavbarAuthButton from "@/components/NavbarAuthButton";

// ✅ Firestore
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  setDoc,
} from "firebase/firestore";

// ===============================
// ✅ Return Type
// ===============================
interface OrderItem {
  orderId: string;
  productId: number;
  quantity: number;
  unitPrice: number;
}

interface ReturnItem {
  returnId: number;
  orderId: string;
  productId: number;
  reason: string;
  description: string;
  status: string;
  refundAmount: number;
  submittedDate: string;
  customerName?: string;
  productName?: string;
  customerId?: string;
  processedDate?: string;
}
export default function ReturnsPage() {
  const { user } = useAuth();

  // ========= CUSTOMER FORM ========
  const [returnReason, setReturnReason] = useState("");
  const [returnDescription, setReturnDescription] = useState("");
  const [orderId, setOrderId] = useState("");
  const [productId, setProductId] = useState<number | null>(null);

  // ========= DATA LISTS =========
  const [customerReturns, setCustomerReturns] = useState<ReturnItem[]>([]);
  const [staffReturns, setStaffReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ========= STAFF FILTERS ========
  const [staffStatusFilters, setStaffStatusFilters] = useState<string[]>([]);
  const [staffOrderId, setStaffOrderId] = useState("");
  const [staffCustomerId, setStaffCustomerId] = useState("");

  // ========= MODAL =========
  const [viewDetailOpen, setViewDetailOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnItem | null>(null);

  // ========= STATS =========
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    totalRefunds: 0,
  });

  /* ============================================================
     ✅ FETCH CUSTOMER RETURNS
  ============================================================ */
  const fetchCustomerReturns = async () => {
  if (!user?.customerId) return;
  setLoading(true);

  const qRef = query(
    collection(db, "return"),
    where("customerId", "==", user?.customerId),
    orderBy("submittedDate", "desc")
  );

  const snap = await getDocs(qRef);

  const list: ReturnItem[] = [];
  snap.forEach((d) => list.push(d.data() as ReturnItem));

  setCustomerReturns(list);
  setLoading(false);
};


  /* ============================================================
     ✅ FETCH STAFF RETURNS
  ============================================================ */
  const fetchStaffReturns = async () => {
    setLoading(true);

    let qRef = query(collection(db, "return"), orderBy("submittedDate", "desc"));
    const snap = await getDocs(qRef);

    let list: ReturnItem[] = [];
    snap.forEach((d) => list.push(d.data() as ReturnItem));

    // Manual filters
    if (staffStatusFilters.length > 0)
      list = list.filter((i) => staffStatusFilters.includes(i.status));

    if (staffOrderId)
      list = list.filter((i) => String(i.orderId) === String(staffOrderId));

    if (staffCustomerId)
      list = list.filter((i) => String(i.customerId) === String(staffCustomerId));

    const pending = list.filter((i) => i.status === "pending").length;
    const approved = list.filter((i) => i.status === "approved").length;
    const rejected = list.filter((i) => i.status === "rejected").length;
    const totalRefunds = list.reduce(
      (sum, i) => sum + (i.refundAmount ?? 0),
      0
    );

    setStats({ pending, approved, rejected, totalRefunds });
    setStaffReturns(list);

    setLoading(false);
  };

  /* ============================================================
     ✅ TRIGGER FETCH WHEN LOGGED IN
  ============================================================ */
  useEffect(() => {
    if (!user) return;
    if (user.role === "staff") fetchStaffReturns();
    else fetchCustomerReturns();
  }, [user, staffStatusFilters, staffOrderId, staffCustomerId]);

  /* ============================================================
     ✅ SUBMIT RETURN REQUEST
  ============================================================ */
/* ============================================================
   ✅ SUBMIT RETURN REQUEST
============================================================ */
  const handleReturnSubmit = async () => {
    if (!orderId || !returnReason) {
      alert("Fill all required fields");
      return;
    }

    // 1) Get order
    const orderSnap = await getDoc(doc(db, "order", orderId));
    if (!orderSnap.exists()) {
      alert("Order does not exist");
      return;
    }
    const order = orderSnap.data();
    const customerId = order.customerId;     // ✅ LẤY TỪ ORDER
    const customerName = user?.name ?? "";

    // 2) Get orderItem
    let pickedItem = null as OrderItem | null;

    const itemsSnap = await getDocs(
      query(collection(db, "orderItem"), where("orderId", "==", orderId))
    );

    itemsSnap.forEach((d) => {
      const data = d.data() as OrderItem;
      if (!productId || Number(data.productId) === Number(productId)) {
        pickedItem = data;
      }
    });

    if (!pickedItem) {
      alert("orderItem not found");
      return;
    }

    const refundAmount = Number(pickedItem.unitPrice ?? 0);
    const resolvedProductId = Number(pickedItem.productId);

    // 3) Get product name
    const pSnap = await getDoc(doc(db, "product", String(resolvedProductId)));
    const productName = pSnap.exists() ? pSnap.data()?.name : "";

    // 4) Generate returnId
    const allReturns = await getDocs(collection(db, "return"));
    const newReturnId = allReturns.size + 1;
    const returnId = String(newReturnId);

    const newReturn = {
      returnId: newReturnId,
      orderId,
      productId: resolvedProductId,
      reason: returnReason,
      description: returnDescription,
      status: "pending",
      refundAmount,
      submittedDate: new Date().toISOString(),
      customerId: user?.customerId,
      customerName: user?.name ?? "",
      productName,
    };

    await setDoc(doc(db, "return", returnId), newReturn);

    alert("Return request submitted!");
    setOrderId("");
    setReturnReason("");
    setReturnDescription("");

    fetchCustomerReturns();
  };


  /* ============================================================
     ✅ STAFF: UPDATE STATUS
  ============================================================ */
  const updateReturnStatus = async (returnId: number, newStatus: string) => {
    const snap = await getDocs(
      query(collection(db, "return"), where("returnId", "==", returnId))
    );

    snap.forEach(async (d) => {
      await updateDoc(doc(db, "return", d.id), {
        status: newStatus,
        processedDate: new Date().toISOString(),
      });
    });

    fetchStaffReturns();
  };

  /* ============================================================
     ✅ UI HELPERS
  ============================================================ */
  const getStatusColor = (status: string) =>
    ({
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800",
    }[status] || "bg-gray-100 text-gray-800");

  const getStatusIcon = (status: string) =>
    ({
      pending: <Clock className="w-4 h-4" />,
      approved: <CheckCircle className="w-4 h-4" />,
      rejected: <AlertCircle className="w-4 h-4" />,
      completed: <Package className="w-4 h-4" />,
    }[status] || <RefreshCw className="w-4 h-4" />);

  /* ============================================================
     ✅ IF NOT LOGIN
  ============================================================ */
  if (!user)
    return (
      <div className="w-full flex justify-end p-4 border-b bg-white">
        <NavbarAuthButton />
        <div className="flex justify-center items-center h-96 w-full">
          <div className="text-xl">Please sign in to access this page.</div>
        </div>
      </div>
    );

  /* ============================================================
     ✅ RENDER
  ============================================================ */
  return (
    <div>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Returns & Exchanges</h1>

        {/* ======================================================
            ✅ STAFF VIEW
        ====================================================== */}
        {user.role === "staff" ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-6">
                  <div>
                    <div className="font-semibold mb-2">Filter by Status</div>
                    {["pending", "approved", "rejected"].map((s) => (
                      <label
                        key={s}
                        className="flex items-center gap-1 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={staffStatusFilters.includes(s)}
                          onChange={(e) =>
                            setStaffStatusFilters((prev) =>
                              e.target.checked
                                ? [...prev, s]
                                : prev.filter((i) => i !== s)
                            )
                          }
                        />
                        {s}
                      </label>
                    ))}
                  </div>

                  <div>
                    <div className="font-semibold mb-2">Filter by Order ID</div>
                    <Input
                      value={staffOrderId}
                      onChange={(e) => setStaffOrderId(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="font-semibold mb-2">Filter by Customer ID</div>
                    <Input
                      value={staffCustomerId}
                      onChange={(e) => setStaffCustomerId(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ✅ STATS */}
            <div className="grid grid-cols-4 gap-4 font-bold">
              <Card><CardContent>Pending: {stats.pending}</CardContent></Card>
              <Card><CardContent>Approved: {stats.approved}</CardContent></Card>
              <Card><CardContent>Rejected: {stats.rejected}</CardContent></Card>
              <Card>
                <CardContent>
                  Total Refunds: {stats.totalRefunds.toLocaleString("vi-VN")} ₫
                </CardContent>
              </Card>
            </div>

            {/* ✅ LIST */}
            <div className="space-y-4">
              {staffReturns.map((item) => (
                <Card key={item.returnId}>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <Badge className={getStatusColor(item.status)}>
                          {item.status.toUpperCase()}
                        </Badge>
                      </div>

                      {item.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateReturnStatus(item.returnId, "approved")}>
                            Approve
                          </Button>
                          <Button size="sm" onClick={() => updateReturnStatus(item.returnId, "rejected")}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-lg">{item.productName}</div>
                      <div className="text-sm text-gray-600">Order: {item.orderId}</div>
                      <div className="text-sm text-gray-600">Customer: {item.customerName}</div>

                      <div className="text-sm text-gray-600">
                        Reason: {item.reason.replace("_", " ")}
                      </div>
                      <div className="text-sm text-gray-600">
                        Description: {item.description}
                      </div>
                      <div className="text-sm text-gray-600">
                        Refund Amount: {item.refundAmount.toLocaleString("vi-VN")} ₫
                      </div>
                      {item.processedDate && (
                        <div className="text-sm text-gray-500">
                          Processed: {new Date(item.processedDate).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          /* ======================================================
             ✅ CUSTOMER VIEW
          ====================================================== */
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Request Return/Exchange</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Label>Order ID</Label>
                <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} />

                <Label>Reason</Label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="">Select reason</option>
                  <option value="damaged">Damaged</option>
                  <option value="wrong_product">Wrong product</option>
                  <option value="expired">Expired</option>
                </select>

                <Label>Description</Label>
                <Textarea
                  value={returnDescription}
                  onChange={(e) => setReturnDescription(e.target.value)}
                />

                <Button onClick={handleReturnSubmit} className="bg-yellow-400 text-black hover:bg-black hover:text-yellow-400">
                  <RefreshCw className="w-4 h-4 mr-2" /> Submit
                </Button>
              </CardContent>
            </Card>

            {customerReturns.map((item) => (
            <Card key={item.returnId}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.status)}
                    <Badge className={getStatusColor(item.status)}>
                      {item.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(item.submittedDate).toLocaleString()}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="font-bold text-lg">{item.productName}</div>
                  <div className="text-sm text-gray-600">Order: {item.orderId}</div>
                  <div className="text-sm text-gray-600">
                    Reason: {item.reason.replace("_", " ")}
                  </div>
                  <div className="text-sm text-gray-600">
                    Description: {item.description}
                  </div>
                  <div className="text-sm text-gray-600">
                    Refund: {item.refundAmount.toLocaleString("vi-VN")} ₫
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        )}
      </div>
    </div>
  );
}
