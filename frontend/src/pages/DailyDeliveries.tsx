import React from 'react';
import { DriverPortal } from './DriverPortal';

/**
 * Deliveries & Route Supervision Page
 * 
 * Directly renders the live Route Run Supervision tracker where:
 * - Admin tracks all deliveries in real-time with instant live-sync
 * - Shows exact delivery time and rider for every customer
 * - Eliminates the confusing manual batch grid in favor of clean live route tracking
 */
export const DailyDeliveries: React.FC = () => {
  return <DriverPortal isSupervisionMode={true} />;
};

export default DailyDeliveries;
