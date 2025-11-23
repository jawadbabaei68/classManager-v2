
export enum ClassType {
  MODULAR = 'MODULAR', // پودمانی
  TERM = 'TERM',       // ترمی
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
}

export interface DisciplineRecord {
  sleep: boolean;      // -0.5
  badBehavior: boolean; // -0.5
  expelled: boolean;    // -1.0
}

export interface SessionRecord {
  sessionId: string;
  studentId: string;
  attendance: AttendanceStatus;
  discipline: DisciplineRecord;
  positivePoints: number; // 0.5 to 5
  note: string;
}

export interface Session {
  id: string;
  classId: string;
  date: string; // ISO string
  dayOfWeek: string;
  records: SessionRecord[];
}

export interface Student {
  id: string;
  name: string;
  avatarUrl?: string; // Base64 or URL
}

export interface GradeModular {
  moduleId: 1 | 2 | 3 | 4 | 5;
  score: number;
}

export interface GradeTerm {
  termId: 1 | 2;
  continuous: number; // مستمر
  final: number;      // پایانی
}

export interface StudentPerformance {
  studentId: string;
  gradesModular: GradeModular[];
  gradesTerm: GradeTerm[];
}

export interface AIResource {
  name: string;
  mimeType: string;
  data: string; // Base64
}

export interface Classroom {
  id: string;
  name: string;
  bookName: string; // نام کتاب/موضوع
  academicYear: string; // سال تحصیلی
  type: ClassType;
  students: Student[];
  sessions: Session[];
  performance: StudentPerformance[];
  resources: {
    mainFile?: AIResource; // فایل اصلی کتاب برای هوش مصنوعی
    lessonPlans: string[];
  };
}

export interface GlobalSettings {
  teacherName: string;
  username?: string;
  password?: string;
  currentAcademicYear: string;
  availableYears: string[]; // لیست سال‌های تحصیلی موجود
}