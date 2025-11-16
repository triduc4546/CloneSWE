"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Package,
  Truck,
  MapPin,
  Clock,
  User,
  Search,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Footer } from "@/components/footer";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Delivery {
  id: string; // Firestore doc ID
  orderId: string; // same as id, used in URLs
  customerName: string;
  customerAddress: string;
  status: string; // stored as lowercase for easier matching
  orderDate: string; // ISO string
  totalAmount: number;
  prescriptionId?: number;
  customerId: string;
}

const formatDate = (value: any | undefined): string => {
  if (!value) return "";
  if (value?.seconds) {
    return new Date(value.seconds * 1000).toISOString();
  }
  return new Date(value).toISOString();
};

export default function DeliveryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [trackingId, setTrackingId] = useState("");
  const [trackError, setTrackError] = useState<string | null>(null);
  const [customerDeliveries, setCustomerDeliveries] = useState<Delivery[]>([]);
  const [staffDeliveries, setStaffDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination - customer
  const [customerPage, setCustomerPage] = useState(1);
  const deliveriesPerPage = 10;

  // Pagination - staff (now frontend)
  const [staffPage, setStaffPage] = useState(1);
  const staffDeliveriesPerPage = 10;
  const [totalStaff, setTotalStaff] = useState(0);
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    approved: 0,
    delivered: 0,
  });

  // Filters for staff
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchCustomerId, setSearchCustomerId] = useState("");
  const [debouncedOrderId, setDebouncedOrderId] = useState("");
  const [debouncedCustomerId, setDebouncedCustomerId] = useState("");

  // Debounce for Order ID
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedOrderId(searchOrderId), 400);
    return () => clearTimeout(handler);
  }, [searchOrderId]);

  // Debounce for Customer ID
  useEffect(() => {
    const handler = setTimeout(
      () => setDebouncedCustomerId(searchCustomerId),
      400
    );
    return () => clearTimeout(handler);
  }, [searchCustomerId]);

  // Load customer deliveries
  useEffect(() => {
    if (user?.role === "customer") {
      fetchCustomerDeliveries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPage, user?.role]);

  // Load staff deliveries
  useEffect(() => {
    if (user?.role === "staff") {
      fetchAllDeliveries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatuses, debouncedOrderId, debouncedCustomerId, user?.role]);

  // Optional polling for staff
  useEffect(() => {
    if (user?.role !== "staff") return;
    const interval = setInterval(() => {
      fetchAllDeliveries();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatuses, debouncedOrderId, debouncedCustomerId, user?.role]);

  // 🔹 Fetch only this customer's deliveries from Firestore
  const fetchCustomerDeliveries = async () => {
    if (!user?.customerId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "order"),
        where("customerId", "==", String(user.customerId))
      );
      const snap = await getDocs(q);

      const orders = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          orderId: d.id,
          customerName: user.name ?? user.email ?? "You",
          customerAddress: data.shippingAddress ?? "",
          status: String(data.status ?? "pending").toLowerCase(),
          orderDate: formatDate(data.createdAt),
          totalAmount: Number(data.totalAmount ?? 0),
          prescriptionId: undefined,
          customerId: String(data.customerId ?? user.customerId),
        } as Delivery;
      });

      setCustomerDeliveries(orders);
    } catch (error) {
      console.error("Error fetching customer deliveries:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Fetch all deliveries for staff from Firestore (filters applied in JS)
  const fetchAllDeliveries = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "order"));

      const rawOrders = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          orderId: d.id,
          raw: data,
        };
      });

      // Build a customer map so we can show names/addresses (best effort)
      const customerIds = Array.from(
        new Set(
          rawOrders
            .map((o) => String(o.raw.customerId || ""))
            .filter((id) => id !== "")
        )
      );
      const customerMap = new Map<string, any>();

      await Promise.all(
        customerIds.map(async (cid) => {
          try {
            const cSnap = await getDoc(doc(db, "customer", cid));
            if (cSnap.exists()) {
              customerMap.set(cid, cSnap.data());
            }
          } catch {
            // ignore
          }
        })
      );

      let deliveries: Delivery[] = rawOrders.map((o) => {
        const data = o.raw;
        const cid = String(data.customerId ?? "");
        const customer = customerMap.get(cid) ?? {};

        return {
          id: o.id,
          orderId: o.id,
          customerName:
            customer.name ?? customer.fullName ?? customer.email ?? "Customer",
          customerAddress:
            data.shippingAddress ?? customer.address ?? "No address available",
          status: String(data.status ?? "pending").toLowerCase(),
          orderDate: formatDate(data.createdAt),
          totalAmount: Number(data.totalAmount ?? 0),
          prescriptionId: undefined,
          customerId: cid,
        } as Delivery;
      });

      // Apply filters in JS
      if (selectedStatuses.length > 0) {
        const allowed = selectedStatuses.map((s) => s.toLowerCase());
        deliveries = deliveries.filter((d) =>
          allowed.includes(d.status.toLowerCase())
        );
      }

      if (debouncedOrderId.trim()) {
        const term = debouncedOrderId.trim();
        deliveries = deliveries.filter((d) => d.orderId.includes(term));
      }

      if (debouncedCustomerId.trim()) {
        const cid = debouncedCustomerId.trim();
        deliveries = deliveries.filter((d) => d.customerId === cid);
      }

      // Status counts
      const counts = { pending: 0, approved: 0, delivered: 0 };
      for (const d of deliveries) {
        const s = d.status.toLowerCase();
        if (s === "pending") counts.pending++;
        if (s === "approved") counts.approved++;
        if (s === "delivered") counts.delivered++;
      }

      setStatusCounts(counts);
      setStaffDeliveries(deliveries);
      setTotalStaff(deliveries.length);
    } catch (error) {
      console.error("Error fetching all deliveries:", error);
    } finally {
      setLoading(false);
    }
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
        return "bg-gray-100 text-gray-800";
    }
  };

  // 🔹 Update Firestore order status
  const updateDeliveryStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "order", orderId), {
        status: newStatus,
      });

      if (user?.role === "customer") {
        fetchCustomerDeliveries();
      } else {
        fetchAllDeliveries();
      }
    } catch (error) {
      console.error("Error updating delivery status:", error);
    }
  };

  // 🔹 Track button – validate in Firestore instead of /api
  const handleTrackDelivery = async () => {
    setTrackError(null);
    if (!trackingId) {
      setTrackError("Please enter an Order ID.");
      return;
    }
    if (!user?.customerId) {
      setTrackError("You must be signed in to track your order.");
      return;
    }

    try {
      const orderRef = doc(db, "order", trackingId);
      const snap = await getDoc(orderRef);

      if (!snap.exists()) {
        setTrackError("Order not found. Please check your Order ID.");
        return;
      }

      const data = snap.data() as any;
      if (String(data.customerId) !== String(user.customerId)) {
        setTrackError("This order does not belong to your account.");
        return;
      }

      router.push(`/delivery/${encodeURIComponent(trackingId)}`);
    } catch (error) {
      console.error("Error tracking order:", error);
      setTrackError("Order not found. Please check your Order ID.");
    }
  };

  // Customer pagination (frontend)
  const filteredCustomerDeliveries = customerDeliveries; // already filtered by customerId
  const totalCustomerPages = Math.ceil(
    filteredCustomerDeliveries.length / deliveriesPerPage
  );
  const paginatedCustomerDeliveries = filteredCustomerDeliveries.slice(
    (customerPage - 1) * deliveriesPerPage,
    customerPage * deliveriesPerPage
  );

  // Staff pagination (frontend)
  const totalStaffPages = Math.ceil(totalStaff / staffDeliveriesPerPage);
  const paginatedStaffDeliveries = useMemo(
    () =>
      staffDeliveries.slice(
        (staffPage - 1) * staffDeliveriesPerPage,
        staffPage * staffDeliveriesPerPage
      ),
    [staffDeliveries, staffPage, staffDeliveriesPerPage]
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading deliveries...</div>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-96 w-full">
          <div className="text-xl">Please sign in to access this page.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Delivery Management</h1>

        {/* Staff view */}
        {user.role === "staff" ? (
          <div className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-8 items-center">
                  <div>
                    <div className="font-semibold mb-2">Filter by Status:</div>
                    <div className="flex gap-3 flex-wrap">
                      {["pending", "approved", "delivered"].map((status) => (
                        <label
                          key={status}
                          className="flex items-center gap-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStatuses.includes(status)}
                            onChange={(e) => {
                              setSelectedStatuses((prev) =>
                                e.target.checked
                                  ? [...prev, status]
                                  : prev.filter((s) => s !== status)
                              );
                              setStaffPage(1);
                            }}
                          />
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-2">Filter by Order ID:</div>
                    <Input
                      type="text"
                      placeholder="Enter order ID"
                      value={searchOrderId}
                      onChange={(e) => {
                        setSearchOrderId(e.target.value);
                        setStaffPage(1);
                      }}
                    />
                  </div>

                  <div>
                    <div className="font-semibold mb-2">
                      Filter by Customer ID:
                    </div>
                    <Input
                      type="text"
                      placeholder="Enter customer ID"
                      value={searchCustomerId}
                      onChange={(e) => {
                        setSearchCustomerId(e.target.value);
                        setStaffPage(1);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Pending
                      </p>
                      <p className="text-2xl font-bold">
                        {statusCounts.pending}
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        In Transit
                      </p>
                      <p className="text-2xl font-bold">
                        {statusCounts.approved}
                      </p>
                    </div>
                    <Truck className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Delivered
                      </p>
                      <p className="text-2xl font-bold">
                        {statusCounts.delivered}
                      </p>
                    </div>
                    <Package className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Staff deliveries list */}
            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">All Deliveries</h2>
              {staffDeliveries.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">No deliveries found</p>
                  </CardContent>
                </Card>
              ) : (
                paginatedStaffDeliveries.map((delivery) => (
                  <Card key={delivery.id} className="border rounded-lg mb-4">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {delivery.status === "pending" && (
                              <Clock className="w-4 h-4" />
                            )}
                            {delivery.status === "approved" && (
                              <Truck className="w-4 h-4" />
                            )}
                            {delivery.status === "delivered" && (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            <Badge className={getStatusColor(delivery.status)}>
                              {delivery.status?.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            Order ID: {delivery.orderId} | Customer ID:{" "}
                            {delivery.customerId}
                          </div>
                          <div className="text-xs text-gray-400">
                            <User className="inline w-4 h-4 mr-1" />
                            {delivery.customerName || "Guest"}
                            {" | "}
                            <MapPin className="inline w-4 h-4 mr-1" />
                            {delivery.customerAddress ||
                              "No address available"}
                          </div>
                          <div className="text-xs text-gray-400">
                            Order Date:{" "}
                            {delivery.orderDate
                              ? new Date(
                                  delivery.orderDate
                                ).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </div>
                        <div className="text-right min-w-[120px]">
                          <div className="font-bold text-yellow-500">
                            {delivery.totalAmount.toLocaleString("vi-VN")} ₫
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Submitted:{" "}
                            {delivery.orderDate
                              ? new Date(
                                  delivery.orderDate
                                ).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {user?.role === "staff" &&
                          delivery.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-blue-500 hover:bg-blue-600 text-white"
                                onClick={() =>
                                  updateDeliveryStatus(delivery.id, "approved")
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                className="bg-red-500 hover:bg-red-600 text-white"
                                onClick={() =>
                                  updateDeliveryStatus(
                                    delivery.id,
                                    "cancelled"
                                  )
                                }
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        {user?.role === "staff" &&
                          delivery.status === "approved" && (
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-600 text-white"
                              onClick={() =>
                                updateDeliveryStatus(delivery.id, "delivered")
                              }
                            >
                              Mark Delivered
                            </Button>
                          )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/delivery/${delivery.orderId}`)
                          }
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {/* Staff Pagination */}
              {totalStaffPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={staffPage === 1}
                    onClick={() => setStaffPage(1)}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={staffPage === 1}
                    onClick={() =>
                      setStaffPage((prev) => Math.max(1, prev - 1))
                    }
                  >
                    &lt;
                  </Button>
                  <span className="px-2">
                    Page {staffPage} of {totalStaffPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={staffPage === totalStaffPages}
                    onClick={() =>
                      setStaffPage((prev) =>
                        Math.min(totalStaffPages, prev + 1)
                      )
                    }
                  >
                    &gt;
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={staffPage === totalStaffPages}
                    onClick={() => setStaffPage(totalStaffPages)}
                  >
                    Last
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Customer view
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Track Your Delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter tracking ID"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                  />
                  <Button
                    className="bg-yellow-400 hover:bg-black hover:text-yellow-400 text-black font-bold"
                    onClick={handleTrackDelivery}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Track
                  </Button>
                </div>
                {trackError && (
                  <div className="text-red-500 text-sm mt-2">
                    {trackError}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">Your Deliveries</h2>
              {paginatedCustomerDeliveries.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">No deliveries found</p>
                  </CardContent>
                </Card>
              ) : (
                paginatedCustomerDeliveries.map((delivery) => (
                  <Card key={delivery.id} className="border rounded-lg mb-4">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {delivery.status === "pending" && (
                              <Clock className="w-4 h-4" />
                            )}
                            {delivery.status === "approved" && (
                              <Truck className="w-4 h-4" />
                            )}
                            {delivery.status === "delivered" && (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            <Badge className={getStatusColor(delivery.status)}>
                              {delivery.status?.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            Order ID: {delivery.orderId}
                          </div>
                          <div className="text-xs text-gray-400">
                            <MapPin className="inline w-4 h-4 mr-1" />
                            {delivery.customerAddress ||
                              "No address available"}
                          </div>
                          <div className="text-xs text-gray-400">
                            Order Date:{" "}
                            {delivery.orderDate
                              ? new Date(
                                  delivery.orderDate
                                ).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </div>
                        <div className="text-right min-w-[120px]">
                          <div className="font-bold text-yellow-500">
                            {delivery.totalAmount.toLocaleString("vi-VN")} ₫
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Submitted:{" "}
                            {delivery.orderDate
                              ? new Date(
                                  delivery.orderDate
                                ).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/delivery/${delivery.orderId}`)
                          }
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {/* Customer Pagination */}
              {totalCustomerPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={customerPage === 1}
                    onClick={() => setCustomerPage(1)}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={customerPage === 1}
                    onClick={() =>
                      setCustomerPage((prev) => Math.max(1, prev - 1))
                    }
                  >
                    &lt;
                  </Button>
                  <span className="px-2">
                    Page {customerPage} of {totalCustomerPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={customerPage === totalCustomerPages}
                    onClick={() =>
                      setCustomerPage((prev) =>
                        Math.min(totalCustomerPages, prev + 1)
                      )
                    }
                  >
                    &gt;
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={customerPage === totalCustomerPages}
                    onClick={() => setCustomerPage(totalCustomerPages)}
                  >
                    Last
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
