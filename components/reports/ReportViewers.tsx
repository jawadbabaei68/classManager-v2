import React from 'react';
import { Classroom, Student, AttendanceStatus, ClassType } from '../../types';
import { formatJalaali } from '../../services/dateService';
import { Icons } from '../Icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, CartesianGrid, LabelList, YAxis } from 'recharts';

interface StudentReportModalProps {
  student: Student | null;
  classroom: Classroom | null;
  onClose: () => void;
  shareReportAsImage: (id: string, title: string) => void;
  onSelectClass?: (cls: Classroom) => void; // Optional for "Enter Class"
}

interface FullClassReportModalProps {
  classroom: Classroom | null;
  onClose: () => void;
  shareReportAsImage: (id: string, title: string) => void;
}

export const StudentReportModal: React.FC<StudentReportModalProps> = ({ student, classroom, onClose, shareReportAsImage, onSelectClass }) => {
    if (!student || !classroom) return null;
    
    const perf = classroom.performance?.find(p => p.studentId === student.id);
    let present = 0, absent = 0, late = 0, posScore = 0;
    const negCounts = { sleep: 0, bad: 0, expelled: 0 };
    const sessionHistory: {date: string, day: string, status: string, statusColor: string, desc: string}[] = [];

    const sortedSessions = [...classroom.sessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedSessions.forEach(sess => {
        const r = sess.records.find(rec => rec.studentId === student.id);
        if (r) {
            let status = 'نامشخص', statusColor = 'text-gray-500';
            if (r.attendance === AttendanceStatus.PRESENT) { present++; status = 'حاضر'; statusColor = 'text-emerald-600'; }
            if (r.attendance === AttendanceStatus.ABSENT) { absent++; status = 'غایب'; statusColor = 'text-red-600'; }
            if (r.attendance === AttendanceStatus.LATE) { late++; status = 'تاخیر'; statusColor = 'text-amber-600'; }
            
            posScore += r.positivePoints;
            if (r.discipline.sleep) negCounts.sleep++;
            if (r.discipline.badBehavior) negCounts.bad++;
            if (r.discipline.expelled) negCounts.expelled++;

            const descParts = [];
            if (r.discipline.sleep) descParts.push('خواب');
            if (r.discipline.badBehavior) descParts.push('بی‌انضباطی');
            if (r.discipline.expelled) descParts.push('اخراج');
            if (r.positivePoints > 0) descParts.push(`+${r.positivePoints} امتیاز`);
            if (r.note) descParts.push(r.note);

            sessionHistory.push({
                date: formatJalaali(sess.date),
                day: sess.dayOfWeek,
                status,
                statusColor,
                desc: descParts.join(' - ')
            });
        }
    });

    const negTotal = negCounts.sleep + negCounts.bad + negCounts.expelled;

    let chartData = [];
    if (classroom.type === ClassType.MODULAR) {
        chartData = [1,2,3,4,5].map(i => ({
            name: `پودمان ${i}`,
            score: perf?.gradesModular.find(g => g.moduleId === i)?.score || 0
        }));
    } else {
        const t1 = perf?.gradesTerm.find(g => g.termId === 1);
        const t2 = perf?.gradesTerm.find(g => g.termId === 2);
        chartData = [
            { name: 'مستمر ۱', score: t1?.continuous || 0 },
            { name: 'پایانی ۱', score: t1?.final || 0 },
            { name: 'مستمر ۲', score: t2?.continuous || 0 },
            { name: 'پایانی ۲', score: t2?.final || 0 },
        ];
    }

    const uniqueId = onSelectClass ? 'home-individual-report' : 'individual-report-content';

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
             <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 rounded-t-3xl z-10">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">پرونده تحصیلی</h3>
                    <div className="flex gap-2">
                         <button onClick={() => shareReportAsImage(uniqueId, `Report_${student.name}`)} className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-xl" title="ذخیره تصویر">
                             <Icons.Camera size={20} />
                         </button>
                         <button onClick={onClose} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 p-2 rounded-xl">
                             <Icons.XCircle size={20} />
                         </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-4 md:p-6" id={uniqueId}>
                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl border border-gray-200 dark:border-gray-600 mb-4">
                        {student.avatarUrl ? (
                             <img src={student.avatarUrl} className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-500 shadow-sm" />
                        ) : (
                             <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-2xl">
                                 {student.name.charAt(0)}
                             </div>
                        )}
                        <div className="flex-1">
                             <div className="flex justify-between items-start">
                                 <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1">{student.name}</h2>
                                 { !onSelectClass && (
                                    <span className="text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                                        {new Date().toLocaleDateString('fa-IR')}
                                    </span>
                                 )}
                             </div>
                             <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{classroom.name} | {classroom.bookName}</p>
                             <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                                 امتیاز کل: <span className="text-lg">{posScore - (negTotal * 0.5)}</span>
                             </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl text-center border border-emerald-100 dark:border-emerald-900/30">
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1">حاضر</div>
                            <div className="font-black text-lg text-emerald-700 dark:text-emerald-300">{present}</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-xl text-center border border-red-100 dark:border-red-900/30">
                            <div className="text-[10px] text-red-600 dark:text-red-400 mb-1">غایب</div>
                            <div className="font-black text-lg text-red-700 dark:text-red-300">{absent}</div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-xl text-center border border-amber-100 dark:border-amber-900/30">
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 mb-1">تاخیر</div>
                            <div className="font-black text-lg text-amber-700 dark:text-amber-300">{late}</div>
                        </div>
                         <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-xl text-center border border-purple-100 dark:border-purple-900/30">
                            <div className="text-[10px] text-purple-600 dark:text-purple-400 mb-1">منفی</div>
                            <div className="font-black text-lg text-purple-700 dark:text-purple-300">{negTotal}</div>
                        </div>
                    </div>

                    <div className="mb-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-3 pb-0">
                         <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 px-1">روند نمرات</h4>
                         <div className="h-40 w-full" style={{ direction: 'ltr' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                                    <YAxis hide domain={[0, 20]} />
                                    <Bar dataKey="score" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24}>
                                        <LabelList dataKey="score" position="top" style={{ fontSize: 10, fill: '#374151', fontWeight: 'bold' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                         </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 px-1">تاریخچه جلسات</h4>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                            <table className="w-full text-xs text-right">
                                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                    <tr>
                                        <th className="p-2 font-bold">تاریخ</th>
                                        <th className="p-2 font-bold">وضعیت</th>
                                        <th className="p-2 font-bold">توضیحات</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                    {sessionHistory.length === 0 ? (
                                        <tr><td colSpan={3} className="p-4 text-center text-gray-400">بدون سابقه</td></tr>
                                    ) : (
                                        sessionHistory.map((h, i) => (
                                            <tr key={i}>
                                                <td className="p-2 text-gray-700 dark:text-gray-300 w-24">
                                                    <div className="font-bold">{h.date}</div>
                                                    <div className="text-[10px] text-gray-400">{h.day}</div>
                                                </td>
                                                <td className={`p-2 font-bold w-16 ${h.statusColor}`}>{h.status}</td>
                                                <td className="p-2 text-gray-600 dark:text-gray-400">{h.desc || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {onSelectClass && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-3xl">
                         <button onClick={() => {
                            onClose();
                            onSelectClass(classroom);
                         }} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-700 transition-colors">
                            ورود به کلاس
                         </button>
                    </div>
                )}
             </div>
        </div>
    );
};

export const FullClassReportModal: React.FC<FullClassReportModalProps> = ({ classroom, onClose, shareReportAsImage }) => {
    if (!classroom) return null;
    const data = classroom;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center">
            {/* Added max-h-[90vh] and overflow-hidden to main container, and flex-1 overflow-y-auto to content */}
            <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-3xl p-6 m-4 shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Icons.Chart className="text-emerald-600" />
                        گزارش جامع کلاس {data.name}
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => shareReportAsImage('class-report-content', `ClassReport_${data.name}`)} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors">
                            <Icons.Camera size={18} /> <span className="hidden sm:inline">ذخیره تصویر</span>
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-red-500 p-2">
                            <Icons.XCircle size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                    <div id="class-report-content" className="space-y-6 bg-white dark:bg-gray-800 p-2">
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{data.name}</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{data.bookName} | {data.academicYear}</p>
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-gray-500 dark:text-gray-400">تعداد دانش‌آموز: {data.students.length}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">تعداد جلسات: {data.sessions.length}</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-purple-600 text-white text-xs">
                                        <th className="p-3 rounded-tr-xl">#</th>
                                        <th className="p-3 text-right">نام دانش‌آموز</th>
                                        <th className="p-3">غایب</th>
                                        <th className="p-3">تاخیر</th>
                                        <th className="p-3">نمره مثبت</th>
                                        <th className="p-3">نمره منفی</th>
                                        {data.type === ClassType.MODULAR && [1,2,3,4,5].map(i => (
                                            <th key={i} className="p-3 bg-emerald-700">پ {i}</th>
                                        ))}
                                        <th className="p-3 rounded-tl-xl">وضعیت</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-gray-900 dark:text-gray-100">
                                    {data.students.map((s, idx) => {
                                        let absent = 0;
                                        let late = 0;
                                        let posScore = 0;
                                        let negScore = 0;

                                        data.sessions.forEach(sess => {
                                            const r = sess.records.find(rec => rec.studentId === s.id);
                                            if (r) {
                                                if (r.attendance === AttendanceStatus.ABSENT) absent++;
                                                if (r.attendance === AttendanceStatus.LATE) late++;
                                                posScore += r.positivePoints;
                                                if (r.discipline.sleep) negScore++;
                                                if (r.discipline.badBehavior) negScore++;
                                                if (r.discipline.expelled) negScore++;
                                            }
                                        });

                                        const perf = data.performance?.find(p => p.studentId === s.id);

                                        return (
                                            <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="p-3 text-center">{idx + 1}</td>
                                                <td className="p-3 font-bold">{s.name}</td>
                                                <td className="p-3 text-center text-red-500">{absent || '-'}</td>
                                                <td className="p-3 text-center text-amber-500">{late || '-'}</td>
                                                <td className="p-3 text-center text-emerald-600">{posScore || '-'}</td>
                                                <td className="p-3 text-center text-red-600">{negScore || '-'}</td>
                                                {data.type === ClassType.MODULAR && [1,2,3,4,5].map(i => (
                                                    <td key={i} className="p-3 text-center text-gray-600 dark:text-gray-300 border-l border-gray-100 dark:border-gray-700">
                                                        {perf?.gradesModular.find(g => g.moduleId === i)?.score || '-'}
                                                    </td>
                                                ))}
                                                <td className="p-3 text-center">
                                                    {absent > 3 ? <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">هشدار حذف</span> : <span className="text-emerald-500 text-xs">نرمال</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
