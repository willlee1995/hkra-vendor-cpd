# Troubleshooting Guide

## Common Issues and Solutions

### "Vendor record not found" Error

**Symptom:** When uploading a poster image or submitting a form, you see the error: "Vendor account not set up. Please contact administrator to create your vendor profile."

**Cause:** Your user account exists in Supabase Auth with the `vendor` role, but there's no corresponding record in the `vendors` table.

**Solution:**

1. **Check if vendor record exists:**
   ```sql
   SELECT * FROM vendors WHERE user_id = 'YOUR_USER_ID';
   ```

2. **Create vendor record:**
   ```sql
   -- Get your user_id from auth.users
   SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

   -- Create vendor record
   INSERT INTO vendors (user_id, company_name, contact_name, contact_email, contact_phone)
   VALUES (
     'YOUR_USER_ID_FROM_AUTH',
     'Your Company Name',
     'Your Contact Name',
     'your-email@example.com',
     '+1234567890'
   );
   ```

3. **Or use the helper function:**
   ```sql
   SELECT setup_vendor_user(
     (SELECT id FROM auth.users WHERE email = 'your-email@example.com'),
     'Your Company Name',
     'Your Contact Name',
     'your-email@example.com',
     '+1234567890'
   );
   ```

**Note:** The poster upload is optional. You can submit the form without uploading a poster, but you'll need the vendor record for other operations.

### Form Submission Errors

**Symptom:** Form shows "[object Object]" errors or validation errors don't display properly.

**Solution:** This has been fixed in the latest code. Make sure you're using the updated `VendorRequestForm` component with the `getErrorMessage` helper function.

### Date Picker Not Working

**Symptom:** Calendar picker shows errors or doesn't display correctly.

**Solution:**
- Make sure Tailwind CSS v4 is properly configured
- Check browser console for errors
- Verify the Calendar component is properly imported

### Authentication Issues

**Symptom:** "Access denied. Vendor account required."

**Cause:** Your user account doesn't have `role: 'vendor'` in user metadata.

**Solution:**
```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"vendor"'
)
WHERE email = 'your-email@example.com';
```

### Edge Functions Not Working

**Symptom:** API calls to Edge Functions return 404 or 500 errors.

**Solutions:**
1. **Check if functions are deployed:**
   ```bash
   docker exec supabase_functions ls /home/deno/functions/
   ```

2. **Check function logs:**
   ```bash
   docker logs supabase_functions
   ```

3. **Verify environment variables are set:**
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

4. **Redeploy functions:**
   ```bash
   ./scripts/deploy-functions.sh
   ```

### Storage Upload Errors

**Symptom:** File uploads fail with permission errors.

**Solutions:**
1. **Check storage bucket exists:**
   ```sql
   SELECT * FROM storage.buckets WHERE id IN ('vendor-posters', 'vendor-attendance');
   ```

2. **Verify storage policies:**
   ```sql
   SELECT * FROM storage.policies WHERE bucket_id = 'vendor-posters';
   ```

3. **Check RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'storage';
   ```

### Database Connection Issues

**Symptom:** Cannot connect to Supabase or queries fail.

**Solutions:**
1. **Verify connection string:**
   ```bash
   echo $VITE_SUPABASE_URL
   echo $VITE_SUPABASE_ANON_KEY
   ```

2. **Test connection:**
   ```sql
   SELECT version();
   ```

3. **Check if migrations are applied:**
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
   ```

## Getting Help

If you encounter issues not covered here:

1. Check browser console for detailed error messages
2. Check Supabase logs: `docker logs supabase_functions`
3. Verify all environment variables are set correctly
4. Ensure database migrations have been applied
5. Verify vendor user setup (see SETUP_VENDOR_USERS.md)

