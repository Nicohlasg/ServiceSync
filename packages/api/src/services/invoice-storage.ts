/**
 * Invoice Storage Service — ServiceSync
 *
 * Manages PDF storage in Supabase Storage and bulk download (ZIP generation).
 * Storage path: invoices/{providerId}/{year}/{month}/{invoiceId}.pdf
 *
 * Budget: ~$25 SGD/month for Supabase Storage (compressed PDFs ~30-50KB each)
 */

import { getAdminClient } from './supabase-admin';

const supabase = getAdminClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StorageUploadResult {
  success: boolean;
  storagePath?: string;
  publicUrl?: string;
  error?: string;
}

export interface BulkDownloadResult {
  success: boolean;
  zipBuffer?: Buffer;
  fileName?: string;
  fileCount?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Uploads a PDF to Supabase Storage with organized folder structure.
 */
export async function uploadInvoicePdf(
  providerId: string,
  invoiceId: string,
  pdfBuffer: Buffer,
  date: Date = new Date()
): Promise<StorageUploadResult> {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const storagePath = `invoices/${providerId}/${year}/${month}/${invoiceId}.pdf`;

  const { error } = await supabase.storage
    .from('invoices')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  const { data: urlData } = supabase.storage
    .from('invoices')
    .getPublicUrl(storagePath);

  return {
    success: true,
    storagePath,
    publicUrl: urlData.publicUrl,
  };
}

/**
 * Downloads all invoices for a given month as a ZIP file.
 */
export async function downloadMonthlyInvoices(
  providerId: string,
  year: number,
  month: number
): Promise<BulkDownloadResult> {
  const monthStr = month.toString().padStart(2, '0');
  const prefix = `invoices/${providerId}/${year}/${monthStr}/`;

  return downloadInvoicesAsZip(prefix, `invoices-${year}-${monthStr}.zip`);
}

/**
 * Downloads all invoices for a given year as a ZIP file.
 */
export async function downloadYearlyInvoices(
  providerId: string,
  year: number
): Promise<BulkDownloadResult> {
  const prefix = `invoices/${providerId}/${year}/`;
  return downloadInvoicesAsZip(prefix, `invoices-${year}.zip`);
}

/**
 * Downloads all invoices for a provider as a ZIP file.
 */
export async function downloadAllInvoices(
  providerId: string
): Promise<BulkDownloadResult> {
  const prefix = `invoices/${providerId}/`;
  return downloadInvoicesAsZip(prefix, `invoices-all.zip`);
}

/**
 * Deletes a specific invoice PDF from storage.
 */
export async function deleteInvoicePdf(
  storagePath: string
): Promise<boolean> {
  const { error } = await supabase.storage
    .from('invoices')
    .remove([storagePath]);

  return !error;
}

/**
 * Gets the public URL for an invoice PDF.
 */
export function getInvoicePdfUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from('invoices')
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Internal: ZIP Generation
// ---------------------------------------------------------------------------

async function listPdfsRecursive(
  basePath: string
): Promise<Array<{ name: string; fullPath: string }>> {
  const cleanPath = basePath.replace(/\/$/, '');
  const { data: entries } = await supabase.storage
    .from('invoices')
    .list(cleanPath, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

  if (!entries?.length) return [];

  const results: Array<{ name: string; fullPath: string }> = [];

  for (const entry of entries) {
    const entryPath = `${cleanPath}/${entry.name}`;
    if (entry.name.endsWith('.pdf')) {
      results.push({ name: entry.name, fullPath: entryPath });
    } else if (!entry.name.includes('.')) {
      // Likely a subdirectory — recurse into it
      const nested = await listPdfsRecursive(entryPath);
      results.push(...nested);
    }
  }

  return results;
}

async function downloadInvoicesAsZip(
  prefix: string,
  zipFileName: string
): Promise<BulkDownloadResult> {
  // Recursively list all PDFs under the prefix
  const pdfFiles = await listPdfsRecursive(prefix);

  if (pdfFiles.length === 0) {
    return { success: false, error: 'No invoices found for this period' };
  }

  // Lazy import JSZip
  let JSZip: any;
  try {
    JSZip = (await import('jszip')).default;
  } catch {
    return { success: false, error: 'JSZip not available for bulk download' };
  }

  const zip = new JSZip();

  // Download each PDF and add to ZIP
  for (const file of pdfFiles) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('invoices')
      .download(file.fullPath);

    if (!downloadError && fileData) {
      const buffer = Buffer.from(await fileData.arrayBuffer());
      zip.file(file.name, buffer);
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    success: true,
    zipBuffer,
    fileName: zipFileName,
    fileCount: pdfFiles.length,
  };
}
