
import { ClassType, Classroom } from '../types';

export interface AcademicPeriod {
  id: number;
  label: string;
}

/**
 * Creates session structure (academic periods) for a course.
 * Returns Terms for term-based courses and Pods for modular courses.
 */
export const createSessionsForCourse = (course: Classroom | { type: ClassType | string }): AcademicPeriod[] => {
  const type = course.type;
  
  // Check for Term type (handling potential string variations if data comes from external sources)
  if (type === ClassType.TERM || type === 'TERM' || type === 'term') {
    return [
      { id: 1, label: 'ترم اول' },
      { id: 2, label: 'ترم دوم' }
    ];
  }
  
  // Default to Modular (Pod 1-5)
  return [
    { id: 1, label: 'پودمان ۱' },
    { id: 2, label: 'پودمان ۲' },
    { id: 3, label: 'پودمان ۳' },
    { id: 4, label: 'پودمان ۴' },
    { id: 5, label: 'پودمان ۵' }
  ];
};
