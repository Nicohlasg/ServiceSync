/**
 * PayNow QR Generation — ServiceSync
 *
 * Generates SGQR-compliant PayNow QR codes for invoice payment.
 * Uses the EMVCo QR Code Specification for Merchant Payments.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayNowQRInput {
  /** PayNow key: NRIC, mobile (+65...) or UEN */
  paynowKey: string;
  paynowKeyType: 'nric' | 'mobile' | 'uen';
  /** Amount in cents */
  amountCents: number;
  /** Invoice reference for reconciliation */
  reference: string;
  /** Whether amount is editable by payer */
  isAmountEditable?: boolean;
  /** Expiry date (optional) */
  expiryDate?: string;
}

export interface PayNowQRResult {
  /** EMVCo-compliant payload string */
  payload: string;
  /** Data URL of QR code image (PNG) */
  qrDataUrl: string;
}

// ---------------------------------------------------------------------------
// EMVCo TLV Tag Constants
// ---------------------------------------------------------------------------

const TAG_PAYLOAD_FORMAT     = '00';
const TAG_POI_METHOD         = '01';
const TAG_MERCHANT_ACCOUNT   = '26';  // Merchant Account Info (template)
const TAG_MERCHANT_CATEGORY  = '52';
const TAG_CURRENCY           = '53';
const TAG_AMOUNT             = '54';
const TAG_COUNTRY            = '58';
const TAG_MERCHANT_NAME      = '59';
const TAG_MERCHANT_CITY      = '60';
const TAG_ADDITIONAL_DATA    = '62';
const TAG_CRC                = '63';

// Sub-tags within Merchant Account (26)
const TAG_REVERSE_DOMAIN     = '00';
const TAG_PROXY_TYPE         = '01';
const TAG_PROXY_VALUE        = '02';
const TAG_AMOUNT_EDITABLE    = '03';
const TAG_EXPIRY             = '04';

// Sub-tags within Additional Data (62)
const TAG_BILL_NUMBER        = '01';

const PAYNOW_REVERSE_DOMAIN = 'SG.PAYNOW';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a PayNow SGQR-compliant QR code.
 * Returns both the EMVCo payload string and a rendered QR data URL.
 */
export async function generatePayNowQR(
  input: PayNowQRInput
): Promise<PayNowQRResult> {
  const payload = buildEMVCoPayload(input);

  // Generate QR code image
  let qrDataUrl: string;
  try {
    const QRCode = await import('qrcode');
    qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch {
    // qrcode package not available — return payload only
    qrDataUrl = '';
  }

  return { payload, qrDataUrl };
}

// ---------------------------------------------------------------------------
// EMVCo Payload Builder
// ---------------------------------------------------------------------------

function buildEMVCoPayload(input: PayNowQRInput): string {
  const { paynowKey, paynowKeyType, amountCents, reference, isAmountEditable, expiryDate } = input;
  const amount = (amountCents / 100).toFixed(2);

  // Proxy type: 0 = mobile, 2 = UEN (per PayNow/SGQR spec)
  const proxyType = paynowKeyType === 'mobile' ? '0' : paynowKeyType === 'uen' ? '2' : '0';

  // Normalize proxy value based on type
  let proxyValue = paynowKey;
  if (paynowKeyType === 'mobile') {
    // PayNow mobile proxy requires +65XXXXXXXX format (with plus sign)
    const digits = paynowKey.replace(/\D/g, '');
    if (digits.startsWith('65') && digits.length === 10) {
      // Already has country code (e.g. "6584984878") — add +
      proxyValue = `+${digits}`;
    } else if (digits.length === 8) {
      // Raw 8-digit SG number — prepend +65
      proxyValue = `+65${digits}`;
    } else {
      // Fallback — use as-is with + prefix
      proxyValue = `+${digits}`;
    }
  }

  // Build merchant account info (tag 26)
  let merchantAccount = '';
  merchantAccount += tlv(TAG_REVERSE_DOMAIN, PAYNOW_REVERSE_DOMAIN);
  merchantAccount += tlv(TAG_PROXY_TYPE, proxyType);
  merchantAccount += tlv(TAG_PROXY_VALUE, proxyValue);
  merchantAccount += tlv(TAG_AMOUNT_EDITABLE, isAmountEditable ? '1' : '0');
  if (expiryDate) {
    merchantAccount += tlv(TAG_EXPIRY, expiryDate);
  }

  // Build additional data (tag 62) — sub-tag 01 = Bill Number (per SGQR spec)
  let additionalData = '';
  additionalData += tlv(TAG_BILL_NUMBER, reference.slice(0, 25)); // Max 25 chars

  // Build full payload (without CRC)
  let payload = '';
  payload += tlv(TAG_PAYLOAD_FORMAT, '01');
  payload += tlv(TAG_POI_METHOD, isAmountEditable ? '11' : '12');
  payload += tlv(TAG_MERCHANT_ACCOUNT, merchantAccount);
  payload += tlv(TAG_MERCHANT_CATEGORY, '0000');
  payload += tlv(TAG_CURRENCY, '702');  // SGD = 702
  if (amountCents > 0) {
    payload += tlv(TAG_AMOUNT, amount);
  }
  payload += tlv(TAG_COUNTRY, 'SG');
  payload += tlv(TAG_MERCHANT_NAME, 'SERVICESYNC');
  payload += tlv(TAG_MERCHANT_CITY, 'SINGAPORE');
  payload += tlv(TAG_ADDITIONAL_DATA, additionalData);

  // Add CRC placeholder and calculate
  payload += TAG_CRC + '04';
  const crc = crc16CCITT(payload);
  payload += crc;

  return payload;
}

// ---------------------------------------------------------------------------
// TLV Encoding
// ---------------------------------------------------------------------------

function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

// ---------------------------------------------------------------------------
// CRC-16/CCITT-FALSE
// ---------------------------------------------------------------------------

function crc16CCITT(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Suppress unused variable warnings for tag constants used only in builder
void TAG_BILL_NUMBER;
