-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL UNIQUE,
    contact_phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Create vendor_requests table
CREATE TABLE IF NOT EXISTS vendor_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    event_start_date DATE NOT NULL,
    event_end_date DATE NOT NULL,
    expected_cpd_points DECIMAL(4, 2) NOT NULL CHECK (
        expected_cpd_points >= 0.5
        AND expected_cpd_points <= 8.0
    ),
    vendor_company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    poster_file_url TEXT,
    expected_promotion_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'withdrawn')
    ),
    admin_notes TEXT,
    rejection_reason TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    attendance_file_url TEXT,
    attendance_uploaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Create vendor_request_status_history table
CREATE TABLE IF NOT EXISTS vendor_request_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES vendor_requests(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_contact_email ON vendors(contact_email);
CREATE INDEX IF NOT EXISTS idx_vendor_requests_vendor_id ON vendor_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_requests_status ON vendor_requests(status);
CREATE INDEX IF NOT EXISTS idx_vendor_requests_created_at ON vendor_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_request_status_history_request_id ON vendor_request_status_history(request_id);
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Add updated_at triggers
CREATE TRIGGER update_vendors_updated_at BEFORE
UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendor_requests_updated_at BEFORE
UPDATE ON vendor_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Enable Row Level Security
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_request_status_history ENABLE ROW LEVEL SECURITY;
-- RLS Policies for vendors table
-- Vendors can view and update their own record
CREATE POLICY "Vendors can view own record" ON vendors FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Vendors can update own record" ON vendors FOR
UPDATE USING (auth.uid() = user_id);
-- Admins can view all vendors
CREATE POLICY "Admins can view all vendors" ON vendors FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM auth.users
            WHERE auth.users.id = auth.uid()
                AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
        )
    );
-- RLS Policies for vendor_requests table
-- Vendors can view their own requests
CREATE POLICY "Vendors can view own requests" ON vendor_requests FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM vendors
            WHERE vendors.id = vendor_requests.vendor_id
                AND vendors.user_id = auth.uid()
        )
    );
-- Vendors can create requests (with their own vendor_id)
CREATE POLICY "Vendors can create own requests" ON vendor_requests FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM vendors
            WHERE vendors.id = vendor_requests.vendor_id
                AND vendors.user_id = auth.uid()
        )
    );
-- Vendors can update requests only if status is 'pending'
CREATE POLICY "Vendors can update pending requests" ON vendor_requests FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM vendors
            WHERE vendors.id = vendor_requests.vendor_id
                AND vendors.user_id = auth.uid()
        )
        AND status = 'pending'
    ) WITH CHECK (
        EXISTS (
            SELECT 1
            FROM vendors
            WHERE vendors.id = vendor_requests.vendor_id
                AND vendors.user_id = auth.uid()
        )
        AND status = 'pending'
    );
-- Admins can view all requests
CREATE POLICY "Admins can view all requests" ON vendor_requests FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM auth.users
            WHERE auth.users.id = auth.uid()
                AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
        )
    );
-- Admins can update all requests
CREATE POLICY "Admins can update all requests" ON vendor_requests FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM auth.users
            WHERE auth.users.id = auth.uid()
                AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
        )
    );
-- RLS Policies for vendor_request_status_history table
-- Vendors can view history for their own requests
CREATE POLICY "Vendors can view own request history" ON vendor_request_status_history FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM vendor_requests
                JOIN vendors ON vendors.id = vendor_requests.vendor_id
            WHERE vendor_requests.id = vendor_request_status_history.request_id
                AND vendors.user_id = auth.uid()
        )
    );
-- Admins can view all history
CREATE POLICY "Admins can view all request history" ON vendor_request_status_history FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM auth.users
            WHERE auth.users.id = auth.uid()
                AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
        )
    );
-- Function to automatically create status history entry
CREATE OR REPLACE FUNCTION create_status_history() RETURNS TRIGGER AS $$ BEGIN IF OLD.status IS DISTINCT
FROM NEW.status THEN
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
-- Trigger to create status history
CREATE TRIGGER vendor_request_status_history_trigger
AFTER
UPDATE ON vendor_requests FOR EACH ROW EXECUTE FUNCTION create_status_history();