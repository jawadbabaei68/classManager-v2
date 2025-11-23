import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Session, Student, SessionRecord, AttendanceStatus, DailyLessonPlan, AIResource } from '../types';
import { formatJalaali, parseJalaaliToIso } from '../services/dateService';
import { Icons } from '../components/Icons';

interface SessionScreenProps {
  session: Session;
  students: Student[];
  allSessions: Session[];
  onUpdate: (s: Session, shouldExit: boolean) => void;
  resource?: AIResource;
}

export const SessionScreen: React.FC<SessionScreenProps> = ({ session, students, allSessions, onUpdate, resource }) => {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [dateStr, setDateStr] = useState('');
  const [dayStr, setDayStr] = useState(session.dayOfWeek);
  
  // Lesson Plan State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [lessonPlan, setLessonPlan] = useState<DailyLessonPlan>(session.lessonPlan || {
      topic: '',
      objectives: '',
      materials: '',
      method: '',
      activities: '',
      evaluation: ''
  });

  const [savingStatus, setSavingStatus] = useState<'saved' | 'saving' | 'pending'>('saved');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize only once on mount
  useEffect(() => {
    setDateStr(formatJalaali(session.date));
    if (session.records.length > 0) {
      setRecords(session.records);
    } else {
      const initialRecords: SessionRecord[] = students.map(s => ({
        sessionId: session.id,
        studentId: s.id,
        attendance: AttendanceStatus.PRESENT,
        discipline: { sleep: false, badBehavior: false, expelled: false },
        positivePoints: 0,
        note: ''
      }));
      setRecords(initialRecords);
    }
  }, []); // Empty dependency array ensures this runs once per session screen mount

  // Find previous session
  const previousSession = useMemo(() => {
    if (!allSessions || allSessions.length < 2) return null;
    
    const sorted = [...allSessions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const currentIndex = sorted.findIndex(s => s.id === session.id);
    if (currentIndex > 0) {
        return sorted[currentIndex - 1];
    }
    return null;
  }, [allSessions, session.id]);

  // Auto-save Effect
  useEffect(() => {
    if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
    }

    // Skip initial render
    if (records.length === 0) return;

    setSavingStatus('pending');
    
    autoSaveTimerRef.current = setTimeout(() => {
        handleSave(false);
    }, 1000); // 1 second debounce

    return () => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [records, dateStr, dayStr, lessonPlan]);

  const updateRecord = (studentId: string, updates: Partial<SessionRecord>) => {
    setRecords(prev => prev.map(r => r.studentId === studentId ? { ...r, ...updates } : r));
  };

  const updateDiscipline = (studentId: string, key: keyof SessionRecord['discipline']) => {
    setRecords(prev => prev.map(r => {
        if (r.studentId !== studentId) return r;
        return {
            ...r,
            discipline: { ...r.discipline, [key]: !r.discipline[key] }
        };
    }));
  };

  const handleSave = (shouldExit: boolean) => {
    if (!dateStr) return; // Wait for initialization
    
    const isoDate = parseJalaaliToIso(dateStr);
    if (!isoDate) return; 

    setSavingStatus('saving');
    
    onUpdate({
        ...session,
        date: isoDate,
        dayOfWeek: dayStr,
        records,
        lessonPlan
    }, shouldExit);

    // Fake a small delay for UI feedback if not exiting
    if (!shouldExit) {
        setTimeout(() => setSavingStatus('saved'), 500);
    }
  };

  const handleBack = () => {
      handleSave(true);
  };

  const calculateScore = (r: SessionRecord) => {
      let score = 0;
      if (r.discipline.sleep) score -= 0.5;
      if (r.discipline.badBehavior) score -= 0.5;
      if (r.discipline.expelled) score -= 1;
      score += r.positivePoints;
      return score;
  };

  const getPreviousStatus = (studentId: string) => {
      if (!previousSession) return null;
      const record = previousSession.records.find(r => r.studentId === studentId);
      if (!record) return null;
      
      switch(record.attendance) {
          case AttendanceStatus.ABSENT:
              return { text: 'غایب جلسه قبل', color: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/40' };
          case AttendanceStatus.LATE:
              return { text: 'تاخیر جلسه قبل', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/40' };
          default:
              return null;
      }
  };

  const handleViewResource = () => {
      if (!resource) return;
      try {
        const base64Data = resource.data;
        const mimeType = resource.mimeType;
        
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: mimeType});
        const fileURL = URL.createObjectURL(blob);
        window.open(fileURL, '_blank');
      } catch (error) {
          console.error("Error opening file", error);
          alert("خطا در باز کردن فایل.");
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col font-vazir transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 sticky top-0 z-20 shadow-sm border-b border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4 max-w-3xl mx-auto w-full">
            <button onClick={handleBack} className="text-gray-600 dark:text-gray-300 font-bold text-sm hover:text-gray-900 dark:hover:text-white px-2 flex items-center gap-1">
                <Icons.Back size={16} />
                بازگشت
            </button>
            <div className="flex flex-col items-center">
                <h2 className="font-black text-lg text-emerald-800 dark:text-emerald-400">مدیریت جلسه</h2>
                <span className={`text-[10px] font-bold transition-colors ${
                    savingStatus === 'saved' ? 'text-emerald-500' : 
                    savingStatus === 'saving' ? 'text-blue-500' : 'text-amber-500'
                }`}>
                    {savingStatus === 'saved' ? 'ذخیره شد' : 
                     savingStatus === 'saving' ? 'در حال ذخیره...' : 'تغییرات ذخیره نشده'}
                </span>
            </div>
            
            <div className="flex gap-2">
                {resource && (
                    <button 
                        onClick={handleViewResource}
                        className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"
                        title="مشاهده منبع"
                    >
                        <Icons.Eye size={20} />
                    </button>
                )}
                <button 
                    onClick={() => setShowPlanModal(true)}
                    className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center gap-1"
                >
                    {/* Fix: Replaced Icons.FileText with Icons.File */}
                    <Icons.File size={20} />
                    <span className="text-xs font-bold hidden sm:inline">طرح درس</span>
                </button>
            </div>
        </div>
        <div className="flex gap-3 max-w-3xl mx-auto w-full">
            <div className="relative flex-1">
                <input 
                    type="text" 
                    value={dateStr} 
                    onChange={(e) => setDateStr(e.target.value)}
                    placeholder="۱۴۰۳/۰۱/۰۱"
                    className="w-full border border-gray-200 dark:border-gray-600 p-2.5 rounded-xl text-sm bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900 dark:text-white text-left pl-8"
                    dir="ltr"
                />
                <Icons.Calendar className="absolute left-2.5 top-2.5 text-gray-400 w-4 h-4" />
            </div>
            <input 
                type="text" 
                value={dayStr}
                onChange={(e) => setDayStr(e.target.value)}
                className="border border-gray-200 dark:border-gray-600 p-2.5 rounded-xl w-1/3 text-sm text-center bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900 dark:text-white"
            />
        </div>
      </div>

      {/* Student List */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto max-w-3xl mx-auto w-full pb-20">
        {students.map(student => {
            const record = records.find(r => r.studentId === student.id);
            if (!record) return null;
            const score = calculateScore(record);
            const prevStatus = getPreviousStatus(student.id);

            return (
                <div key={student.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 transition-shadow hover:shadow-md">
                    {/* Row 1: Info & Attendance */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                             {student.avatarUrl ? (
                                <img src={student.avatarUrl} className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-gray-600 shadow-sm" />
                             ) : (
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><Icons.Users size={20}/></div>
                             )}
                             <div>
                                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    {student.name}
                                    {prevStatus && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${prevStatus.color}`}>
                                            {prevStatus.text}
                                        </span>
                                    )}
                                </h3>
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${score < 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400' : score > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                    {score > 0 ? '+' : ''}{score} امتیاز
                                </span>
                             </div>
                        </div>
                        
                        {/* Attendance Toggles */}
                        <div className="flex bg-gray-50 dark:bg-gray-700 rounded-xl p-1 border border-gray-100 dark:border-gray-600">
                            <button 
                                onClick={() => updateRecord(student.id, { attendance: AttendanceStatus.PRESENT })}
                                className={`p-2.5 rounded-lg transition-all ${record.attendance === AttendanceStatus.PRESENT ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-400 hover:bg-white dark:hover:bg-gray-600'}`}
                            >
                                <Icons.Present size={18} />
                            </button>
                            <button 
                                onClick={() => updateRecord(student.id, { attendance: AttendanceStatus.LATE })}
                                className={`p-2.5 rounded-lg transition-all ${record.attendance === AttendanceStatus.LATE ? 'bg-amber-400 text-white shadow-md' : 'text-gray-400 hover:bg-white dark:hover:bg-gray-600'}`}
                            >
                                <Icons.Late size={18} />
                            </button>
                            <button 
                                onClick={() => updateRecord(student.id, { attendance: AttendanceStatus.ABSENT })}
                                className={`p-2.5 rounded-lg transition-all ${record.attendance === AttendanceStatus.ABSENT ? 'bg-red-500 text-white shadow-md' : 'text-gray-400 hover:bg-white dark:hover:bg-gray-600'}`}
                            >
                                <Icons.Absent size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Discipline & Positive */}
                    {record.attendance !== AttendanceStatus.ABSENT && (
                        <div className="border-t border-dashed border-gray-100 dark:border-gray-700 pt-4 space-y-4">
                            {/* Discipline Checkboxes */}
                            <div className="flex gap-2 flex-wrap">
                                <button 
                                    onClick={() => updateDiscipline(student.id, 'sleep')}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${record.discipline.sleep ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-bold' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}
                                >
                                    خواب (-۰.۵)
                                </button>
                                <button 
                                    onClick={() => updateDiscipline(student.id, 'badBehavior')}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${record.discipline.badBehavior ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-bold' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}
                                >
                                    بی‌انضباطی (-۰.۵)
                                </button>
                                <button 
                                    onClick={() => updateDiscipline(student.id, 'expelled')}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${record.discipline.expelled ? 'bg-red-100 dark:bg-red-900/50 border-red-500 dark:border-red-800 text-red-700 dark:text-red-300 font-bold' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}
                                >
                                    اخراج (-۱)
                                </button>
                            </div>

                            {/* Positive Points Slider */}
                            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-xl flex items-center gap-3">
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">نمره مثبت:</span>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="5" 
                                    step="0.5"
                                    value={record.positivePoints}
                                    onChange={(e) => updateRecord(student.id, { positivePoints: parseFloat(e.target.value) })}
                                    className="flex-1 h-1.5 bg-emerald-200 dark:bg-emerald-800 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:accent-emerald-500"
                                />
                                <span className="text-sm w-6 text-center font-black text-emerald-600 dark:text-emerald-400">{record.positivePoints}</span>
                            </div>

                            {/* Note */}
                            <input 
                                type="text" 
                                placeholder="یادداشت (مثال: پرسش کلاسی عالی بود...)"
                                value={record.note}
                                onChange={(e) => updateRecord(student.id, { note: e.target.value })}
                                className="w-full text-xs border-b border-gray-200 dark:border-gray-600 py-2 focus:border-emerald-500 outline-none bg-transparent placeholder-gray-300 dark:placeholder-gray-600 text-gray-900 dark:text-white"
                            />
                        </div>
                    )}
                </div>
            );
        })}
      </div>

      {/* Lesson Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl border dark:border-gray-700 my-auto">
                <div className="flex justify-between items-center mb-6">
                     <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        {/* Fix: Replaced Icons.FileText with Icons.File */}
                        <Icons.File className="text-purple-600 dark:text-purple-400" />
                        طرح درس روزانه
                     </h3>
                     <button onClick={() => setShowPlanModal(false)} className="text-gray-400 hover:text-red-500">
                         <Icons.Delete className="w-5 h-5 rotate-45" />
                     </button>
                </div>
                
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">موضوع درس</label>
                        <input 
                           type="text" 
                           value={lessonPlan.topic}
                           onChange={e => setLessonPlan({...lessonPlan, topic: e.target.value})}
                           className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">اهداف رفتاری</label>
                        <textarea 
                           rows={3}
                           value={lessonPlan.objectives}
                           onChange={e => setLessonPlan({...lessonPlan, objectives: e.target.value})}
                           className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white text-sm"
                           placeholder="دانش‌آموز پس از پایان درس باید بتواند..."
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">روش تدریس</label>
                            <input 
                                type="text"
                                value={lessonPlan.method}
                                onChange={e => setLessonPlan({...lessonPlan, method: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">وسایل مورد نیاز</label>
                            <input 
                                type="text"
                                value={lessonPlan.materials}
                                onChange={e => setLessonPlan({...lessonPlan, materials: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white text-sm"
                            />
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">فعالیت‌های یادگیری</label>
                        <textarea 
                           rows={3}
                           value={lessonPlan.activities}
                           onChange={e => setLessonPlan({...lessonPlan, activities: e.target.value})}
                           className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white text-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">ارزشیابی</label>
                        <textarea 
                           rows={2}
                           value={lessonPlan.evaluation}
                           onChange={e => setLessonPlan({...lessonPlan, evaluation: e.target.value})}
                           className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white text-sm"
                        />
                     </div>
                </div>

                <div className="mt-6">
                    <button onClick={() => setShowPlanModal(false)} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-200 dark:shadow-none transition-colors">
                        تایید و بستن
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};