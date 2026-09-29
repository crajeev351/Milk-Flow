import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Milk, Users, Receipt, Menu, Bike, LogOut } from 'lucide-react';
import { api } from '../services/api';

interface MobileBottomNavProps {
  onOpenMore: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMore }) => {
  const navigate = useNavigate();
  const user = api.getUser();
  const isWorker = user?.role === 'worker';

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      api.logout();
      navigate('/login');
    }
  };

  if (isWorker) {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-6 py-2 pb-safe shadow-lg">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <NavLink
            to="/driver"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/30"
          >
            <Bike className="w-4 h-4" />
            <span>Delivery Run Portal</span>
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 text-xs font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </nav>
    );
  }

  interface BottomNavItem {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }

  const navItems: BottomNavItem[] = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/deliveries', label: 'Deliveries', icon: Milk },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/bills', label: 'Bills', icon: Receipt },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 pb-safe shadow-lg">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all ${
                  isActive
                    ? 'text-emerald-700 font-bold bg-emerald-50/80 scale-105'
                    : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-emerald-600 text-white text-[8px] font-extrabold rounded-full animate-pulse">
                    ★
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}

        {/* More Menu Trigger */}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center w-16 py-1 rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">More</span>
        </button>
      </div>
    </nav>
  );
};

