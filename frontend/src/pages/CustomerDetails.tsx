import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Phone, MapPin, Calendar, Clock, Plus,
  PauseCircle, PlayCircle, Edit3, Trash2, IndianRupee,
  CheckCircle2, XCircle, AlertCircle, FileText, Bike, X
} from 'lucide-react';
import { api } from '../services/api';
import { Customer, DeliveryRecord, Subscription, Product, Bill, Payment, User } from '../types';
import { PaymentModal } from '../components/PaymentModal';

export const CustomerDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customerId = Number(id);

  const [activeTab, setActiveTab] = useState<'deliveries' | 'subscriptions' | 'pauses' | 'bills'>('deliveries');

  // Pause Modal
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseStart, setPauseStart] = useState(new Date().toISOString().split('T')[0]);
  const [pauseEnd, setPauseEnd] = useState('');
  const [pauseReason, setPauseReason] = useState('Out of town / Vacation');

  // Sub Modal
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(1);
  const [subQty, setSubQty] = useState(1.0);
  const [subRate, setSubRate] = useState('');

  // Payment Modal
  const [payModalOpen, setPayModalOpen] = useState(false);

  // Edit Delivery Modal
  const [editDeliveryModal, setEditDeliveryModal] = useState<{
    isOpen: boolean;
    record?: DeliveryRecord;
    newQuantity: number;
    newStatus: string;
    skipReason: string;
    correctionReason: string;
  }>({
    isOpen: false,
    newQuantity: 1,
    newStatus: 'delivered',
    skipReason: '',
    correctionReason: '',
  });

  // Edit Customer Profile Modal
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    alternate_phone: '',
    address: '',
    area: '',
    default_delivery_time: 'morning',
    assigned_worker_id: '',
    route_sequence: 0,
    notes: '',
  });

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ['customer', customerId],
    queryFn: () => api.getCustomer(customerId),
  });

  const { data: riders = [] } = useQuery<User[]>({
    queryKey: ['riders'],
    queryFn: () => api.getRiders(),
  });

  const handleOpenEdit = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      phone: customer.phone,
      alternate_phone: customer.alternate_phone || '',
      address: customer.address,
      area: customer.area,
      default_delivery_time: customer.default_delivery_time,
      assigned_worker_id: customer.assigned_worker_id ? String(customer.assigned_worker_id) : '',
      route_sequence: customer.route_sequence || 0,
      notes: customer.notes || '',
    });
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateCustomer(customerId, {
        name: editForm.name,
        phone: editForm.phone,
        alternate_phone: editForm.alternate_phone || undefined,
        address: editForm.address,
        area: editForm.area,
        default_delivery_time: editForm.default_delivery_time,
        assigned_worker_id: editForm.assigned_worker_id ? Number(editForm.assigned_worker_id) : null,
        route_sequence: Number(editForm.route_sequence) || 0,
        notes: editForm.notes || undefined,
      });
      setEditProfileOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['driver_sheet'] });
      alert('Customer details and assigned rider updated successfully!');
    } catch (err: any) {
      alert(`Error updating customer: ${err.message || 'Failed'}`);
    }
  };

  const { data: deliveries = [] } = useQuery<DeliveryRecord[]>({
    queryKey: ['customer_deliveries', customerId],
    queryFn: () => api.getCustomerDeliveries(customerId),
  });

  const { data: bills = [] } = useQuery<Bill[]>({
    queryKey: ['customer_bills', customerId],
    queryFn: () => api.getBills({ customer_id: customerId }),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  const handleAddPause = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addCustomerPause(customerId, {
        start_date: pauseStart,
        end_date: pauseEnd || undefined,
        reason: pauseReason,
      });
      setPauseModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      alert('Delivery pause scheduled successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCancelPause = async (pauseId: number) => {
    if (!window.confirm('Resume deliveries early for this customer?')) return;
    try {
      await api.cancelCustomerPause(customerId, pauseId);
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSubscription({
        customer_id: customerId,
        product_id: Number(selectedProduct),
        default_quantity: Number(subQty),
        custom_rate: subRate ? parseFloat(subRate) : undefined,
        delivery_time: 'morning',
        is_active: true,
      });
      setSubModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      alert('Subscription added successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveDeliveryCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDeliveryModal.record) return;

    try {
      await api.correctDelivery(editDeliveryModal.record.id, {
        actual_quantity: Number(editDeliveryModal.newQuantity),
        status: editDeliveryModal.newStatus,
        skip_reason: editDeliveryModal.newStatus === 'skipped' ? editDeliveryModal.skipReason : undefined,
        correction_reason: editDeliveryModal.correctionReason || 'Manual correction by admin',
      });
      setEditDeliveryModal({ ...editDeliveryModal, isOpen: false });
      queryClient.invalidateQueries({ queryKey: ['customer_deliveries', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      alert('Delivery corrected and audit log recorded!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (isLoading || !customer) {
    return (
      <div className="text-center py-16">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">Loading customer profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back & Title */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/customers')}
          className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleOpenEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Edit Details & Rider</span>
          </button>

          <button
            type="button"
            onClick={() => setPauseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>Pause Deliveries</span>
          </button>

          <button
            type="button"
            onClick={() => setPayModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs"
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* CUSTOMER HEADER CARD */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {customer.customer_code}
              </span>
              <h2 className="text-2xl font-black text-slate-900 font-heading">
                {customer.name}
              </h2>
              <span
                className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase ${
                  customer.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : customer.status === 'paused'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {customer.status}
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {customer.phone}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {customer.address}, {customer.area}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Preferred: <b className="capitalize">{customer.default_delivery_time}</b> (Route #{customer.route_sequence})
              </span>
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-900 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold">
                <Bike className="w-3.5 h-3.5 text-emerald-600" />
                <span>Rider: {customer.assigned_worker_name || (customer.assigned_worker_id === 2 ? 'Santosh Jadhav' : customer.assigned_worker_id === 1 ? 'Rajesh Sharma' : 'Unassigned')}</span>
              </span>
            </div>
          </div>

          {/* Financial Stat Pills */}
          <div className="flex items-center gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center min-w-[110px]">
              <span className="text-[10px] font-bold text-slate-500 uppercase">This Month</span>
              <p className="text-lg font-black text-slate-900 font-heading">
                {customer.total_delivered_this_month || 0} L
              </p>
            </div>

            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-center min-w-[120px]">
              <span className="text-[10px] font-bold text-red-600 uppercase">Pending Due</span>
              <p className="text-lg font-black text-red-700 font-heading">
                ₹{customer.current_balance?.toLocaleString('en-IN') || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        {[
          { key: 'deliveries', label: 'Delivery Calendar & History' },
          { key: 'subscriptions', label: `Subscriptions (${customer.subscriptions?.length || 0})` },
          { key: 'pauses', label: `Pause Periods (${customer.pauses?.length || 0})` },
          { key: 'bills', label: `Bills & Invoices (${bills.length})` },
        ].map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              activeTab === t.key
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: DELIVERIES HISTORY */}
      {activeTab === 'deliveries' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Recent Deliveries Log</h3>
            <span className="text-xs text-slate-400">Click edit on any entry to correct past records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">Scheduled</th>
                  <th className="py-2.5 px-4">Delivered</th>
                  <th className="py-2.5 px-4">Applied Rate</th>
                  <th className="py-2.5 px-4">Amount</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No delivery records found for this customer.
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {new Date(d.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4">{d.product_name}</td>
                      <td className="py-3 px-4 text-slate-500">{d.scheduled_quantity} L</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {d.actual_quantity} L
                      </td>
                      <td className="py-3 px-4 text-slate-600">₹{d.applied_rate.toFixed(2)}</td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        ₹{(d.actual_quantity * d.applied_rate).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            d.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {d.status}
                        </span>
                        {d.skip_reason && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">{d.skip_reason}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setEditDeliveryModal({
                            isOpen: true,
                            record: d,
                            newQuantity: d.actual_quantity,
                            newStatus: d.status,
                            skipReason: d.skip_reason || '',
                            correctionReason: '',
                          })}
                          className="p-1 text-slate-400 hover:text-emerald-700 rounded transition-colors"
                          title="Correct entry (Audit logged)"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Active Subscriptions</h3>
            <button
              type="button"
              onClick={() => setSubModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product Subscription</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customer.subscriptions?.map(sub => (
              <div key={sub.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{sub.product?.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Default: <b className="text-slate-800">{sub.default_quantity} {sub.unit}</b> • {sub.delivery_time}
                  </p>
                  <p className="text-xs text-emerald-700 font-bold mt-1">
                    Rate: ₹{sub.custom_rate ? `${sub.custom_rate.toFixed(2)} (Custom)` : `${sub.product?.default_price?.toFixed(2)} (Standard)`}
                  </p>
                </div>

                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PAUSES */}
      {activeTab === 'pauses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Scheduled Pause Intervals</h3>
            <button
              type="button"
              onClick={() => setPauseModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule New Pause</span>
            </button>
          </div>

          <div className="space-y-2">
            {customer.pauses?.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                No pauses on record. Deliveries are active every morning.
              </div>
            ) : (
              customer.pauses?.map(p => (
                <div key={p.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      {new Date(p.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' → '}
                      {p.end_date ? new Date(p.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Indefinite'}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">Reason: {p.reason || 'Vacation'}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${p.is_active ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                      {p.is_active ? 'Active Pause' : 'Completed'}
                    </span>
                    {p.is_active && (
                      <button
                        type="button"
                        onClick={() => handleCancelPause(p.id)}
                        className="text-xs text-emerald-700 font-bold hover:underline"
                      >
                        Resume Early
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BILLS */}
      {activeTab === 'bills' && (
        <div className="space-y-3">
          {bills.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              No bills generated yet for this customer.
            </div>
          ) : (
            bills.map(b => (
              <div key={b.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Bill #{b.bill_number}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full uppercase ${b.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Period: {new Date(b.period_start).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - {new Date(b.period_end).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' • '}{b.total_quantity} L
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900 font-heading">
                      ₹{b.total_due.toLocaleString('en-IN')}
                    </span>
                    {b.balance_remaining > 0 && (
                      <p className="text-[10px] font-bold text-red-600">Due: ₹{b.balance_remaining.toLocaleString('en-IN')}</p>
                    )}
                  </div>

                  <a
                    href={api.getBillPdfUrl(b.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs font-bold transition-colors"
                    title="Download PDF Invoice"
                  >
                    <FileText className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SCHEDULE PAUSE MODAL */}
      {pauseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Schedule Delivery Pause</h3>
              <button onClick={() => setPauseModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddPause} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pause Start Date *</label>
                <input
                  type="date"
                  required
                  value={pauseStart}
                  onChange={(e) => setPauseStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resume Date (Optional)</label>
                <input
                  type="date"
                  value={pauseEnd}
                  onChange={(e) => setPauseEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400">Leave blank for indefinite pause until manually resumed</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Vacation to native place"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPauseModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  Confirm Pause
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SUBSCRIPTION MODAL */}
      {subModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Add Product Subscription</h3>
              <button onClick={() => setSubModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddSubscription} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Std ₹{p.default_price}/{p.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Daily Quantity</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  required
                  value={subQty}
                  onChange={(e) => setSubQty(parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Rate Override (₹)</label>
                <input
                  type="number"
                  placeholder="Leave empty to use standard product price"
                  value={subRate}
                  onChange={(e) => setSubRate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DELIVERY AUDIT MODAL */}
      {editDeliveryModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Correct Delivery Record</h3>
                <p className="text-xs text-slate-400">Audited change with timestamp & user log</p>
              </div>
              <button
                onClick={() => setEditDeliveryModal({ ...editDeliveryModal, isOpen: false })}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDeliveryCorrection} className="p-5 space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                <p><span className="text-slate-500">Date:</span> <b>{editDeliveryModal.record?.delivery_date}</b></p>
                <p><span className="text-slate-500">Product:</span> <b>{editDeliveryModal.record?.product_name}</b></p>
                <p><span className="text-slate-500">Original Quantity:</span> <b>{editDeliveryModal.record?.actual_quantity} L</b></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Actual Quantity (L) *</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  required
                  value={editDeliveryModal.newQuantity}
                  onChange={(e) => setEditDeliveryModal({ ...editDeliveryModal, newQuantity: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Status</label>
                <select
                  value={editDeliveryModal.newStatus}
                  onChange={(e) => setEditDeliveryModal({ ...editDeliveryModal, newStatus: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="delivered">Delivered</option>
                  <option value="skipped">Skipped</option>
                  <option value="absent">Customer Absent</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Reason for Correction *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer took 1L instead of 5L entered by mistake"
                  value={editDeliveryModal.correctionReason}
                  onChange={(e) => setEditDeliveryModal({ ...editDeliveryModal, correctionReason: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditDeliveryModal({ ...editDeliveryModal, isOpen: false })}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Save Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Edit Customer Details</h3>
                  <p className="text-xs text-slate-400">Update contact info, address, route sequence & assigned rider</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Phone *</label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Alternate Phone</label>
                  <input
                    type="tel"
                    value={editForm.alternate_phone}
                    onChange={(e) => setEditForm({ ...editForm, alternate_phone: e.target.value })}
                    placeholder="Optional backup number"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Area / Locality *</label>
                  <input
                    type="text"
                    required
                    value={editForm.area}
                    onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Address *</label>
                <textarea
                  required
                  rows={2}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Flat #, Society, Street..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Rider Assignment & Slot */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                  <Bike className="w-4 h-4 text-emerald-600" />
                  <span>Delivery Logistics & Rider Assignment</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Delivery Rider</label>
                    <select
                      value={editForm.assigned_worker_id}
                      onChange={(e) => setEditForm({ ...editForm, assigned_worker_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Unassigned --</option>
                      {riders.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.full_name} ({r.role === 'admin' ? 'Owner' : 'Rider'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Slot</label>
                    <select
                      value={editForm.default_delivery_time}
                      onChange={(e) => setEditForm({ ...editForm, default_delivery_time: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="morning">Morning (6:00 - 8:00 AM)</option>
                      <option value="evening">Evening (5:00 - 7:00 PM)</option>
                      <option value="both">Both Morning & Evening</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Route Stop Sequence # (Sort Order)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.route_sequence}
                    onChange={(e) => setEditForm({ ...editForm, route_sequence: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. 1, 2, 3..."
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Controls delivery stop order on the rider's phone route sheet</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Special Delivery Instructions / Gate Notes</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="e.g. Ring bell twice, leave bag on door handle"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        customerId={customer.id}
        customerName={customer.name}
        defaultAmount={customer.current_balance || 0}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
          queryClient.invalidateQueries({ queryKey: ['customer_bills', customerId] });
          alert('Payment recorded successfully!');
        }}
      />
    </div>
  );
};
