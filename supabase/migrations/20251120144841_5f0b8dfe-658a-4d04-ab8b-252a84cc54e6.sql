-- Step 1: Add admin_no to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS admin_no TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_students_admin_no ON public.students(admin_no);

-- Step 2: Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'parent');

-- Step 3: Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create parent_students mapping table
CREATE TABLE IF NOT EXISTS public.parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, student_id)
);

-- Enable RLS on parent_students
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

-- Step 5: Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 6: Create helper function to get user's children (for parents)
CREATE OR REPLACE FUNCTION public.get_user_children(_user_id UUID)
RETURNS TABLE (student_id UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT student_id
  FROM public.parent_students
  WHERE user_id = _user_id
$$;

-- Step 7: Update RLS policies for students table
DROP POLICY IF EXISTS "Authenticated users can view all students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can insert students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can update students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can delete students" ON public.students;

-- Admins and teachers can view all students, parents can view their children
CREATE POLICY "Role-based student access"
ON public.students FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'teacher') OR
  (public.has_role(auth.uid(), 'parent') AND id IN (SELECT public.get_user_children(auth.uid())))
);

-- Only admins can insert students
CREATE POLICY "Admins can insert students"
ON public.students FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update students
CREATE POLICY "Admins can update students"
ON public.students FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete students
CREATE POLICY "Admins can delete students"
ON public.students FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Step 8: Update RLS policies for attendance table
DROP POLICY IF EXISTS "Authenticated users can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Authenticated users can insert attendance" ON public.attendance;

-- Admins and teachers can view all attendance, parents can view their children's attendance
CREATE POLICY "Role-based attendance access"
ON public.attendance FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'teacher') OR
  (public.has_role(auth.uid(), 'parent') AND student_id IN (SELECT public.get_user_children(auth.uid())))
);

-- Admins and API can insert attendance (edge function will use service role)
CREATE POLICY "Admins can insert attendance"
ON public.attendance FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Step 9: RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Step 10: RLS policies for parent_students table
CREATE POLICY "Parents can view their children"
ON public.parent_students FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage parent-student relationships"
ON public.parent_students FOR ALL
USING (public.has_role(auth.uid(), 'admin'));