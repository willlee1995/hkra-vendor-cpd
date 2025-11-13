-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-posters', 'vendor-posters', false),
    ('vendor-attendance', 'vendor-attendance', false) ON CONFLICT (id) DO NOTHING;
-- Storage policies for vendor-posters bucket
-- Vendors can upload to their own folder
CREATE POLICY "Vendors can upload own posters" ON storage.objects FOR
INSERT WITH CHECK (
        bucket_id = 'vendor-posters'
        AND (storage.foldername(name)) [1] = (
            SELECT id::text
            FROM vendors
            WHERE user_id = auth.uid()
        )
    );
-- Vendors can view their own posters
CREATE POLICY "Vendors can view own posters" ON storage.objects FOR
SELECT USING (
        bucket_id = 'vendor-posters'
        AND (
            (storage.foldername(name)) [1] = (
                SELECT id::text
                FROM vendors
                WHERE user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1
                FROM auth.users
                WHERE auth.users.id = auth.uid()
                    AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
            )
        )
    );
-- Vendors can update their own posters
CREATE POLICY "Vendors can update own posters" ON storage.objects FOR
UPDATE USING (
        bucket_id = 'vendor-posters'
        AND (storage.foldername(name)) [1] = (
            SELECT id::text
            FROM vendors
            WHERE user_id = auth.uid()
        )
    );
-- Vendors can delete their own posters
CREATE POLICY "Vendors can delete own posters" ON storage.objects FOR DELETE USING (
    bucket_id = 'vendor-posters'
    AND (storage.foldername(name)) [1] = (
        SELECT id::text
        FROM vendors
        WHERE user_id = auth.uid()
    )
);
-- Storage policies for vendor-attendance bucket
-- Vendors can upload attendance files for their own requests
CREATE POLICY "Vendors can upload own attendance" ON storage.objects FOR
INSERT WITH CHECK (
        bucket_id = 'vendor-attendance'
        AND (storage.foldername(name)) [1] = (
            SELECT id::text
            FROM vendors
            WHERE user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1
            FROM vendor_requests
            WHERE vendor_requests.id::text = (storage.foldername(name)) [2]
                AND vendor_requests.vendor_id = (
                    SELECT id
                    FROM vendors
                    WHERE user_id = auth.uid()
                )
                AND vendor_requests.status = 'approved'
        )
    );
-- Vendors can view their own attendance files
CREATE POLICY "Vendors can view own attendance" ON storage.objects FOR
SELECT USING (
        bucket_id = 'vendor-attendance'
        AND (
            (storage.foldername(name)) [1] = (
                SELECT id::text
                FROM vendors
                WHERE user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1
                FROM auth.users
                WHERE auth.users.id = auth.uid()
                    AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
            )
        )
    );
-- Admins can view all attendance files
CREATE POLICY "Admins can view all attendance" ON storage.objects FOR
SELECT USING (
        bucket_id = 'vendor-attendance'
        AND EXISTS (
            SELECT 1
            FROM auth.users
            WHERE auth.users.id = auth.uid()
                AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
        )
    );