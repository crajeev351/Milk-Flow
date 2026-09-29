import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, Calendar, Search, Filter, Download, Send,
  IndianRupee, CheckCircle2, AlertCircle, RefreshCw, FileText,
  ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { api } from '../services/api';
import { Bill } from '../types';
import { WhatsAppModal } from '../components/WhatsAppModal';
import { PaymentModal } from '../components/PaymentModal';

export const Bills: React.FC = () => {
  const queryClient = useQueryClient();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);

  // WhatsApp Modal
  const [waModal, setWaModal] = useState<{
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

  // Payment Modal
  const [payModal, setPayModal] = useState<{
    isOpen: boolean;
    customerId: number;
    customerName: string;
    billId?: number;
    billNumber?: string;
    defaultAmount: number;
  }>({
    isOpen: false,
    customerId: 0,
    customerName: '',
    defaultAmount: 0,
  });

  const { data: bills = [], isLoading, refetch } = useQuery<Bill[]>({
    queryKey: ['bills', selectedYear, selectedMonth, statusFilter],
    queryFn: () => api.getBills({
      year: selectedYear,
      month: selectedMonth,
      status_filter: statusFilter === 'all' ? undefined : statusFilter,
    }),
  });

  const filteredBills = bills.filter(b => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = b.customer_name?.toLowerCase().includes(q);
      const matchBill = b.bill_number?.toLowerCase().includes(q);
      const matchPhone = b.customer_phone?.toLowerCase().includes(q);
      if (!matchName && !matchBill && !matchPhone) return false;
    }
    return true;
  });

  const handleGenerateAllBills = async () => {
    const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    if (!window.confirm(`Generate monthly bills for all active customers for ${monthName}?`)) {
      return;
    }

    const start_d = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0];
    const next_m = selectedMonth < 12 ? selectedMonth : 0;
    const next_y = selectedMonth < 12 ? selectedYear : selectedYear + 1;
    const end_d = new Date(next_y, next_m, 0).toISOString().split('T')[0];

    try {
      setIsGenerating(true);
      const generated = await api.generateBills({
        period_start: start_d,
        period_end: end_d,
      });
      await refetch();
      alert(`Successfully generated/updated ${generated.length} customer bills!`);
    } catch (err: any) {
      alert(`Error generating bills: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareWhatsApp = async (bill: Bill) => {
    try {
      const payload = await api.getBillWhatsAppPayload(bill.id);
      setWaModal({
        isOpen: true,
        customerName: payload.customer_name,
        phone: payload.phone,
        message: payload.message,
        url: payload.whatsapp_url,
      });
    } catch (err: any) {
      alert(`Failed to prepare WhatsApp message: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
            Monthly Billing & Invoices
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated billing engine, itemized rate brackets, ReportLab PDF bills, and WhatsApp delivery
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateAllBills}
          disabled={isGenerating}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
        >
          <Receipt className="w-4 h-4" />
          <span>{isGenerating ? 'Calculating Bills...' : 'Generate All Bills for Month'}</span>
        </button>
      </div>

      {/* Filter & Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        {/* Month & Year Selectors */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          >
            {[
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ].map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          >
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customer name, bill #, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none w-full sm:w-auto"
        >
          <option value="all">All Statuses</option>
          <option value="generated">Generated / Pending</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* BILLS LIST */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading bills...</p>
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
          <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No bills found for this period</p>
          <p className="text-xs text-slate-400 mt-1">
            Click "Generate All Bills for Month" to compute deliveries for all customers.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBills.map((b) => {
            const isExpanded = expandedBillId === b.id;
            const isPaid = b.status === 'paid';
            const isPartPaid = b.status === 'partially_paid';

            return (
              <div
                key={b.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-emerald-200"
              >
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Bill Details Header */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">
                        {b.customer_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        #{b.bill_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPartPaid
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      Period: <b>{new Date(b.period_start).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</b> - <b>{new Date(b.period_end).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</b>
                      {' • '}Delivered: <b className="text-slate-800">{b.total_quantity} L</b>
                    </p>
                  </div>

                  {/* Financial Figures */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Total Due</div>
                      <span className="text-sm font-black text-slate-900 font-heading">
                        ₹{b.total_due.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Balance Due</div>
                      <span className={`text-sm font-black font-heading ${b.balance_remaining > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        ₹{b.balance_remaining.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      {/* Breakdown Toggle */}
                      <button
                        type="button"
                        onClick={() => setExpandedBillId(isExpanded ? null : b.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title="View itemized breakdown"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>

                      {/* PDF Download */}
                      <a
                        href={api.getBillPdfUrl(b.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                        title="Download ReportLab PDF Bill"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">PDF</span>
                      </a>

                      {/* WhatsApp Share */}
                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(b)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors"
                        title="Share on WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>

                      {/* Inline Record Pay */}
                      {b.balance_remaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayModal({
                            isOpen: true,
                            customerId: b.customer_id,
                            customerName: b.customer_name || '',
                            billId: b.id,
                            billNumber: b.bill_number,
                            defaultAmount: b.balance_remaining,
                          })}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors"
                        >
                          Pay
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* EXPANDABLE ITEMIZED BREAKDOWN */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-xs space-y-3 animate-in fade-in duration-150">
                    <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Itemized Rate & Period Breakdown
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="text-[10px] text-slate-500 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-1">Rate Bracket</th>
                            <th className="py-1">Rate (₹)</th>
                            <th className="py-1">Delivered (L)</th>
                            <th className="py-1 text-right">Subtotal (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60">
                          {b.items?.map((item, idx) => (
                            <tr key={idx}>
                              <td className="py-1.5 font-medium text-slate-800">
                                {item.rate_period_description || item.product_name}
                              </td>
                              <td className="py-1.5 text-slate-600">₹{item.rate.toFixed(2)}</td>
                              <td className="py-1.5 font-bold">{item.total_quantity}</td>
                              <td className="py-1.5 font-bold text-right text-slate-900">
                                ₹{item.total_amount.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center text-[11px] text-slate-600">
                      <div>
                        <span>Current Milk: ₹{b.milk_total_amount.toFixed(2)}</span>
                        {b.previous_balance > 0 && <span className="ml-3 text-amber-700 font-bold">+ Previous Bal: ₹{b.previous_balance.toFixed(2)}</span>}
                        {b.discount_amount > 0 && <span className="ml-3 text-emerald-700 font-bold">- Discount: ₹{b.discount_amount.toFixed(2)}</span>}
                      </div>

                      <div>
                        <span>Paid: <b>₹{b.amount_paid.toFixed(2)}</b></span>
                        <span className="ml-3 text-red-600 font-black">Net Due: ₹{b.balance_remaining.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={waModal.isOpen}
        onClose={() => setWaModal({ ...waModal, isOpen: false })}
        title="Share Monthly Bill"
        customerName={waModal.customerName}
        phone={waModal.phone}
        message={waModal.message}
        whatsappUrl={waModal.url}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={payModal.isOpen}
        onClose={() => setPayModal({ ...payModal, isOpen: false })}
        customerId={payModal.customerId}
        customerName={payModal.customerName}
        billId={payModal.billId}
        billNumber={payModal.billNumber}
        defaultAmount={payModal.defaultAmount}
        onSuccess={() => {
          refetch();
          alert('Payment successfully allocated to bill!');
        }}
      />
    </div>
  );
};
