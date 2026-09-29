import React, { useState } from 'react';
import { X, Send, Copy, Check, MessageSquare } from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  customerName: string;
  phone: string;
  message: string;
  whatsappUrl: string;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  title,
  customerName,
  phone,
  message,
  whatsappUrl,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-emerald-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <MessageSquare className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">{title}</h3>
              <p className="text-xs text-emerald-200">{customerName} • {phone}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-600/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              WhatsApp Message Preview
            </label>
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl text-xs text-slate-800 whitespace-pre-line font-mono max-h-56 overflow-y-auto leading-relaxed">
              {message}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Text'}
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Send className="w-4 h-4" />
              Open WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
