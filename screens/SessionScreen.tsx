import React, { useState, useEffect } from 'react';
import { Session, Student, SessionRecord, AttendanceStatus } from '../types';
import { Icons } from '../components/Icons';

interface SessionScreenProps {
  session: Session;
  students: Student[];
  onSave: (s: Session) => void;
  onCancel: () => void;
}

export const SessionScreen: React.FC<SessionScreenProps> = ({ session, students, onSave, onCancel }) => {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [dateStr, setDateStr] = useState(session.date.split('T')[0]);
  const [dayStr, setDayStr] = useState(session.dayOfWeek);

  useEffect(() => {
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
  }, [session, students]);

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

  const handleSave = () => {
    onSave({
        ...session,
        date: new Date(dateStr).toISOString(),
        dayOfWeek: dayStr,
        records
    });
  };

  const calculateScore = (r: SessionRecord) => {
      let score = 0;
      if (r.discipline.sleep) score -= 0.5;
      if (r.discipline.badBehavior) score -= 0.5;
      if (r.discipline.expelled) score -= 1;
      score += r.positivePoints;
      return score;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-vazir">
      {/* Header */}
      <div className="bg-white p-4 sticky top-0 z-20 shadow-sm border-b border-gray-100">
        <div className="flex justify-between items-center mb-4 max-w-3xl mx-auto w-full">
            <button onClick={onCancel} className="text-gray-500 font-medium hover:text-gray-700 px-2">انصراف</button>
            <h2 className="font-black text-lg text-emerald-800">مدیریت جلسه</h2>
            <button onClick={handleSave} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-emerald-200 shadow-md active:scale-95 transition-transform">
                <Icons.Save size={16} /> ذخیره
            </button>
        </div>
        <div className="flex gap-3 max-w-3xl mx-auto w-full">
            <input 
                type="date" 
                value={dateStr} 
                onChange={(e) => setDateStr(e.target.value)}
                className="border border-gray-200 p-2.5 rounded-xl flex-1 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900"
            />
            <input 
                type="text" 
                value={dayStr}
                onChange={(e) => setDayStr(e.target.value)}
                className="border border-gray-200 p-2.5 rounded-xl w-1/3 text-sm text-center bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900"
            />
        </div>
      </div>

      {/* Student List */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto max-w-3xl mx-auto w-full pb-20">
        {students.map(student => {
            const record = records.find(r => r.studentId === student.id);
            if (!record) return null;
            const score = calculateScore(record);

            return (
                <div key={student.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 transition-shadow hover:shadow-md">
                    {/* Row 1: Info & Attendance */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                             {student.avatarUrl ? (
                                <img src={student.avatarUrl} className="w-12 h-12 rounded-full object-cover border border-gray-100 shadow-sm" />
                             ) : (
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400"><Icons.Users size={20}/></div>
                             )}
                             <div>
                                <h3 className="font-bold text-gray-800">{student.name}</h3>
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${score < 0 ? 'bg-red-50 text-red-500' : score > 0 ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400'}`}>
                                    {score > 0 ? '+' : ''}{score} امتیاز
                                </span>
                             </div>
                        </div>
                        
                        {/* Attendance Toggles */}
                        <div className="flex bg-gray-50 rounded-xl p-1 border border-gray-100">
                            <button 
                                onClick={() => updateRecord(student.id, { attendance: AttendanceStatus.PRESENT })}
                                className={`p-2.5 rounded-lg transition-all ${record.attendance === AttendanceStatus.PRESENT ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-400 hover:bg-white'}`}
                            >
                                <Icons.Present size={18} />
                            </button>
                            <button 
                                onClick={() => updateRecord(student.id, { attendance: AttendanceStatus.LATE })}
                                className={`p-2.5 rounded-lg transition-all ${record.attendance === AttendanceStatus.LATE ? 'bg-amber-400 text-white shadow-md' : 'text-gray-400 hover:bg-white'}`}
                            >
                                <Icons.Late size={18} />
                            </button>
                            <button 
                                onClick={() => updateRecord(student.id, { attendance: AttendanceStatus.ABSENT })}
                                className={`p-2.5 rounded-lg transition-all ${record.attendance === AttendanceStatus.ABSENT ? 'bg-red-500 text-white shadow-md' : 'text-gray-400 hover:bg-white'}`}
                            >
                                <Icons.Absent size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Discipline & Positive */}
                    {record.attendance !== AttendanceStatus.ABSENT && (
                        <div className="border-t border-dashed border-gray-100 pt-4 space-y-4">
                            {/* Discipline Checkboxes */}
                            <div className="flex gap-2 flex-wrap">
                                <button 
                                    onClick={() => updateDiscipline(student.id, 'sleep')}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${record.discipline.sleep ? 'bg-red-50 border-red-200 text-red-600 font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                    خواب (-۰.۵)
                                </button>
                                <button 
                                    onClick={() => updateDiscipline(student.id, 'badBehavior')}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${record.discipline.badBehavior ? 'bg-red-50 border-red-200 text-red-600 font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                    بی‌انضباطی (-۰.۵)
                                </button>
                                <button 
                                    onClick={() => updateDiscipline(student.id, 'expelled')}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${record.discipline.expelled ? 'bg-red-100 border-red-500 text-red-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                    اخراج (-۱)
                                </button>
                            </div>

                            {/* Positive Points Slider */}
                            <div className="bg-emerald-50/50 p-3 rounded-xl flex items-center gap-3">
                                <span className="text-xs font-bold text-emerald-700">نمره مثبت:</span>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="5" 
                                    step="0.5"
                                    value={record.positivePoints}
                                    onChange={(e) => updateRecord(student.id, { positivePoints: parseFloat(e.target.value) })}
                                    className="flex-1 h-1.5 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                                <span className="text-sm w-6 text-center font-black text-emerald-600">{record.positivePoints}</span>
                            </div>

                            {/* Note */}
                            <input 
                                type="text" 
                                placeholder="یادداشت (مثال: پرسش کلاسی عالی بود...)"
                                value={record.note}
                                onChange={(e) => updateRecord(student.id, { note: e.target.value })}
                                className="w-full text-xs border-b border-gray-200 py-2 focus:border-emerald-500 outline-none bg-transparent placeholder-gray-300 text-gray-900"
                            />
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};