"use client"

import { useAuth } from "@/context/AuthContext"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, Clock, User } from "lucide-react"
import { useEffect, useState } from "react"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

type OrderItem = {
  orderItemId: string
  productName: string
  productDescription?: string
  quantity: number
  price: number
}

type Order = {
  orderId: string
  customerName: string
  customerEmail?: string
  orderDate?: string
  status: string
  totalAmount?: number
  deliveryMethod?: string
  shippingAddress?: string
  items: OrderItem[]
}

const formatDate = (value: any | undefined): string | undefined => {
  if (!value) return undefined
  if (value?.seconds) {
    // Firestore Timestamp
    return new Date(value.seconds * 1000).toISOString()
  }
  return new Date(value).toISOString()
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "preparing":
      return "bg-yellow-100 text-yellow-800"
    case "in_transit":
      return "bg-blue-100 text-blue-800"
    case "delivered":
      return "bg-green-100 text-green-800"
    case "failed":
    case "cancelled":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export default function TrackDeliveryPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  // 🔑 We use the Firestore document ID of the order as tracking ID
  const orderIdParam = searchParams.get("orderId") || ""

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true)
      setError(null)

      if (!orderIdParam) {
        setOrder(null)
        setLoading(false)
        setError("No tracking ID provided.")
        return
      }

      try {
        // 1️⃣ Load order from `order` collection
        const orderRef = doc(db, "order", orderIdParam)
        const orderSnap = await getDoc(orderRef)

        if (!orderSnap.exists()) {
          setOrder(null)
          setError("No tracking information found.")
          setLoading(false)
          return
        }

        const orderData = { id: orderSnap.id, ...orderSnap.data() } as any

        // 2️⃣ Load customer info (optional – best effort)
        let customerName = "Customer"
        let customerEmail: string | undefined

        if (orderData.customerId) {
          try {
            const customerRef = doc(db, "customer", String(orderData.customerId))
            const customerSnap = await getDoc(customerRef)
            if (customerSnap.exists()) {
              const c = customerSnap.data() as any
              customerName = c.name ?? c.fullName ?? customerName
              customerEmail = c.email ?? customerEmail
            }
          } catch {
            // ignore customer errors, still show order
          }
        }

        // 3️⃣ Load order items from `orderItem` collection
        const itemQuery = query(
          collection(db, "orderItem"),
          where("orderId", "==", orderSnap.id)
        )
        const itemSnap = await getDocs(itemQuery)
        const itemDocs = itemSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))

        // 4️⃣ For each item, fetch product details from `product`
        const productIds = Array.from(
          new Set(itemDocs.map((it: any) => String(it.productId)))
        )
        const productMap = new Map<string, any>()

        await Promise.all(
          productIds.map(async pid => {
            try {
              const pRef = doc(db, "product", pid)
              const pSnap = await getDoc(pRef)
              if (pSnap.exists()) {
                productMap.set(pid, pSnap.data())
              }
            } catch {
              // ignore missing product
            }
          })
        )

        const items: OrderItem[] = itemDocs.map((it: any) => {
          const pid = String(it.productId)
          const pData = productMap.get(pid) ?? {}
          const basePrice = Number(
            it.price ?? it.unitPrice ?? pData.price ?? 0
          )

          return {
            orderItemId: it.id,
            productName: pData.name ?? "Unknown Product",
            productDescription: pData.description ?? "",
            quantity: Number(it.quantity ?? 0),
            price: basePrice,
          }
        })

        const totalAmount =
          orderData.totalAmount ??
          items.reduce((sum, it) => sum + it.price * it.quantity, 0)

        const mappedOrder: Order = {
          orderId: orderData.id,
          customerName,
          customerEmail,
          orderDate: formatDate(orderData.createdAt),
          status: orderData.status ?? "pending",
          totalAmount,
          deliveryMethod: orderData.deliveryMethod,
          shippingAddress:
            orderData.shippingAddress ?? orderData.address ?? "",
          items,
        }

        setOrder(mappedOrder)
      } catch (err) {
        console.error("Error fetching order from Firestore:", err)
        setError("No tracking information found.")
        setOrder(null)
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderIdParam])

  // 🔐 Optional: keep this if you want tracking only for signed-in customers
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          Please sign in to track your orders.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading tracking information...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          {error || "No tracking information found."}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Track Your Delivery</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Order info */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center mb-2">
                <Package className="w-5 h-5 mr-2" />
                <span className="font-semibold text-lg">
                  Order #{order.orderId}
                </span>
              </div>

              <div className="flex items-center mb-2">
                <User className="w-5 h-5 mr-2" />
                <span>
                  {order.customerName}
                  {order.customerEmail && (
                    <> (<span className="text-gray-600">{order.customerEmail}</span>)</>
                  )}
                </span>
              </div>

              <div className="flex items-center mb-2">
                <Clock className="w-5 h-5 mr-2" />
                <span>
                  Order Date:{" "}
                  {order.orderDate
                    ? new Date(order.orderDate).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>

              <div className="flex items-center mb-2">
                <span className="font-medium mr-2">Status:</span>
                <Badge className={getStatusColor(order.status)}>
                  {order.status ? order.status.toUpperCase() : "N/A"}
                </Badge>
              </div>

              {order.deliveryMethod && (
                <div className="flex items-center mb-2">
                  <span className="font-medium mr-2">Delivery Method:</span>
                  <span>{order.deliveryMethod}</span>
                </div>
              )}

              {order.shippingAddress && (
                <div className="flex items-center mb-2">
                  <span className="font-medium mr-2">Shipping Address:</span>
                  <span>{order.shippingAddress}</span>
                </div>
              )}

              <div className="flex items-center mb-2">
                <span className="font-medium mr-2">
                  Total Amount (Included Tax):
                </span>
                <span>
                  {order.totalAmount
                    ? `${order.totalAmount.toLocaleString("vi-VN")} ₫`
                    : "0 ₫"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ordered items */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ordered Items</CardTitle>
            </CardHeader>
            <CardContent>
              {order.items && order.items.length > 0 ? (
                <ul className="space-y-2">
                  {order.items.map(item => (
                    <li key={item.orderItemId} className="border-b pb-2">
                      <div className="font-medium">{item.productName}</div>
                      {item.productDescription && (
                        <div className="text-sm text-gray-600">
                          {item.productDescription}
                        </div>
                      )}
                      <div className="text-sm">
                        Quantity: {item.quantity} &nbsp;|&nbsp; Price:{" "}
                        {item.price.toLocaleString("vi-VN")} ₫
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-500">
                  No items found for this order.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
