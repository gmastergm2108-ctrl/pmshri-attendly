-- Drop the minimal attendance table and recreate full system
DROP TABLE IF EXISTS public.attendance CASCADE;

-- Create students table with fingerprint data
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  class text NOT NULL,
  section text NOT NULL,
  roll_number text NOT NULL,
  finger_id text UNIQUE,
  parent_phone text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create attendance table with student relationship
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present',
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  device_id text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for ESP32 and frontend)
CREATE POLICY "Allow public read students"
  ON public.students
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert students"
  ON public.students
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update students"
  ON public.students
  FOR UPDATE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read attendance"
  ON public.attendance
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert attendance"
  ON public.attendance
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

-- Create indexes for performance
CREATE INDEX idx_students_finger_id ON public.students(finger_id);
CREATE INDEX idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX idx_attendance_timestamp ON public.attendance(timestamp DESC);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Add trigger for students table
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();