/**
 * WhatsApp Simple Service - No API Required
 * 
 * Uses wa.me (Click to Chat) links and WhatsApp Business App features
 * instead of the official WhatsApp Business API.
 * 
 * Benefits:
 * - Zero cost (no per-message fees)
 * - No Meta approval process
 * - Uses technician's existing WhatsApp Business App
 * - Native app experience for both technician and client
 */

import { formatCents } from '../payment';

// ---------------------------------------------------------------------------
// wa.me Link Generators
// ---------------------------------------------------------------------------

export interface WAMeLinkParams {
  phone: string;      // E.164 format (e.g., +6591234567)
  message: string;    // Pre-filled message
}

/**
 * Generate a wa.me (Click to Chat) link
 * Opens WhatsApp with pre-filled message
 * 
 * Example: generateWALink({ phone: "+6591234567", message: "Hi!" })
 * Returns: https://wa.me/6591234567?text=Hi%21
 */
export function generateWALink(params: WAMeLinkParams): string {
  const cleanPhone = params.phone.replace(/\+/g, ''); // Remove + for wa.me
  const encodedMessage = encodeURIComponent(params.message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Generate a wa.me link that opens WhatsApp Web (for desktop)
 */
export function generateWAWebLink(params: WAMeLinkParams): string {
  const cleanPhone = params.phone.replace(/\+/g, '');
  const encodedMessage = encodeURIComponent(params.message);
  return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
}

// ---------------------------------------------------------------------------
// Pre-filled Message Templates
// ---------------------------------------------------------------------------

export interface InvoiceMessageParams {
  clientName: string;
  invoiceUrl: string;
  amount: number;           // in cents
  serviceType: string;
  technicianName: string;
}

export interface ReminderMessageParams {
  clientName: string;
  serviceType: string;
  bookingUrl: string;
  lastServiceDate?: string;
}

export interface JobCompleteParams {
  clientName: string;
  serviceType: string;
  reportUrl: string;
  amount: number;
  notes?: string;
}

/**
 * Generate invoice message with payment link
 */
export function generateInvoiceMessage(params: InvoiceMessageParams): string {
  const amountStr = formatCents(params.amount);
  return `Hi ${params.clientName}! 👋

Thank you for choosing ${params.technicianName} for your ${params.serviceType}.

Here is your invoice: ${params.invoiceUrl}

Total: ${amountStr}
You can pay instantly via PayNow QR on the invoice page.

If you have any questions, just reply to this message.

Best regards,
${params.technicianName}`;
}

/**
 * Generate service reminder message
 */
export function generateReminderMessage(params: ReminderMessageParams): string {
  let message = `Hi ${params.clientName}! 👋`;
  
  if (params.lastServiceDate) {
    message += `\n\nIt's been a while since your last ${params.serviceType} on ${params.lastServiceDate}.`;
  } else {
    message += `\n\nTime for your next ${params.serviceType}!`;
  }
  
  message += `\n\nCheck my live availability and book instantly here: ${params.bookingUrl}`;
  message += `\n\nNo back-and-forth needed - see what's open and lock in your slot! 🗓️`;
  
  return message;
}

/**
 * Generate job completion message with service report
 */
export function generateJobCompleteMessage(params: JobCompleteParams): string {
  const amountStr = formatCents(params.amount);
  
  let message = `Hi ${params.clientName}! ✅

Your ${params.serviceType} has been completed successfully.

📋 Service Report: ${params.reportUrl}
💰 Amount: ${amountStr}

Please check the report and let me know if everything looks good. If there's any issue with the amount, just reply to this chat.

Thank you for your business!`;

  if (params.notes) {
    message += `\n\n📝 Notes: ${params.notes}`;
  }
  
  return message;
}

/**
 * Generate greeting message for WhatsApp Business App
 * Technicians copy this into their WhatsApp Business greeting message setting
 */
export function generateGreetingMessageTemplate(
  technicianName: string,
  bookingUrl: string
): string {
  return `Hi! Thanks for contacting ${technicianName}! 👋

I'm currently out on a job, but you can check my live availability and book your slot instantly here:
${bookingUrl}

See real-time openings and lock in your preferred time - no waiting for replies! ⚡`;
}

/**
 * Generate quick reply template for /book command
 */
export function generateQuickReplyTemplate(bookingUrl: string): string {
  return `Check my live schedule and book instantly: ${bookingUrl}

See all available slots in real-time and secure your booking immediately! 📅`;
}

// ---------------------------------------------------------------------------
// Digital Handshake (No API Version)
// ---------------------------------------------------------------------------

export interface DigitalHandshakeParams {
  clientName: string;
  clientPhone: string;
  invoiceUrl: string;
  amount: number;
  serviceType: string;
  technicianName: string;
}

/**
 * Generate wa.me link for digital handshake
 * Opens technician's WhatsApp with pre-filled confirmation message
 */
export function generateDigitalHandshakeLink(
  params: DigitalHandshakeParams
): string {
  const message = generateJobCompleteMessage({
    clientName: params.clientName,
    serviceType: params.serviceType,
    reportUrl: params.invoiceUrl,
    amount: params.amount,
  });

  return generateWALink({
    phone: params.clientPhone,
    message,
  });
}

// ---------------------------------------------------------------------------
// Web Push Notification Payloads
// ---------------------------------------------------------------------------

export interface JobRequestNotification {
  title: string;
  body: string;
  icon: string;
  data: {
    url: string;
    requestId: string;
    clientName: string;
    serviceType: string;
    amount: number;
  };
}

/**
 * Generate web push notification for new job request
 */
export function generateJobRequestNotification(
  clientName: string,
  serviceType: string,
  amount: number,
  requestId: string,
  dashboardUrl: string
): JobRequestNotification {
  return {
    title: '🆕 New Job Request!',
    body: `${clientName} wants ${serviceType} - ${formatCents(amount)}`,
    icon: '/icon-192x192.png',
    data: {
      url: `${dashboardUrl}/requests`,
      requestId,
      clientName,
      serviceType,
      amount,
    },
  };
}

// ---------------------------------------------------------------------------
// URL Shorteners (Optional - for cleaner links)
// ---------------------------------------------------------------------------

/**
 * Generate a shortened URL using a service like tinyurl or bit.ly
 * This is optional - technicians can use full URLs too
 */
export async function shortenUrl(longUrl: string): Promise<string> {
  // For now, return the original URL
  // In production, integrate with bit.ly or tinyurl API
  // Or use your own URL shortener service
  return longUrl;
}

// ---------------------------------------------------------------------------
// Export all for easy importing
// ---------------------------------------------------------------------------

export const WhatsAppSimple = {
  generateWALink,
  generateWAWebLink,
  generateInvoiceMessage,
  generateReminderMessage,
  generateJobCompleteMessage,
  generateGreetingMessageTemplate,
  generateQuickReplyTemplate,
  generateDigitalHandshakeLink,
  generateJobRequestNotification,
  shortenUrl,
};

export default WhatsAppSimple;
