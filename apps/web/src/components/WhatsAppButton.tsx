/**
 * WhatsApp Button Component
 * 
 * Opens WhatsApp with pre-filled message using wa.me links
 * No API required - uses native WhatsApp app
 */

'use client';

import { Button } from '@/components/ui/button';
import { useWhatsApp } from '@/lib/whatsapp-helpers';
import { Phone, MessageCircle, CheckCircle } from 'lucide-react';

interface WhatsAppButtonProps {
  clientPhone: string;
  clientName: string;
  variant?: 'invoice' | 'reminder' | 'complete' | 'custom';
  
  // For invoice variant
  invoiceId?: string;
  amount?: number;
  serviceType?: string;
  technicianName?: string;
  
  // For reminder variant
  technicianSlug?: string;
  lastServiceDate?: string;
  
  // For complete variant
  reportUrl?: string;
  notes?: string;
  
  // For custom variant
  customMessage?: string;
  
  // Button appearance
  label?: string;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  showIcon?: boolean;
}

export function WhatsAppButton({
  clientPhone,
  clientName,
  variant = 'custom',
  invoiceId,
  amount,
  serviceType,
  technicianName,
  technicianSlug,
  lastServiceDate,
  reportUrl,
  notes,
  customMessage,
  label,
  size = 'default',
  className,
  showIcon = true,
}: WhatsAppButtonProps) {
  const { openInvoice, openReminder, openCompletion } = useWhatsApp();

  const handleClick = () => {
    switch (variant) {
      case 'invoice':
        if (invoiceId && amount && serviceType && technicianName) {
          openInvoice(
            clientPhone,
            clientName,
            invoiceId,
            amount,
            serviceType,
            technicianName
          );
        }
        break;
        
      case 'reminder':
        if (technicianSlug && serviceType) {
          openReminder(
            clientPhone,
            clientName,
            serviceType,
            technicianSlug,
            lastServiceDate
          );
        }
        break;
        
      case 'complete':
        if (reportUrl && amount && serviceType) {
          openCompletion(
            clientPhone,
            clientName,
            serviceType,
            reportUrl,
            amount,
            notes
          );
        }
        break;
        
      case 'custom':
      default:
        if (customMessage) {
          const waLink = `https://wa.me/${clientPhone.replace(/\+/g, '')}?text=${encodeURIComponent(customMessage)}`;
          window.open(waLink, '_blank');
        }
        break;
    }
  };

  const getDefaultLabel = () => {
    switch (variant) {
      case 'invoice': return 'Send Invoice via WhatsApp';
      case 'reminder': return 'Send Reminder';
      case 'complete': return 'Send Completion Message';
      default: return 'Open WhatsApp';
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'invoice': return <CheckCircle className="h-4 w-4 mr-2" />;
      case 'reminder': return <MessageCircle className="h-4 w-4 mr-2" />;
      case 'complete': return <CheckCircle className="h-4 w-4 mr-2" />;
      default: return <Phone className="h-4 w-4 mr-2" />;
    }
  };

  return (
    <Button
      onClick={handleClick}
      size={size}
      className={`bg-green-600 hover:bg-green-700 text-white ${className}`}
    >
      {showIcon && getIcon()}
      {label || getDefaultLabel()}
    </Button>
  );
}

/**
 * Greeting Message Setup Card
 * Shows technicians how to set up their WhatsApp Business greeting
 */
export function GreetingMessageSetup({
  technicianName,
  technicianSlug,
}: {
  technicianName: string;
  technicianSlug: string;
}) {
  const { getGreetingTemplate, copyToClipboard } = useWhatsApp();
  
  const template = getGreetingTemplate({ name: technicianName, slug: technicianSlug, phone: '' });

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
      <h4 className="font-semibold text-white">📱 WhatsApp Greeting Message</h4>
      <p className="text-sm text-slate-400">
        Copy this into your WhatsApp Business App settings to auto-reply to new customers:
      </p>
      <div className="bg-slate-900 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap">
        {template}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => copyToClipboard(template)}
        className="w-full"
      >
        Copy to Clipboard
      </Button>
    </div>
  );
}

/**
 * Quick Reply Setup Card
 * Shows technicians how to set up the /book quick reply
 */
export function QuickReplySetup({ technicianSlug }: { technicianSlug: string }) {
  const { getQuickReplyTemplate, copyToClipboard } = useWhatsApp();
  
  const template = getQuickReplyTemplate(technicianSlug);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
      <h4 className="font-semibold text-white">⚡ Quick Reply: /book</h4>
      <p className="text-sm text-slate-400">
        Save this as a quick reply in WhatsApp Business. Type /book to instantly share your booking link:
      </p>
      <div className="bg-slate-900 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap">
        {template}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => copyToClipboard(template)}
        className="w-full"
      >
        Copy to Clipboard
      </Button>
    </div>
  );
}
