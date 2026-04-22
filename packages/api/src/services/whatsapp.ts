/**
 * ⚠️ DEPRECATED: WhatsApp Business Cloud API Service
 * 
 * This file is kept for reference but is NO LONGER USED in production.
 * 
 * We switched from the official WhatsApp Business API to wa.me (Click to Chat)
 * links combined with the free WhatsApp Business App.
 * 
 * WHY THE CHANGE?
 * - Zero cost: No per-message fees
 * - No Meta approval process required
 * - Uses tools technicians already have
 * - Simpler architecture
 * - More reliable (native app vs API)
 * 
 * NEW APPROACH:
 * See `whatsapp-simple.ts` for the current implementation using:
 * - wa.me links (pre-filled messages)
 * - WhatsApp Business App greeting messages
 * - WhatsApp Business App quick replies (/book)
 * - Web push notifications for job alerts
 * 
 * MIGRATION COMPLETE: March 2026
 */

// Re-export from the new simple implementation
export {
  WhatsAppSimple as default,
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
} from './whatsapp-simple';

export type {
  WAMeLinkParams,
  InvoiceMessageParams,
  ReminderMessageParams,
  JobCompleteParams,
  DigitalHandshakeParams,
  JobRequestNotification,
} from './whatsapp-simple';

/**
 * @deprecated Use generateDigitalHandshakeLink from whatsapp-simple.ts instead
 */
export async function sendCashConfirmation(): Promise<never> {
  throw new Error(
    'WhatsApp Business API is deprecated. ' +
    'Use wa.me links via generateDigitalHandshakeLink() instead.'
  );
}

/**
 * @deprecated Use generateWALink with generateJobCompleteMessage instead
 */
export async function sendReceiptLink(): Promise<never> {
  throw new Error(
    'WhatsApp Business API is deprecated. ' +
    'Use wa.me links via generateWALink() instead.'
  );
}
