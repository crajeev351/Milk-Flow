import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Milk, Users, IndianRupee, AlertCircle, CheckCircle2,
  Calendar, ArrowUpRight, Plus, Send, RefreshCw, TrendingUp, Bike
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { api } from '../services/api';
import { DashboardSummary } from '../types';
import { WhatsAppModal } from '../components/WhatsAppModal';
import { PaymentModal } from '../components/PaymentModal';

const COLORS = ['#059669', '#2563eb', '#f59e0b', '#8b5cf6', '#ec4899'];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // WhatsApp reminder modal state
  const [reminderModal, setReminderModal] = useState<{
    isOpen: boolean;
    customerName: string;
    phone: string;
    message: string;
    url: string;
  }>({
    isOpen: false,
    customerName: '',
    phone: '',
    message: '',
    url: '',
  });

  // Payment modal state
  const [payModal, setPayModal] = useState<{
    isOpen: boolean;
    customerId: number;
    customerName: string;
    defaultAmount: number;
  }>({
    isOpen: false,
    customerId: 0,
    customerName: '',
    defaultAmount: 0,
  });

  const { data: summary, isLoading, refetch, isRefetching } = useQuery<DashboardSummary>({
    queryKey: ['dashboard_summary'],
    queryFn: () => api.getDashboard(),
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['dashboard_notifications'],
    queryFn: () => api.getDeliveryNotifications(30),
    refetchInterval: 8000,
  });

  const handleSendReminder = (customer: any) => {
    const bizName = "Shree Krishna Dairy & Milk Services";
    const msg = `Namaste ${customer.name} ji 🙏\n\nFriendly reminder regarding your pending milk balance of *₹${customer.balance_due.toLocaleString('en-IN')}* with *${bizName}*.\n\n📲 Kindly settle conveniently via UPI: *shreekrishna@okaxis*\nThank you! 🥛✨`;
    const cleanPhone = customer.phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;

    setReminderModal({
      isOpen: true,
      customerName: customer.name,
      phone: customer.phone,
      message: msg,
      url: url,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading daily dairy intelligence...</p>
        </div>
      </div>
    );
  }

  const today = summary?.today;
  const monthly = summary?.monthly;

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
            Good Morning, Rajesh! 🥛
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Today is {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/deliveries?view=route')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white shadow-sm transition-all"
          >
            <Bike className="w-3.5 h-3.5 text-emerald-400" />
            <span>Supervise Route Run</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/deliveries')}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm transition-all"
          >
            <Milk className="w-3.5 h-3.5" />
            <span>Record Today's Milk</span>
          </button>
        </div>
      </div>

      {/* QUICK ACTIONS 4-GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => navigate('/deliveries')}
          className="group text-left p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-700/10 hover:shadow-lg hover:scale-[1.01] transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Milk className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-sm font-bold leading-snug">Record Today's Milk</h3>
          <p className="text-[11px] text-emerald-100 mt-0.5">Fast one-tap delivery log</p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/customers')}
          className="group text-left p-4 rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-sm hover:border-emerald-300 hover:shadow-md hover:scale-[1.01] transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold leading-snug">Customers & Rates</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{today?.active_customers || 0} active subscriptions</p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/bills')}
          className="group text-left p-4 rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-sm hover:border-emerald-300 hover:shadow-md hover:scale-[1.01] transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <IndianRupee className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold leading-snug">Generate Bills</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Monthly billing & WhatsApp</p>
        </button>

        <button
          type="button"
          onClick={() => {
            if (summary?.pending_payments && summary.pending_payments.length > 0) {
              const top = summary.pending_payments[0];
              setPayModal({
                isOpen: true,
                customerId: top.customer_id,
                customerName: top.name,
                defaultAmount: top.balance_due,
              });
            } else {
              navigate('/payments');
            }
          }}
          className="group text-left p-4 rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-sm hover:border-emerald-300 hover:shadow-md hover:scale-[1.01] transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold leading-snug">Record Payment</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">UPI, Cash, or Bank Transfer</p>
        </button>
      </div>

      {/* LIVE DELIVERY STREAM WIDGET */}
      {notificationsData?.notifications && notificationsData.notifications.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-4 sm:p-5 rounded-3xl text-white shadow-xl border border-slate-700/60">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5 font-heading">
                <Bike className="w-4 h-4 text-emerald-400" />
                Live Delivery Guy Updates
              </h3>
            </div>
            <button
              onClick={() => navigate('/deliveries?view=route')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
            >
              <span>View Route Run</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Array.from(
              notificationsData.notifications.reduce((map, notif) => {
                if (!map.has(notif.customer_id)) {
                  map.set(notif.customer_id, notif);
                }
                return map;
              }, new Map<number, (typeof notificationsData.notifications)[0]>()).values()
            )
              .slice(0, 6)
              .map((notif) => (
              <div key={notif.id} className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 flex items-start gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  notif.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {notif.status === 'delivered' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-white truncate">{notif.title.replace('Milk Delivered: ', '').replace('Milk Skipped: ', '')}</p>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(notif.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-300 font-semibold mt-0.5">
                    {notif.status === 'delivered' ? `✓ ${notif.quantity} L delivered` : '✕ Delivery Skipped'}
                    {notif.worker_name && ` by ${notif.worker_name}`}
                  </p>
                  {notif.customer_address && (
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">📍 {notif.customer_address}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TODAY'S SNAPSHOT SECTION */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Today's Delivery Progress
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Milk Delivered</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 font-heading">
                {today?.milk_delivered || 0}
              </span>
              <span className="text-xs font-bold text-slate-500">/ {today?.milk_scheduled || 0} L</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${today?.milk_scheduled ? Math.min(100, ((today.milk_delivered / today.milk_scheduled) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Expected Value</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-700 font-heading">
                ₹{today?.expected_value?.toLocaleString('en-IN') || 0}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium mt-3 block">From delivered entries today</span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Entries</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className={`text-2xl font-black font-heading ${today?.pending_entries ? 'text-amber-600' : 'text-slate-900'}`}>
                {today?.pending_entries || 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">customers</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium mt-3 block">Awaiting confirmation</span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Skipped / Paused</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 font-heading">
                {today?.skipped_deliveries || 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">deliveries</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium mt-3 block">Customer vacation or surplus</span>
          </div>
        </div>
      </div>

      {/* MONTHLY SECTION */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
          This Month's Summary ({new Date().toLocaleString('en-IN', { month: 'long' })})
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Milk Sold</span>
            <div className="mt-1 text-2xl font-black text-white font-heading">
              {monthly?.total_milk_sold?.toLocaleString('en-IN') || 0} L
            </div>
            <span className="text-[10px] text-emerald-400 font-medium mt-2 block">Volume delivered</span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <div className="mt-1 text-2xl font-black text-slate-900 font-heading">
              ₹{monthly?.total_revenue?.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-slate-400 font-medium mt-2 block">Billed & unbilled milk</span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount Collected</span>
            <div className="mt-1 text-2xl font-black text-emerald-600 font-heading">
              ₹{monthly?.amount_collected?.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-slate-400 font-medium mt-2 block">Cash & UPI receipts</span>
          </div>

          <div className="p-4 bg-red-50/70 rounded-2xl border border-red-200 shadow-sm">
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Outstanding Balance</span>
            <div className="mt-1 text-2xl font-black text-red-700 font-heading">
              ₹{monthly?.outstanding_amount?.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-[10px] text-red-600/80 font-medium mt-2 block">
              {monthly?.unpaid_customers_count || 0} customers with dues
            </span>
          </div>
        </div>
      </div>

      {/* CHARTS & PENDING PAYMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Milk Volume Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Daily Milk Volume (Last 14 Days)</h4>
              <p className="text-xs text-slate-400">Total litres delivered per day</p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
              Daily Trend
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary?.volume_trend || []}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit="L" />
                <Tooltip
                  formatter={(val: any) => [`${val} Litres`, 'Delivered']}
                  contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '12px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="volume" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#volGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Distribution Pie Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-900">Product Sales Distribution</h4>
            <p className="text-xs text-slate-400">This month by volume</p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary?.product_distribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="volume"
                >
                  {(summary?.product_distribution || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} Units`, 'Quantity']}
                  contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 mt-2">
            {(summary?.product_distribution || []).map((p, idx) => (
              <div key={p.product_id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-slate-600 font-medium truncate max-w-[130px]">{p.name}</span>
                </div>
                <span className="font-bold text-slate-900">{p.volume} L</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PENDING PAYMENTS & REMINDERS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Pending Customer Payments</h4>
            <p className="text-xs text-slate-400">Send polite WhatsApp reminder with one tap</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/bills')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>View All Bills</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {summary?.pending_payments && summary.pending_payments.length > 0 ? (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {summary.pending_payments.map((cust) => (
              <div key={cust.customer_id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{cust.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{cust.area} • {cust.phone}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-black text-red-600 font-heading">
                      ₹{cust.balance_due.toLocaleString('en-IN')}
                    </span>
                    {cust.last_bill_number && (
                      <p className="text-[10px] text-slate-400">Bill #{cust.last_bill_number}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendReminder(cust)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors"
                    title="Send WhatsApp Reminder"
                  >
                    <Send className="w-3 h-3 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayModal({
                      isOpen: true,
                      customerId: cust.customer_id,
                      customerName: cust.name,
                      defaultAmount: cust.balance_due,
                    })}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    Record Pay
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">All caught up!</p>
            <p className="text-[11px] text-slate-400 mt-0.5">No pending customer dues at this moment.</p>
          </div>
        )}
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={reminderModal.isOpen}
        onClose={() => setReminderModal({ ...reminderModal, isOpen: false })}
        title="Payment Reminder"
        customerName={reminderModal.customerName}
        phone={reminderModal.phone}
        message={reminderModal.message}
        whatsappUrl={reminderModal.url}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={payModal.isOpen}
        onClose={() => setPayModal({ ...payModal, isOpen: false })}
        customerId={payModal.customerId}
        customerName={payModal.customerName}
        defaultAmount={payModal.defaultAmount}
        onSuccess={() => {
          refetch();
          alert('Payment recorded successfully!');
        }}
      />
    </div>
  );
};
