export interface ServiceSyncInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  status: 'draft' | 'pending' | 'awaiting_qr_confirmation' | 'paid_cash' | 'paid_qr' | 'disputed' | 'void';
  company: {
    name: string;
    phone?: string;
    uen?: string;
    acraVerified: boolean;
  };
  client: {
    name: string;
    phone?: string;
    address?: string;
  };
  service: {
    type: string;
    date: string;
  };
  items: {
    description: string;
    amountCents: number;
  }[];
  summary: {
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    depositAmountCents: number;
    balanceDueCents: number;
  };
  payment: {
    methodLabel: string;
    paidAt?: string;
    qrDataUrl?: string;
  };
  notes?: string;
  footerNote: string;
}
