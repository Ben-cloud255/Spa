'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface PaymentMethod {
  id: number;
  name: string;
  is_active: boolean;
}

export function usePaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ paymentMethods: PaymentMethod[] }>('/payment-methods').then((d) => {
      setPaymentMethods(d.paymentMethods);
      setLoading(false);
    });
  }, []);

  return { paymentMethods, loading };
}
