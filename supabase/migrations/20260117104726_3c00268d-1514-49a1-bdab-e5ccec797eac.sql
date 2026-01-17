-- Allow admins to delete damage photos
CREATE POLICY "Admins can delete damage photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'damage-photos' 
  AND auth.role() = 'authenticated'
  AND public.has_role(auth.uid(), 'admin')
);