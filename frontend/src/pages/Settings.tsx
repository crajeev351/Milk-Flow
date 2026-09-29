import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, Save, Building, Phone, Mail, MapPin, QrCode, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { Business } from '../types';

export const Settings: React.FC = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Business>>({});
  const [success, setSuccess] = useState(false);

  const { data: business, isLoading } = useQuery<Business>({
    queryKey: ['business'],
    queryFn: () => api.getBusiness(),
  });

  useEffect(() => {
    if (business) {
      setFormData(business);
    }
  }, [business]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateBusiness(formData);
      queryClient.invalidateQueries({ queryKey: ['business'] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error updating settings: ${err.message}`);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-xs text-slate-500">Loading business settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
          Dairy Business Settings
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure branding, UPI payment handle, address, and invoice numbering
        </p>
      </div>

      {success && (
        <div className="p-3 bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Business settings updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name *</label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Name *</label>
            <input
              type="text"
              required
              value={formData.owner_name || ''}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Phone *</label>
            <input
              type="tel"
              required
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Alternate Phone</label>
            <input
              type="tel"
              value={formData.alternate_phone || ''}
              onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Shop / Dairy Address *</label>
          <input
            type="text"
            required
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Payments & Invoicing</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">UPI ID (for bills)</label>
              <input
                type="text"
                placeholder="dairy@upi"
                value={formData.upi_id || ''}
                onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Prefix</label>
              <input
                type="text"
                value={formData.invoice_prefix || 'INV'}
                onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Currency</label>
              <input
                type="text"
                disabled
                value="INR (₹)"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 text-slate-500 font-bold"
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Business Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
