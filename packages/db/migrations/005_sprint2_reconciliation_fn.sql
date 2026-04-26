-- Migration 005: Reconciliation function (Sprint 2 Task 2.5)
-- Detects split states from partial writes in payment flows.
-- Designed to be called by pg_cron daily or via Supabase Edge Function.

-- 1. Cash payments without matching invoice status
-- 2. Escrow releases stuck in 'processing'
-- 3. Till entries without matching payment record

DO $$ BEGIN

-- Drop and recreate to ensure latest version
DROP FUNCTION IF EXISTS public.reconciliation_check();

END $$;

CREATE OR REPLACE FUNCTION public.reconciliation_check()
RETURNS TABLE (
    issue_type TEXT,
    entity_id UUID,
    entity_table TEXT,
    details JSONB,
    detected_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- 1. Cash payments confirmed but invoice not marked paid_cash
    RETURN QUERY
    SELECT
        'cash_payment_invoice_mismatch'::TEXT AS issue_type,
        cp.id AS entity_id,
        'cash_payments'::TEXT AS entity_table,
        jsonb_build_object(
            'invoice_id', cp.invoice_id,
            'invoice_status', i.status,
            'cash_confirmed_at', cp.confirmed_at
        ) AS details,
        NOW() AS detected_at
    FROM cash_payments cp
    JOIN invoices i ON i.id = cp.invoice_id
    WHERE cp.confirmed_at IS NOT NULL
      AND cp.voided_at IS NULL
      AND i.status NOT IN ('paid_cash', 'paid');

    -- 2. Escrow releases stuck in processing for > 1 hour
    RETURN QUERY
    SELECT
        'escrow_stuck_processing'::TEXT AS issue_type,
        er.id AS entity_id,
        'escrow_releases'::TEXT AS entity_table,
        jsonb_build_object(
            'invoice_id', er.invoice_id,
            'requested_at', er.created_at,
            'hours_stuck', EXTRACT(EPOCH FROM (NOW() - er.created_at)) / 3600
        ) AS details,
        NOW() AS detected_at
    FROM escrow_releases er
    WHERE er.status = 'processing'
      AND er.created_at < NOW() - INTERVAL '1 hour';

    -- 3. Till entries without a matching cash_payment or payment record
    RETURN QUERY
    SELECT
        'orphan_till_entry'::TEXT AS issue_type,
        te.id AS entity_id,
        'till_entries'::TEXT AS entity_table,
        jsonb_build_object(
            'invoice_id', te.invoice_id,
            'amount_cents', te.amount_cents,
            'recorded_at', te.created_at
        ) AS details,
        NOW() AS detected_at
    FROM till_entries te
    WHERE te.invoice_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM cash_payments cp
          WHERE cp.invoice_id = te.invoice_id
            AND cp.confirmed_at IS NOT NULL
      )
      AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.invoice_id = te.invoice_id
            AND p.status = 'confirmed'
      )
      AND te.created_at < NOW() - INTERVAL '30 minutes';
END;
$$;

-- Grant execute to service role (Edge Functions use service_role key)
GRANT EXECUTE ON FUNCTION public.reconciliation_check() TO service_role;

COMMENT ON FUNCTION public.reconciliation_check() IS
'Sprint 2 Task 2.5: Daily reconciliation check detecting split states from partial writes. Call via pg_cron or Edge Function.';
