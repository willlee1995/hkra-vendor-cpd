-- Grant execute permission to service_role and authenticated users (though service_role usually bypasses, explicit grant helps with PostgREST exposure)
GRANT EXECUTE ON FUNCTION setup_vendor_user(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION setup_vendor_user(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION setup_vendor_user(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO anon;
