import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

interface QuickQuantityChipsProps {
  value: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
}

const PRESET_QUANTITIES = [0, 0.5, 1, 1.5, 2, 2.5, 3];

export const QuickQuantityChips: React.FC<QuickQuantityChipsProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isCustom, setIsCustom] = useState(false);

  const handleStep = (delta: number) => {
    const next = Math.max(0, Math.round((value + delta) * 100) / 100);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {/* Decrement */}
        <button
          type="button"
          disabled={disabled || value <= 0}
          onClick={() => handleStep(-0.25)}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors shrink-0"
          title="Minus 0.25L"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Preset Chips */}
        {PRESET_QUANTITIES.map((q) => {
          const isSelected = value === q;
          return (
            <button
              key={q}
              type="button"
              disabled={disabled}
              onClick={() => {
                setIsCustom(false);
                onChange(q);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all shrink-0 ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600 ring-offset-1'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {q}
            </button>
          );
        })}

        {/* Increment */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleStep(0.25)}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors shrink-0"
          title="Plus 0.25L"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* Custom Toggle / Input */}
        <div className="flex items-center ml-1 shrink-0">
          <input
            type="number"
            step="0.25"
            min="0"
            disabled={disabled}
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onChange(isNaN(v) ? 0 : Math.max(0, v));
            }}
            className="w-16 px-1.5 py-0.5 text-xs text-center font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
          />
          <span className="text-[10px] text-slate-500 ml-1">L</span>
        </div>
      </div>
    </div>
  );
};
