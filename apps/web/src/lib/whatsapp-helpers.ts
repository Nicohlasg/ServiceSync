/**
 * WhatsApp Helper Hooks & Functions
 * 
 * Client-side utilities for wa.me links and WhatsApp integration
 * No API keys required - uses native WhatsApp app
 */

import { generateWALink, generateInvoiceMessage, generateReminderMessage, generateJobCompleteMessage, generateGreetingMessageTemplate, generateQuickReplyTemplate } from '@/server/services/whatsapp-simple';

export interface TechnicianProfile {
  name: string;
  slug: string;  // e.g., "ah-huat-aircon"
  phone: string; // E.164 format
}

/**
 * Get the public booking URL for a technician
 */
export function getBookingUrl(technicianSlug: string): string {
  // In production, this would be your actual domain
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://servicesync.sg';
  return `${baseUrl}/p/${technicianSlug}/book`;
}

/**
 * Get the invoice/ report URL
 */
export function getInvoiceUrl(invoiceId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://servicesync.sg';
  return `${baseUrl}/invoice/${invoiceId}`;
}

/**
 * Open WhatsApp with pre-filled invoice message
 */
export function openWhatsAppWithInvoice(
  clientPhone: string,
  clientName: string,
  invoiceId: string,
  amount: number,
  serviceType: string,
  technicianName: string
): void {
  const invoiceUrl = getInvoiceUrl(invoiceId);
  const message = generateInvoiceMessage({
    clientName,
    invoiceUrl,
    amount,
    serviceType,
    technicianName,
  });

  const waLink = generateWALink({ phone: clientPhone, message });
  window.open(waLink, '_blank');
}

/**
 * Open WhatsApp with reminder message
 */
export function openWhatsAppWithReminder(
  clientPhone: string,
  clientName: string,
  serviceType: string,
  technicianSlug: string,
  lastServiceDate?: string
): void {
  const bookingUrl = getBookingUrl(technicianSlug);
  const message = generateReminderMessage({
    clientName,
    serviceType,
    bookingUrl,
    lastServiceDate,
  });

  const waLink = generateWALink({ phone: clientPhone, message });
  window.open(waLink, '_blank');
}

/**
 * Open WhatsApp with job completion message
 */
export function openWhatsAppWithCompletion(
  clientPhone: string,
  clientName: string,
  serviceType: string,
  reportUrl: string,
  amount: number,
  notes?: string
): void {
  const message = generateJobCompleteMessage({
    clientName,
    serviceType,
    reportUrl,
    amount,
    notes,
  });

  const waLink = generateWALink({ phone: clientPhone, message });
  window.open(waLink, '_blank');
}

/**
 * Get greeting message template for WhatsApp Business App setup
 * Technicians copy this into their WhatsApp Business settings
 */
export function getGreetingMessageTemplate(technician: TechnicianProfile): string {
  const bookingUrl = getBookingUrl(technician.slug);
  return generateGreetingMessageTemplate(technician.name, bookingUrl);
}

/**
 * Get quick reply template for /book command
 */
export function getQuickReplyTemplate(technicianSlug: string): string {
  const bookingUrl = getBookingUrl(technicianSlug);
  return generateQuickReplyTemplate(bookingUrl);
}

/**
 * Copy text to clipboard (for setting up greeting messages)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Hook for WhatsApp actions
 */
export function useWhatsApp() {
  return {
    openInvoice: openWhatsAppWithInvoice,
    openReminder: openWhatsAppWithReminder,
    openCompletion: openWhatsAppWithCompletion,
    getBookingUrl,
    getInvoiceUrl,
    getGreetingTemplate: getGreetingMessageTemplate,
    getQuickReplyTemplate,
    copyToClipboard,
  };
}

export {
  generateWALink,
  generateInvoiceMessage,
  generateReminderMessage,
  generateJobCompleteMessage,
};
