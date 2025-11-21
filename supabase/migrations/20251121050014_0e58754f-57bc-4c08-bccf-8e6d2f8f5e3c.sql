-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- Create users table with fingerprint mapping
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  role app_role NOT NULL,
  admn_no TEXT,
  class TEXT,
  section TEXT,
  fingerprint_id INTEGER UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create finger login logs table
CREATE TABLE public.finger_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_id INTEGER NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  device_id TEXT,
  login_time TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finger_login_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Allow public read users"
  ON public.users
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert users"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated delete users"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for finger_login_logs
CREATE POLICY "Allow public read finger_login_logs"
  ON public.finger_login_logs
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert finger_login_logs"
  ON public.finger_login_logs
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster fingerprint lookups
CREATE INDEX idx_users_fingerprint_id ON public.users(fingerprint_id);
CREATE INDEX idx_finger_login_logs_login_time ON public.finger_login_logs(login_time DESC);

-- Enable realtime for finger_login_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.finger_login_logs;