export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'worker';
  is_active: boolean;
  created_at: string;
}

export interface Business {
  id: number;
  name: string;
  owner_name: string;
  phone: string;
  alternate_phone?: string;
  address?: string;
  email?: string;
  currency: string;
  currency_symbol: string;
  billing_cycle: string;
  upi_id?: string;
  invoice_prefix: string;
}

export interface ProductPriceHistory {
  id: number;
  product_id: number;
  price: number;
  effective_from: string;
  effective_to?: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  category: string;
  unit: string;
  default_price: number;
  is_active: boolean;
  price_history?: ProductPriceHistory[];
}

export interface CustomerPause {
  id: number;
  customer_id: number;
  start_date: string;
  end_date?: string;
  reason?: string;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: number;
  customer_id: number;
  product_id: number;
  product?: Product;
  default_quantity: number;
  unit: string;
  custom_rate?: number;
  delivery_frequency: string;
  delivery_time: string;
  is_active: boolean;
  start_date: string;
  end_date?: string;
}

export interface Customer {
  id: number;
  customer_code: string;
  name: string;
  phone: string;
  alternate_phone?: string;
  address: string;
  area: string;
  email?: string;
  status: 'active' | 'paused' | 'inactive';
  default_delivery_time: 'morning' | 'evening' | 'both';
  assigned_worker_id?: number;
  route_sequence: number;
  notes?: string;
  start_date: string;
  end_date?: string;
  current_balance?: number;
  total_delivered_this_month?: number;
  assigned_worker_name?: string;
  subscriptions?: Subscription[];
  pauses?: CustomerPause[];
}

export interface DeliverySheetItem {
  customer_id: number;
  customer_code: string;
  customer_name: string;
  phone: string;
  address: string;
  area: string;
  route_sequence: number;
  product_id: number;
  product_name: string;
  unit: string;
  subscription_id?: number;
  delivery_time: string;
  is_paused: boolean;
  pause_reason?: string;
  scheduled_quantity: number;
  actual_quantity: number;
  applied_rate: number;
  status: 'delivered' | 'skipped' | 'pending' | 'absent' | 'holiday';
  skip_reason?: string;
  existing_record_id?: number;
  notes?: string;
  delivered_at?: string;
  worker_name?: string;
  assigned_worker_id?: number;
  assigned_worker_name?: string;
}

export interface DeliveryNotification {
  id: number;
  delivery_record_id?: number;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  worker_id?: number;
  worker_name?: string;
  title: string;
  message: string;
  quantity: number;
  product_name?: string;
  status: string;
  is_read: boolean;
  created_at: string;
}

export interface DeliveryNotificationListResponse {
  notifications: DeliveryNotification[];
  unread_count: number;
}

export interface SingleDeliveryRecordResponse {
  delivery_record: DeliveryRecord;
  notification?: DeliveryNotification;
  customer_name: string;
  customer_phone: string;
  customer_whatsapp_message: string;
  customer_whatsapp_url: string;
  whatsapp_message: string;
  whatsapp_url: string;
  owner_phone: string;
  owner_whatsapp_message?: string;
  owner_whatsapp_url?: string;
}



export interface DeliveryRecord {
  id: number;
  customer_id: number;
  customer_name?: string;
  product_id: number;
  product_name?: string;
  delivery_date: string;
  delivery_time: string;
  scheduled_quantity: number;
  actual_quantity: number;
  applied_rate: number;
  status: string;
  skip_reason?: string;
  notes?: string;
  created_at: string;
}

export interface BillItem {
  id: number;
  product_id: number;
  product_name?: string;
  rate: number;
  total_quantity: number;
  total_amount: number;
  rate_period_description?: string;
}

export interface Bill {
  id: number;
  bill_number: string;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  period_start: string;
  period_end: string;
  total_quantity: number;
  milk_total_amount: number;
  previous_balance: number;
  additional_charges: number;
  discount_amount: number;
  total_due: number;
  amount_paid: number;
  balance_remaining: number;
  status: 'draft' | 'generated' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  created_at: string;
  items: BillItem[];
}

export interface Payment {
  id: number;
  receipt_number: string;
  customer_id: number;
  customer_name?: string;
  bill_id?: number;
  bill_number?: string;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface BusinessExpense {
  id: number;
  date: string;
  title: string;
  category: string;
  amount: number;
  notes?: string;
  created_at: string;
}

export interface MilkProcurement {
  id: number;
  date: string;
  supplier_name: string;
  purchase_quantity: number;
  purchase_rate: number;
  total_cost: number;
  notes?: string;
  created_at: string;
}

export interface DashboardSummary {
  today: {
    active_customers: number;
    customers_to_deliver: number;
    milk_scheduled: number;
    milk_delivered: number;
    expected_value: number;
    skipped_deliveries: number;
    pending_entries: number;
  };
  monthly: {
    total_milk_sold: number;
    total_revenue: number;
    amount_collected: number;
    outstanding_amount: number;
    unpaid_customers_count: number;
    active_customers_count: number;
  };
  pending_payments: {
    customer_id: number;
    name: string;
    phone: string;
    area: string;
    balance_due: number;
    last_bill_number?: string;
    last_bill_date?: string;
  }[];
  volume_trend: {
    date: string;
    full_date: string;
    volume: number;
  }[];
  revenue_trend: {
    month: string;
    revenue: number;
    collected: number;
  }[];
  product_distribution: {
    product_id: number;
    name: string;
    volume: number;
  }[];
}
