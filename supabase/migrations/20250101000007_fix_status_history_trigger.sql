-- Fix the status history trigger to handle cases where auth.uid() is NULL
-- This happens when updates are made via Edge Functions using service role
-- The trigger should skip insertion if auth.uid() is NULL, as the Edge Function
-- will manually insert the history entry with the correct user ID
CREATE OR REPLACE FUNCTION create_status_history() RETURNS TRIGGER AS $$ BEGIN -- Only create history entry if auth.uid() is available (not NULL)
    -- Edge Functions using service role will manually insert history entries
    IF OLD.status IS DISTINCT
FROM NEW.status
    AND auth.uid() IS NOT NULL THEN
INSERT INTO vendor_request_status_history (request_id, status, changed_by, notes)
VALUES (
        NEW.id,
        NEW.status,
        auth.uid(),
        CASE
            WHEN NEW.status = 'rejected' THEN NEW.rejection_reason
            WHEN NEW.status = 'approved' THEN NEW.admin_notes
            ELSE NULL
        END
    );
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;