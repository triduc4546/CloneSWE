"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnimatedSection } from "@/components/animated-section"
import { Coffee, Truck, ShieldCheck, RefreshCw, ShoppingBag } from "lucide-react"
import FeaturedProducts from "@/components/featured-products"
import BestSellingProducts from "@/components/best-selling-products"
import PromoSection from "@/components/promo-section"
import { Footer } from "@/components/footer"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-white">
      {/* ==== HERO SECTION ==== */}
      <div className="relative bg-white overflow-hidden">
        <div className="container mx-auto px-4 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[600px]">

            {/* LEFT */}
            <div className="text-center lg:text-left space-y-6">
              <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-black">
                TRUNG NGUYÊN
                <br />
                <span className="text-yellow-400">LEGEND</span>
                <br />
                COFFEE
              </h1>

              <p className="text-xl opacity-80 max-w-lg text-black">
                The Energy Coffee That Changes Life
              </p>

              <p className="text-xl opacity-80 max-w-lg text-black">
                25+ years of passion
              </p>

              <Link href="/products">
                <Button className="bg-yellow-400 text-black hover:bg-black hover:text-yellow-400 font-semibold px-8 py-6 rounded-xl">
                  Explore Products
                </Button>
              </Link>
            </div>

            {/* RIGHT — IMAGE */}
            <div className="flex justify-center">
              <div className="relative">
                <Image
                  src="/coffee-image.png"
                  alt="Trung Nguyen Coffee"
                  width={1500}
                  height={1200}
                  className="rounded-3xl shadow-2xl object-cover"
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ==== BRAND VALUES ==== */}
      <AnimatedSection className="bg-black py-20 border-t border-zinc-800">
        <div className="container mx-auto px-4">
          <AnimatedSection delay={200}>
            <h2 className="text-3xl font-bold mb-12 text-center text-yellow-400">Why Choose Trung Nguyên?</h2>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Coffee className="w-10 h-10 text-yellow-500" />,
                title: "Premium Beans",
                description: "Rare & exquisite Arabica, Robusta, Excelsa blends.",
              },
              {
                icon: <ShieldCheck className="w-10 h-10 text-yellow-500" />,
                title: "Authentic Flavor",
                description: "Rich Vietnamese heritage & coffee culture.",
              },
              {
                icon: <Truck className="w-10 h-10 text-yellow-500" />,
                title: "Fast Delivery",
                description: "Fresh coffee shipped nationwide.",
              },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={350 + i * 150}>
                <div className="bg-zinc-900 border border-zinc-700 hover:border-yellow-500 transition-all rounded-2xl shadow-lg p-8 text-center">
                  <div className="flex justify-center mb-4">{item.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="opacity-70 leading-relaxed">{item.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ==== FEATURED PRODUCTS ==== */}
      <FeaturedProducts />

      {/* ==== BEST SELLING PRODUCTS ==== */}
      <BestSellingProducts />

      {/* ==== PROMO ==== */}
      <PromoSection />

      {/* FOOTER */}
      <Footer />
    </div>
  )
}
