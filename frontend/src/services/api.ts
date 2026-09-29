import {
  User, Business, Product, Customer, Subscription,
  DeliverySheetItem, DeliveryRecord, Bill, Payment,
  BusinessExpense, MilkProcurement, DashboardSummary, CustomerPause,
  DeliveryNotification, DeliveryNotificationListResponse, SingleDeliveryRecordResponse
} from '../types';

const API_BASE = '/api/v1';

class ApiService {
  private tokenKey = 'milkflow_token';
  private userKey = 'milkflow_user';

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setAuth(token: string, user: User) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  getUser(): User | null {
    const raw = localStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) : null;
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.logout();
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      let errorMsg = 'An unexpected error occurred';
      try {
        const errorData = await response.json();
        errorMsg = errorData.detail || errorData.message || errorMsg;
      } catch (e) {
        errorMsg = response.statusText;
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const res = await this.request<{ access_token: string; token_type: string; user: User }>('/auth/login/json', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setAuth(res.access_token, res.user);
    return res;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async getRiders(): Promise<User[]> {
    return this.request<User[]>('/auth/riders');
  }

  // Business
  async getBusiness(): Promise<Business> {
    return this.request<Business>('/business');
  }

  async updateBusiness(data: Partial<Business>): Promise<Business> {
    return this.request<Business>('/business', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Dashboard
  async getDashboard(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('/dashboard');
  }

  // Customers
  async getCustomers(params?: { search?: string; status_filter?: string; area_filter?: string; delivery_time?: string; worker_id?: number }): Promise<Customer[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status_filter) query.set('status_filter', params.status_filter);
    if (params?.area_filter) query.set('area_filter', params.area_filter);
    if (params?.delivery_time) query.set('delivery_time', params.delivery_time);
    if (params?.worker_id) query.set('worker_id', params.worker_id.toString());
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<Customer[]>(`/customers${qs}`);
  }

  async getCustomer(id: number): Promise<Customer> {
    return this.request<Customer>(`/customers/${id}`);
  }

  async createCustomer(data: any): Promise<Customer> {
    return this.request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: number, data: any): Promise<Customer> {
    return this.request<Customer>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async setCustomerStatus(id: number, status: 'active' | 'paused' | 'inactive') {
    return this.request(`/customers/${id}/status?status_val=${status}`, {
      method: 'PATCH',
    });
  }

  async addCustomerPause(customerId: number, data: { start_date: string; end_date?: string; reason?: string }): Promise<CustomerPause> {
    return this.request<CustomerPause>(`/customers/${customerId}/pauses`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelCustomerPause(customerId: number, pauseId: number) {
    return this.request(`/customers/${customerId}/pauses/${pauseId}`, {
      method: 'DELETE',
    });
  }

  async getCustomerDeliveries(customerId: number): Promise<DeliveryRecord[]> {
    return this.request<DeliveryRecord[]>(`/customers/${customerId}/deliveries`);
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return this.request<Product[]>('/products');
  }

  async createProduct(data: Partial<Product>): Promise<Product> {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    return this.request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async addProductPriceHistory(id: number, price: number, effective_from: string) {
    return this.request(`/products/${id}/prices`, {
      method: 'POST',
      body: JSON.stringify({ price, effective_from }),
    });
  }

  // Subscriptions
  async getSubscriptionsByCustomer(customerId: number): Promise<Subscription[]> {
    return this.request<Subscription[]>(`/subscriptions/customer/${customerId}`);
  }

  async createSubscription(data: any): Promise<Subscription> {
    return this.request<Subscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSubscription(id: number, data: any): Promise<Subscription> {
    return this.request<Subscription>(`/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSubscription(id: number) {
    return this.request(`/subscriptions/${id}`, {
      method: 'DELETE',
    });
  }

  // Deliveries
  async getDailyDeliverySheet(dateStr: string, time: string = 'morning', workerId?: number, area?: string, allCustomers?: boolean): Promise<DeliverySheetItem[]> {
    const q = new URLSearchParams({ delivery_date: dateStr, delivery_time: time });
    if (workerId) q.set('worker_id', workerId.toString());
    if (area) q.set('area', area);
    if (allCustomers) q.set('all_customers', 'true');
    return this.request<DeliverySheetItem[]>(`/deliveries/sheet?${q.toString()}`);
  }

  async bulkSaveDeliveries(delivery_date: string, delivery_time: string, entries: any[]) {
    return this.request<{ message: string; count: number }>('/deliveries/bulk', {
      method: 'POST',
      body: JSON.stringify({ delivery_date, delivery_time, entries }),
    });
  }

  async recordSingleDelivery(data: {
    customer_id: number;
    product_id: number;
    delivery_date: string;
    delivery_time?: string;
    actual_quantity: number;
    status: string;
    skip_reason?: string;
    notes?: string;
  }): Promise<SingleDeliveryRecordResponse> {
    return this.request<SingleDeliveryRecordResponse>('/deliveries/record-single', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDeliveryNotifications(limit: number = 50): Promise<DeliveryNotificationListResponse> {
    return this.request<DeliveryNotificationListResponse>(`/deliveries/notifications?limit=${limit}`);
  }

  async markNotificationsRead(notification_ids?: number[]): Promise<{ message: string; count: number }> {
    return this.request<{ message: string; count: number }>('/deliveries/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ notification_ids }),
    });
  }

  async applySameAsYesterday(target_date: string, delivery_time: string = 'morning') {
    return this.request<{ message: string; count: number }>(`/deliveries/same-as-yesterday?target_date=${target_date}&delivery_time=${delivery_time}`, {
      method: 'POST',
    });
  }

  async correctDelivery(id: number, data: { actual_quantity: number; status: string; skip_reason?: string; notes?: string; correction_reason?: string }) {
    return this.request<DeliveryRecord>(`/deliveries/${id}/correct`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Bills
  async getBills(params?: { customer_id?: number; status_filter?: string; year?: number; month?: number }): Promise<Bill[]> {
    const q = new URLSearchParams();
    if (params?.customer_id) q.set('customer_id', params.customer_id.toString());
    if (params?.status_filter) q.set('status_filter', params.status_filter);
    if (params?.year) q.set('year', params.year.toString());
    if (params?.month) q.set('month', params.month.toString());
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<Bill[]>(`/bills${qs}`);
  }

  async generateBills(data: { customer_ids?: number[]; period_start: string; period_end: string; additional_charges?: number; discount_amount?: number }): Promise<Bill[]> {
    return this.request<Bill[]>('/bills/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBill(id: number): Promise<Bill> {
    return this.request<Bill>(`/bills/${id}`);
  }

  async getBillWhatsAppPayload(id: number): Promise<{ message: string; whatsapp_url: string; phone: string; customer_name: string }> {
    return this.request(`/bills/${id}/whatsapp`);
  }

  async updateBillStatus(id: number, status: string) {
    return this.request(`/bills/${id}/status?status_val=${status}`, {
      method: 'PATCH',
    });
  }

  getBillPdfUrl(id: number): string {
    return `${API_BASE}/bills/${id}/pdf`;
  }

  // Payments
  async getPayments(params?: { customer_id?: number; bill_id?: number }): Promise<Payment[]> {
    const q = new URLSearchParams();
    if (params?.customer_id) q.set('customer_id', params.customer_id.toString());
    if (params?.bill_id) q.set('bill_id', params.bill_id.toString());
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<Payment[]>(`/payments${qs}`);
  }

  async recordPayment(data: { customer_id: number; bill_id?: number; amount: number; payment_date: string; payment_method: string; reference_number?: string; notes?: string }): Promise<Payment> {
    return this.request<Payment>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Reports
  async getDailyReport(dateStr: string) {
    return this.request<any>(`/reports/daily?report_date=${dateStr}`);
  }

  async getMonthlyReport(year: number, month: number) {
    return this.request<any>(`/reports/monthly?year=${year}&month=${month}`);
  }

  getExportCustomersUrl(): string {
    return `${API_BASE}/reports/export/customers`;
  }

  getExportDeliveriesUrl(startDate: string, endDate: string): string {
    return `${API_BASE}/reports/export/deliveries?start_date=${startDate}&end_date=${endDate}`;
  }

  // Expenses & Procurement
  async getExpenses(startDate?: string, endDate?: string, category?: string): Promise<BusinessExpense[]> {
    const q = new URLSearchParams();
    if (startDate) q.set('start_date', startDate);
    if (endDate) q.set('end_date', endDate);
    if (category) q.set('category', category);
    return this.request<BusinessExpense[]>(`/expenses?${q.toString()}`);
  }

  async addExpense(data: { title: string; category: string; amount: number; date: string; notes?: string }): Promise<BusinessExpense> {
    return this.request<BusinessExpense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteExpense(id: number) {
    return this.request(`/expenses/${id}`, { method: 'DELETE' });
  }

  async getProcurement(startDate?: string, endDate?: string): Promise<MilkProcurement[]> {
    const q = new URLSearchParams();
    if (startDate) q.set('start_date', startDate);
    if (endDate) q.set('end_date', endDate);
    return this.request<MilkProcurement[]>(`/expenses/procurement?${q.toString()}`);
  }

  async addProcurement(data: { supplier_name: string; purchase_quantity: number; purchase_rate: number; date: string; notes?: string }): Promise<MilkProcurement> {
    return this.request<MilkProcurement>('/expenses/procurement', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProcurementReconciliation(dateStr: string) {
    return this.request<any>(`/expenses/reconciliation?target_date=${dateStr}`);
  }
}

export const api = new ApiService();
