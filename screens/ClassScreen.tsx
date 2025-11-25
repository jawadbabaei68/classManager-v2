
import React, { useState, useEffect, useRef } from 'react';
import { Classroom, Student, Session, ClassType, AttendanceStatus, GlobalSettings, StudentPerformance } from '../types';
import { updateClass, deleteClass, getSettings } from '../services/storageService';
import { formatJalaali, parseJalaaliToIso } from '../services/dateService';
import { Icons } from '../components/Icons';
import { SessionScreen } from './SessionScreen';
import { ResponsiveContainer, BarChart, Bar, XAxis, CartesianGrid, LabelList, Tooltip, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface ClassScreenProps {
  classroom: Classroom;
  onBack: () => void;
}

type Tab = 'STUDENTS' | 'SESSIONS' | 'GRADES' | 'CHARTS';

export const ClassScreen: React.FC<ClassScreenProps> = ({ classroom, onBack }) => {
  const [currentTab, setCurrentTab] = useState<Tab>('STUDENTS');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [data, setData] = useState<Classroom>(classroom);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  
  // Image Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStudentId, setUploadStudentId] = useState<string | null>(null);

  // Modals State
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [showClassReport, setShowClassReport] = useState(false);
  const [showEditClassInfo, setShowEditClassInfo] = useState(false);
  
  // Individual Report State
  const [showStudentSelectModal, setShowStudentSelectModal] = useState(false);
  const [showIndividualReport, setShowIndividualReport] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  
  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // New Session Modal State
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionDay, setNewSessionDay] = useState('');

  // Edit Class Form State
  const [editClassName, setEditClassName] = useState(data.name);
  const [editBookName, setEditBookName] = useState(data.bookName);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleUpdate = async (updated: Classroom) => {
    try {
      await updateClass(updated);
      setData(updated);
    } catch (e) {
      console.error(e);
      alert("خطا در ذخیره اطلاعات");
    }
  };

  const handleDeleteClass = async () => {
    const confirmMsg = `آیا از حذف کلاس «${data.name}» مطمئن هستید؟\nاین عملیات غیرقابل بازگشت است.`;
    if (window.confirm(confirmMsg)) {
      try {
        await deleteClass(data.id);
        onBack();
      } catch (error) {
        alert("خطا در حذف کلاس.");
      }
    }
  };

  const handleDeleteStudent = async (e: React.MouseEvent, studentId: string) => {
    e.stopPropagation();
    if (window.confirm('آیا از حذف این دانش‌آموز و تمام سوابق او اطمینان دارید؟')) {
        const updated = { ...data, students: data.students.filter(s => s.id !== studentId) };
        await handleUpdate(updated);
    }
  };

  const addStudent = () => {
    if (!newStudentName.trim()) return;
    const student: Student = {
      id: Date.now().toString(),
      name: newStudentName,
      phoneNumber: newStudentPhone.trim(),
      avatarUrl: undefined
    };
    const updated = { ...data, students: [...data.students, student] };
    handleUpdate(updated);
    setNewStudentName('');
    setNewStudentPhone('');
    setShowAddStudent(false);
  };

  const handleEditStudent = (student: Student, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingStudent(student);
      setNewStudentName(student.name);
      setNewStudentPhone(student.phoneNumber || '');
  };

  const saveEditedStudent = () => {
      if (!editingStudent || !newStudentName.trim()) return;
      const updatedStudents = data.students.map(s => 
        s.id === editingStudent.id 
          ? { ...s, name: newStudentName, phoneNumber: newStudentPhone.trim() } 
          : s
      );
      handleUpdate({ ...data, students: updatedStudents });
      setEditingStudent(null);
      setNewStudentName('');
      setNewStudentPhone('');
  };

  const handleEditClassInfo = async () => {
      const updated = { ...data, name: editClassName, bookName: editBookName };
      await handleUpdate(updated);
      setShowEditClassInfo(false);
  };

  // --- Excel Import Logic ---
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      const newStudents: Student[] = [];
      
      rawData.forEach((row) => {
         if (row && row.length > 0) {
             const name = row[0]; 
             if (typeof name === 'string' && name.trim().length > 0) {
                 newStudents.push({
                     id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                     name: name.trim(),
                     phoneNumber: row[1] ? String(row[1]) : undefined // Assuming column 2 is phone
                 });
             }
         }
      });

      if (newStudents.length > 0) {
          const updated = { ...data, students: [...data.students, ...newStudents] };
          handleUpdate(updated);
          alert(`${newStudents.length} دانش‌آموز با موفقیت اضافه شدند.`);
      } else {
          alert("هیچ نامی در فایل اکسل یافت نشد.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // --- Share as Image Logic (Optimized for No Whitespace) ---
  const shareReportAsImage = async (elementId: string, title: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Fixed width for consistent high-quality export without layout shifts
    const EXPORT_WIDTH = 800; 

    // Create a temporary container off-screen to hold the clone
    // This isolates the clone from the current view's constraints (like scrollbars or flex containers)
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0'; // align top
    container.style.left = '0'; // align left
    container.style.zIndex = '-9999';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    // Clone the element
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Reset styles on the clone to ensure it flows naturally
    clone.style.width = `${EXPORT_WIDTH}px`;
    clone.style.minWidth = `${EXPORT_WIDTH}px`;
    clone.style.maxWidth = `${EXPORT_WIDTH}px`;
    clone.style.height = 'auto'; // allow expansion
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.position = 'relative';
    clone.style.margin = '0';
    clone.style.padding = '20px';
    clone.style.borderRadius = '0';
    clone.style.boxShadow = 'none';
    clone.style.transform = 'none';
    
    // Ensure Dark/Light mode consistency
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
        clone.classList.add('dark');
        clone.style.backgroundColor = '#111827';
        clone.style.color = '#f3f4f6';
    } else {
        clone.classList.remove('dark');
        clone.style.backgroundColor = '#ffffff';
        clone.style.color = '#111827';
    }

    // Add Footer
    const footer = document.createElement('div');
    footer.innerText = 'جواد بابائی | mrhonaramoz.ir';
    footer.style.textAlign = 'center';
    footer.style.marginTop = '24px';
    footer.style.paddingTop = '12px';
    footer.style.borderTop = isDark ? '1px solid #374151' : '1px solid #e5e7eb';
    footer.style.fontSize = '12px';
    footer.style.fontWeight = '700';
    footer.style.color = isDark ? '#9ca3af' : '#6b7280';
    footer.style.fontFamily = 'Vazirmatn, sans-serif';
    clone.appendChild(footer);

    container.appendChild(clone);

    // Give DOM a moment to render the clone
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const canvas = await html2canvas(clone, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: isDark ? '#111827' : '#ffffff',
        width: EXPORT_WIDTH,
        windowWidth: EXPORT_WIDTH, // Critical for preventing right whitespace in RTL
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: (doc) => {
            // Force text color to ensure readability if classes don't apply
            const el = doc.getElementById(elementId);
            if (el) {
                el.style.color = isDark ? '#f3f4f6' : '#111827';
            }
        }
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      if (Capacitor.isNativePlatform()) {
        const fileName = `${title}_${Date.now()}.jpg`;
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: dataUrl.split(',')[1],
          directory: Directory.Cache
        });

        await Share.share({
          title: title,
          files: [savedFile.uri],
        });
      } else {
        const link = document.createElement('a');
        link.download = `${title}.jpg`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Sharing failed', error);
      alert('خطا در تولید تصویر گزارش');
    } finally {
      document.body.removeChild(container);
    }
  };

  // --- Full Excel Export Logic ---
  const handleFullExport = () => {
    const wb = XLSX.utils.book_new();
    
    // 1. Grades Sheet
    const gradesHeader = ["نام دانش‌آموز", "شماره تماس"];
    if (data.type === ClassType.MODULAR) {
        [1,2,3,4,5].forEach(i => gradesHeader.push(`پودمان ${i}`));
    } else {
        gradesHeader.push("مستمر ۱", "پایانی ۱", "مستمر ۲", "پایانی ۲");
    }
    
    const gradesData = data.students.map(s => {
        const row: any[] = [s.name, s.phoneNumber || ""];
        const perf = data.performance?.find(p => p.studentId === s.id);
        if (data.type === ClassType.MODULAR) {
             [1,2,3,4,5].forEach(i => {
                 row.push(perf?.gradesModular.find(g => g.moduleId === i)?.score || 0);
             });
        } else {
             row.push(
                 perf?.gradesTerm.find(g => g.termId === 1)?.continuous || 0,
                 perf?.gradesTerm.find(g => g.termId === 1)?.final || 0,
                 perf?.gradesTerm.find(g => g.termId === 2)?.continuous || 0,
                 perf?.gradesTerm.find(g => g.termId === 2)?.final || 0,
             );
        }
        return row;
    });
    const wsGrades = XLSX.utils.aoa_to_sheet([gradesHeader, ...gradesData]);
    wsGrades['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    wsGrades['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, wsGrades, "نمرات");

    // 2. Attendance Sheet
    const attHeader = ["تاریخ", "روز", ...data.students.map(s => s.name)];
    const attData = data.sessions.map(sess => {
        const row: any[] = [formatJalaali(sess.date), sess.dayOfWeek];
        data.students.forEach(s => {
            const rec = sess.records.find(r => r.studentId === s.id);
            let status = "-";
            if (rec?.attendance === AttendanceStatus.PRESENT) status = "حاضر";
            else if (rec?.attendance === AttendanceStatus.ABSENT) status = "غایب";
            else if (rec?.attendance === AttendanceStatus.LATE) status = "تاخیر";
            row.push(status);
        });
        return row;
    });
    const wsAtt = XLSX.utils.aoa_to_sheet([attHeader, ...attData]);
    wsAtt['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, wsAtt, "حضور و غیاب");

    // 3. Discipline Sheet
    const discRows: any[] = [["نام دانش‌آموز", "تاریخ", "مورد انضباطی", "امتیاز مثبت"]];
    data.sessions.forEach(sess => {
        sess.records.forEach(rec => {
            const s = data.students.find(st => st.id === rec.studentId);
            const issues = [];
            if (rec.discipline.sleep) issues.push("خواب");
            if (rec.discipline.badBehavior) issues.push("بی‌انضباطی");
            if (rec.discipline.expelled) issues.push("اخراج");
            
            if (issues.length > 0 || rec.positivePoints > 0) {
                discRows.push([
                    s?.name || "نامشخص",
                    formatJalaali(sess.date),
                    issues.join(" - "),
                    rec.positivePoints > 0 ? rec.positivePoints : ""
                ]);
            }
        });
    });
    const wsDisc = XLSX.utils.aoa_to_sheet(discRows);
    wsDisc['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, wsDisc, "موارد انضباطی");

    const teacher = settings?.teacherName || "Teacher";
    const year = settings?.currentAcademicYear || "Year";
    const fileName = `Report_${data.name}_${teacher}_${year}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (uploadStudentId) {
          handleImageUpload(e, uploadStudentId);
      }
      e.target.value = ''; // Reset input
  };

  const triggerProfileImagePicker = (e: React.MouseEvent, studentId: string) => {
      e.stopPropagation();
      
      if (Capacitor.isNativePlatform()) {
          handleNativeCamera(studentId);
      } else {
          setUploadStudentId(studentId);
          fileInputRef.current?.click();
      }
  };

  const handleNativeCamera = async (studentId: string) => {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
      });

      if (image.dataUrl) {
         const updatedStudents = data.students.map(s => 
            s.id === studentId ? { ...s, avatarUrl: image.dataUrl } : s
          );
          handleUpdate({ ...data, students: updatedStudents });
      }
    } catch (error) {
      console.log("Camera cancelled or failed", error);
    }
  };

  // --- Session Management ---
  const openSessionModal = () => {
      const today = new Date();
      const todayStr = formatJalaali(today.toISOString());
      const dayName = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(today);
      
      setNewSessionDate(todayStr);
      setNewSessionDay(dayName);
      setShowNewSessionModal(true);
  };

  const handleConfirmCreateSession = () => {
    const isoDate = parseJalaaliToIso(newSessionDate);
    if (!isoDate) {
        alert("فرمت تاریخ نادرست است");
        return;
    }

    const newSession: Session = {
      id: Date.now().toString(),
      classId: data.id,
      date: isoDate,
      dayOfWeek: newSessionDay,
      records: []
    };
    setActiveSession(newSession);
    setShowNewSessionModal(false);
  };

  const saveSession = (updatedSession: Session, shouldExit: boolean) => {
      // Find if session exists
      const exists = data.sessions.find(s => s.id === updatedSession.id);
      let updatedSessions;
      
      if (exists) {
          updatedSessions = data.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
      } else {
          updatedSessions = [...data.sessions, updatedSession];
      }

      handleUpdate({ ...data, sessions: updatedSessions });
      
      if (shouldExit) {
          setActiveSession(null);
      } else {
          setActiveSession(updatedSession);
      }
  };

  const updateModularGrade = (studentId: string, moduleId: 1|2|3|4|5, score: number) => {
      const existingPerf = data.performance?.find(p => p.studentId === studentId);
      const perfList = data.performance?.filter(p => p.studentId !== studentId) || [];
      
      const newGrades = existingPerf ? [...existingPerf.gradesModular] : [];
      const idx = newGrades.findIndex(g => g.moduleId === moduleId);
      if (idx >= 0) newGrades[idx].score = score;
      else newGrades.push({ moduleId, score });

      const newPerf: StudentPerformance = {
          studentId,
          gradesModular: newGrades,
          gradesTerm: existingPerf?.gradesTerm || []
      };

      handleUpdate({ ...data, performance: [...perfList, newPerf] });
  };

  const updateTermGrade = (studentId: string, termId: 1|2, field: 'continuous'|'final', score: number) => {
      const existingPerf = data.performance?.find(p => p.studentId === studentId);
      const perfList = data.performance?.filter(p => p.studentId !== studentId) || [];

      const newGrades = existingPerf ? [...existingPerf.gradesTerm] : [];
      const idx = newGrades.findIndex(g => g.termId === termId);
      
      if (idx >= 0) {
          newGrades[idx] = { ...newGrades[idx], [field]: score };
      } else {
          newGrades.push({ termId, continuous: 0, final: 0, [field]: score });
      }

      const newPerf: StudentPerformance = {
          studentId,
          gradesModular: existingPerf?.gradesModular || [],
          gradesTerm: newGrades
      };

      handleUpdate({ ...data, performance: [...perfList, newPerf] });
  };

  // --- Render Functions ---

  const renderClassReportModal = () => {
    if (!showClassReport) return null;

    // Calculate negative scores for top list
    const negativeScores = data.students.map(s => {
        let count = 0;
        let details: string[] = [];
        data.sessions.forEach(sess => {
            const r = sess.records.find(rec => rec.studentId === s.id);
            if (r) {
                if (r.discipline.sleep) { count++; details.push('خواب'); }
                if (r.discipline.badBehavior) { count++; details.push('بی‌انضباطی'); }
                if (r.discipline.expelled) { count++; details.push('اخراج'); }
            }
        });
        return { student: s, count, details };
    }).sort((a, b) => b.count - a.count).slice(0, 5).filter(x => x.count > 0);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto pt-10 pb-10">
            <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-3xl p-6 m-4 shadow-2xl relative">
                {/* Fixed Header in Modal */}
                <div className="flex justify-between items-center mb-6 sticky top-0 bg-white dark:bg-gray-800 z-10 pb-4 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Icons.Chart className="text-emerald-600" />
                        گزارش جامع کلاس
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => shareReportAsImage('class-report-content', `ClassReport_${data.name}`)} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors">
                            <Icons.Camera size={18} /> <span className="hidden sm:inline">ذخیره تصویر</span>
                        </button>
                        <button onClick={() => setShowClassReport(false)} className="text-gray-400 hover:text-red-500 p-2">
                            <Icons.XCircle size={24} />
                        </button>
                    </div>
                </div>

                {/* Report Content */}
                <div id="class-report-content" className="space-y-6 bg-white dark:bg-gray-800 p-4 rounded-xl">
                    {/* Header Info */}
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

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-emerald-600 text-white text-xs">
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

                    {/* Top Negative Students */}
                    {negativeScores.length > 0 && (
                         <div className="mt-8">
                             <h4 className="font-bold text-red-600 dark:text-red-400 mb-3 border-b border-red-100 dark:border-red-900 pb-2">لیست انضباطی (بیشترین موارد منفی)</h4>
                             <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-100 dark:border-red-900/30">
                                 {negativeScores.map((item, i) => (
                                     <div key={i} className="flex justify-between items-center py-2 border-b border-red-100 dark:border-red-900/30 last:border-0 text-sm">
                                         <div className="flex items-center gap-2">
                                             <span className="w-5 h-5 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-100 rounded-full flex items-center justify-center text-xs font-bold">{i+1}</span>
                                             <span className="font-bold text-gray-800 dark:text-gray-200">{item.student.name}</span>
                                         </div>
                                         <div className="text-red-600 dark:text-red-300 text-xs">
                                             {item.count} مورد: {item.details.join('، ')}
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
  };

  const renderIndividualReportModal = () => {
    if (!showIndividualReport || !selectedStudentForReport) return null;

    const s = selectedStudentForReport;
    const perf = data.performance?.find(p => p.studentId === s.id);
    
    // Stats Calculation
    let present = 0, absent = 0, late = 0, posScore = 0;
    const negCounts = { sleep: 0, bad: 0, expelled: 0 };
    const sessionHistory: {date: string, day: string, status: string, statusColor: string, desc: string}[] = [];

    // Sort sessions by date desc
    const sortedSessions = [...data.sessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedSessions.forEach(sess => {
        const r = sess.records.find(rec => rec.studentId === s.id);
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

    // Chart Data
    let chartData = [];
    if (data.type === ClassType.MODULAR) {
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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Fixed Modal Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 rounded-t-3xl z-10">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">گزارش عملکرد</h3>
                    <div className="flex gap-2">
                         <button onClick={() => shareReportAsImage('individual-report-content', `Report_${s.name}`)} className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-xl" title="ذخیره تصویر">
                             <Icons.Camera size={20} />
                         </button>
                         <button onClick={() => setShowIndividualReport(false)} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 p-2 rounded-xl">
                             <Icons.XCircle size={20} />
                         </button>
                    </div>
                </div>

                {/* Scrollable Body - This content is captured */}
                <div className="overflow-y-auto p-4 md:p-6" id="individual-report-content">
                    {/* Compact Header Profile */}
                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl border border-gray-200 dark:border-gray-600 mb-4">
                        {s.avatarUrl ? (
                             <img src={s.avatarUrl} className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-500 shadow-sm" />
                        ) : (
                             <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-2xl">
                                 {s.name.charAt(0)}
                             </div>
                        )}
                        <div className="flex-1">
                             <div className="flex justify-between items-start">
                                 <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1">{s.name}</h2>
                                 <span className="text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                                     {new Date().toLocaleDateString('fa-IR')}
                                 </span>
                             </div>
                             <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{data.name}</p>
                             <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                                 امتیاز کل: <span className="text-lg">{posScore - (negTotal * 0.5)}</span>
                             </p>
                        </div>
                    </div>

                    {/* Stats Bar (Compact) */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl text-center border border-emerald-100 dark:border-emerald-900/30">
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">حاضر</div>
                            <div className="font-black text-lg text-emerald-700 dark:text-emerald-300">{present}</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-xl text-center border border-red-100 dark:border-red-900/30">
                            <div className="text-xs text-red-600 dark:text-red-400 mb-1">غایب</div>
                            <div className="font-black text-lg text-red-700 dark:text-red-300">{absent}</div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-xl text-center border border-amber-100 dark:border-amber-900/30">
                            <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">تاخیر</div>
                            <div className="font-black text-lg text-amber-700 dark:text-amber-300">{late}</div>
                        </div>
                         <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-xl text-center border border-purple-100 dark:border-purple-900/30">
                            <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">موارد منفی</div>
                            <div className="font-black text-lg text-purple-700 dark:text-purple-300">{negTotal}</div>
                        </div>
                    </div>

                    {/* Grades Chart (Compact Height) */}
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

                    {/* Session History Table (Compact) */}
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
            </div>
        </div>
    );
  };

  if (activeSession) {
    return (
        <SessionScreen 
            session={activeSession}
            allSessions={data.sessions}
            students={data.students}
            resource={data.resources.mainFile}
            onUpdate={(updatedSession, shouldExit) => saveSession(updatedSession, shouldExit)}
        />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-vazir pb-20 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-b-3xl shadow-sm border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10">
        <div className="flex justify-between items-start mb-4">
            <button onClick={onBack} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><Icons.Back size={20} /></button>
            <div className="text-center">
                 <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{data.name}</h1>
                 <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{data.bookName}</p>
            </div>
            <button onClick={() => setShowEditClassInfo(true)} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full text-gray-600 dark:text-gray-300"><Icons.Settings size={20}/></button>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-2xl">
            <button onClick={() => setCurrentTab('STUDENTS')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${currentTab === 'STUDENTS' ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>دانش‌آموزان</button>
            <button onClick={() => setCurrentTab('SESSIONS')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${currentTab === 'SESSIONS' ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>جلسات</button>
            <button onClick={() => setCurrentTab('GRADES')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${currentTab === 'GRADES' ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>نمرات</button>
            <button onClick={() => setCurrentTab('CHARTS')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${currentTab === 'CHARTS' ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>گزارشات</button>
        </div>
      </div>

      <div className="p-4">
        {/* STUDENTS TAB */}
        {currentTab === 'STUDENTS' && (
            <div className="space-y-3">
                {data.students.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">
                        <Icons.Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>هنوز دانش‌آموزی اضافه نشده است.</p>
                    </div>
                ) : (
                    data.students.map((student) => (
                        <div key={student.id} onClick={() => { setSelectedStudentForReport(student); setShowIndividualReport(true); }} className="bg-white dark:bg-gray-800 p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-gray-100 dark:border-gray-700 active:scale-[0.99] transition-transform">
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
        )}

        {/* SESSIONS TAB */}
        {currentTab === 'SESSIONS' && (
            <div className="space-y-3">
                {data.sessions.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">
                        <Icons.Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>هنوز جلسه‌ای ثبت نشده است.</p>
                    </div>
                ) : (
                    [...data.sessions].reverse().map((session) => (
                        <div key={session.id} onClick={() => setActiveSession(session)} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center active:scale-[0.99] transition-transform cursor-pointer group">
                             <div className="flex items-center gap-3">
                                 <div className="bg-purple-100 dark:bg-purple-900/30 w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-purple-700 dark:text-purple-300 font-bold leading-none">
                                     <span className="text-[10px] opacity-70">{session.dayOfWeek}</span>
                                     <span className="text-sm mt-0.5">{formatJalaali(session.date).split('/')[2]}</span>
                                 </div>
                                 <div>
                                     <p className="text-sm font-bold text-gray-900 dark:text-white">{formatJalaali(session.date)}</p>
                                     <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {session.records.filter(r => r.attendance === AttendanceStatus.PRESENT).length} حاضر . {session.records.filter(r => r.attendance === AttendanceStatus.ABSENT).length} غایب
                                     </p>
                                 </div>
                             </div>
                             <Icons.Back className="text-gray-300 group-hover:text-purple-500 rotate-180 transition-colors" size={20} />
                        </div>
                    ))
                )}
            </div>
        )}

        {/* GRADES TAB */}
        {currentTab === 'GRADES' && (
             <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                 <table className="w-full text-sm text-left">
                     <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 uppercase">
                         <tr>
                             <th className="px-4 py-3 text-right">دانش‌آموز</th>
                             {data.type === ClassType.MODULAR ? (
                                 [1,2,3,4,5].map(i => <th key={i} className="px-4 py-3 text-center whitespace-nowrap">پودمان {i}</th>)
                             ) : (
                                 <>
                                     <th className="px-4 py-3 text-center whitespace-nowrap">مستمر ۱</th>
                                     <th className="px-4 py-3 text-center whitespace-nowrap">پایانی ۱</th>
                                     <th className="px-4 py-3 text-center whitespace-nowrap">مستمر ۲</th>
                                     <th className="px-4 py-3 text-center whitespace-nowrap">پایانی ۲</th>
                                 </>
                             )}
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                         {data.students.map(student => {
                             const perf = data.performance?.find(p => p.studentId === student.id);
                             return (
                                 <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                     <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-right whitespace-nowrap sticky right-0 bg-white dark:bg-gray-800 z-10">{student.name}</td>
                                     {data.type === ClassType.MODULAR ? (
                                         [1,2,3,4,5].map(i => (
                                             <td key={i} className="px-2 py-2">
                                                 <input 
                                                     type="number" 
                                                     className="w-12 text-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all dark:text-white"
                                                     value={perf?.gradesModular.find(g => g.moduleId === i)?.score || ''}
                                                     onChange={(e) => updateModularGrade(student.id, i as any, parseFloat(e.target.value))}
                                                 />
                                             </td>
                                         ))
                                     ) : (
                                         <>
                                            <td className="px-2 py-2"><input type="number" className="w-12 text-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 focus:border-emerald-500 outline-none dark:text-white" value={perf?.gradesTerm.find(g => g.termId === 1)?.continuous || ''} onChange={(e) => updateTermGrade(student.id, 1, 'continuous', parseFloat(e.target.value))} /></td>
                                            <td className="px-2 py-2"><input type="number" className="w-12 text-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 focus:border-emerald-500 outline-none dark:text-white" value={perf?.gradesTerm.find(g => g.termId === 1)?.final || ''} onChange={(e) => updateTermGrade(student.id, 1, 'final', parseFloat(e.target.value))} /></td>
                                            <td className="px-2 py-2"><input type="number" className="w-12 text-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 focus:border-emerald-500 outline-none dark:text-white" value={perf?.gradesTerm.find(g => g.termId === 2)?.continuous || ''} onChange={(e) => updateTermGrade(student.id, 2, 'continuous', parseFloat(e.target.value))} /></td>
                                            <td className="px-2 py-2"><input type="number" className="w-12 text-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 focus:border-emerald-500 outline-none dark:text-white" value={perf?.gradesTerm.find(g => g.termId === 2)?.final || ''} onChange={(e) => updateTermGrade(student.id, 2, 'final', parseFloat(e.target.value))} /></td>
                                         </>
                                     )}
                                 </tr>
                             )
                         })}
                     </tbody>
                 </table>
             </div>
        )}

        {/* REPORTS & CHARTS TAB */}
        {currentTab === 'CHARTS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div onClick={() => setShowClassReport(true)} className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-3xl shadow-lg shadow-emerald-200 dark:shadow-none flex flex-col items-center justify-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform">
                    <div className="bg-white/20 p-4 rounded-2xl"><Icons.Chart size={32} /></div>
                    <span className="font-bold text-lg">گزارش وضعیت کلاس</span>
                </div>

                <div onClick={handleFullExport} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                     <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-4 rounded-2xl"><Icons.Download size={32} /></div>
                     <span className="font-bold text-gray-800 dark:text-white">خروجی اکسل کامل</span>
                </div>

                <div onClick={() => handleDeleteClass()} className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors sm:col-span-2">
                     <Icons.Delete size={24} className="text-red-500" />
                     <span className="font-bold text-red-600 dark:text-red-400 text-sm">حذف کامل کلاس</span>
                </div>
            </div>
        )}
      </div>

      {/* Floating Action Button */}
      {currentTab === 'SESSIONS' && (
           <button onClick={openSessionModal} className="fixed bottom-6 left-6 bg-emerald-600 text-white p-4 rounded-2xl shadow-xl shadow-emerald-200 dark:shadow-none hover:scale-110 transition-transform z-20 flex items-center gap-2">
               <Icons.Plus className="w-6 h-6" /> <span className="font-bold text-sm hidden md:inline">جلسه جدید</span>
           </button>
      )}
      {currentTab === 'STUDENTS' && (
           <button onClick={() => setShowAddStudent(true)} className="fixed bottom-6 left-6 bg-emerald-600 text-white p-4 rounded-2xl shadow-xl shadow-emerald-200 dark:shadow-none hover:scale-110 transition-transform z-20 flex items-center gap-2">
               <Icons.AddUser className="w-6 h-6" /> <span className="font-bold text-sm hidden md:inline">دانش‌آموز جدید</span>
           </button>
      )}

      {/* Modals */}
      {showAddStudent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">افزودن دانش‌آموز</h3>
                  <input autoFocus type="text" placeholder="نام و نام خانوادگی" value={newStudentName} onChange={e=>setNewStudentName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl mb-3 focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white" />
                  <input type="tel" placeholder="شماره تماس (اختیاری)" value={newStudentPhone} onChange={e=>setNewStudentPhone(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white" />
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mb-4 text-center">
                       <label className="text-xs font-bold text-blue-600 dark:text-blue-400 block mb-2">یا وارد کردن از اکسل</label>
                       <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="text-xs text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"/>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={()=>setShowAddStudent(false)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold">انصراف</button>
                      <button onClick={addStudent} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none">افزودن</button>
                  </div>
              </div>
          </div>
      )}

      {editingStudent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">ویرایش دانش‌آموز</h3>
                  <input autoFocus type="text" placeholder="نام" value={newStudentName} onChange={e=>setNewStudentName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl mb-3 focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white" />
                  <input type="tel" placeholder="شماره تماس" value={newStudentPhone} onChange={e=>setNewStudentPhone(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white" />
                  <div className="flex gap-2">
                      <button onClick={()=>{setEditingStudent(null); setNewStudentName('');}} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold">انصراف</button>
                      <button onClick={saveEditedStudent} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none">ذخیره</button>
                  </div>
              </div>
          </div>
      )}

      {showNewSessionModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">جلسه جدید</h3>
                  <div className="space-y-3 mb-6">
                      <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 font-bold block mb-1">تاریخ</label>
                          <input type="text" value={newSessionDate} onChange={e=>setNewSessionDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl text-center font-bold text-gray-900 dark:text-white" dir="ltr"/>
                      </div>
                      <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 font-bold block mb-1">روز</label>
                          <input type="text" value={newSessionDay} onChange={e=>setNewSessionDay(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl text-center font-bold text-gray-900 dark:text-white"/>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={()=>setShowNewSessionModal(false)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold">انصراف</button>
                      <button onClick={handleConfirmCreateSession} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none">ایجاد</button>
                  </div>
              </div>
          </div>
      )}

      {showEditClassInfo && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">ویرایش اطلاعات کلاس</h3>
                  <input type="text" placeholder="نام کلاس" value={editClassName} onChange={e=>setEditClassName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl mb-3 outline-none dark:text-white" />
                  <input type="text" placeholder="نام درس" value={editBookName} onChange={e=>setEditBookName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl mb-4 outline-none dark:text-white" />
                  <div className="flex gap-2">
                      <button onClick={()=>setShowEditClassInfo(false)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold">انصراف</button>
                      <button onClick={handleEditClassInfo} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none">ذخیره</button>
                  </div>
              </div>
          </div>
      )}

      {renderClassReportModal()}
      {renderIndividualReportModal()}
      
      {/* Hidden File Input for Web Image Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleFileInputChange}
      />
    </div>
  );
};
