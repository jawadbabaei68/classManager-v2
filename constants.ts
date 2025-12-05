
import { GraduationCap, Users, BookOpen, CalendarCheck, Settings, FileText, UserCircle } from 'lucide-react';

export const APP_NAME = "مدرسه یار";

// Enhanced Color Palette for Mobile UI
export const COLORS = {
  primary: {
    DEFAULT: '#10b981', // emerald-500
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },
  secondary: {
    DEFAULT: '#3b82f6', // blue-500
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  accent: {
    DEFAULT: '#f59e0b', // amber-500
    light: '#fef3c7',   // amber-100
    dark: '#d97706',    // amber-600
  },
  danger: {
    DEFAULT: '#ef4444', // red-500
    light: '#fee2e2',   // red-100
    dark: '#b91c1c',    // red-700
  },
  background: {
    light: '#f9fafb',   // gray-50
    dark: '#111827',    // gray-900
    cardLight: '#ffffff',
    cardDark: '#1f2937',
  },
  text: {
    main: '#111827',    // gray-900
    muted: '#6b7280',   // gray-500
    light: '#f9fafb',   // gray-50
  }
};

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
