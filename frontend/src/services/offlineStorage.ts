import { DeliverySheetItem } from '../types';
import { api } from './api';

export interface QueuedDeliveryUpdate {
  delivery_date: string;
  delivery_time: string;
  entry: {
    customer_id: number;
    product_id: number;
    subscription_id?: number;
    delivery_time: string;
    scheduled_quantity: number;
    actual_quantity: number;
    applied_rate: number;
    status: string;
    skip_reason?: string;
    notes?: string;
  };
  timestamp: number;
}

const QUEUE_KEY = 'milkflow_offline_queue';

export class OfflineStorage {
  static isOnline(): boolean {
    return navigator.onLine;
  }

  static cacheSheet(dateStr: string, time: string, items: DeliverySheetItem[]): void {
    const key = `milkflow_sheet_${dateStr}_${time}`;
    try {
      localStorage.setItem(key, JSON.stringify({ items, cachedAt: Date.now() }));
    } catch (e) {
      console.warn('Failed to cache sheet locally', e);
    }
  }

  static getCachedSheet(dateStr: string, time: string): DeliverySheetItem[] | null {
    const key = `milkflow_sheet_${dateStr}_${time}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return data.items || null;
    } catch (e) {
      return null;
    }
  }

  static queueDeliveryUpdate(update: QueuedDeliveryUpdate): void {
    const queue = this.getOfflineQueue();
    // Replace any existing update for same customer & date in the queue
    const filtered = queue.filter(
      q => !(q.delivery_date === update.delivery_date && 
             q.delivery_time === update.delivery_time && 
             q.entry.customer_id === update.entry.customer_id && 
             q.entry.product_id === update.entry.product_id)
    );
    filtered.push(update);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  }

  static getOfflineQueue(): QueuedDeliveryUpdate[] {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  static clearQueue(): void {
    localStorage.removeItem(QUEUE_KEY);
  }

  static async syncOfflineQueue(): Promise<{ syncedCount: number; errors: string[] }> {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) {
      return { syncedCount: 0, errors: [] };
    }

    // Group by delivery_date & delivery_time
    const groups: Record<string, QueuedDeliveryUpdate[]> = {};
    for (const item of queue) {
      const gKey = `${item.delivery_date}__${item.delivery_time}`;
      if (!groups[gKey]) groups[gKey] = [];
      groups[gKey].push(item);
    }

    let synced = 0;
    const errors: string[] = [];

    for (const [key, items] of Object.entries(groups)) {
      const [dDate, dTime] = key.split('__');
      const entries = items.map(i => i.entry);
      try {
        await api.bulkSaveDeliveries(dDate, dTime, entries);
        synced += entries.length;
      } catch (err: any) {
        errors.push(`Failed sync for ${dDate}: ${err.message}`);
      }
    }

    if (errors.length === 0) {
      this.clearQueue();
    }

    return { syncedCount: synced, errors };
  }
}
