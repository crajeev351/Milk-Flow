import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Edit3, History, Check, AlertCircle, IndianRupee } from 'lucide-react';
import { api } from '../services/api';
import { Product } from '../types';

export const Products: React.FC = () => {
  const queryClient = useQueryClient();

  // Add Product Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProd, setNewProd] = useState({
    name: '',
    description: '',
    category: 'Milk',
    unit: 'Litre',
    default_price: 60.0,
  });

  // Price History Modal
  const [priceHistoryModal, setPriceHistoryModal] = useState<{
    isOpen: boolean;
    product?: Product;
    newPrice: number;
    effectiveFrom: string;
  }>({
    isOpen: false,
    newPrice: 60,
    effectiveFrom: new Date().toISOString().split('T')[0],
  });

  const { data: products = [], isLoading, refetch } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createProduct({
        name: newProd.name,
        description: newProd.description,
        category: newProd.category,
        unit: newProd.unit,
        default_price: Number(newProd.default_price),
      });
      setIsAddOpen(false);
      setNewProd({ name: '', description: '', category: 'Milk', unit: 'Litre', default_price: 60.0 });
      refetch();
      alert('Product created with initial price history!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceHistoryModal.product) return;

    try {
      await api.addProductPriceHistory(
        priceHistoryModal.product.id,
        Number(priceHistoryModal.newPrice),
        priceHistoryModal.effectiveFrom
      );
      setPriceHistoryModal({ ...priceHistoryModal, isOpen: false });
      refetch();
      alert('Price history bracket updated! Past deliveries will retain historical rates.');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
            Products & Historical Pricing
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure milk varieties, dairy items, and maintain historical rate brackets
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* PRODUCTS GRID */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading products...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div
              key={p.id}
              className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between gap-4 hover:border-emerald-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">
                    {p.category}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.description || 'Standard dairy product'}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Current Standard Rate</span>
                  <span className="text-xl font-black text-slate-900 font-heading">
                    ₹{p.default_price.toFixed(2)}
                    <span className="text-xs text-slate-500 font-normal"> / {p.unit}</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setPriceHistoryModal({
                    isOpen: true,
                    product: p,
                    newPrice: p.default_price,
                    effectiveFrom: new Date().toISOString().split('T')[0],
                  })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                >
                  <History className="w-3.5 h-3.5 text-slate-600" />
                  <span>Update Price</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Add New Product</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddProduct} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gir Cow A2 Milk"
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newProd.category}
                    onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Milk">Milk</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                  <select
                    value={newProd.unit}
                    onChange={(e) => setNewProd({ ...newProd, unit: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Litre">Litre</option>
                    <option value="Kilogram">Kilogram</option>
                    <option value="Piece">Piece</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Rate (₹) *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={newProd.default_price}
                  onChange={(e) => setNewProd({ ...newProd, default_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short description..."
                  value={newProd.description}
                  onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRICE HISTORY BRACKET MODAL */}
      {priceHistoryModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Update Rate History</h3>
                <p className="text-xs text-slate-400">{priceHistoryModal.product?.name}</p>
              </div>
              <button
                onClick={() => setPriceHistoryModal({ ...priceHistoryModal, isOpen: false })}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePrice} className="p-5 space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                <b>Historical Accuracy Guaranteed:</b> Changing the rate starting from a specific date will NOT affect previous deliveries or finalized bills.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Rate (₹ / {priceHistoryModal.product?.unit}) *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={priceHistoryModal.newPrice}
                  onChange={(e) => setPriceHistoryModal({ ...priceHistoryModal, newPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Starting From Date *</label>
                <input
                  type="date"
                  required
                  value={priceHistoryModal.effectiveFrom}
                  onChange={(e) => setPriceHistoryModal({ ...priceHistoryModal, effectiveFrom: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPriceHistoryModal({ ...priceHistoryModal, isOpen: false })}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Save New Rate Bracket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
