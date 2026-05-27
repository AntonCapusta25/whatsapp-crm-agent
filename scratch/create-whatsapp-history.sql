-- Run this in the Supabase SQL Editor for the CRM project
CREATE TABLE IF NOT EXISTS public.whatsapp_chat_history (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id   text NOT NULL,
    phone       text NOT NULL,
    direction   text NOT NULL CHECK (direction IN ('INCOMING', 'OUTGOING')),
    message_body text NOT NULL,
    is_important boolean DEFAULT false,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wch_phone_tenant ON public.whatsapp_chat_history(phone, tenant_id);
CREATE INDEX IF NOT EXISTS idx_wch_created_at   ON public.whatsapp_chat_history(created_at DESC);

-- Optional: auto-purge messages older than 90 days
-- (You can set this up as a pg_cron job instead)
