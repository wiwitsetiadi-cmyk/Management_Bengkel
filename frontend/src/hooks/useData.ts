// src/hooks/useData.ts
import { useState, useCallback } from 'react';
import { fetchApi } from '../api';
import type { Order, Sparepart, Service, Transaction, Mechanic } from '../data';

export function useData(showToast: (msg: string) => void) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [parts, setParts] = useState<Sparepart[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [resOrders, resParts, resTransactions, resMechanics, resServices] = await Promise.all([
        fetchApi('/api/orders'),
        fetchApi('/api/spareparts'),
        fetchApi('/api/transactions'),
        fetchApi('/api/mechanics'),
        fetchApi('/api/services')
      ]);
      
      setOrders(await resOrders.json());
      setParts(await resParts.json());
      setTransactions(await resTransactions.json());
      setMechanics(await resMechanics.json());
      setServices(await resServices.json());
    } catch (error) {
      console.error('Fetch Error:', error);
      showToast('Gagal terhubung ke database server');
    }
  }, [showToast]);

  // Kembalikan semua state dan fungsi agar bisa dipakai di App.tsx
  return {
    orders, setOrders,
    parts, setParts,
    services, setServices,
    transactions, setTransactions,
    mechanics, setMechanics,
    fetchData
  };
}