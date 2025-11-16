// Core data types that will map to database schemas
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  role: "customer" | "staff" | "admin"
  createdAt: Date
  updatedAt: Date
}

export interface Product {
  id: string
  name: string
  description?: string
  price: number
  stock: number
  category: string
  prescriptionRequired: boolean
  imageUrl?: string
  createdAt: Date
  updatedAt: Date
}

export interface CartItem {
  id: string
  userId: string
  productId: string
  quantity: number
  product?: Product
  createdAt: Date
  updatedAt: Date
}

export interface Order {
  id: string
  userId: string
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"
  subtotal: number
  tax: number
  shippingCost: number
  total: number
  shippingAddress: Address
  paymentMethod: "card" | "paypal" | "cash"
  paymentStatus: "pending" | "paid" | "failed" | "refunded"
  items: OrderItem[]
  createdAt: Date
  updatedAt: Date
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  quantity: number
  price: number
  product?: Product
}

export interface Address {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  city: string
  zipCode: string
  country: string
}

export interface Delivery {
  id: string
  orderId: string
  trackingId: string
  status: "pending" | "in_transit" | "delivered" | "failed"
  deliveryMethod: "standard" | "express" | "overnight"
  estimatedDelivery: Date
  actualDelivery?: Date
  currentLocation?: string
  deliveryInstructions?: string
  order?: Order
  timeline: DeliveryTimeline[]
  createdAt: Date
  updatedAt: Date
}

export interface DeliveryTimeline {
  id: string
  deliveryId: string
  status: string
  description: string
  timestamp: Date
  location?: string
}

export interface ReturnRequest {
  id: string
  orderId: string
  userId: string
  productId: string
  reason: "damaged" | "wrong_product" | "expired" | "not_as_described" | "allergic_reaction" | "other"
  description: string
  status: "pending" | "approved" | "rejected" | "completed"
  refundAmount: number
  requestDate: Date
  processedDate?: Date
  order?: Order
  product?: Product
  user?: User
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
