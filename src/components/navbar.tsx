"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import NavbarAuthButton from "./NavbarAuthButton";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = `/products?search=${encodeURIComponent(
      searchQuery.trim()
    )}`;
  };

  return (
    <header className="sticky top-0 z-[100] shadow">
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* ✅ Left: Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0 hover:opacity-80 transition">
            <Image
              src="/trung_nguyen_logo.png"
              alt="Logo"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="font-bold text-xl text-black">
              Trung Nguyên
            </span>
          </Link>

          {/* ✅ Center: Menu */}
          <div className="hidden md:flex items-center gap-2 font-medium text-black">
            {[
              { label: "Product", href: "/products" },
              { label: "Track Delivery", href: "/delivery" },
              { label: "Returns & Exchanges", href: "/returns" },
              ...(user?.role === "staff"
                ? [{ label: "Inventory", href: "/inventory" }]
                : []),
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-md hover:bg-black/10 hover:text-black transition whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* ✅ Center: Search */}
          <form
            onSubmit={handleSearch}
            className="relative flex-1 max-w-md hidden md:block"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 w-5 h-5" />
            <Input
              placeholder="Tìm sản phẩm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 h-10 rounded-full bg-yellow-400/40 
                border border-transparent focus:border-black/30 focus:bg-white 
                transition"
            />
          </form>

          {/* ✅ Right: Cart + Auth */}
          <div className="flex items-center gap-4 font-medium shrink-0">
            <Link
              href="/cart"
              className="flex items-center gap-2 text-black hover:bg-black/10 px-3 py-2 rounded-md transition"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Cart</span>
            </Link>

            <NavbarAuthButton />
          </div>
        </div>

        {/* ✅ Mobile search */}
        <form onSubmit={handleSearch} className="md:hidden px-4 pb-3 relative mt-1">
          <Search className="absolute left-8 top-[1.2rem] text-gray-600 w-5 h-5" />
          <Input
            placeholder="Tìm sản phẩm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-4 h-10 rounded-full bg-yellow-400/40 
              border border-transparent focus:border-black/30 focus:bg-white 
              transition"
          />
        </form>
      </nav>
    </header>
  );
}
