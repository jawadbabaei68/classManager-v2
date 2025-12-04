
import React, { useState } from 'react';
import { Classroom, Student, Session, ClassType, AttendanceStatus } from '../../types';
import { Icons } from '../Icons';
import { formatJalaali } from '../../services/dateService';

interface StudentListTabProps {
  students: Student[];
  setSelectedStudentForReport: (s: Student) => void;
  setShowIndividualReport: (show: boolean) => void;
  triggerProfileImagePicker: (e: React.MouseEvent, id: string) => void;
  handleEditStudent: (s: Student, e: React.MouseEvent) => void;
  handleDeleteStudent: (e: React.MouseEvent, id: string) => void;
}

export const StudentListTab: React.FC<StudentListTabProps> = ({ students, setSelectedStudentForReport, setShowIndividualReport, triggerProfileImagePicker, handleEditStudent, handleDeleteStudent }) => {
  return (
    <div className="space-y-3">
        {students.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
                <Icons.Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>هنوز دانش‌آموزی اضافه نشده است.</p>
            </div>
        ) : (
            students.map((student) => (
                <div key={student.id} onClick={() => { setSelectedStudentForReport(student); setShowIndividualReport(true); }} className="bg-white dark:bg-gray-800 p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-gray-100 dark:border-gray-700 active:scale-[0.99] transition-transform cursor-pointer">
                        <div className="relative">
                            {student.avatarUrl ? (
                                <img src={student.avatarUrl} className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-gray-600" />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                                    {student.name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-1.5 shadow-md border border-gray-100 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors z-10" onClick={(e) => triggerProfileImagePicker(e, student.id)}>
                                <Icons.Camera size={14} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900 dark:text-white">{student.name}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{student.phoneNumber || 'بدون شماره'}</p>
                        </div>
                        <div className="flex gap-2">
                        <button onClick={(e) => handleEditStudent(student, e)} className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <Icons.Pencil size={18} />
                        </button>
                        <button onClick={(e) => handleDeleteStudent(e, student.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <Icons.Delete size={18} />
                        </button>
                        </div>
                </div>
            ))
        )}
    </div>
  );
};

interface SessionListTabProps {
    sessions: Session[];
    setActiveSession: (s: Session) => void;
    deleteSession: (e: React.MouseEvent, id: string) => void;
}

export const SessionListTab: React.FC<SessionListTabProps> = ({ sessions, setActiveSession, deleteSession }) => {
    const [activeModuleFilter, setActiveModuleFilter] = useState<number | 'all'>('all');

    const filteredSessions = activeModuleFilter === 'all' 
        ? sessions 
        : sessions.filter(s => (s.moduleId || 1) === activeModuleFilter);

    return (
        <div className="space-y-4">
            {/* Module Filter for Sessions */}
             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button 
                    onClick={() => setActiveModuleFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${activeModuleFilter === 'all' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}
                >
                    همه جلسات
                </button>
                {[1, 2, 3, 4, 5].map(m => (
                    <button 
                        key={m}
                        onClick={() => setActiveModuleFilter(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${activeModuleFilter === m ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}
                    >
                        پودمان {m}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {filteredSessions.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">
                        <Icons.Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>هیچ جلسه‌ای یافت نشد.</p>
                    </div>
                ) : (
                    [...filteredSessions].reverse().map((session) => (
                        <div key={session.id} onClick={() => setActiveSession(session)} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center active:scale-[0.99] transition-transform cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-100 dark:bg-purple-900/30 w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-purple-700 dark:text-purple-300 font-bold leading-none">
                                        <span className="text-[10px] opacity-70">{session.dayOfWeek}</span>
                                        <span className="text-sm mt-0.5">{formatJalaali(session.date).split('/')[2]}</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-gray-900 dark:text-white">{formatJalaali(session.date)}</h3>
                                            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">پودمان {session.moduleId || 1}</span>
                                        </div>
                                        <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            <span>{session.records.filter(r => r.attendance === AttendanceStatus.PRESENT).length} حاضر</span>
                                            <span>•</span>
                                            <span className="text-red-500">{session.records.filter(r => r.attendance === AttendanceStatus.ABSENT).length} غایب</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                {session.lessonPlan && <Icons.File className="text-purple-400" size={16} />}
                                <button onClick={(e) => deleteSession(e, session.id)} className="p-2 text-gray-300 hover:text-red-500">
                                    <Icons.Delete size={18} />
                                </button>
                                <Icons.Back size={16} className="text-gray-300 rotate-180" />
                                </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

interface GradesTabProps {
    data: Classroom;
    updateModularGrade: (studentId: string, moduleId: 1|2|3|4|5, field: 'examScore' | 'classroomPositive' | 'classroomNegative', value: number) => void;
    updateTermGrade: (studentId: string, termId: 1|2, field: 'continuous'|'final', score: number) => void;
}

export const GradesTab: React.FC<GradesTabProps> = ({ data, updateModularGrade, updateTermGrade }) => {
    const [activeModule, setActiveModule] = useState<1|2|3|4|5>(1);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {data.type === ClassType.MODULAR && (
                <div className="p-4 pb-0 flex gap-2 overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-gray-700">
                    {[1, 2, 3, 4, 5].map((mod) => (
                        <button
                            key={mod}
                            onClick={() => setActiveModule(mod as any)}
                            className={`px-4 py-2 rounded-t-xl font-bold text-sm transition-colors whitespace-nowrap ${
                                activeModule === mod 
                                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500' 
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            پودمان {mod}
                        </button>
                    ))}
                </div>
            )}
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-b dark:border-gray-600">
                        <tr>
                            <th className="p-2 text-right whitespace-nowrap sticky right-0 bg-gray-50 dark:bg-gray-700 z-10 border-l dark:border-gray-600 text-xs">دانش‌آموز</th>
                            {data.type === ClassType.MODULAR ? (
                                <>
                                    <th className="p-1 text-center whitespace-nowrap text-xs">آزمون</th>
                                    <th className="p-1 text-center whitespace-nowrap text-xs text-emerald-600">+</th>
                                    <th className="p-1 text-center whitespace-nowrap text-xs text-red-600">-</th>
                                    <th className="p-1 text-center whitespace-nowrap text-xs">نهایی</th>
                                </>
                            ) : (
                                <>
                                    <th className="p-2 text-center whitespace-nowrap">مستمر ۱</th>
                                    <th className="p-2 text-center whitespace-nowrap">پایانی ۱</th>
                                    <th className="p-2 text-center whitespace-nowrap">مستمر ۲</th>
                                    <th className="p-2 text-center whitespace-nowrap">پایانی ۲</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data.students.map(student => {
                            const perf = data.performance?.find(p => p.studentId === student.id);
                            
                            return (
                                <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="p-2 font-bold text-gray-900 dark:text-white sticky right-0 bg-white dark:bg-gray-800 border-l dark:border-gray-700 z-10 text-xs truncate max-w-[100px]">{student.name}</td>
                                    {data.type === ClassType.MODULAR ? (
                                        (() => {
                                            const grade = perf?.gradesModular.find(g => g.moduleId === activeModule);
                                            const examScore = grade?.examScore;
                                            
                                            // Calculate live scores - ONLY from current module's sessions
                                            let calcPos = 0;
                                            let calcNeg = 0;
                                            data.sessions.forEach(sess => {
                                                // Default to module 1 if undefined to handle legacy data
                                                const sModule = sess.moduleId || 1; 

                                                if (sModule === activeModule) {
                                                    const rec = sess.records.find(r => r.studentId === student.id);
                                                    if(rec) {
                                                        calcPos += rec.positivePoints || 0;
                                                        if(rec.discipline.sleep) calcNeg += 0.5;
                                                        if(rec.discipline.badBehavior) calcNeg += 0.5;
                                                        if(rec.discipline.expelled) calcNeg += 1;
                                                    }
                                                }
                                            });

                                            const finalScore = (examScore || 0) + calcPos - calcNeg;

                                            return (
                                                <>
                                                    <td className="p-1">
                                                        <input 
                                                            type="number" 
                                                            className="w-12 text-center p-1 rounded-lg bg-gray-50 dark:bg-gray-700 focus:bg-emerald-50 dark:focus:bg-emerald-900/20 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors text-xs mx-auto block"
                                                            placeholder="-"
                                                            value={examScore ?? ''}
                                                            onChange={e => updateModularGrade(student.id, activeModule, 'examScore', parseFloat(e.target.value))}
                                                        />
                                                    </td>
                                                    <td className="p-1 text-center">
                                                        <span className="text-xs font-bold text-emerald-600 block bg-emerald-50 dark:bg-emerald-900/20 rounded py-1 w-8 mx-auto">
                                                            {calcPos}
                                                        </span>
                                                    </td>
                                                    <td className="p-1 text-center">
                                                        <span className="text-xs font-bold text-red-600 block bg-red-50 dark:bg-red-900/20 rounded py-1 w-8 mx-auto">
                                                            {calcNeg}
                                                        </span>
                                                    </td>
                                                    <td className="p-1 text-center font-bold">
                                                        <span className={`text-xs ${finalScore < 12 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                                                            {finalScore}
                                                        </span>
                                                    </td>
                                                </>
                                            );
                                        })()
                                    ) : (
                                        <>
                                            {[1, 2].map(term => (
                                                <React.Fragment key={term}>
                                                    <td className="p-1">
                                                        <input type="number" className="w-12 mx-auto block text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700 focus:bg-emerald-50 focus:ring-1 outline-none text-xs" placeholder="-"
                                                            value={perf?.gradesTerm.find(g => g.termId === term)?.continuous || ''}
                                                            onChange={e => updateTermGrade(student.id, term as any, 'continuous', parseFloat(e.target.value))}
                                                        />
                                                    </td>
                                                    <td className="p-1">
                                                        <input type="number" className="w-12 mx-auto block text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700 focus:bg-emerald-50 focus:ring-1 outline-none border-l dark:border-gray-700 text-xs" placeholder="-"
                                                            value={perf?.gradesTerm.find(g => g.termId === term)?.final || ''}
                                                            onChange={e => updateTermGrade(student.id, term as any, 'final', parseFloat(e.target.value))}
                                                        />
                                                    </td>
                                                </React.Fragment>
                                            ))}
                                        </>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface ChartsTabProps {
    setShowClassReport: (show: boolean) => void;
    handleFullExport: () => void;
}

export const ChartsTab: React.FC<ChartsTabProps> = ({ setShowClassReport, handleFullExport }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div onClick={() => setShowClassReport(true)} className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none cursor-pointer hover:scale-[1.02] transition-transform">
                <Icons.Chart size={40} className="mb-4 opacity-80" />
                <h3 className="text-xl font-black mb-1">گزارش جامع کلاس</h3>
                <p className="text-emerald-100 text-sm opacity-90">مشاهده لیست نمرات، غایبین و موارد انضباطی کل کلاس</p>
            </div>

            <div onClick={handleFullExport} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors group">
                <Icons.Download size={40} className="mb-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">خروجی اکسل</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">دریافت فایل Excel شامل تمام اطلاعات کلاس</p>
            </div>
        </div>
    );
};
