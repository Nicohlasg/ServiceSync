import { createHmac, timingSafeEqual } from 'crypto';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { NextRequest, NextResponse } from 'next/server';
import { createElement, type ReactElement } from 'react';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Turbopack emits JSX elements with $$typeof = Symbol.for("react.transitional.element")
// but @react-pdf/reconciler (bundled by turbopack) only recognises
// Symbol.for("react.element"). This shim deeply normalises the element tree
// before handing it to renderToBuffer so the reconciler never sees the
// transitional symbol.
// ---------------------------------------------------------------------------
const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_TRANSITIONAL_TYPE = Symbol.for('react.transitional.element');

// ---------------------------------------------------------------------------
// GLOBAL FIX: Turbopack emits JSX elements with $$typeof = Symbol.for("react.transitional.element")
// but @react-pdf/reconciler only recognises Symbol.for("react.element").
// This global override ensures any symbol request for the transitional type 
// returns the standard type, fixing Error #31 across the entire render tree.
// ---------------------------------------------------------------------------
if (typeof Symbol !== 'undefined' && Symbol.for) {
  const originalSymbolFor = Symbol.for;
  Symbol.for = (key: string) => {
    if (key === 'react.transitional.element') return REACT_ELEMENT_TYPE;
    return originalSymbolFor(key);
  };
}

/**
 * Recursively walk a React element tree and replace every
 * `$$typeof: react.transitional.element` with `$$typeof: react.element`.
 *
 * This must handle:
 *   - null / undefined / string / number / boolean primitives (pass-through)
 *   - Arrays of children
 *   - React elements (objects with $$typeof)
 *   - Function component elements (type is a function) — we call the function
 *     to fully resolve the tree so the reconciler only sees host primitives
 *     from @react-pdf/renderer (Document, Page, View, Text, Image …).
 */
function resolveElement(node: unknown): unknown {
  // Primitives pass through untouched
  if (node == null || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return node;
  }

  // Arrays of children
  if (Array.isArray(node)) {
    return node.map(resolveElement);
  }

  // Not an object — skip
  if (typeof node !== 'object') return node;

  const el = node as Record<string, unknown>;

  // Not a React element — skip
  if (el.$$typeof !== REACT_ELEMENT_TYPE && el.$$typeof !== REACT_TRANSITIONAL_TYPE) {
    return node;
  }

  const props = el.props as Record<string, unknown> | undefined;

  // Resolve children recursively
  let resolvedChildren = props?.children;
  if (resolvedChildren !== undefined && resolvedChildren !== null) {
    resolvedChildren = Array.isArray(resolvedChildren)
      ? resolvedChildren.map(resolveElement)
      : resolveElement(resolvedChildren);
  }

  // Return a new element with the standard $$typeof and resolved children
  return {
    ...el,
    $$typeof: REACT_ELEMENT_TYPE,
    props: props
      ? { ...props, children: resolvedChildren }
      : props,
  };
}

const invoiceRenderSchema = z.object({
  invoiceId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  createdAt: z.string().min(1),
  dueDate: z.string().optional(),
  providerName: z.string().min(1),
  providerPhone: z.string().optional(),
  providerAcraUen: z.string().optional(),
  providerAcraVerified: z.boolean(),
  clientName: z.string().min(1),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  serviceType: z.string().min(1),
  serviceDate: z.string().min(1),
  lineItems: z.array(
    z.object({
      description: z.string().min(1),
      amountCents: z.number().int().min(0),
    }),
  ).min(1),
  subtotalCents: z.number().int().min(0),
  taxCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
  depositAmountCents: z.number().int().min(0),
  balanceDueCents: z.number().int().min(0),
  paynowQrDataUrl: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['draft', 'pending', 'awaiting_qr_confirmation', 'paid_cash', 'paid_qr', 'disputed', 'void']),
  paidAt: z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get('x-servicesync-render-signature');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid PDF render signature' }, { status: 401 });
  }

  let parsedBody: z.infer<typeof invoiceRenderSchema>;
  try {
    parsedBody = invoiceRenderSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    console.error('[PDFX] Invalid PDF payload:', err);
    return NextResponse.json({ error: 'Invalid PDF payload' }, { status: 400 });
  }

  try {
    const { ServiceSyncInvoiceDocument } = await import('@/blocks/pdfx/servicesync-invoice/servicesync-invoice');

    // Build the element tree. createElement will produce a transitional element
    // under turbopack, so we recursively resolve + normalise the entire tree
    // to plain react.element symbols that @react-pdf/reconciler understands.
    const rawElement = createElement(ServiceSyncInvoiceDocument, {
      data: toDocumentData(parsedBody),
    });

    const documentElement = resolveElement(rawElement) as ReactElement<DocumentProps>;



    const pdfBuffer = await renderToBuffer(documentElement);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${parsedBody.invoiceNumber}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[PDFX] Invoice render failed:', error);
    return NextResponse.json({ error: 'Failed to render PDF' }, { status: 500 });
  }
}

function toDocumentData(input: z.infer<typeof invoiceRenderSchema>) {
  const isPaid = input.status === 'paid_cash' || input.status === 'paid_qr';

  return {
    invoiceNumber: input.invoiceNumber,
    invoiceDate: formatSgDate(input.createdAt),
    dueDate: input.dueDate ? formatSgDate(input.dueDate) : undefined,
    status: input.status,
    company: {
      name: input.providerName,
      phone: input.providerPhone,
      uen: input.providerAcraUen,
      acraVerified: input.providerAcraVerified,
    },
    client: {
      name: input.clientName,
      phone: input.clientPhone,
      address: input.clientAddress,
    },
    service: {
      type: input.serviceType,
      date: formatSgDate(input.serviceDate),
    },
    items: input.lineItems,
    summary: {
      subtotalCents: input.subtotalCents,
      taxCents: input.taxCents,
      totalCents: input.totalCents,
      depositAmountCents: input.depositAmountCents,
      balanceDueCents: input.balanceDueCents,
    },
    payment: {
      methodLabel: isPaid
        ? `Paid via ${formatPaymentMethod(input.paymentMethod ?? input.status)}`
        : 'PayNow QR or direct settlement',
      paidAt: input.paidAt ? formatSgDate(input.paidAt) : undefined,
      qrDataUrl: !isPaid ? input.paynowQrDataUrl : undefined,
    },
    notes: input.notes,
    footerNote: isPaid
      ? 'Generated electronically by ServiceSync. This paid document may be retained as a formal receipt for bookkeeping, tax, and audit records.'
      : 'Generated electronically by ServiceSync. Please retain this invoice for bookkeeping, tax, and audit records.',
  };
}

function formatSgDate(value: string): string {
  return new Intl.DateTimeFormat('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(new Date(value));
}

function formatPaymentMethod(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function verifySignature(payload: string, providedSignature: string | null): boolean {
  const secret = getInternalPdfRenderSecret();
  if (!secret || !providedSignature) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

function getInternalPdfRenderSecret(): string | undefined {
  return process.env.INTERNAL_PDF_RENDER_SECRET
    ?? process.env.FIELD_ENCRYPTION_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}
