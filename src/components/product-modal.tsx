"use client"

import Image from "next/image"
import { X } from "lucide-react"
import { db } from "@/lib/firebase"
import { useAuth } from "@/context/AuthContext"
import { collection, addDoc, query, where, getDocs, updateDoc } from "firebase/firestore"
import { toast } from "sonner"

export default function ProductModal({ product, onClose }: any) {
  const { user } = useAuth()

  if (!product) return null

  const handleAddToCart = async () => {
    if (!user) {
      toast.error("Please login first")
      return
    }

    if (!user.customerId) {
      toast.error("Your account is missing customerId")
      return
    }

    try {
      const q = query(
        collection(db, "cart"),
        where("customerId", "==", user.customerId),
        where("productId", "==", product.id)
      )

      const snapshot = await getDocs(q)

      if (!snapshot.empty) {
        // ✅ Exists → Update quantity
        const docRef = snapshot.docs[0].ref
        const oldQty = snapshot.docs[0].data().quantity ?? 1
        await updateDoc(docRef, { quantity: oldQty + 1 })
      } else {
        // ✅ Add new
        await addDoc(collection(db, "cart"), {
          customerId: user.customerId,
          productId: Number(product.id),
          quantity: 1,
        })
      }

      toast.success("Added to cart ✅")
      onClose()

    } catch (err) {
      console.error(err)
      toast.error("Failed to add to cart")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white w-[90%] max-w-3xl rounded-2xl p-6 shadow-xl relative">
        {/* Close button */}
        <button
          className="absolute top-4 right-4 text-zinc-600 hover:text-black transition"
          onClick={onClose}
        >
          <X size={26} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Image
            src={product.img_link}
            alt={product.name}
            width={500}
            height={500}
            className="rounded-lg object-contain"
          />

          <div>
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">{product.name}</h1>

            <p className="text-yellow-500 font-medium mb-3">{product.category}</p>

            <p className="text-2xl font-bold text-yellow-500 mb-5">
              {product.price.toLocaleString()}₫
            </p>

            <h2 className="font-semibold mb-2 text-zinc-900">Description</h2>
            <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        </div>

        {/* ✅ New Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleAddToCart}
            className="px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-semibold transition"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}