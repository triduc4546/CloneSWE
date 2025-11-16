'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Product {
  productId: number;
  name: string;
  description: string;
  price: number;
  category: string;
  requiresPrescription: boolean;
}

interface Customer {
  customerId: number;
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
  dateOfBirth: string;
  gender: string;
}

interface Order {
  orderId: number;
  orderDate: string;
  status: string;
  totalAmount: number;
  customerName: string;
  customerEmail: string;
}

interface DashboardStats {
  customers: number;
  orders: number;
  products: number;
  branches: number;
}

export default function DataDisplay() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  const fetchData = async (endpoint: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/${endpoint}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    const data = await fetchData('dashboard');
    if (data) setStats(data.stats);
  };

  const loadProducts = async () => {
    const data = await fetchData('products');
    if (data) setProducts(data.products || []);
  };

  const loadCustomers = async () => {
    const data = await fetchData('customers');
    if (data) setCustomers(data.customers || []);
  };

  const loadOrders = async () => {
    const data = await fetchData('orders');
    if (data) setOrders(data.orders || []);
  };

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboard();
    else if (activeTab === 'products') loadProducts();
    else if (activeTab === 'customers') loadCustomers();
    else if (activeTab === 'orders') loadOrders();
  }, [activeTab]);

  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.customers || 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.orders || 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.products || 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.branches || 0}</div>
        </CardContent>
      </Card>
    </div>
  );

  const renderProducts = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <Card key={product.productId}>
          <CardHeader>
            <CardTitle className="text-lg">{product.name}</CardTitle>
            <CardDescription>{product.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Price:</span>
                <span className="font-semibold">${product.price}</span>
              </div>
              <div className="flex justify-between">
                <span>Category:</span>
                <Badge variant="secondary">{product.category}</Badge>
              </div>
              {product.requiresPrescription && (
                <Badge variant="destructive">Prescription Required</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderCustomers = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {customers.map((customer) => (
        <Card key={customer.customerId}>
          <CardHeader>
            <CardTitle className="text-lg">{customer.name}</CardTitle>
            <CardDescription>{customer.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div><strong>Phone:</strong> {customer.phoneNumber}</div>
              <div><strong>Address:</strong> {customer.address}</div>
              <div><strong>Gender:</strong> {customer.gender}</div>
              <div><strong>DOB:</strong> {new Date(customer.dateOfBirth).toLocaleDateString()}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.orderId}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Order #{order.orderId}</CardTitle>
                <CardDescription>Customer: {order.customerName}</CardDescription>
              </div>
              <Badge 
                variant={
                  order.status === 'Delivered' ? 'default' :
                  order.status === 'Pending' ? 'secondary' :
                  order.status === 'Cancelled' ? 'destructive' : 'outline'
                }
              >
                {order.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-semibold">${order.totalAmount}</span>
              </div>
              <div className="flex justify-between">
                <span>Order Date:</span>
                <span>{new Date(order.orderDate).toLocaleDateString()}</span>
              </div>
              <div><strong>Customer Email:</strong> {order.customerEmail}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Pharmacy Management System</h1>
      
      <div className="flex space-x-4 mb-6">
        <Button 
          variant={activeTab === 'dashboard' ? 'default' : 'outline'}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </Button>
        <Button 
          variant={activeTab === 'products' ? 'default' : 'outline'}
          onClick={() => setActiveTab('products')}
        >
          Products
        </Button>
        <Button 
          variant={activeTab === 'customers' ? 'default' : 'outline'}
          onClick={() => setActiveTab('customers')}
        >
          Customers
        </Button>
        <Button 
          variant={activeTab === 'orders' ? 'default' : 'outline'}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </Button>
      </div>

      {loading && <div className="text-center py-8">Loading...</div>}

      {!loading && (
        <>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'products' && renderProducts()}
          {activeTab === 'customers' && renderCustomers()}
          {activeTab === 'orders' && renderOrders()}
        </>
      )}
    </div>
  );
}
