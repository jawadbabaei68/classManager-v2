
export const sqlSchema = `
-- ==========================================
-- Madrese Yar - School Management Schema (v2)
-- Database: PostgreSQL (Supabase)
-- ==========================================

-- Drop existing tables if rebuilding (Optional - Be careful!)
-- DROP TABLE IF EXISTS grades, attendance, sessions, subjects, enrollments, students, teachers, classes, profiles CASCADE;

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
    CREATE TYPE subject_type AS ENUM ('term', 'modular');
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'justified');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. PROFILES (Links to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role user_role DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  grade_level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TEACHERS (School Staff Directory)
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  personnel_id TEXT, -- Optional ID
  phone TEXT,
  profile_id UUID REFERENCES public.profiles(id), -- Link to auth later
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STUDENTS (Student Directory)
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  national_id TEXT UNIQUE NOT NULL,
  father_name TEXT,
  profile_id UUID REFERENCES public.profiles(id), -- Link to auth later
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ENROLLMENTS (Student -> Class)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  UNIQUE(class_id, student_id)
);

-- 7. SUBJECTS (Assign Teacher to Class)
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- e.g., "Math", "Science"
  type subject_type DEFAULT 'term',
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SESSIONS (For Attendance)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  topic TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  status attendance_status DEFAULT 'present',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- 10. GRADES
CREATE TABLE IF NOT EXISTS public.grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) DEFAULT 20,
  type TEXT DEFAULT 'term', 
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- RLS POLICIES (Simplified for Demo)
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- Allow everything for now (Secure this in production!)
CREATE POLICY "Public Access" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.classes FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.teachers FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.students FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.subjects FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.enrollments FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.sessions FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.attendance FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.grades FOR ALL USING (true);

`;

export const helpReadme = `
# راهنمای نصب و راه‌اندازی (README)

## پیش‌نیازها
1. Node.js نسخه 18 به بالا
2. حساب کاربری Supabase

## نصب پروژه
\`\`\`bash
npm install
\`\`\`

## راه‌اندازی Supabase
1. یک پروژه جدید در Supabase ایجاد کنید.
2. به بخش SQL Editor بروید.
3. کدهای SQL موجود در تب "SQL Schema" در تنظیمات اپلیکیشن را کپی و اجرا کنید.
4. به بخش Project Settings -> API بروید.
5. URL و Anon Key پروژه را کپی کنید.

## اجرای اپلیکیشن
\`\`\`bash
npm start
\`\`\`
سپس در صفحه تنظیمات برنامه، URL و Key را وارد کرده و دکمه ذخیره را بزنید.

## ساخت نسخه اندروید (APK)
\`\`\`bash
npm run build
npx cap add android
npx cap sync
npx cap open android
\`\`\`
`;
