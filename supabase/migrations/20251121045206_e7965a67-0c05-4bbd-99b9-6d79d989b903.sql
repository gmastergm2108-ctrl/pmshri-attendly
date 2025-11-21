-- Drop existing attendance table and recreate with minimal structure
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.parent_students CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP FUNCTION IF EXISTS public.has_role CASCADE;
DROP FUNCTION IF EXISTS public.get_user_children CASCADE;

DROP TYPE IF EXISTS public.app_role CASCADE;

-- Create simple attendance table for fingerprint logs
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_id integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for ESP32)
CREATE POLICY "Allow public insert"
  ON public.attendance
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anyone to read
CREATE POLICY "Allow public select"
  ON public.attendance
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

-- Create index for faster queries
CREATE INDEX idx_attendance_created_at ON public.attendance(created_at DESC);