import React, { useState } from 'react';
import { Classroom, Student, Session, ClassType, AttendanceStatus } from '../types';
import { updateClass, deleteClass, exportToCSV } from '../services/storageService';
import { generateLessonPlan } from '../services/geminiService';
import { Icons } from '../components/Icons';
import { SessionScreen } from './SessionScreen';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface ClassScreenProps {
  classroom: Classroom;
  onBack: () => void;
}

type Tab = 'STUDENTS' | 'SESSIONS' | 'GRADES' | 'CHARTS';

export const ClassScreen: React.FC<ClassScreenProps> = ({ classroom, onBack }) => {
  const [currentTab, setCurrentTab] = useState<Tab>('STUDENTS');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [data, setData] = useState<Classroom>(classroom);
  
  // Modals State
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [lessonTopic, setLessonTopic] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  
  // Chart Detail State
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string | null>(null);

  const handleUpdate = async (updated: Classroom) => {
    await updateClass(updated);
    setData(updated);
  };

  const handleDeleteClass = async () => {
    if (window.confirm('آیا از حذف این کلاس اطمینان دارید؟')) {
      await deleteClass(data.id);
      onBack();
    }
  };

  const addStudent = () => {
    if (!newStudentName.trim()) return;
    const student: Student = {
      id: Date.now().toString(),
      name: newStudentName,
      avatarUrl: undefined
    };
    const updated = { ...data, students: [...data.students, student] };
    handleUpdate(updated);
    setNewStudentName('');
    setShowAddStudent(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, studentId?: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (studentId) {
          const updatedStudents = data.students.map(s => 
            s.id === studentId ? { ...s, avatarUrl: result } : s
          );
          handleUpdate({ ...data, students: updatedStudents });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const createSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      classId: data.id,
      date: new Date().toISOString(),
      dayOfWeek: new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(new Date()),
      records: []
    };
    setActiveSession(newSession);
  };

  const handleSessionComplete = (completedSession: Session) => {
    const exists = data.sessions.find(s => s.id === completedSession.id);
    let updatedSessions;
    if (exists) {
        updatedSessions = data.sessions.map(s => s.id === completedSession.id ? completedSession : s);
    } else {
        updatedSessions = [completedSession, ...data.sessions];
    }
    const updated = { ...data, sessions: updatedSessions };
    handleUpdate(updated);
    setActiveSession(null);
  };

  const generateAIPlan = async () => {
    if (!lessonTopic) return;
    setGeneratingAI(true);
    const plan = await generateLessonPlan(
        lessonTopic, 
        data.type === ClassType.MODULAR ? 'پودمانی' : 'ترمی',
        data.bookName,
        data.resources.mainFile
    );
    const updatedResources = { 
        ...data.resources, 
        lessonPlans: [plan, ...data.resources.lessonPlans] 
    };
    handleUpdate({ ...data, resources: updatedResources });
    setGeneratingAI(false);
    setLessonTopic('');
  };

  if (activeSession) {
    return (
      <SessionScreen 
        session={activeSession} 
        students={data.students} 
        onSave={handleSessionComplete}
        onCancel={() => setActiveSession(null)}
      />
    );
  }

  // --- Tabs ---

  const renderStudents = () => (
    <div className="space-y-4 pb-24">
      <div className="flex gap-3 mb-6">
        <button onClick={() => setShowAddStudent(true)} className="flex-1 bg-emerald-600 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all font-bold text-sm">
          <Icons.AddUser size={18} />
          افزودن دانش‌آموز
        </button>
        <button onClick={() => exportToCSV(data)} className="bg-white text-emerald-700 border border-emerald-200 py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-emerald-50 transition-all font-bold text-sm">
          <Icons.Download size={18} />
          اکسل
        </button>
      </div>

      {data.students.length === 0 && (
        <div className="text-center py-12 opacity-50">
            <Icons.Users className="w-16 h-16 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">لیست کلاس خالی است</p>
        </div>
      )}

      <div className="grid gap-3">
        {data.students.map(student => (
            <div key={student.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
            <div className="relative group">
                {student.avatarUrl ? (
                <img src={student.avatarUrl} alt={student.name} className="w-14 h-14 rounded-full object-cover border-2 border-emerald-100 shadow-sm" />
                ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400 border-2 border-white shadow-sm">
                    <Icons.Camera size={22} />
                </div>
                )}
                <input 
                type="file" 
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => handleImageUpload(e, student.id)}
                />
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-base">{student.name}</h3>
            </div>
            <button 
                onClick={() => {
                if(window.confirm('حذف دانش‌آموز؟')) {
                    handleUpdate({...data, students: data.students.filter(s => s.id !== student.id)});
                }
                }}
                className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
                <Icons.Delete size={18} />
            </button>
            </div>
        ))}
      </div>
    </div>
  );

  const renderSessions = () => (
    <div className="space-y-6 pb-24">
      <button onClick={createSession} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 hover:scale-[1.02] transition-transform">
        <Icons.Plus size={22} />
        <span className="font-bold">شروع کلاس جدید</span>
      </button>
      
      {/* AI Section */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100">
        <div className="flex items-center gap-2 mb-4 text-emerald-800">
            <div className="p-2 bg-emerald-100 rounded-lg">
                <Icons.Sparkles size={18} className="text-emerald-600" />
            </div>
            <h3 className="font-bold">دستیار هوشمند</h3>
        </div>
        
        {data.resources.mainFile && (
            <div className="mb-4 bg-emerald-50 p-2 rounded-lg flex items-center gap-2 text-xs text-emerald-700">
                <Icons.BookOpen size={14} />
                <span className="truncate">منبع فعال: {data.resources.mainFile.name}</span>
            </div>
        )}

        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="موضوع درس امروز..." 
            value={lessonTopic}
            onChange={e => setLessonTopic(e.target.value)}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-gray-900"
          />
          <button 
            onClick={generateAIPlan}
            disabled={generatingAI}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl disabled:bg-gray-300 font-medium text-sm transition-colors"
          >
            {generatingAI ? '...' : 'تولید'}
          </button>
        </div>

        {data.resources.lessonPlans.length > 0 && (
             <div className="mt-6 space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">آخرین طرح درس‌ها</p>
                {data.resources.lessonPlans.map((plan, idx) => (
                    <details key={idx} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden group">
                        <summary className="cursor-pointer font-medium text-emerald-700 p-3 text-sm bg-white hover:bg-emerald-50 transition-colors flex items-center justify-between select-none">
                            <span>طرح درس {data.resources.lessonPlans.length - idx}</span>
                            <Icons.Back className="w-4 h-4 -rotate-90 text-gray-400 group-open:rotate-90 transition-transform" />
                        </summary>
                        <div className="p-4 text-sm leading-loose text-gray-700 markdown-body border-t border-gray-100">
                            {plan.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
                        </div>
                    </details>
                ))}
             </div>
        )}
      </div>

      <div className="pt-2">
        <h3 className="font-bold text-gray-800 mb-4 px-2">تاریخچه جلسات</h3>
        {data.sessions.length === 0 && <p className="text-gray-400 text-center text-sm">هنوز جلسه‌ای ثبت نشده است.</p>}
        <div className="space-y-3">
            {data.sessions.map(session => (
                <div key={session.id} 
                    onClick={() => setActiveSession(session)}
                    className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-emerald-400 cursor-pointer hover:translate-x-1 transition-transform"
                >
                <div className="flex justify-between items-center">
                    <div>
                    <p className="font-bold text-gray-800">{new Date(session.date).toLocaleDateString('fa-IR')}</p>
                    <p className="text-xs text-gray-400 mt-1">{session.dayOfWeek}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold">
                            {session.records.filter(r => r.attendance === 'PRESENT').length} حاضر
                        </span>
                        {session.records.some(r => r.note) && <Icons.File className="w-3 h-3 text-gray-400" />}
                    </div>
                </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );

  const renderGrades = () => {
    const updateGrade = (studentId: string, field: any, value: number) => {
        const updatedPerf = [...(data.performance || [])];
        let studPerf = updatedPerf.find(p => p.studentId === studentId);
        
        if (!studPerf) {
            studPerf = { studentId, gradesModular: [], gradesTerm: [] };
            updatedPerf.push(studPerf);
        }

        if (data.type === ClassType.MODULAR) {
             const modId = field as 1|2|3|4|5;
             const existing = studPerf.gradesModular.find(g => g.moduleId === modId);
             if (existing) existing.score = value;
             else studPerf.gradesModular.push({ moduleId: modId, score: value });
        } else {
            const termId = field.term as 1|2;
            const type = field.type as 'continuous' | 'final';
            const existing = studPerf.gradesTerm.find(g => g.termId === termId);
            if (existing) {
                if (type === 'continuous') existing.continuous = value;
                else existing.final = value;
            } else {
                studPerf.gradesTerm.push({ 
                    termId, 
                    continuous: type === 'continuous' ? value : 0, 
                    final: type === 'final' ? value : 0 
                });
            }
        }
        handleUpdate({ ...data, performance: updatedPerf });
    };

    const getScore = (studentId: string, field: any) => {
        const perf = data.performance?.find(p => p.studentId === studentId);
        if (!perf) return '';
        
        if (data.type === ClassType.MODULAR) {
            return perf.gradesModular.find(g => g.moduleId === field)?.score || '';
        } else {
             const term = perf.gradesTerm.find(g => g.termId === field.term);
             if (!term) return '';
             return field.type === 'continuous' ? term.continuous : term.final;
        }
    };

    return (
      <div className="overflow-x-auto pb-24 rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm text-right">
            <thead className="bg-emerald-50 text-emerald-800 text-xs uppercase font-bold">
                <tr>
                    <th className="px-4 py-4 rounded-tr-xl">نام دانش‌آموز</th>
                    {data.type === ClassType.MODULAR ? (
                        [1, 2, 3, 4, 5].map(i => <th key={i} className="px-2 py-4 text-center whitespace-nowrap">پودمان {i}</th>)
                    ) : (
                        <>
                            <th className="px-2 py-4 text-center border-l border-emerald-100">مستمر ۱</th>
                            <th className="px-2 py-4 text-center border-l border-emerald-200">پایانی ۱</th>
                            <th className="px-2 py-4 text-center border-l border-emerald-100">مستمر ۲</th>
                            <th className="px-2 py-4 text-center rounded-tl-xl">پایانی ۲</th>
                        </>
                    )}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {data.students.map(student => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-700">{student.name}</td>
                        {data.type === ClassType.MODULAR ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <td key={i} className="px-1 py-2 text-center">
                                    <input 
                                        type="number" 
                                        className="w-12 text-center bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900"
                                        value={getScore(student.id, i)}
                                        onChange={(e) => updateGrade(student.id, i, parseFloat(e.target.value))}
                                    />
                                </td>
                            ))
                        ) : (
                            <>
                             <td className="px-1 py-2 text-center"><input type="number" className="w-12 text-center bg-orange-50/50 border border-orange-100 rounded-lg p-2 text-gray-900" value={getScore(student.id, {term:1, type:'continuous'})} onChange={e=>updateGrade(student.id, {term:1, type:'continuous'}, parseFloat(e.target.value))}/></td>
                             <td className="px-1 py-2 text-center"><input type="number" className="w-12 text-center bg-orange-100/50 border border-orange-200 rounded-lg p-2 text-gray-900" value={getScore(student.id, {term:1, type:'final'})} onChange={e=>updateGrade(student.id, {term:1, type:'final'}, parseFloat(e.target.value))}/></td>
                             <td className="px-1 py-2 text-center"><input type="number" className="w-12 text-center bg-blue-50/50 border border-blue-100 rounded-lg p-2 text-gray-900" value={getScore(student.id, {term:2, type:'continuous'})} onChange={e=>updateGrade(student.id, {term:2, type:'continuous'}, parseFloat(e.target.value))}/></td>
                             <td className="px-1 py-2 text-center"><input type="number" className="w-12 text-center bg-blue-100/50 border border-blue-200 rounded-lg p-2 text-gray-900" value={getScore(student.id, {term:2, type:'final'})} onChange={e=>updateGrade(student.id, {term:2, type:'final'}, parseFloat(e.target.value))}/></td>
                            </>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    );
  };

  const renderCharts = () => {
      // Overall Stats
      let present = 0, absent = 0, late = 0;
      data.sessions.forEach(sess => {
          sess.records.forEach(rec => {
              if (rec.attendance === 'PRESENT') present++;
              if (rec.attendance === 'ABSENT') absent++;
              if (rec.attendance === 'LATE') late++;
          });
      });
      
      const overallData = [
          { name: 'حاضر', value: present, color: '#10b981' }, // emerald-500
          { name: 'غایب', value: absent, color: '#ef4444' }, // red-500
          { name: 'تاخیر', value: late, color: '#f59e0b' }, // amber-500
      ].filter(d => d.value > 0);

      const renderStudentReport = () => {
        if (!selectedStudentForReport) return null;
        const student = data.students.find(s => s.id === selectedStudentForReport);
        if (!student) return null;

        let sPresent = 0, sAbsent = 0, sLate = 0;
        let sPositive = 0;
        let sDisciplineEvents: string[] = [];

        data.sessions.forEach(sess => {
            const rec = sess.records.find(r => r.studentId === student.id);
            if (rec) {
                if (rec.attendance === AttendanceStatus.PRESENT) sPresent++;
                if (rec.attendance === AttendanceStatus.ABSENT) sAbsent++;
                if (rec.attendance === AttendanceStatus.LATE) sLate++;
                sPositive += rec.positivePoints;
                
                if (rec.discipline.sleep) sDisciplineEvents.push(`${new Date(sess.date).toLocaleDateString('fa-IR')}: خوابیدن در کلاس`);
                if (rec.discipline.badBehavior) sDisciplineEvents.push(`${new Date(sess.date).toLocaleDateString('fa-IR')}: بی‌انضباطی`);
                if (rec.discipline.expelled) sDisciplineEvents.push(`${new Date(sess.date).toLocaleDateString('fa-IR')}: اخراج از کلاس`);
            }
        });

        const sData = [
            { name: 'حاضر', value: sPresent, color: '#10b981' },
            { name: 'غایب', value: sAbsent, color: '#ef4444' },
            { name: 'تاخیر', value: sLate, color: '#f59e0b' },
        ].filter(d => d.value > 0);

        return (
            <div className="fixed inset-0 bg-emerald-900/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            {student.avatarUrl ? (
                                <img src={student.avatarUrl} className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><Icons.Users size={20}/></div>
                            )}
                            <h3 className="font-bold text-lg text-gray-800">{student.name}</h3>
                        </div>
                        <button onClick={() => setSelectedStudentForReport(null)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200">
                            <Icons.Delete className="w-5 h-5 rotate-45" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-green-50 p-3 rounded-xl text-center">
                                <p className="text-green-600 font-bold text-xl">{sPresent}</p>
                                <p className="text-xs text-green-800">حضور</p>
                            </div>
                            <div className="bg-red-50 p-3 rounded-xl text-center">
                                <p className="text-red-600 font-bold text-xl">{sAbsent}</p>
                                <p className="text-xs text-red-800">غیبت</p>
                            </div>
                             <div className="bg-blue-50 p-3 rounded-xl text-center">
                                <p className="text-blue-600 font-bold text-xl">{sPositive}</p>
                                <p className="text-xs text-blue-800">امتیاز مثبت</p>
                            </div>
                        </div>

                        {/* Pie Chart */}
                        <div className="h-48 w-full">
                            {sData.length > 0 ? (
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={sData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5}>
                                        {sData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                </PieChart>
                            </ResponsiveContainer>
                            ) : <p className="text-center text-gray-400 mt-10">بدون داده</p>}
                        </div>

                        {/* Discipline Log */}
                        <div>
                            <h4 className="font-bold text-gray-700 mb-3 text-sm border-b pb-2">موارد انضباطی</h4>
                            {sDisciplineEvents.length > 0 ? (
                                <ul className="space-y-2">
                                    {sDisciplineEvents.map((e, i) => (
                                        <li key={i} className="text-xs bg-red-50 text-red-700 p-2 rounded border-r-2 border-red-400">
                                            {e}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-green-600 bg-green-50 p-2 rounded">مورد انضباطی ثبت نشده است. عالی!</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
      }

      return (
        <div className="pb-24 space-y-6">
            {selectedStudentForReport && renderStudentReport()}

            {/* Overall Chart */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
                <h3 className="font-bold text-emerald-800 mb-6 text-center flex items-center justify-center gap-2">
                    <Icons.Chart className="w-5 h-5" />
                    وضعیت کلی کلاس
                </h3>
                <div className="h-64 w-full relative">
                    {overallData.length > 0 ? (
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={overallData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5}>
                                    {overallData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-300">بدون داده</div>
                    )}
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <span className="block text-3xl font-black text-gray-700">{data.sessions.length}</span>
                            <span className="text-xs text-gray-400">جلسه</span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-center gap-6 text-xs mt-4">
                    {overallData.map(d => (
                        <div key={d.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></div>
                            <span className="text-gray-600 font-medium">{d.name} ({d.value})</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Student List for Reports */}
            <div>
                <h3 className="font-bold text-gray-700 mb-4 px-2 text-sm">گزارش عملکرد فردی</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.students.map(student => (
                        <div 
                            key={student.id} 
                            onClick={() => setSelectedStudentForReport(student.id)}
                            className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all active:scale-95"
                        >
                            {student.avatarUrl ? (
                                <img src={student.avatarUrl} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400"><Icons.Users size={16}/></div>
                            )}
                            <span className="text-sm font-bold text-gray-700">{student.name}</span>
                            <Icons.Back className="w-4 h-4 text-emerald-300 mr-auto rotate-180" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="min-h-screen bg-emerald-50/50 font-vazir">
      <header className="bg-white/90 backdrop-blur-md p-4 shadow-sm sticky top-0 z-10 border-b border-emerald-100">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors">
            <Icons.Back className="w-6 h-6" />
            </button>
            <div className="flex-1 overflow-hidden">
                <h1 className="font-black text-lg text-emerald-900 truncate">{data.name}</h1>
                <p className="text-xs text-emerald-600 truncate flex items-center gap-1">
                    {data.type === ClassType.MODULAR ? 'پودمانی' : 'ترمی'}
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-500">{data.bookName}</span>
                </p>
            </div>
            <button onClick={handleDeleteClass} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors">
                <Icons.Delete className="w-5 h-5" />
            </button>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto">
        {currentTab === 'STUDENTS' && renderStudents()}
        {currentTab === 'SESSIONS' && renderSessions()}
        {currentTab === 'GRADES' && renderGrades()}
        {currentTab === 'CHARTS' && renderCharts()}
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-3 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20 max-w-3xl mx-auto">
        <NavButton tab="STUDENTS" current={currentTab} set={setCurrentTab} icon={Icons.Users} label="دانش‌آموزان" />
        <NavButton tab="SESSIONS" current={currentTab} set={setCurrentTab} icon={Icons.Calendar} label="جلسات" />
        <NavButton tab="GRADES" current={currentTab} set={setCurrentTab} icon={Icons.BookOpen} label="نمرات" />
        <NavButton tab="CHARTS" current={currentTab} set={setCurrentTab} icon={Icons.Chart} label="گزارش‌ها" />
      </div>

      {/* Add Student Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-emerald-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-gray-900 mb-4">دانش‌آموز جدید</h3>
            <input 
              type="text" 
              value={newStudentName}
              onChange={e => setNewStudentName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mb-6 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900"
              placeholder="نام و نام خانوادگی"
            />
            <div className="flex gap-3">
                <button onClick={() => setShowAddStudent(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl">لغو</button>
                <button onClick={addStudent} className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold shadow-lg shadow-emerald-200">ثبت</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavButton = ({ tab, current, set, icon: Icon, label }: any) => (
    <button 
        onClick={() => set(tab)} 
        className={`flex flex-col items-center transition-all duration-300 ${
            current === tab ? 'text-emerald-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'
        }`}
    >
        <div className={`p-1 rounded-xl mb-1 ${current === tab ? 'bg-emerald-50' : ''}`}>
            <Icon size={24} strokeWidth={current === tab ? 2.5 : 2} />
        </div>
        <span className="text-[10px] font-bold">{label}</span>
    </button>
);