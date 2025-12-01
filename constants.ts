
import { GraduationCap, Users, BookOpen, CalendarCheck, Settings, FileText, UserCircle } from 'lucide-react';

export const APP_NAME = "مدرسه یار";

export const ROLE_LABELS: Record<string, string> = {
  admin: 'مدیر سیستم',
  teacher: 'دبیر محترم',
  student: 'دانش‌آموز',
};

export const MENU_ITEMS = [
  { icon: Users, label: 'مدیریت کاربران', path: '/admin/users', roles: ['admin'] },
  { icon: GraduationCap, label: 'کلاس‌ها و دروس', path: '/admin/classes', roles: ['admin'] },
  { icon: BookOpen, label: 'درس‌های من', path: '/teacher/subjects', roles: ['teacher'] },
  { icon: CalendarCheck, label: 'حضور و غیاب', path: '/teacher/attendance', roles: ['teacher', 'admin'] },
  { icon: FileText, label: 'نمرات', path: '/teacher/grades', roles: ['teacher'] },
  { icon: Settings, label: 'تنظیمات', path: '/settings', roles: ['admin', 'teacher', 'student'] },
];

export const ATTENDANCE_STATUSES = [
  { value: 'present', label: 'حاضر', color: 'bg-green-100 text-green-800' },
  { value: 'absent', label: 'غایب', color: 'bg-red-100 text-red-800' },
  { value: 'late', label: 'تاخیر', color: 'bg-yellow-100 text-yellow-800' },
];
