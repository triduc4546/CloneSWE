"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Minus, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import { Footer } from "@/components/footer"

// ✅ Firestore imports
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore"
import Image from "next/image"

interface CartItem {
  cartId: string
  customerId: number
  productId: number
  name: string
  price: number
  quantity: number
  description: string
  imageUrl?: string
}

export default function CartPage() {
  const { user } = useAuth()

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  /* =======================
      GET CART ITEMS
  ======================= */
  useEffect(() => {
    if (user && user.customerId) {
      fetchCartItems(user.customerId)
    }
  }, [user])

  const fetchCartItems = async (customerId: number) => {
    setLoading(true)
    try {
      const q = query(collection(db, "cart"), where("customerId", "==", customerId))
      const cartSnapshot = await getDocs(q)

      const items: CartItem[] = []

      for (const snap of cartSnapshot.docs) {
        const cartData = snap.data()

        // ✅ Fetch product details
        const productRef = doc(db, "product", String(cartData.productId))
        const productSnap = await getDoc(productRef)

        const productData = productSnap.exists() ? productSnap.data() : {}

        items.push({
          cartId: snap.id,
          customerId,
          productId: cartData.productId,
          name: productData?.name ?? "",
          description: productData?.description ?? "",
          price: productData?.price ?? 0,
          quantity: cartData.quantity ?? 1,
          imageUrl: productData?.img_link ?? null,
        })
      }

      setCartItems(items)
    } catch (err) {
      console.error("Error fetching cart items:", err)
    } finally {
      setLoading(false)
    }
  }

  /* =======================
      UPDATE QUANTITY
  ======================= */
  const updateQuantity = async (cartId: string, productId: number, newQuantity: number) => {
    if (newQuantity < 1) return

    try {
      const ref = doc(db, "cart", cartId)
      await updateDoc(ref, { quantity: newQuantity })

      setCartItems((items) =>
        items.map((i) => (i.cartId === cartId ? { ...i, quantity: newQuantity } : i))
      )
    } catch (err) {
      console.error("Error updating quantity:", err)
    }
  }

  /* =======================
      REMOVE ITEM
  ======================= */
  const removeItem = async (cartId: string) => {
    try {
      await deleteDoc(doc(db, "cart", cartId))
      setCartItems((items) => items.filter((i) => i.cartId !== cartId))
    } catch (err) {
      console.error("Error removing item:", err)
    }
  }

  /* =======================
      CALCULATE TOTAL
  ======================= */
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  /* =======================
      UI
  ======================= */

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto px-4 py-8 flex-1">
          <div className="text-center mt-16">
            <p className="mb-4 text-lg">Please sign in to view your cart.</p>
            <Link href="/login">
              <Button className="bg-yellow-500 text-white hover:bg-yellow-600">Sign In</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto px-4 py-8 flex-1">
          <div className="text-center">Loading cart...</div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ITEMS */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Cart Items ({cartItems.length})</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {cartItems.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">Your cart is empty</p>
                    <Link href="/products">
                      <Button>Browse Products</Button>
                    </Link>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.cartId} className="flex items-center space-x-4 p-4 border rounded-lg">
                      
                      {/* ✅ IMAGE */}
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          width={80}
                          height={80}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center">
                          <span className="text-gray-500 text-xs">No Image</span>
                        </div>
                      )}

                      <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-gray-600 text-sm">{item.description}</p>
                        <p className="text-gray-600">{item.price.toLocaleString()} đ</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.cartId, item.productId, item.quantity - 1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>

                        <Input
                          className="w-16 text-center"
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(item.cartId, item.productId, Number(e.target.value) || 1)
                          }
                        />

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.cartId, item.productId, item.quantity + 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold">
                          {(item.price * item.quantity).toLocaleString()} đ
                        </p>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.cartId)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* SUMMARY */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{subtotal.toLocaleString()} đ</span>
                </div>

                <div className="flex justify-between">
                  <span>Tax (10%):</span>
                  <span>{tax.toLocaleString()} đ</span>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>{total.toLocaleString()} đ</span>
                  </div>
                </div>

                <Link href="/purchase" className="w-full">
                  <Button className="w-full bg-yellow-500 text-white hover:bg-yellow-600" size="lg">
                    Proceed to Checkout
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
