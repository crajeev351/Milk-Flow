import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Plus, Calendar, TrendingUp, AlertCircle, Trash2, Milk } from 'lucide-react';
import { api } from '../services/api';
import { BusinessExpense, MilkProcurement } from '../types';

export const Expenses: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Expense Modal
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [newExp, setNewExp] = useState({
    title: '',
    category: 'transport',
    amount: '',
    notes: '',
  });

  // Procurement Modal
  const [isProcOpen, setIsProcOpen] = useState(false);
  const [newProc, setNewProc] = useState({
    supplier_name: 'Bhairavnath Dairy Farm',
    purchase_quantity: 120,
    purchase_rate: 44.0,
    notes: 'Tanker supply',
  });

  const { data: reconciliation, refetch: refetchRecon } = useQuery({
    queryKey: ['reconciliation', selectedDate],
    queryFn: () => api.getProcurementReconciliation(selectedDate),
  });

  const { data: expenses = [], refetch: refetchExp } = useQuery<BusinessExpense[]>({
    queryKey: ['expenses'],
    queryFn: () => api.getExpenses(),
  });

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addExpense({
        title: newExp.title,
        category: newExp.category,
        amount: parseFloat(newExp.amount) || 0,
        date: selectedDate,
        notes: newExp.notes || undefined,
      });
      setIsExpenseOpen(false);
      setNewExp({ title: '', category: 'transport', amount: '', notes: '' });
      refetchExp();
      refetchRecon();
      alert('Expense recorded!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddProcurement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addProcurement({
        supplier_name: newProc.supplier_name,
        purchase_quantity: Number(newProc.purchase_quantity),
        purchase_rate: Number(newProc.purchase_rate),
        date: selectedDate,
        notes: newProc.notes || undefined,
      });
      setIsProcOpen(false);
      refetchRecon();
      alert('Procurement log saved!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.deleteExpense(id);
      refetchExp();
      refetchRecon();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
            Milk Procurement & Expenses
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Reconcile purchased milk vs sold milk and track operating costs & estimated profit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsProcOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs"
          >
            <Milk className="w-4 h-4" />
            <span>Log Milk Purchase</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpenseOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* RECONCILIATION CARD */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Daily Milk & Profit Reconciliation</h3>
            <p className="text-xs text-slate-400">Comparing intake volume against actual consumer deliveries</p>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold px-3 py-1 border border-slate-300 rounded-xl bg-slate-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl">
            <span className="text-[10px] font-bold text-blue-700 uppercase">Milk Purchased</span>
            <p className="text-2xl font-black text-blue-900 font-heading mt-1">
              {reconciliation?.milk_purchased_litres || 0} L
            </p>
            <span className="text-[10px] text-blue-600/80 mt-1 block">
              Cost: ₹{reconciliation?.procurement_cost?.toLocaleString('en-IN') || 0}
            </span>
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
            <span className="text-[10px] font-bold text-emerald-700 uppercase">Milk Sold</span>
            <p className="text-2xl font-black text-emerald-900 font-heading mt-1">
              {reconciliation?.milk_sold_litres || 0} L
            </p>
            <span className="text-[10px] text-emerald-600/80 mt-1 block">
              Revenue: ₹{reconciliation?.sales_revenue?.toLocaleString('en-IN') || 0}
            </span>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl">
            <span className="text-[10px] font-bold text-amber-700 uppercase">Remaining / Buffer</span>
            <p className="text-2xl font-black text-amber-900 font-heading mt-1">
              {reconciliation?.milk_remaining_litres || 0} L
            </p>
            <span className="text-[10px] text-amber-600/80 mt-1 block">Unsold / Dairy storage</span>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated Daily Profit</span>
            <p className={`text-2xl font-black font-heading mt-1 ${reconciliation?.estimated_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ₹{reconciliation?.estimated_profit?.toLocaleString('en-IN') || 0}
            </p>
            <span className="text-[10px] text-slate-400 mt-1 block">Revenue minus all expenses</span>
          </div>
        </div>
      </div>

      {/* EXPENSES LEDGER */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">Recent Operating Expenses</h4>
          <span className="text-xs text-slate-400">{expenses.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Title</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Notes</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{e.date}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{e.title}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                      {e.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{e.notes || '—'}</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900 font-heading">
                    ₹{e.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(e.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD EXPENSE MODAL */}
      {isExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Record Operating Expense</h3>
              <button onClick={() => setIsExpenseOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddExpense} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Van Petrol, Packaging foil, Worker wage"
                  value={newExp.title}
                  onChange={(e) => setNewExp({ ...newExp, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newExp.category}
                    onChange={(e) => setNewExp({ ...newExp, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="transport">Transportation / Diesel</option>
                    <option value="packaging">Packaging Pouches</option>
                    <option value="electricity">Electricity / Cold Storage</option>
                    <option value="wages">Staff Wages</option>
                    <option value="other">Other Supplies</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={newExp.amount}
                    onChange={(e) => setNewExp({ ...newExp, amount: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Receipt / vendor name..."
                  value={newExp.notes}
                  onChange={(e) => setNewExp({ ...newExp, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOG PROCUREMENT MODAL */}
      {isProcOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Log Milk Procurement</h3>
              <button onClick={() => setIsProcOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddProcurement} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dairy Farm / Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={newProc.supplier_name}
                  onChange={(e) => setNewProc({ ...newProc, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Qty (L) *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={newProc.purchase_quantity}
                    onChange={(e) => setNewProc({ ...newProc, purchase_quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Rate (₹/L) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newProc.purchase_rate}
                    onChange={(e) => setNewProc({ ...newProc, purchase_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-blue-50 text-blue-900 text-xs font-bold rounded-xl flex justify-between">
                <span>Total Procurement Cost:</span>
                <span>₹{(newProc.purchase_quantity * newProc.purchase_rate).toFixed(2)}</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProcOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  Save Procurement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
