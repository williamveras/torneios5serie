CREATE POLICY "Deny anon access to database_export_15_07_26"
ON storage.objects FOR ALL TO anon
USING (bucket_id <> 'database_export_15_07_26')
WITH CHECK (bucket_id <> 'database_export_15_07_26');

CREATE POLICY "Deny authenticated access to database_export_15_07_26"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id <> 'database_export_15_07_26')
WITH CHECK (bucket_id <> 'database_export_15_07_26');