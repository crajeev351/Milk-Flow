import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Plus, Phone, MapPin, ChevronRight,
  Filter, PauseCircle, PlayCircle, UserX, UserCheck, IndianRupee, Bike
} from 'lucide-react';
import { api } from '../services/api';
import { Customer, Product, User } from '../types';

export const Customers: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [slotFilter, setSlotFilter] = useState<string>('all');

  // Add Customer Modal
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [newCust, setNewCust] = useState({
    name: '',
    phone: '',
    alternate_phone: '',
    address: '',
    area: 'Kothrud',
    default_delivery_time: 'morning',
    assigned_worker_id: '',
    initial_product_id: 1,
    initial_quantity: 1.0,
    initial_rate: '',
  });

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', search, statusFilter, areaFilter, slotFilter],
    queryFn: () => api.getCustomers({
      search: search.trim() || undefined,
      status_filter: statusFilter === 'all' ? undefined : statusFilter,
      area_filter: areaFilter === 'all' ? undefined : areaFilter,
      delivery_time: slotFilter === 'all' ? undefined : slotFilter,
    }),
  });

  const { data: riders = [] } = useQuery<User[]>({
    queryKey: ['riders'],
    queryFn: () => api.getRiders(),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  const distinctAreas = useMemo(() => {
    const s = new Set<string>();
    customers.forEach(c => { if (c.area) s.add(c.area); });
    return Array.from(s);
  }, [customers]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCustomer({
        name: newCust.name,
        phone: newCust.phone,
        alternate_phone: newCust.alternate_phone || undefined,
        address: newCust.address,
        area: newCust.area,
        default_delivery_time: newCust.default_delivery_time,
        assigned_worker_id: newCust.assigned_worker_id ? Number(newCust.assigned_worker_id) : undefined,
        initial_product_id: Number(newCust.initial_product_id),
        initial_quantity: Number(newCust.initial_quantity),
        initial_rate: newCust.initial_rate ? parseFloat(newCust.initial_rate) : undefined,
      });
      setIsAddOpen(false);
      setNewCust({
        name: '',
        phone: '',
        alternate_phone: '',
        address: '',
        area: 'Kothrud',
        default_delivery_time: 'morning',
        assigned_worker_id: '',
        initial_product_id: 1,
        initial_quantity: 1.0,
        initial_rate: '',
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      alert('Customer created successfully with daily milk subscription!');
    } catch (err: any) {
      alert(`Error creating customer: ${err.message}`);
    }
  };

  const handleToggleStatus = async (c: Customer) => {
    const nextStatus = c.status === 'active' ? 'inactive' : 'active';
    const actionName = nextStatus === 'inactive' ? 'Deactivate' : 'Reactivate';
    if (!window.confirm(`${actionName} customer "${c.name}"? Historical delivery and billing records will remain fully preserved.`)) {
      return;
    }
    try {
      await api.setCustomerStatus(c.id, nextStatus as any);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
            Customers & Subscriptions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage daily subscribers, custom rates, delivery addresses, and status
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, phone, code, area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Area Filter */}
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          >
            <option value="all">All Areas</option>
            {distinctAreas.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Slot Filter */}
          <select
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          >
            <option value="all">All Slots</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>

      {/* Customer Cards List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading customers...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No customers found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or click Add New Customer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {customers.map((c) => {
            const hasBalance = (c.current_balance || 0) > 0;
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/customers/${c.id}`)}
                className="group p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {c.customer_code}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {c.name}
                      </h3>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full uppercase tracking-wider ${
                        c.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'paused'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{c.phone}</span>
                  </p>

                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 truncate">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{c.address}, {c.area}</span>
                  </p>

                  <p className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-200/60 px-2 py-0.5 rounded-md flex items-center gap-1 mt-2 font-medium self-start">
                    <Bike className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Rider: <strong>{c.assigned_worker_name || (c.assigned_worker_id === 2 ? 'Santosh Jadhav' : c.assigned_worker_id === 1 ? 'Rajesh Sharma' : 'Unassigned')}</strong></span>
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="font-semibold text-slate-700 capitalize">{c.default_delivery_time}</span>
                    <span>• Route #{c.route_sequence || 1}</span>
                  </div>

                  {hasBalance ? (
                    <span className="text-xs font-black text-red-600 font-heading">
                      Due: ₹{c.current_balance?.toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-600">
                      Paid Up ✓
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Add New Customer</h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kulkarni"
                    value={newCust.name}
                    onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="98XXXXXXXX"
                    value={newCust.phone}
                    onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Area / Locality *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kothrud"
                    value={newCust.area}
                    onChange={(e) => setNewCust({ ...newCust, area: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Slot</label>
                  <select
                    value={newCust.default_delivery_time}
                    onChange={(e) => setNewCust({ ...newCust, default_delivery_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="morning">Morning (6:00 - 8:00 AM)</option>
                    <option value="evening">Evening (5:00 - 7:00 PM)</option>
                    <option value="both">Both Morning & Evening</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Delivery Rider</label>
                  <select
                    value={newCust.assigned_worker_id}
                    onChange={(e) => setNewCust({ ...newCust, assigned_worker_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="">-- Unassigned --</option>
                    {riders.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.full_name} ({r.role === 'admin' ? 'Owner' : 'Rider'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Address *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Flat No, Building Name, Street Landmark..."
                  value={newCust.address}
                  onChange={(e) => setNewCust({ ...newCust, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Initial Subscription Details */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-3">
                <p className="text-xs font-bold text-emerald-900">Regular Milk Subscription</p>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Product</label>
                    <select
                      value={newCust.initial_product_id}
                      onChange={(e) => setNewCust({ ...newCust, initial_product_id: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Daily Qty (L)</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      required
                      value={newCust.initial_quantity}
                      onChange={(e) => setNewCust({ ...newCust, initial_quantity: parseFloat(e.target.value) || 1 })}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Custom Rate (₹)</label>
                    <input
                      type="number"
                      placeholder="Default"
                      value={newCust.initial_rate}
                      onChange={(e) => setNewCust({ ...newCust, initial_rate: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-2 px-4 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
