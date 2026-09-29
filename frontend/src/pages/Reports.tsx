import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, Download, Calendar, Filter, Milk, Users, IndianRupee } from 'lucide-react';
import { api } from '../services/api';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  // Date range for CSV export
  const [exportStart, setExportStart] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [exportEnd, setExportEnd] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const { data: dailyReport, isLoading: isDailyLoading } = useQuery({
    queryKey: ['daily_report', selectedDate],
    queryFn: () => api.getDailyReport(selectedDate),
    enabled: reportType === 'daily',
  });

  const { data: monthlyReport, isLoading: isMonthlyLoading } = useQuery({
    queryKey: ['monthly_report', selectedYear, selectedMonth],
    queryFn: () => api.getMonthlyReport(selectedYear, selectedMonth),
    enabled: reportType === 'monthly',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
            Business Reports & Data Export
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational summaries, revenue metrics, and full CSV exports
          </p>
        </div>

        {/* CSV Export Actions */}
        <div className="flex items-center gap-2">
          <a
            href={api.getExportCustomersUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Customers CSV</span>
          </a>

          <a
            href={api.getExportDeliveriesUrl(exportStart, exportEnd)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Deliveries CSV</span>
          </a>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setReportType('daily')}
          className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${
            reportType === 'daily'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Daily Delivery Sheet Summary
        </button>

        <button
          type="button"
          onClick={() => setReportType('monthly')}
          className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${
            reportType === 'monthly'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Monthly Business Statement
        </button>
      </div>

      {/* DAILY REPORT VIEW */}
      {reportType === 'daily' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Select Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50"
            />
          </div>

          {isDailyLoading ? (
            <div className="text-center py-12 text-xs text-slate-500">Loading daily statement...</div>
          ) : dailyReport ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Customers Served</span>
                  <p className="text-2xl font-black text-slate-900 font-heading mt-1">
                    {dailyReport.total_customers_served}
                  </p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Litres Delivered</span>
                  <p className="text-2xl font-black text-emerald-700 font-heading mt-1">
                    {dailyReport.total_litres_delivered} L
                  </p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Expected Sales</span>
                  <p className="text-2xl font-black text-slate-900 font-heading mt-1">
                    ₹{dailyReport.total_expected_value.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Skipped Deliveries</span>
                  <p className="text-2xl font-black text-amber-600 font-heading mt-1">
                    {dailyReport.skipped_deliveries}
                  </p>
                </div>
              </div>

              {/* Product Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                <h4 className="text-sm font-bold text-slate-900 mb-3">Product Sales on {selectedDate}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-3">Quantity</th>
                        <th className="py-2 px-3 text-right">Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyReport.product_breakdown?.map((p: any) => (
                        <tr key={p.name}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{p.name}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-700">{p.quantity} {p.unit}</td>
                          <td className="py-2.5 px-3 font-black text-slate-900 text-right">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* MONTHLY REPORT VIEW */}
      {reportType === 'monthly' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Select Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-xs font-bold px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50"
            >
              {[
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
              ].map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs font-bold px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50"
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {isMonthlyLoading ? (
            <div className="text-center py-12 text-xs text-slate-500">Loading monthly statement...</div>
          ) : monthlyReport ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Delivered</span>
                <p className="text-2xl font-black text-slate-900 font-heading mt-1">
                  {monthlyReport.total_quantity} L
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Sales Billed</span>
                <p className="text-2xl font-black text-slate-900 font-heading mt-1">
                  ₹{monthlyReport.total_sales.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Payments Collected</span>
                <p className="text-2xl font-black text-emerald-700 font-heading mt-1">
                  ₹{monthlyReport.total_payments.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Outstanding Dues</span>
                <p className="text-2xl font-black text-red-600 font-heading mt-1">
                  ₹{monthlyReport.outstanding_balance.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
