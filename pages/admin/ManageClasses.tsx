
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, BookOpen, User, GraduationCap, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { getSupabase } from '../../services/supabaseClient';
import { ClassGroup, Subject, Teacher, Student } from '../../types';

const ManageClasses: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'subjects' | 'students'>('subjects');
  
  // Data for Expanded Class
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  
  // Modals
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

  // Forms
  const [newClassName, setNewClassName] = useState('');
  const [subjectForm, setSubjectForm] = useState({ name: '', teacher_id: '', type: 'term' });
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  
  const supabase = getSupabase();

  const fetchClasses = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false });
    if (data) setClasses(data);
  };

  const fetchTeachers = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('teachers').select('*');
    if (data) setTeachers(data);
  };

  // Fetch data for specific class
  const fetchClassDetails = async (classId: string) => {
    if (!supabase) return;
    
    // Fetch Subjects
    const { data: subjects } = await supabase
      .from('subjects')
      .select('*, teacher:teachers(full_name)')
      .eq('class_id', classId)
      .order('created_at', { ascending: true });
    
    if (subjects) setClassSubjects(subjects as any);

    // Fetch Enrolled Students
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student:students(*)')
      .eq('class_id', classId);
    
    if (enrollments) {
      const students = enrollments.map((e: any) => e.student).filter(Boolean);
      setClassStudents(students);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName || !supabase) return;
    setLoading(true);
    const { error } = await supabase.from('classes').insert([{ name: newClassName }]);
    setLoading(false);
    
    if (error) alert('خطا: ' + error.message);
    else {
      setNewClassName('');
      setIsClassModalOpen(false);
      fetchClasses();
    }
  };

  const handleDeleteClass = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supabase || !confirm('با حذف کلاس، تمام دروس و دانش‌آموزان آن حذف می‌شوند. ادامه می‌دهید؟')) return;
    await supabase.from('classes').delete().eq('id', id);
    fetchClasses();
  };

  const toggleClassExpand = (classId: string) => {
    if (expandedClass === classId) {
      setExpandedClass(null);
      setClassSubjects([]);
      setClassStudents([]);
    } else {
      setExpandedClass(classId);
      setActiveTab('subjects');
      fetchClassDetails(classId);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !expandedClass) return;
    
    setSubjectLoading(true);

    // Convert empty string to null for UUID field to prevent DB error
    const teacherIdToSave = subjectForm.teacher_id === '' ? null : subjectForm.teacher_id;

    const { error } = await supabase.from('subjects').insert([{
      name: subjectForm.name,
      teacher_id: teacherIdToSave,
      type: subjectForm.type,
      class_id: expandedClass
    }]);

    setSubjectLoading(false);

    if (error) {
      alert('خطا در ثبت درس: ' + error.message);
    } else {
      setIsSubjectModalOpen(false);
      setSubjectForm({ name: '', teacher_id: '', type: 'term' });
      fetchClassDetails(expandedClass);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!supabase || !confirm('این درس حذف شود؟')) return;
    await supabase.from('subjects').delete().eq('id', id);
    if (expandedClass) fetchClassDetails(expandedClass);
  };

  // Student Enrollment Logic
  const openEnrollModal = async () => {
    if (!supabase) return;
    setEnrollLoading(true);
    // Fetch all students
    const { data } = await supabase.from('students').select('*').order('full_name');
    if (data) {
      // Filter out already enrolled students
      const enrolledIds = new Set(classStudents.map(s => s.id));
      setAvailableStudents(data.filter(s => !enrolledIds.has(s.id)));
    }
    setEnrollLoading(false);
    setSelectedStudentIds(new Set());
    setIsEnrollModalOpen(true);
  };

  const handleEnrollStudents = async () => {
    if (!supabase || !expandedClass) return;
    setEnrollLoading(true);

    const enrollmentsToCreate = Array.from(selectedStudentIds).map(studentId => ({
      class_id: expandedClass,
      student_id: studentId
    }));

    const { error } = await supabase.from('enrollments').insert(enrollmentsToCreate);
    setEnrollLoading(false);

    if (error) {
      alert('خطا در افزودن دانش‌آموزان: ' + error.message);
    } else {
      setIsEnrollModalOpen(false);
      fetchClassDetails(expandedClass);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!supabase || !expandedClass || !confirm('حذف دانش‌آموز از کلاس؟')) return;
    
    await supabase.from('enrollments')
      .delete()
      .eq('class_id', expandedClass)
      .eq('student_id', studentId);
      
    fetchClassDetails(expandedClass);
  };

  const toggleStudentSelection = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-xl font-bold text-gray-900">مدیریت کلاس‌ها</h2>
         <Button onClick={() => setIsClassModalOpen(true)}>
           <Plus size={20} />
           کلاس جدید
         </Button>
      </div>

      <div className="grid gap-4">
        {classes.map(cls => (
          <Card key={cls.id} className="p-0 overflow-hidden">
            {/* Class Header */}
            <div 
              onClick={() => toggleClassExpand(cls.id)}
              className="p-4 flex items-center justify-between bg-white cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{cls.name}</h3>
                <p className="text-xs text-gray-500">{cls.grade_level || 'بدون پایه'}</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={(e) => handleDeleteClass(cls.id, e)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={18} />
                </button>
                {expandedClass === cls.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </div>
            </div>

            {/* Expanded Area */}
            {expandedClass === cls.id && (
              <div className="bg-gray-50 border-t border-gray-100">
                {/* Internal Tabs */}
                <div className="flex border-b border-gray-200">
                  <button 
                    onClick={() => setActiveTab('subjects')}
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'subjects' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500'}`}
                  >
                    دروس و اساتید ({classSubjects.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('students')}
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'students' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500'}`}
                  >
                    دانش‌آموزان ({classStudents.length})
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 animate-in fade-in">
                  {activeTab === 'subjects' && (
                    <>
                       <div className="flex justify-between items-center mb-3">
                        <span className="text-xs text-gray-500">لیست دروس تعریف شده برای این کلاس</span>
                        <Button variant="secondary" className="py-1 px-3 text-xs" onClick={() => setIsSubjectModalOpen(true)}>
                          <Plus size={14} /> افزودن درس
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {classSubjects.map(sub => (
                          <div key={sub.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                            <div>
                              <div className="font-bold text-gray-900">{sub.name}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <User size={12} />
                                {sub.teacher?.full_name || 'بدون دبیر'}
                              </div>
                            </div>
                            <button onClick={() => handleDeleteSubject(sub.id)} className="text-red-400 p-1">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        {classSubjects.length === 0 && <p className="text-center text-gray-400 text-sm py-4">درسی وجود ندارد</p>}
                      </div>
                    </>
                  )}

                  {activeTab === 'students' && (
                    <>
                       <div className="flex justify-between items-center mb-3">
                        <span className="text-xs text-gray-500">دانش‌آموزان عضو این کلاس</span>
                        <Button variant="secondary" className="py-1 px-3 text-xs" onClick={openEnrollModal}>
                          <Plus size={14} /> افزودن دانش‌آموز
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {classStudents.map(std => (
                          <div key={std.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                                {std.full_name?.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 text-sm">{std.full_name}</div>
                                <div className="text-xs text-gray-500">{std.national_id}</div>
                              </div>
                            </div>
                            <button onClick={() => handleRemoveStudent(std.id)} className="text-red-400 p-1 hover:bg-red-50 rounded">
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                        {classStudents.length === 0 && <p className="text-center text-gray-400 text-sm py-4">دانش‌آموزی در این کلاس نیست</p>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
        {classes.length === 0 && <p className="text-center text-gray-400">هنوز کلاسی تعریف نکرده‌اید.</p>}
      </div>

      {/* Modal: Create Class */}
      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title="تعریف کلاس جدید">
        <form onSubmit={handleCreateClass} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نام کلاس</label>
            <input 
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="مثال: دهم ریاضی ۱"
              className="w-full p-3 border rounded-xl bg-gray-50 text-gray-900 placeholder-gray-500 outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          <Button type="submit" fullWidth disabled={loading}>ذخیره کلاس</Button>
        </form>
      </Modal>

      {/* Modal: Add Subject */}
      <Modal isOpen={isSubjectModalOpen} onClose={() => setIsSubjectModalOpen(false)} title="افزودن درس">
        <form onSubmit={handleAddSubject} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نام درس</label>
            <input 
              value={subjectForm.name}
              onChange={(e) => setSubjectForm({...subjectForm, name: e.target.value})}
              placeholder="مثال: ریاضیات گسسته"
              className="w-full p-3 border rounded-xl bg-gray-50 text-gray-900 outline-none focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">دبیر مربوطه</label>
            <select 
              value={subjectForm.teacher_id}
              onChange={(e) => setSubjectForm({...subjectForm, teacher_id: e.target.value})}
              className="w-full p-3 border rounded-xl bg-gray-50 text-gray-900 outline-none focus:border-blue-500"
            >
              <option value="">انتخاب کنید... (اختیاری)</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نوع نمره دهی</label>
            <select 
              value={subjectForm.type}
              onChange={(e) => setSubjectForm({...subjectForm, type: e.target.value as any})}
              className="w-full p-3 border rounded-xl bg-gray-50 text-gray-900 outline-none focus:border-blue-500"
            >
              <option value="term">ترمی (عادی)</option>
              <option value="modular">پودمانی</option>
            </select>
          </div>
          <Button type="submit" fullWidth disabled={subjectLoading}>{subjectLoading ? 'در حال ثبت...' : 'افزودن درس'}</Button>
        </form>
      </Modal>

      {/* Modal: Enroll Students */}
      <Modal isOpen={isEnrollModalOpen} onClose={() => setIsEnrollModalOpen(false)} title="افزودن دانش‌آموز به کلاس">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">دانش‌آموزانی که می‌خواهید اضافه کنید را انتخاب کنید:</p>
          <div className="max-h-60 overflow-y-auto border rounded-xl p-2 bg-gray-50 space-y-1">
            {availableStudents.map(s => (
              <div 
                key={s.id} 
                onClick={() => toggleStudentSelection(s.id)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedStudentIds.has(s.id) ? 'bg-blue-100 border-blue-300' : 'bg-white hover:bg-gray-100'}`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedStudentIds.has(s.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
                  {selectedStudentIds.has(s.id) && <Check size={12} className="text-white" />}
                </div>
                <div className="text-sm font-bold text-gray-800">{s.full_name} <span className="text-gray-400 font-normal">({s.national_id})</span></div>
              </div>
            ))}
            {availableStudents.length === 0 && <p className="text-center text-gray-400 py-4">همه دانش‌آموزان عضو کلاس هستند.</p>}
          </div>
          <div className="flex gap-2">
             <Button fullWidth onClick={handleEnrollStudents} disabled={enrollLoading || selectedStudentIds.size === 0}>
               {enrollLoading ? 'در حال افزودن...' : `افزودن (${selectedStudentIds.size} نفر)`}
             </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Helper for check icon
const Check = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default ManageClasses;
