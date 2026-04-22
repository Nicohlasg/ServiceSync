import { generateInvoicePdf } from './packages/api/src/services/pdf';

async function run() {
  const res = await generateInvoicePdf({
    invoiceId: 'test-123',
    invoiceNumber: 'INV-123',
    providerId: 'prov-123',
    providerName: 'Test',
    providerPhone: '98765432',
    providerAcraVerified: false,
    clientName: 'Client',
    clientPhone: '12345678',
    clientAddress: '123 St',
    serviceType: 'Test',
    serviceDate: new Date().toISOString(),
    lineItems: [],
    subtotalCents: 100,
    taxCents: 0,
    totalCents: 100,
    depositAmountCents: 0,
    balanceDueCents: 100
  });
  console.log(res);
}

run();
