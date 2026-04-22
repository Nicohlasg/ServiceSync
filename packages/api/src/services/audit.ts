/**
 * Audit logging helper (SEC-M3).
 *
 * Emits an append-only record to `audit_log`. Use for sensitive mutations on
 * bookings, invoices, clients, cash_payments, and profile edits. Non-blocking:
 * failures are logged but never surface as tRPC errors so they cannot mask
 * the primary operation's success.
 *
 * For `update` actions, prefer passing `{ before, after }` as the diff so
 * retention queries can reconstruct the full history without a separate
 * trigger-based audit.
 */

import { getAdminClient } from './supabase-admin';

export type AuditEntityType =
    | 'booking'
    | 'invoice'
    | 'client'
    | 'cash_payment'
    | 'profile'
    | 'service'
    | 'asset';

export type AuditAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'status_change'
    | 'payment_confirm'
    | 'payment_confirm_qr'
    | 'signature_capture'
    | 'escrow_release';

export interface AuditEvent {
    actorId: string | null;
    actorIp?: string | null;
    entityType: AuditEntityType;
    entityId: string | null;
    action: AuditAction;
    diff?: Record<string, unknown> | null;
}

/**
 * Append an audit event. Swallows errors so that logging failure never breaks
 * the originating business operation — it only warns to stderr.
 */
export async function emitAuditEvent(event: AuditEvent): Promise<void> {
    try {
        const supabase = getAdminClient();
        const { error } = await supabase.from('audit_log').insert({
            actor_id: event.actorId,
            actor_ip: event.actorIp ?? null,
            entity_type: event.entityType,
            entity_id: event.entityId,
            action: event.action,
            diff: event.diff ?? null,
        });
        if (error) {
            console.warn('[audit] insert failed:', error.message, {
                entityType: event.entityType,
                entityId: event.entityId,
                action: event.action,
            });
        }
    } catch (err) {
        console.warn('[audit] unexpected error:', err);
    }
}
