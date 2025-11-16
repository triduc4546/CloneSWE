import Link from "next/link"
import Image from "next/image"
import { AnimatedSection } from "@/components/animated-section"
import { MapPin, Phone, Mail, Clock, Coffee, Bean } from "lucide-react"

export function Footer() {
  return (
    <AnimatedSection>
      <footer className="bg-black text-white">
        <div className="container mx-auto px-4 py-16">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 max-w-6xl mx-auto">
            {/* BRAND */}
            <AnimatedSection delay={200}>
              <div className="space-y-6 h-full flex flex-col md:text-left">
                <div className="flex items-center space-x-3 justify-center md:justify-start">
                  <Image
                    src="/trung_nguyen.png"
                    alt="Trung Nguyên Legend Logo"
                    width={110}
                    height={40}
                    className="object-contain"
                  />
                  <div>
                    <h3 className="text-xl font-bold uppercase">
                      TRUNG NGUYÊN LEGEND
                    </h3>
                    <p className="text-yellow-300 text-sm">
                      The Energy of Creation
                    </p>
                  </div>
                </div>

                <p className="text-white leading-relaxed flex-grow">
                  Hành trình phụng sự để mang đến những sản phẩm cà phê năng lượng tuyệt hảo, nâng tầm trí tuệ và khát vọng Việt.
                </p>
              </div>
            </AnimatedSection>

            {/* LINKS */}
            <AnimatedSection delay={400}>
              <div className="space-y-6 h-full pl-16 text-yellow-300">
                <h4 className="text-lg font-semibold uppercase tracking-wide">
                  Danh mục
                </h4>

                <ul className="grid grid-cols-1 gap-3 text-white">
                  <li>
                    <Link href="/products" className=" hover:text-yellow-400 transition">
                      Sản phẩm
                    </Link>
                  </li>
                  <li>
                    <Link href="/cart" className=" hover:text-yellow-400 transition">
                      Giỏ hàng
                    </Link>
                  </li>
                </ul>
              </div>
            </AnimatedSection>

            {/* CONTACT */}
            <AnimatedSection delay={600}>
              <div className="space-y-6 h-full md:text-left pl-16">
                <h4 className="text-lg font-semibold uppercase tracking-wide text-yellow-300">
                  Liên hệ
                </h4>

                <div className="space-y-4 text-white">
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-yellow-300 mt-1" />
                    <div>
                      <p>82-84 Bùi Thị Xuân</p>
                      <p>Quận 1, TP. Hồ Chí Minh</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-yellow-300" />
                    <p>+84 343 580 927</p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-yellow-300" />
                    <p>legend@trungnguyen.com</p>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Clock className="w-5 h-5 text-yellow-300 mt-1" />
                    <div>
                      <p>Mon – Fri: 8:00 – 22:00</p>
                      <p>Sat – Sun: 9:00 – 21:00</p>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* BOTTOM */}
          <AnimatedSection delay={1000}>
            <div className="border-t border-yellow-500 mt-16 pt-8">
              <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                <div className="text-yellow-300 text-sm">
                  © 2025 Trung Nguyên Legend. All rights reserved.
                </div>

                <div className="flex space-x-6 text-sm text-yellow-300">
                  <Link href="/privacy" className="hover:text-white transition">
                    Chính sách bảo mật
                  </Link>
                  <Link href="/terms" className="hover:text-white transition">
                    Điều khoản
                  </Link>
                  <Link href="/about" className="hover:text-white transition">
                    Về chúng tôi
                  </Link>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </footer>
    </AnimatedSection>
  )
}
