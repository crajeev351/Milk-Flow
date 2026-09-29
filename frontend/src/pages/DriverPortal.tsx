import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bike, CheckCircle2, XCircle, Phone, MapPin, MessageSquare,
  Clock, Navigation, ChevronLeft, ChevronRight, Search,
  Calendar, RotateCcw, AlertTriangle, ArrowRight, Check,
  Share2, Sparkles, Filter, ExternalLink, RefreshCw, X, ShieldAlert,
  UserCheck, Send
} from 'lucide-react';
import { api } from '../services/api';
import { DeliverySheetItem, SingleDeliveryRecordResponse, User } from '../types';

const SKIP_REASONS = [
  'Door locked / No one home',
  'Customer out of town / Vacation',
  'Had surplus / Extra milk yesterday',
  'Customer refused today',
  'Dairy shortage / Can empty',
  'Other reason'
];

// Synthesize pleasant success sound using Web Audio API
const playSuccessChime = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Audio may be blocked by browser policy until interaction
  }
};

interface DriverPortalProps {
  isSupervisionMode?: boolean;
}

export const DriverPortal: React.FC<DriverPortalProps> = ({ isSupervisionMode = false }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = api.getUser();

  // Selected date & shift
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [shift, setShift] = useState<'morning' | 'evening'>('morning');
  const [showAllCustomers, setShowAllCustomers] = useState<boolean>(true);
  const [selectedRiderFilter, setSelectedRiderFilter] = useState<string>('all');

  // Search & Filter
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered' | 'skipped'>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');

  // Skip Modal
  const [skipTarget, setSkipTarget] = useState<DeliverySheetItem | null>(null);
  const [skipReason, setSkipReason] = useState<string>(SKIP_REASONS[0]);

  // Custom Quantity Modal
  const [qtyModalTarget, setQtyModalTarget] = useState<DeliverySheetItem | null>(null);
  const [customQty, setCustomQty] = useState<number>(1.0);

  // Delivery Success & WhatsApp Dispatch Modal
  const [deliveryResult, setDeliveryResult] = useState<SingleDeliveryRecordResponse | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Fetch Delivery Sheet with real-time live auto-sync
  const { data: sheet = [], isLoading, refetch, isFetching } = useQuery<DeliverySheetItem[]>({
    queryKey: ['driver_sheet', selectedDate, shift, showAllCustomers],
    queryFn: async () => {
      const workerId = showAllCustomers ? undefined : currentUser?.id;
      return api.getDailyDeliverySheet(selectedDate, shift, workerId, undefined, showAllCustomers);
    },
    refetchInterval: 3000, // Real-time live sync every 3 seconds
  });

  // Fetch All Staff / Riders for selection and filtering
  const { data: riders = [] } = useQuery<User[]>({
    queryKey: ['riders'],
    queryFn: () => api.getRiders(),
  });

  // Filter sheet items by selected rider
  const riderFilteredSheet = useMemo(() => {
    if (selectedRiderFilter === 'all') return sheet;
    if (selectedRiderFilter === 'unassigned') {
      return sheet.filter(i => !i.assigned_worker_id);
    }
    const rId = Number(selectedRiderFilter);
    return sheet.filter(i => i.assigned_worker_id === rId);
  }, [sheet, selectedRiderFilter]);

  // Mutation for single delivery record
  const recordMutation = useMutation({
    mutationFn: (data: {
      customer_id: number;
      product_id: number;
      delivery_date: string;
      delivery_time: string;
      actual_quantity: number;
      status: string;
      skip_reason?: string;
      notes?: string;
    }) => api.recordSingleDelivery(data),
    onSuccess: (res) => {
      playSuccessChime();
      queryClient.invalidateQueries({ queryKey: ['driver_sheet'] });
      queryClient.invalidateQueries({ queryKey: ['delivery_notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
      queryClient.invalidateQueries({ queryKey: ['daily_sheet'] });
      setDeliveryResult(res);
      setShowResultModal(true);
    },
    onError: (err: any) => {
      alert(`Error recording delivery: ${err.message || 'Unknown error'}`);
    }
  });

  // Distinct Areas
  const distinctAreas = useMemo(() => {
    const set = new Set<string>();
    riderFilteredSheet.forEach(i => { if (i.area) set.add(i.area); });
    return Array.from(set);
  }, [riderFilteredSheet]);

  // Filtered Sheet Items
  const filteredItems = useMemo(() => {
    return riderFilteredSheet.filter(item => {
      if (selectedArea !== 'all' && item.area !== selectedArea) return false;
      if (statusFilter === 'pending' && item.status !== 'pending') return false;
      if (statusFilter === 'delivered' && item.status !== 'delivered') return false;
      if (statusFilter === 'skipped' && item.status !== 'skipped') return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.customer_name.toLowerCase().includes(q);
        const matchCode = item.customer_code.toLowerCase().includes(q);
        const matchPhone = item.phone.toLowerCase().includes(q);
        const matchAddr = item.address.toLowerCase().includes(q);
        const matchArea = item.area.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchPhone && !matchAddr && !matchArea) return false;
      }
      return true;
    });
  }, [riderFilteredSheet, selectedArea, statusFilter, search]);

  // Statistics dynamically calculated for currently viewed rider route
  const stats = useMemo(() => {
    const totalStops = riderFilteredSheet.length;
    const deliveredStops = riderFilteredSheet.filter(i => i.status === 'delivered').length;
    const skippedStops = riderFilteredSheet.filter(i => i.status === 'skipped').length;
    const pendingStops = riderFilteredSheet.filter(i => i.status === 'pending').length;
    const totalScheduledLitres = riderFilteredSheet.reduce((acc, i) => acc + (i.is_paused ? 0 : i.scheduled_quantity), 0);
    const totalDeliveredLitres = riderFilteredSheet
      .filter(i => i.status === 'delivered')
      .reduce((acc, i) => acc + i.actual_quantity, 0);

    const percentComplete = totalStops > 0 ? Math.round((deliveredStops / totalStops) * 100) : 0;

    return {
      totalStops,
      deliveredStops,
      skippedStops,
      pendingStops,
      totalScheduledLitres: Math.round(totalScheduledLitres * 10) / 10,
      totalDeliveredLitres: Math.round(totalDeliveredLitres * 10) / 10,
      percentComplete
    };
  }, [riderFilteredSheet]);

  // Next Pending Customer on Route (Spotlight)
  const nextPendingCustomer = useMemo(() => {
    return riderFilteredSheet.find(i => i.status === 'pending' && !i.is_paused);
  }, [riderFilteredSheet]);

  // Quick Action Handlers
  const handleQuickDeliver = (item: DeliverySheetItem) => {
    const qty = item.actual_quantity > 0 ? item.actual_quantity : (item.scheduled_quantity || 1.0);
    recordMutation.mutate({
      customer_id: item.customer_id,
      product_id: item.product_id,
      delivery_date: selectedDate,
      delivery_time: shift,
      actual_quantity: qty,
      status: 'delivered',
      notes: item.notes,
    });
  };

  const handleOpenQtyModal = (item: DeliverySheetItem) => {
    setQtyModalTarget(item);
    setCustomQty(item.actual_quantity > 0 ? item.actual_quantity : item.scheduled_quantity);
  };

  const handleConfirmCustomQty = () => {
    if (!qtyModalTarget) return;
    recordMutation.mutate({
      customer_id: qtyModalTarget.customer_id,
      product_id: qtyModalTarget.product_id,
      delivery_date: selectedDate,
      delivery_time: shift,
      actual_quantity: customQty,
      status: customQty > 0 ? 'delivered' : 'skipped',
      skip_reason: customQty === 0 ? 'Zero quantity recorded' : undefined,
      notes: qtyModalTarget.notes,
    });
    setQtyModalTarget(null);
  };

  const handleOpenSkipModal = (item: DeliverySheetItem) => {
    setSkipTarget(item);
    setSkipReason(SKIP_REASONS[0]);
  };

  const handleConfirmSkip = () => {
    if (!skipTarget) return;
    recordMutation.mutate({
      customer_id: skipTarget.customer_id,
      product_id: skipTarget.product_id,
      delivery_date: selectedDate,
      delivery_time: shift,
      actual_quantity: 0,
      status: 'skipped',
      skip_reason: skipReason,
      notes: skipTarget.notes,
    });
    setSkipTarget(null);
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-12">
      {/* Driver Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-5 rounded-3xl shadow-xl border border-slate-700/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
              <Bike className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight font-heading">
                  {isSupervisionMode || currentUser?.role === 'admin' ? 'Route Run Supervision' : 'Delivery Run Portal'}
                </h1>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {isSupervisionMode || currentUser?.role === 'admin' ? 'SUPERVISION' : 'LIVE'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-950/80 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Live Sync Active
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                {isSupervisionMode || currentUser?.role === 'admin' ? (
                  <>
                    <span>Rider: <strong className="text-emerald-300">Santosh Jadhav</strong></span>
                    <span className="text-slate-500">•</span>
                    <span>Supervisor: <strong className="text-white">{currentUser?.full_name || 'Rajesh Sharma'}</strong> (Dairy Owner)</span>
                  </>
                ) : (
                  <>
                    <span>Rider: <strong className="text-white">{currentUser?.full_name || 'Santosh Jadhav'}</strong></span>
                    <span className="text-slate-500">•</span>
                    <span className="capitalize text-emerald-400 font-medium">{currentUser?.role || 'Worker'}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Shift Toggle */}
          <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700 flex items-center text-xs font-semibold">
            <button
              onClick={() => setShift('morning')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                shift === 'morning'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🌅 Morning
            </button>
            <button
              onClick={() => setShift('evening')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                shift === 'evening'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🌇 Evening
            </button>
          </div>
        </div>

        {/* Date Selector Strip */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-200 px-1 text-sm tracking-wide">
              {new Date(selectedDate).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
            <button
              onClick={() => handleShiftDate(1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {selectedDate !== new Date().toISOString().split('T')[0] && (
              <button
                onClick={handleToday}
                className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              >
                Today
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isSupervisionMode && (
              <button
                onClick={() => setShowAllCustomers(!showAllCustomers)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                  showAllCustomers
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {showAllCustomers ? 'All Route' : 'My Stops Only'}
              </button>
            )}
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Refresh Route"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dynamic Rider Progress & Route Selection Tabs for Dairy Owner */}
        {(isSupervisionMode || currentUser?.role === 'admin') && (
          <div className="mt-3.5 pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-emerald-400" />
                <span>Track Rider Progress:</span>
              </span>
              <span className="text-[11px] text-emerald-300 font-semibold">
                {selectedRiderFilter === 'all'
                  ? 'All Dairy Route Runs'
                  : selectedRiderFilter === 'unassigned'
                  ? 'Unassigned Customers'
                  : `Route of: ${riders.find(r => String(r.id) === selectedRiderFilter)?.full_name || 'Rider'}`}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedRiderFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedRiderFilter === 'all'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                <span>All Riders</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                  selectedRiderFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-900/60 text-slate-400'
                }`}>
                  {sheet.length}
                </span>
              </button>

              {riders.map(r => {
                const total = sheet.filter(i => i.assigned_worker_id === r.id).length;
                const delivered = sheet.filter(i => i.assigned_worker_id === r.id && i.status === 'delivered').length;
                const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRiderFilter(String(r.id))}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      selectedRiderFilter === String(r.id)
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                    }`}
                  >
                    <span>{r.full_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                      selectedRiderFilter === String(r.id) ? 'bg-slate-900 text-emerald-400' : 'bg-slate-900/60 text-emerald-400'
                    }`}>
                      {delivered}/{total} ({pct}%)
                    </span>
                  </button>
                );
              })}

              {sheet.some(i => !i.assigned_worker_id) && (
                <button
                  type="button"
                  onClick={() => setSelectedRiderFilter('unassigned')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedRiderFilter === 'unassigned'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-800/90 text-amber-300 hover:bg-slate-700 border border-slate-700/60'
                  }`}
                >
                  <span>Unassigned</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-900 text-amber-400">
                    {sheet.filter(i => !i.assigned_worker_id).length}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Route Progress Meter */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-slate-300">
              Route Progress: <strong className="text-emerald-400">{stats.deliveredStops}</strong> of {stats.totalStops} Delivered
            </span>
            <span className="text-emerald-400 font-bold">{stats.percentComplete}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
              style={{ width: `${stats.percentComplete}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-2 text-center text-xs">
            <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-800">
              <p className="text-[10px] text-slate-400 font-medium uppercase">Delivered Litres</p>
              <p className="text-sm font-bold text-emerald-400 mt-0.5">{stats.totalDeliveredLitres} L</p>
            </div>
            <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-800">
              <p className="text-[10px] text-slate-400 font-medium uppercase">Scheduled Litres</p>
              <p className="text-sm font-bold text-slate-200 mt-0.5">{stats.totalScheduledLitres} L</p>
            </div>
            <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-800">
              <p className="text-[10px] text-slate-400 font-medium uppercase">Stops Remaining</p>
              <p className="text-sm font-bold text-amber-400 mt-0.5">{stats.pendingStops}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Next Stop Spotlight (If pending customer exists) */}
      {nextPendingCustomer && statusFilter !== 'delivered' && !search && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 p-4 sm:p-5 rounded-3xl shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/70 px-2.5 py-0.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              Next Stop #{nextPendingCustomer.route_sequence || 1}
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-white/80 px-2 py-0.5 rounded-lg border border-emerald-200">
              {nextPendingCustomer.area}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                {nextPendingCustomer.customer_name}
              </h3>
              <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{nextPendingCustomer.address}</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-600 text-white shadow-sm">
                  🥛 {nextPendingCustomer.scheduled_quantity} L {nextPendingCustomer.product_name}
                </span>
                {nextPendingCustomer.notes && (
                  <span className="text-[11px] text-amber-800 bg-amber-100 font-medium px-2 py-0.5 rounded-md border border-amber-200">
                    📝 {nextPendingCustomer.notes}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 sm:pt-0">
              {/* Call */}
              <a
                href={`tel:${nextPendingCustomer.phone}`}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition-colors"
                title="Call Customer"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
              </a>

              {/* Navigation */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextPendingCustomer.address + ', ' + nextPendingCustomer.area)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition-colors"
                title="Google Maps Navigation"
              >
                <Navigation className="w-4 h-4 text-blue-600" />
              </a>

              {/* Big Green Mark Delivered Button */}
              <button
                onClick={() => handleQuickDeliver(nextPendingCustomer)}
                disabled={recordMutation.isPending}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/30 active:scale-95 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>OK / DELIVERED</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer, house #, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Area Filter */}
          {distinctAreas.length > 1 && (
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">All Areas ({distinctAreas.length})</option>
              {distinctAreas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          )}
        </div>

        {/* Status Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Stops ({sheet.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Pending ({stats.pendingStops})
          </button>
          <button
            onClick={() => setStatusFilter('delivered')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'delivered'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Delivered ({stats.deliveredStops})
          </button>
          <button
            onClick={() => setStatusFilter('skipped')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'skipped'
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
            }`}
          >
            Skipped ({stats.skippedStops})
          </button>
        </div>
      </div>

      {/* Customer Stops List - Responsive Grid (1-col Phone, 2-col Tablet/iPad, 3-col Desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {isLoading ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 col-span-full">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            <p className="text-xs font-semibold">Loading delivery route...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 col-span-full">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No stops match your filter</p>
            <p className="text-xs mt-1">Try clearing search or switching status</p>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isDelivered = item.status === 'delivered';
            const isSkipped = item.status === 'skipped';
            const isPending = item.status === 'pending';

            return (
              <div
                key={`${item.customer_id}-${item.product_id}`}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-sm ${
                  isDelivered
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isSkipped
                    ? 'border-red-200 bg-red-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header: Stop # & Customer details */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                      {item.route_sequence || idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          onClick={() => navigate(`/customers/${item.customer_id}`)}
                          className="font-bold text-slate-900 text-sm sm:text-base leading-tight hover:text-emerald-700 cursor-pointer"
                          title="Click to view & edit customer details"
                        >
                          {item.customer_name}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.customer_code}
                        </span>

                        {/* Direct Rider Assignment Dropdown for Dairy Owner */}
                        {isSupervisionMode && (
                          <div className="flex items-center gap-1">
                            <Bike className="w-3 h-3 text-emerald-600 shrink-0" />
                            <select
                              value={item.assigned_worker_id || ''}
                              onChange={async (e) => {
                                const newId = e.target.value ? Number(e.target.value) : null;
                                try {
                                  await api.updateCustomer(item.customer_id, { assigned_worker_id: newId });
                                  queryClient.invalidateQueries({ queryKey: ['driver_sheet'] });
                                  queryClient.invalidateQueries({ queryKey: ['customers'] });
                                } catch (err: any) {
                                  alert(`Failed to assign rider: ${err.message}`);
                                }
                              }}
                              className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md px-1.5 py-0.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                              title="Assign or change delivery rider"
                            >
                              <option value="">Unassigned</option>
                              {riders.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.full_name} ({r.role === 'admin' ? 'Owner' : 'Rider'})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.address}</span>
                        <span className="font-bold text-slate-800">({item.area})</span>
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isDelivered ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Delivered
                      </span>
                    ) : isSkipped ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100/80 px-2.5 py-1 rounded-full border border-red-200">
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                        Skipped
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Delivery Quantity & Product Banner */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl">
                      🥛 {isDelivered ? item.actual_quantity : item.scheduled_quantity} {item.unit}
                    </span>
                    <span className="text-xs text-slate-600 font-medium">
                      {item.product_name} (@ ₹{item.applied_rate})
                    </span>
                    {item.is_paused && (
                      <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full border border-red-200">
                        Paused
                      </span>
                    )}
                  </div>
                </div>

                {/* Delivery Time & Rider Audit Strip */}
                {isDelivered && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                      <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Delivered at {item.delivered_at ? new Date(item.delivered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Earlier Today'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-emerald-800 font-semibold bg-white px-2 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                        Rider: {item.worker_name || 'Santosh Jadhav'}
                      </span>
                      <span className="text-emerald-600 font-bold">✓ Synced</span>
                    </div>
                  </div>
                )}

                {isSkipped && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-red-900 font-bold">
                      <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Skipped {item.delivered_at ? `at ${new Date(item.delivered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                    </div>
                    <div className="text-[11px] text-red-800 font-semibold bg-white px-2 py-0.5 rounded-md border border-red-200 shadow-2xs">
                      Reason: {item.skip_reason || 'Customer Absent'}
                    </div>
                  </div>
                )}

                {isPending && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span className="font-bold">Pending Route Delivery</span>
                    </div>
                    <div className="text-[11px] text-amber-800 font-medium">
                      Scheduled: {item.scheduled_quantity} {item.unit}
                    </div>
                  </div>
                )}

                {/* Skip Reason Note */}
                {isSkipped && item.skip_reason && (
                  <div className="mt-2 text-xs text-red-700 bg-red-50 p-2 rounded-xl border border-red-200">
                    Reason: <strong>{item.skip_reason}</strong>
                  </div>
                )}

                {/* Customer Instruction / Note */}
                {item.notes && (
                  <div className="mt-2 text-xs text-slate-700 bg-amber-50/80 p-2 rounded-xl border border-amber-200">
                    Instruction: <em>{item.notes}</em>
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  {/* Phone & Maps Navigation */}
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${item.phone}`}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Call Customer"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">Call</span>
                    </a>

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address + ', ' + item.area)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Navigate with Google Maps"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden sm:inline">Maps</span>
                    </a>

                    <a
                      href={`https://wa.me/91${item.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1 border border-emerald-200 transition-colors"
                      title="Message Customer on WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  </div>

                  {/* Primary Delivery Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Custom Qty */}
                    <button
                      type="button"
                      onClick={() => handleOpenQtyModal(item)}
                      className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                      title="Adjust custom quantity"
                    >
                      ± Qty
                    </button>

                    {/* Skip */}
                    {!isSkipped && (
                      <button
                        type="button"
                        onClick={() => handleOpenSkipModal(item)}
                        className="px-2.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 transition-colors"
                      >
                        Skip
                      </button>
                    )}

                    {/* Mark Delivered / OK Button */}
                    <button
                      type="button"
                      onClick={() => handleQuickDeliver(item)}
                      disabled={recordMutation.isPending}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 ${
                        isDelivered
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isDelivered ? 'Re-confirm' : 'OK / DELIVERED'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Skip Reason Modal */}
      {skipTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                Skip Delivery
              </h3>
              <button
                onClick={() => setSkipTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3">
              Why could you not deliver milk to <strong>{skipTarget.customer_name}</strong>?
            </p>

            <div className="space-y-2 my-4">
              {SKIP_REASONS.map(r => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    skipReason === r
                      ? 'bg-red-50 text-red-900 border-red-300'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="skip_reason"
                    value={r}
                    checked={skipReason === r}
                    onChange={() => setSkipReason(r)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSkipTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSkip}
                disabled={recordMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/30"
              >
                Confirm Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Quantity Modal */}
      {qtyModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                Adjust Litres Delivered
              </h3>
              <button
                onClick={() => setQtyModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-2">
              Customer: <strong>{qtyModalTarget.customer_name}</strong>
              <br />
              Default scheduled: <strong>{qtyModalTarget.scheduled_quantity} {qtyModalTarget.unit}</strong>
            </p>

            {/* Quick Chips */}
            <div className="grid grid-cols-4 gap-2 my-4">
              {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCustomQty(val)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                    customQty === val
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  {val} L
                </button>
              ))}
            </div>

            {/* Manual Numeric Input */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setCustomQty(prev => Math.max(0, Math.round((prev - 0.5) * 10) / 10))}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-800 text-lg flex items-center justify-center"
              >
                -
              </button>
              <input
                type="number"
                step="0.25"
                min="0"
                value={customQty}
                onChange={(e) => setCustomQty(parseFloat(e.target.value) || 0)}
                className="flex-1 text-center py-2 text-lg font-black border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCustomQty(prev => Math.round((prev + 0.5) * 10) / 10)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-800 text-lg flex items-center justify-center"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQtyModalTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCustomQty}
                disabled={recordMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Confirmation & Customer WhatsApp Dispatch Modal */}
      {showResultModal && deliveryResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 font-heading">
                Milk Delivered! Send Receipt to Customer 🏡
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Recorded for <strong className="text-slate-800">{deliveryResult.customer_name}</strong>. Send the customer an auto-generated WhatsApp delivery slip with exact milk litres, date, and time.
              </p>
            </div>

            {/* Formatted Auto-generated Message Preview */}
            <div className="my-4 p-3.5 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono whitespace-pre-line leading-relaxed border border-slate-800 max-h-52 overflow-y-auto">
              {deliveryResult.customer_whatsapp_message || deliveryResult.whatsapp_message}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <a
                href={deliveryResult.customer_whatsapp_url || deliveryResult.whatsapp_url}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.01] active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Send WhatsApp Receipt to Customer ({deliveryResult.customer_phone})</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyMessage(deliveryResult.customer_whatsapp_message || deliveryResult.whatsapp_message)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  {copiedText ? '✓ Copied to Clipboard' : 'Copy Message Text'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResultModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
                >
                  Next Stop →
                </button>
              </div>

              {/* Optional: Backup link to notify dairy owner */}
              {deliveryResult.owner_whatsapp_url && (
                <div className="pt-2 text-center border-t border-slate-100 mt-2">
                  <a
                    href={deliveryResult.owner_whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 inline-flex items-center gap-1 transition-colors"
                  >
                    <span>Also send alert to Dairy Owner ({deliveryResult.owner_phone})</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
