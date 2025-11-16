-- Make expected_cpd_points nullable so vendors don't need to provide it
-- Admins will set the CPD points when approving the request
ALTER TABLE vendor_requests
ALTER COLUMN expected_cpd_points DROP NOT NULL;
-- Update the comment to reflect the change
COMMENT ON COLUMN vendor_requests.expected_cpd_points IS 'CPD points awarded for this event, set by admin during approval';