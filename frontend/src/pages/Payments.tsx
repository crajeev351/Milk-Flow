import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  IndianRupee, Plus, Search, Calendar, CheckCircle2,
  FileCheck, Receipt, CreditCard, Banknote, Smartphone
} from 'lucide-react';
import { api } from '../services/api';
import { Payment, Customer } from '../types';
import { PaymentModal } from '../components/PaymentModal';

export const Payments: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState<string>('');
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);

  // New Payment Modal
  const [isRecordOpen, setIsRecordOpen] = useState<boolean>(false);
  const [selectedCustId, setSelectedCustId] = useState<number>(0);

  const { data: payments = [], isLoading, refetch } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: () => api.getPayments(),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers_simple'],
    queryFn: () => api.getCustomers(),
  });

  const filteredPayments = payments.filter(p => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.customer_name?.toLowerCase().includes(q);
      const matchReceipt = p.receipt_number?.toLowerCase().includes(q);
      const matchRef = p.reference_number?.toLowerCase().includes(q);
      if (!matchName && !matchReceipt && !matchRef) return false;
    }
    return true;
  });

  const totalCollected = payments.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
            Payment Records & Receipts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log collections (Cash, UPI, NEFT) with instant receipts and bill allocation
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (customers.length > 0) setSelectedCustId(customers[0].id);
            setIsRecordOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Payment</span>
        </button>
      </div>

      {/* KPI Card */}
      <div className="p-4 bg-emerald-900 text-white rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Total Payments Tracked</span>
          <p className="text-2xl font-black font-heading mt-0.5">
            ₹{totalCollected.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-emerald-200">{payments.length} Transactions</span>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, receipt #, reference ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* PAYMENTS TABLE */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading payment ledger...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
          No payment records found matching your search.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Receipt #</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4">Allocated Bill</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {p.receipt_number}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {p.customer_name}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 uppercase font-bold text-[10px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md inline-flex">
                        {p.payment_method === 'upi' ? <Smartphone className="w-3 h-3 text-emerald-600" /> : <Banknote className="w-3 h-3 text-emerald-600" />}
                        {p.payment_method}
                      </span>
                      {p.reference_number && (
                        <span className="block text-[10px] text-slate-400 mt-0.5 font-mono">Ref: {p.reference_number}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.bill_number ? `Bill #${p.bill_number}` : 'Oldest Pending Bills'}
                    </td>
                    <td className="py-3 px-4 font-black text-emerald-700 text-right font-heading text-sm">
                      ₹{p.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentForReceipt(p)}
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECEIPT VIEW MODAL */}
      {selectedPaymentForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-6 text-center bg-emerald-700 text-white">
              <CheckCircle2 className="w-10 h-10 text-emerald-200 mx-auto mb-2" />
              <h3 className="text-lg font-black font-heading">Payment Receipt</h3>
              <p className="text-xs text-emerald-200 font-mono mt-0.5">
                Receipt #{selectedPaymentForReceipt.receipt_number}
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="text-center py-2 border-y border-dashed border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Amount Received</span>
                <p className="text-3xl font-black text-emerald-700 font-heading mt-0.5">
                  ₹{selectedPaymentForReceipt.amount.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <b className="text-slate-900">{selectedPaymentForReceipt.customer_name}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Date:</span>
                  <b>{new Date(selectedPaymentForReceipt.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Method:</span>
                  <b className="uppercase">{selectedPaymentForReceipt.payment_method}</b>
                </div>
                {selectedPaymentForReceipt.reference_number && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reference No:</span>
                    <b className="font-mono">{selectedPaymentForReceipt.reference_number}</b>
                  </div>
                )}
                {selectedPaymentForReceipt.bill_number && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Allocated To:</span>
                    <b>Bill #{selectedPaymentForReceipt.bill_number}</b>
                  </div>
                )}
              </div>

              <div className="pt-2 text-center text-[10px] text-slate-400">
                Shree Krishna Dairy & Milk Services • Official Payment Confirmation
              </div>

              <button
                type="button"
                onClick={() => setSelectedPaymentForReceipt(null)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isRecordOpen && customers.length > 0 && (
        <PaymentModal
          isOpen={isRecordOpen}
          onClose={() => setIsRecordOpen(false)}
          customerId={selectedCustId || customers[0].id}
          customerName={customers.find(c => c.id === (selectedCustId || customers[0].id))?.name || ''}
          defaultAmount={customers.find(c => c.id === (selectedCustId || customers[0].id))?.current_balance || 500}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['bills'] });
            alert('Payment recorded and allocated successfully!');
          }}
        />
      )}
    </div>
  );
};
