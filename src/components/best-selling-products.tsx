"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, limit } from "firebase/firestore"
import Image from "next/image"
import { Eye } from "lucide-react"
import ProductModal from "./product-modal"

export default function BestSellingProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const q = query(collection(db, "product"), limit(8))
      const snapshot = await getDocs(q)
      setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    }
    fetchData()
  }, [])

  return (
    <section className="bg-black py-20 border-t">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center text-yellow-300 mb-12 tracking-wide">
          Best-Selling Products
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              className="bg-white border border-zinc-300 hover:border-yellow-400 transition-all
                         rounded-2xl overflow-hidden shadow-md cursor-pointer group"
            >
              {/* Image */}
              <div className="relative w-full h-64 flex items-center justify-center bg-white">
                <Image
                  src={p.img_link || "/coffee-default.jpg"}
                  alt={p.name}
                  fill
                  className="object-contain p-4"
                />

                {/* Hover icon */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <Eye className="w-10 h-10 text-white" />
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-semibold text-xl mb-1 text-zinc-900 line-clamp-1">
                  {p.name}
                </h3>

                <p className="text-sm text-yellow-600 mb-3 line-clamp-1">
                  {p.category}
                </p>

                <p className="text-black font-bold text-xl">
                  {p.price.toLocaleString()}₫
                </p>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <ProductModal product={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </section>
  )
}
