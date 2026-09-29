import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Home, Milk, Users, Receipt, IndianRupee, Package,
  FileBarChart, DollarSign, Settings, LogOut, Wifi, WifiOff,
  RefreshCw, X, ChevronRight, Bell, Bike, CheckCircle2, Clock
} from 'lucide-react';
import { api } from '../services/api';
import { OfflineStorage } from '../services/offlineStorage';
import { MobileBottomNav } from './MobileBottomNav';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = api.getUser();

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState<boolean>(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState<boolean>(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Poll for delivery notifications (live delivery updates) every 8 seconds
  const { data: notifData } = useQuery({
    queryKey: ['delivery_notifications'],
    queryFn: () => api.getDeliveryNotifications(25),
    refetchInterval: 8000,
  });

  const markReadMutation = useMutation({
    mutationFn: (ids?: number[]) => api.markNotificationsRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_notifications'] });
    },
  });

  // Close notif dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-mark notifications as read when owner opens the activity feed dropdown
  useEffect(() => {
    if (notifDropdownOpen && (notifData?.unread_count ?? 0) > 0) {
      markReadMutation.mutate(undefined);
    }
  }, [notifDropdownOpen, notifData?.unread_count]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkQueue = () => {
      setOfflineCount(OfflineStorage.getOfflineQueue().length);
    };
    checkQueue();
    const timer = setInterval(checkQueue, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);

  const handleSync = async () => {
    if (!isOnline) {
      alert('Cannot sync while offline. Please connect to internet.');
      return;
    }
    setIsSyncing(true);
    try {
      const result = await OfflineStorage.syncOfflineQueue();
      setOfflineCount(0);
      alert(`Synchronized ${result.syncedCount} queued delivery updates!`);
    } catch (e: any) {
      alert(`Sync failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      api.logout();
      navigate('/login');
    }
  };

  const isWorker = user?.role === 'worker';

  interface NavItem {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
    badge?: string;
  }

  const mainNavItems: NavItem[] = isWorker
    ? [
        { to: '/driver', label: 'Delivery Run Portal', icon: Bike, highlight: true },
      ]
    : [
        { to: '/', label: 'Dashboard', icon: Home },
        { to: '/deliveries', label: 'Deliveries & Route', icon: Milk },
        { to: '/customers', label: 'Customers', icon: Users },
        { to: '/bills', label: 'Monthly Bills', icon: Receipt },
        { to: '/payments', label: 'Payments', icon: IndianRupee },
      ];

  const secondaryNavItems: NavItem[] = isWorker
    ? []
    : [
        { to: '/products', label: 'Products & Rates', icon: Package },
        { to: '/expenses', label: 'Procurement & Expenses', icon: DollarSign },
        { to: '/reports', label: 'Reports & Export', icon: FileBarChart },
        { to: '/settings', label: 'Business Settings', icon: Settings },
      ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Responsive Sidebar: Icon-Rail on Tablet (md), Full Sidebar on Laptop/Desktop (lg) */}
      <aside className="hidden md:flex flex-col md:w-20 lg:w-64 bg-slate-900 text-slate-100 border-r border-slate-800 shrink-0 sticky top-0 h-screen transition-all duration-300">
        {/* Brand Header */}
        <div className="p-4 lg:p-5 border-b border-slate-800/80 flex items-center justify-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-900/30 shrink-0">
              <Milk className="w-6 h-6 text-white" />
            </div>
            <div className="hidden lg:block truncate">
              <h1 className="text-base font-extrabold tracking-tight text-white font-heading">MilkFlow</h1>
              <p className="text-[11px] text-emerald-400 font-medium">
                {isWorker ? 'Delivery Staff Portal' : 'Dairy Operations OS'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto px-2 lg:px-3 py-4 space-y-6">
          <div>
            <p className="hidden lg:block px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {isWorker ? 'Delivery Shift' : 'Daily Workflow'}
            </p>
            <nav className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={({ isActive }) =>
                      `flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      } ${item.highlight && !location.pathname.startsWith('/deliveries') ? 'border border-emerald-500/40' : ''}`
                    }
                  >
                    <Icon className="w-5 h-5 lg:w-4 lg:h-4 shrink-0" />
                    <span className="hidden lg:inline truncate">{item.label}</span>
                    {item.highlight && !isWorker && (
                      <span className="hidden lg:inline ml-auto text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-md font-bold">
                        FAST
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {!isWorker && secondaryNavItems.length > 0 && (
            <div>
              <p className="hidden lg:block px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Business & Analytics
              </p>
              <nav className="space-y-1">
                {secondaryNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      className={({ isActive }) =>
                        `flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="w-5 h-5 lg:w-4 lg:h-4 shrink-0" />
                      <span className="hidden lg:inline truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* User Info & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-center lg:justify-between px-1 lg:px-2 py-1.5">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div
                className="w-8 h-8 rounded-lg bg-emerald-800 text-emerald-100 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer"
                title={`${user?.full_name || 'User'} (${user?.role || 'Admin'})`}
              >
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="hidden lg:block truncate">
                <p className="text-xs font-semibold text-white truncate leading-tight">
                  {user?.full_name || 'User'}
                </p>
                <span className="inline-block text-[10px] text-emerald-400 font-medium capitalize">
                  {user?.role || 'Admin'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-6">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="md:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                <Milk className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-slate-900 font-heading text-base">MilkFlow</span>
            </div>
            <div className="hidden md:block">
              <span className="text-xs text-slate-400 font-medium">
                {isWorker ? 'Delivery Staff Portal' : 'Shree Krishna Dairy & Milk Services'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Online / Offline status badge */}
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  <span className="hidden sm:inline">Online</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full animate-pulse">
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span>Offline Mode</span>
                </span>
              )}

              {/* Pending Offline Sync button */}
              {offlineCount > 0 && (
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={isSyncing || !isOnline}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded-full shadow-sm transition-all"
                  title="Sync cached offline deliveries"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync ({offlineCount})</span>
                </button>
              )}
            </div>

            {/* Live Delivery Notification Bell (Owner only) */}
            {!isWorker && (
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                  className={`relative p-2 rounded-xl transition-all ${
                    notifDropdownOpen
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Real-time Delivery Alerts"
                >
                  <Bell className="w-5 h-5" />
                  {(notifData?.unread_count ?? 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-600 text-white text-[10px] font-black rounded-full px-1 border-2 border-white animate-pulse">
                      {notifData?.unread_count}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Menu */}
                {notifDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bike className="w-4 h-4 text-emerald-400" />
                        <h4 className="font-extrabold text-sm tracking-tight font-heading">
                          Delivery Activity Feed
                        </h4>
                      </div>
                      {(notifData?.unread_count ?? 0) > 0 && (
                        <button
                          onClick={() => markReadMutation.mutate(undefined)}
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {!notifData?.notifications || notifData.notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs">
                          <Bike className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                          No delivery activity logged today yet.
                        </div>
                      ) : (
                        notifData.notifications.map((n) => {
                          const isDelivered = n.status === 'delivered';
                          return (
                            <div
                              key={n.id}
                              className={`p-3.5 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                                !n.is_read ? 'bg-emerald-50/40' : ''
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                  isDelivered
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {isDelivered ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="text-xs font-bold text-slate-900 truncate">
                                    {n.title}
                                  </p>
                                  <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                    {new Date(n.created_at).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                                  {isDelivered
                                    ? `Delivered ${n.quantity} L (${n.product_name || 'Milk'})`
                                    : 'Marked skipped on route'}
                                  {n.worker_name && ` by ${n.worker_name}`}
                                </p>

                                {n.customer_address && (
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    📍 {n.customer_address}
                                  </p>
                                )}
                              </div>

                              {!n.is_read && (
                                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-2" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                      <NavLink
                        to="/deliveries?view=route"
                        onClick={() => setNotifDropdownOpen(false)}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1"
                      >
                        <span>View Live Route Run</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </NavLink>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Quick Avatar (Mobile) */}
            <div className="md:hidden flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile "More" Drawer */}
      {moreDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-4/5 max-w-xs bg-slate-900 text-white h-full p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Milk className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-base">More Features</span>
              </div>
              <button
                onClick={() => setMoreDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2">
              {[...mainNavItems, ...secondaryNavItems].map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </NavLink>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">{user?.full_name}</p>
                <p className="text-[10px] text-emerald-400 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-xs text-red-400 font-semibold p-2 hover:bg-slate-800 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onOpenMore={() => setMoreDrawerOpen(true)} />
    </div>
  );
};
