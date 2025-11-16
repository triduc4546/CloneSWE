// Database schema types for the pharmacy app using exact IDs and syntax

export interface Customer {
  customerId: number;
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
  dateOfBirth: Date;
  gender: string;
}

export interface Order {
  orderId: number;
  orderDate: Date;
  status: 'Pending' | 'Approved' | 'Delivered' | 'Cancelled';
  totalAmount: number;
  customerId: number;
  prescriptionId?: number;
  paymentId: number;
}

export interface Prescription {
  prescriptionId: number;
  imageFile: string;
  uploadDate: Date;
  approved: boolean;
  pharmacistId: number;
}

export interface Product {
  productId: number;
  name: string;
  description: string;
  price: number;
  category: string;
  requiresPrescription: boolean;
}

export interface Inventory {
  inventoryId: number;
  productId: number;
  branchId: number;
  stockQuantity: number;
  updatedAt: Date;
}

export interface Payment {
  paymentId: number;
  method: 'Cash' | 'CreditCard' | 'E-Wallet';
  transactionDate: Date;
  status: 'Success' | 'Failed' | 'Refunded';
}

export interface Pharmacist {
  pharmacistId: number;
  name: string;
  licenseNumber: string;
  branchId: number;
}

export interface Branch {
  branchId: number;
  location: string;
  managerName: string;
  contactNumber: string;
}

export interface Feedback {
  feedbackId: number;
  customerId: number;
  orderId: number;
  rating: number;
  comments?: string;
  submittedDate: Date;
}

export interface Cart {
  cartId: number;
  customerId: number;
  productId: number;
  quantity: number;
  created_at: Date;
}

export interface Delivery {
  id: number;
  orderId: number;
  trackingNumber: string;
  carrier: string;
  status: 'preparing' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed';
  estimated_delivery: Date;
  actual_delivery?: Date;
  shipping_address: string;
  created_at: Date;
  updated_at: Date;
}

export interface Return {
  returnId: number;
  orderId: number;
  productId: number;
  reason: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  refundAmount: number;
  submittedDate: Date;
  processedDate?: Date;
}
