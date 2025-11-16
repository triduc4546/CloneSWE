"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AnimatedSection } from "@/components/animated-section"
import { ChevronLeft, ChevronRight, Coffee, Bean, Star } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PromoSection() {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)

  const promoSlides = [
    {
      id: 1,
      title: "Trung Nguyên Coffee",
      subtitle: "Hương vị năng lượng tuyệt hảo",
      description:
        "Khám phá những dòng cà phê truyền thống mang đậm bản sắc Việt Nam – rang xay tinh tuyển, đậm đà quyến rũ.",
      badge: "SPECIAL",
      badge2: "PREMIUM",
      bgGradient: "from-black via-zinc-900 to-yellow-700",
      buttonText: "Khám phá ngay",
      icon: <Coffee className="w-8 h-8" />,
      category: "coffee",
    },
    {
      id: 2,
      title: "Cà phê phin chuẩn Việt",
      subtitle: "Tinh hoa cà phê rang mộc",
      description:
        "Sự kết hợp hoàn hảo giữa hương vị mạnh mẽ và hậu vị ngọt dịu – thưởng thức theo cách phin đậm đà.",
      badge: "SIGNATURE",
      badge2: "VIETNAMESE STYLE",
      bgGradient: "from-zinc-800 via-black to-yellow-500",
      buttonText: "Mua ngay",
      icon: <Bean className="w-8 h-8" />,
      category: "phin",
    },
    {
      id: 3,
      title: "Legend Capsule",
      subtitle: "Công nghệ hiện đại – trải nghiệm mới",
      description:
        "Cà phê viên nén Trung Nguyên – tiện lợi, chuẩn vị, đánh thức tinh thần sáng tạo mỗi ngày.",
      badge: "NEW",
      badge2: "IN STOCK",
      bgGradient: "from-yellow-500 via-yellow-500 to-neutral-900",
      buttonText: "Xem sản phẩm",
      icon: <Star className="w-8 h-8" />,
      category: "capsule",
    },
  ]

  // Auto slide every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % promoSlides.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [promoSlides.length])

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % promoSlides.length)
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + promoSlides.length) % promoSlides.length)
  const goToSlide = (index: number) => setCurrentSlide(index)

  const handleButtonClick = (category: string) => {
    router.push(`/products?category=${encodeURIComponent(category)}`)
  }

  return (
    <>
      <AnimatedSection className="py-8 bg-white">
        <div className="container mx-auto px-4">
          {/* Main Promo Banner */}
          <div className="relative overflow-hidden rounded-2xl shadow-xl mb-6">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {promoSlides.map((slide) => (
                <div key={slide.id} className={`min-w-full bg-gradient-to-r ${slide.bgGradient} relative`}>
                  <div className="flex items-center justify-between px-8 py-12 text-white min-h-[300px]">
                    {/* Left */}
                    <div className="flex-1 z-10">
                      <div className="flex items-center mb-4">
                        <div className="bg-white/10 p-3 rounded-full mr-4">{slide.icon}</div>
                        <div>
                          <h2 className="text-3xl font-bold mb-2 uppercase">{slide.title}</h2>
                          <h3 className="text-lg font-medium">{slide.subtitle}</h3>
                        </div>
                      </div>

                      <p className="text-base mb-6 text-white/90 max-w-md">
                        {slide.description}
                      </p>

                      <Button
                        onClick={() => handleButtonClick(slide.category)}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-8 py-3 rounded-full text-lg shadow-md"
                      >
                        {slide.buttonText} →
                      </Button>
                    </div>

                    {/* Right */}
                    <div className="flex-1 flex justify-end items-center">
                      <div className="bg-black/40 border border-yellow-400 rounded-3xl p-6 text-center">
                        <div className="text-sm text-yellow-300">{slide.badge}</div>
                        <div className="text-3xl font-bold text-yellow-400 mb-1">{slide.badge2}</div>
                        <div className="text-xs opacity-80 uppercase tracking-wide">Exclusive Offer</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 rounded-full p-3"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 rounded-full p-3"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>

            {/* Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
              {promoSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={`w-3 h-3 rounded-full ${
                    i === currentSlide ? "bg-yellow-400 scale-125" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Secondary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1 */}
            <AnimatedSection delay={200}>
              <div className="bg-black rounded-xl p-6 text-white border border-yellow-500">
                <div className="flex items-center mb-4">
                  <div className="bg-yellow-500 p-2 rounded-lg mr-3">
                    <Coffee className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Bộ sưu tập signature</h3>
                    <p className="text-sm opacity-90">Dành cho tín đồ cà phê</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleButtonClick("signature")}
                  className="bg-yellow-500 text-black hover:bg-yellow-400 font-semibold"
                >
                  Xem ngay
                </Button>
              </div>
            </AnimatedSection>

            {/* 2 */}
            <AnimatedSection delay={400}>
              <div className="bg-zinc-900 rounded-xl p-6 text-white border border-yellow-500">
                <div className="flex items-center mb-4">
                  <div className="bg-yellow-500 p-2 rounded-lg mr-3">
                    <Star className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Ưu đãi thành viên</h3>
                    <p className="text-sm opacity-90">Tích điểm – đổi quà</p>
                  </div>
                </div>
                <Button
                  onClick={() => router.push("/login")}
                  className="bg-yellow-500 text-black hover:bg-yellow-400 font-semibold"
                >
                  Tham gia ngay
                </Button>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </AnimatedSection>
    </>
  )
}
