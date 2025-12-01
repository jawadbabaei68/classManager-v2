import React, { useEffect, useState } from 'react';
import { Calendar, Save, Check } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getSupabase } from '../../services/supabaseClient';
import { ATTENDANCE_STATUSES } from '../../constants';
import { ClassGroup, Student } from '../../types';

const Attendance: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  
  const supabase = getSupabase();

  // Load Classes
  useEffect(() => {
    if (!supabase) return;
    const loadClasses = async () => {
      // In a real app, filter by teacher_id using a junction table
      const { data } = await supabase.from('classes').select('*'); 
      if (data) {
        setClasses(data);
        if (data.length > 0) setSelectedClass(data[0].id);
      }
    };
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Students for Class
  useEffect(() => {
    if (!supabase || !selectedClass) return;
    const loadStudents = async () => {
      // Join enrollments to get students
      const { data } = await supabase
        .from('enrollments')
        .select('student:students(*)')
        .eq('class_id', selectedClass);
      
      if (data) {
        const list = data.map((d: any) => d.student).filter(Boolean);
        setStudents(list);
        // Reset attendance state
        const initialStatus: Record<string, string> = {};
        list.forEach((s: Student) => initialStatus[s.id] = 'present');
        setAttendance(initialStatus);
      }
    };
    loadStudents();
  }, [selectedClass, supabase]);

  const toggleStatus = (studentId: string) => {
    const current = attendance[studentId] || 'present';
    const idx = ATTENDANCE_STATUSES.findIndex(s => s.value === current);
    const next = ATTENDANCE_STATUSES[(idx + 1) % ATTENDANCE_STATUSES.length].value;
    setAttendance(prev => ({ ...prev, [studentId]: next }));
  };

  const handleSave = async () => {
    if (!supabase) return;
    setLoading(true);
    
    try {
      // 1. Create/Get Session
      // Note: In a real app, you'd select a Subject first. Here we simplify to just Class+Date.
      // We will create a dummy session for the first subject of the class or just generic.
      // For this demo, let's assume we have a subject ID or create a dummy one.
      
      // Let's just alert for now as strict schema requires subject_id
      alert("در نسخه کامل، ابتدا باید درس (Subject) انتخاب شود. اطلاعات در کنسول لاگ شد.");
      console.log({ date, class: selectedClass, attendance });
      
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">کلاس</label>
            <select 
              value={selectedClass} 
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-3 bg-gray-50 rounded-xl border-none outline-none text-gray-900"
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">تاریخ</label>
            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl">
              <Calendar size={18} className="text-gray-400" />
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent w-full outline-none ltr text-right text-gray-900" 
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {students.map(student => {
          const status = attendance[student.id] || 'present';
          const statusConfig = ATTENDANCE_STATUSES.find(s => s.value === status) || ATTENDANCE_STATUSES[0];
          
          return (
            <div 
              key={student.id}
              onClick={() => toggleStatus(student.id)}
              className="bg-white p-4 rounded-xl flex items-center justify-between border border-gray-100 active:scale-98 transition-transform select-none cursor-pointer"
            >
              <span className="font-medium text-gray-900">{student.full_name}</span>
              <span className={`px-3 py-1 rounded-lg text-sm font-bold ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          );
        })}
        {students.length === 0 && <p className="text-center text-gray-400 mt-8">دانش‌آموزی در این کلاس یافت نشد.</p>}
      </div>

      {students.length > 0 && (
        <div className="sticky bottom-4">
          <Button fullWidth onClick={handleSave} disabled={loading}>
            <Save size={20} />
            ثبت لیست حضور و غیاب
          </Button>
        </div>
      )}
    </div>
  );
};

export default Attendance;