
import React, { useState, useEffect } from 'react';
import { Classroom, Student, Session, ClassType, AttendanceStatus, GlobalSettings } from '../types';
import { updateClass, deleteClass, getSettings } from '../services/storageService';
import { formatJalaali, parseJalaaliToIso } from '../services/dateService';
import { Icons } from '../components/Icons';
import { SessionScreen } from './SessionScreen';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
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
  
  // Modals State
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [showClassReport, setShowClassReport] = useState(false);
  const [showEditClassInfo, setShowEditClassInfo] = useState(false);
  
  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // New Session Modal State
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionDay, setNewSessionDay] = useState('');

  // Chart Detail State
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string | null>(null);

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

  // --- Share as Image Logic ---
  const shareReportAsImage = async (elementId: string, title: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      // Use html2canvas to capture the element
      const canvas = await html2canvas(element, {
        scale: 3, // High quality
        backgroundColor: '#ffffff', // Force white background for clean report
        logging: false,
        useCORS: true
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      if (Capacitor.isNativePlatform()) {
        const fileName = `report_${Date.now()}.jpg`;
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
        // Web fallback
        const link = document.createElement('a');
        link.download = `${title}.jpg`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Sharing failed', error);
      alert('خطا در تولید تصویر گزارش');
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

    // Metadata for the filename
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

  // Native Camera Handler
  const handleNativeCamera = async (studentId: string) => {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // Asks user: Camera or Photos
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
      // Init default values
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

  const handleSessionUpdate = (updatedSession: Session, shouldExit: boolean) => {
    const exists = data.sessions.find(s => s.id === updatedSession.id);
    let updatedSessions;
    if (exists) {
        updatedSessions = data.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
    } else {
        updatedSessions = [updatedSession, ...data.sessions];
    }
    
    const updated = { ...data, sessions: updatedSessions };
    handleUpdate(updated);
    
    if (shouldExit) {
        setActiveSession(null);
    }
  };

  // --- Resources Logic ---
  const handleViewResource = () => {
      if (!data.resources.mainFile) return;
      
      try {
        const base64Data = data.resources.mainFile.data;
        const mimeType = data.resources.mainFile.mimeType;
        
        // Decode Base64
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: mimeType});
        
        // Create URL
        const fileURL = URL.createObjectURL(blob);
        window.open(fileURL, '_blank');
      } catch (error) {
          console.error("Error opening file", error);
          alert("خطا در باز کردن فایل. ممکن است فایل آسیب دیده باشد.");
      }
  };

  if (activeSession) {
    return (
      <SessionScreen 
        session={activeSession} 
        students={data.students} 
        allSessions={data.sessions}
        onUpdate={handleSessionUpdate}
        resource={data.resources.mainFile}
      />
    );
  }

  // --- Tabs ---

  const renderStudents = () => (
    <div className="space-y-4 pb-24">
      <div className="flex gap-3 mb-6 overflow-x-auto pb-2 no-scrollbar">
        <button onClick={() => setShowAddStudent(true)} className="flex-1 min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none transition-all font-bold text-sm whitespace-nowrap">
          <Icons.AddUser size={18} />
          افزودن دانش‌آموز
        </button>
        
        <label className="flex-1 min-w-[140px] bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-gray-600 py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-emerald-50 dark:hover:bg-gray-700 transition-all font-bold text-sm cursor-pointer whitespace-nowrap">
             <Icons.Upload size={18} />
             ورود از اکسل
             <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
        </label>
      </div>

      {data.students.length === 0 && (
        <div className="text-center py-12 opacity-50">
            <Icons.Users className="w-16 h-16 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">لیست کلاس خالی است</p>
        </div>
      )}

      <div className="grid gap-3">
        {data.students.map(student => (
            <div key={student.id} className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer" onClick={() => setSelectedStudentForReport(student.id)}>
            <div 
                className="relative group cursor-pointer"
                onClick={(e) => {
                    if (Capacitor.isNativePlatform()) {
                        e.stopPropagation();
                        handleNativeCamera(student.id);
                    }
                }}
            >
                {student.avatarUrl ? (
                <img src={student.avatarUrl} alt={student.name} className="w-14 h-14 rounded-full object-cover border-2 border-emerald-100 dark:border-gray-600 shadow-sm" />
                ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-gray-400 border-2 border-white dark:border-gray-700 shadow-sm">
                    <Icons.Camera size={22} />
                </div>
                )}
                {/* Only show file input if NOT native platform */}
                {!Capacitor.isNativePlatform() && (
                    <input 
                    type="file" 
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleImageUpload(e, student.id)}
                    />
                )}
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white text-base">{student.name}</h3>
                {student.phoneNumber && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <Icons.Phone size={12} />
                        <span>{student.phoneNumber}</span>
                    </div>
                )}
            </div>
            <div className="flex gap-2 z-10">
                <button 
                    onClick={(e) => handleEditStudent(student, e)}
                    className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-colors"
                >
                    <Icons.Pencil size={18} />
                </button>
                <button 
                    onClick={(e) => handleDeleteStudent(e, student.id)}
                    className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                >
                    <Icons.Delete size={18} />
                </button>
            </div>
            </div>
        ))}
      </div>
    </div>
  );

  const renderSessions = () => (
    <div className="space-y-6 pb-24">
      <button onClick={openSessionModal} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none hover:scale-[1.02] transition-transform">
        <Icons.Plus size={22} />
        <span className="font-bold">شروع جلسه جدید</span>
      </button>
      
      {/* View Resource Button (if exists) */}
      {data.resources.mainFile && (
        <button 
            onClick={handleViewResource}
            className="w-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 py-3 rounded-2xl flex items-center justify-center gap-2 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
            <Icons.Eye size={20} />
            <span className="font-bold">مشاهده فایل منبع (کتاب)</span>
        </button>
      )}

      <div className="pt-2">
        <h3 className="font-bold text-gray-800 dark:text-white mb-4 px-2">تاریخچه جلسات</h3>
        {data.sessions.length === 0 && <p className="text-gray-400 text-center text-sm">هنوز جلسه‌ای ثبت نشده است.</p>}
        <div className="space-y-3">
            {data.sessions.map(session => (
                <div key={session.id} 
                    onClick={() => setActiveSession(session)}
                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-r-4 border-emerald-400 cursor-pointer hover:translate-x-1 transition-transform"
                >
                <div className="flex justify-between items-center">
                    <div>
                    <p className="font-bold text-gray-800 dark:text-white">{formatJalaali(session.date)}</p>
                    <p className="text-xs text-gray-400 mt-1">{session.dayOfWeek}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded font-bold">
                            {session.records.filter(r => r.attendance === 'PRESENT').length} حاضر
                        </span>
                        <div className="flex gap-1">
                            {session.records.some(r => r.note) && <Icons.File className="w-3 h-3 text-gray-400" />}
                            {session.lessonPlan && <Icons.BookOpen className="w-3 h-3 text-purple-400" />}
                        </div>
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
      <div className="overflow-x-auto pb-24 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <table className="w-full text-sm text-right">
            <thead className="bg-emerald-50 dark:bg-gray-700 text-emerald-800 dark:text-emerald-400 text-xs uppercase font-bold">
                <tr>
                    <th className="px-4 py-4 rounded-tr-xl">نام دانش‌آموز</th>
                    {data.type === ClassType.MODULAR ? (
                        [1, 2, 3, 4, 5].map(i => <th key={i} className="px-2 py-4 text-center whitespace-nowrap">پودمان {i}</th>)
                    ) : (
                        <>
                            <th className="px-2 py-4 text-center border-l border-emerald-100 dark:border-gray-600">مستمر ۱</th>
                            <th className="px-2 py-4 text-center border-l border-emerald-200 dark:border-gray-600">پایانی ۱</th>
                            <th className="px-2 py-4 text-center border-l border-emerald-100 dark:border-gray-600">مستمر ۲</th>
                            <th className="px-2 py-4 text-center rounded-tl-xl">پایانی ۲</th>
                        </>
                    )}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.students.map(student => (
                    <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-700 dark:text-gray-200">{student.name}</td>
                        {data.type === ClassType.MODULAR ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <td key={i} className="px-1 py-2 text-center">
                                    <input 
                                        type="number" 
                                        className="w-12 text-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900 dark:text-white"
                                        value={getScore(student.id, i)}
                                        onChange={(e) => updateGrade(student.id, i, parseFloat(e.target.value))}
                                    />
                                </td>
                            ))
                        ) : (
                            <>
                             <td className="px-1 py-2 text-center"><input type="number" className="w-12 text-center bg-orange-50/50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/50 rounded-lg p-2 text-gray-900 dark:text-white" value={getScore(student.id, {term:1, type:'continuous'})} onChange={e=>updateGrade(student.id, {term:1, type:'continuous'}, parseFloat(e.target.value))}/></td>
                             <td className="px-1 py-2 text-center"><input type="number" className="w-12 text-center bg-orange-100/50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-900/60 rounded-lg p-2 text-gray-900 dark:text-white" value={getScore(student.id, {term:1, type:'final'})} onChange={e=>updateGrade(student.id, {term:1, type:'final'}, parseFloat(e.target.value))}/></td>
                             <td className="px-1 py-2 text-center"><input type="number" className="w-12 text-center bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-lg p-2 text-gray-900 dark:text-white" value={getScore(student.id, {term:2, type:'continuous'})} onChange={e=>updateGrade(student.id, {term:2, type:'continuous'}, parseFloat(e.target.value))}/></td>
                             <td className="px-1 py-2 text-center"><input type="number" className="w-12 text-center bg-blue-100/50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-900/60 rounded-lg p-2 text-gray-900 dark:text-white" value={getScore(student.id, {term:2, type:'final'})} onChange={e=>updateGrade(student.id, {term:2, type:'final'}, parseFloat(e.target.value))}/></td>
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

      // -- Helper for Aggregated Stats for Class Report --
      const getStudentStats = (studentId: string) => {
          let p = 0, a = 0, l = 0, pos = 0, neg = 0;
          data.sessions.forEach(sess => {
              const r = sess.records.find(r => r.studentId === studentId);
              if (r) {
                  if (r.attendance === AttendanceStatus.PRESENT) p++;
                  else if (r.attendance === AttendanceStatus.ABSENT) a++;
                  else l++;
                  
                  pos += r.positivePoints;
                  if (r.discipline.sleep) neg++;
                  if (r.discipline.badBehavior) neg++;
                  if (r.discipline.expelled) neg++;
              }
          });
          return { p, a, l, pos, neg };
      };

      const renderClassReportModal = () => (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-6 overflow-auto">
            <div className="bg-white w-full max-w-4xl rounded-none md:rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-full">
                <div className="flex justify-between items-center p-4 bg-gray-100 border-b">
                     <h3 className="font-bold text-gray-800">پیش‌نمایش گزارش وضعیت کلاس</h3>
                     <button onClick={() => setShowClassReport(false)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 text-gray-700">
                         <Icons.Delete className="w-5 h-5 rotate-45" />
                     </button>
                </div>
                
                {/* The Capture Area */}
                <div id="class-report-capture" className="bg-white p-8 text-gray-900 font-vazir dir-rtl overflow-auto">
                     {/* Header */}
                     <div className="border-b-2 border-emerald-600 pb-4 mb-6 flex justify-between items-end">
                        <div>
                            <h1 className="text-2xl font-black text-emerald-800 mb-1">گزارش وضعیت کلاس</h1>
                            <p className="text-sm text-gray-500">مدیریت کلاس هوشمند</p>
                        </div>
                        <div className="text-left text-sm text-gray-600 leading-6">
                             <p><span className="font-bold">نام کلاس:</span> {data.name}</p>
                             <p><span className="font-bold">دبیر:</span> {settings?.teacherName}</p>
                             <p><span className="font-bold">تاریخ گزارش:</span> {formatJalaali(new Date().toISOString())}</p>
                        </div>
                     </div>

                     {/* Table */}
                     <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-emerald-100 text-emerald-900">
                                <th className="p-3 border border-emerald-200 text-right">نام دانش‌آموز</th>
                                <th className="p-3 border border-emerald-200 text-center">حاضر</th>
                                <th className="p-3 border border-emerald-200 text-center">غایب</th>
                                <th className="p-3 border border-emerald-200 text-center">تاخیر</th>
                                <th className="p-3 border border-emerald-200 text-center bg-emerald-50">امتیاز مثبت</th>
                                <th className="p-3 border border-emerald-200 text-center bg-red-50 text-red-900">موارد انضباطی</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.students.map((student, idx) => {
                                const stats = getStudentStats(student.id);
                                return (
                                    <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="p-3 border border-gray-200 font-bold">{student.name}</td>
                                        <td className="p-3 border border-gray-200 text-center">{stats.p}</td>
                                        <td className="p-3 border border-gray-200 text-center font-bold text-red-600">{stats.a}</td>
                                        <td className="p-3 border border-gray-200 text-center text-amber-600">{stats.l}</td>
                                        <td className="p-3 border border-gray-200 text-center font-bold text-emerald-600 bg-emerald-50/30">{stats.pos}</td>
                                        <td className="p-3 border border-gray-200 text-center text-red-600 bg-red-50/30">{stats.neg}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                     </table>
                     
                     <div className="mt-8 flex justify-between items-center text-xs text-gray-400 border-t pt-4">
                         <p>تولید شده توسط نرم‌افزار مدیریت کلاس</p>
                         <p>mrhonaramoz.ir</p>
                     </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button 
                        onClick={() => shareReportAsImage('class-report-capture', `ClassReport_${data.name}`)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2"
                    >
                        <Icons.Upload size={20} />
                        اشتراک‌گذاری تصویر
                    </button>
                </div>
            </div>
        </div>
      );

      const renderStudentReport = () => {
        if (!selectedStudentForReport) return null;
        const student = data.students.find(s => s.id === selectedStudentForReport);
        if (!student) return null;

        let sPresent = 0, sAbsent = 0, sLate = 0;
        let sPositive = 0;
        
        // Detailed Session Log Data
        const sessionLogs = data.sessions.map(sess => {
            const rec = sess.records.find(r => r.studentId === student.id);
            if (!rec) return null;

            if (rec.attendance === AttendanceStatus.PRESENT) sPresent++;
            if (rec.attendance === AttendanceStatus.ABSENT) sAbsent++;
            if (rec.attendance === AttendanceStatus.LATE) sLate++;
            sPositive += rec.positivePoints;

            const disciplineIssues = [];
            if (rec.discipline.sleep) disciplineIssues.push("خواب");
            if (rec.discipline.badBehavior) disciplineIssues.push("بی‌انضباطی");
            if (rec.discipline.expelled) disciplineIssues.push("اخراج");
            
            // Calculate daily score for chart
            let dailyScore = 0;
            if (rec.attendance !== AttendanceStatus.ABSENT) {
                if (rec.discipline.sleep) dailyScore -= 0.5;
                if (rec.discipline.badBehavior) dailyScore -= 0.5;
                if (rec.discipline.expelled) dailyScore -= 1;
                dailyScore += rec.positivePoints;
            }

            return {
                id: sess.id,
                date: formatJalaali(sess.date),
                day: sess.dayOfWeek,
                status: rec.attendance,
                issues: disciplineIssues,
                positive: rec.positivePoints,
                score: dailyScore,
                note: rec.note
            };
        }).filter(Boolean).sort((a, b) => b!.id.localeCompare(a!.id)); // Reverse chrono order

        // Chart Data (Chronological)
        const chartData = [...sessionLogs].reverse().map(l => ({
            name: l?.date.split('/')[2], // Show day only
            score: l?.score
        }));

        // Get Grades
        const perf = data.performance?.find(p => p.studentId === student.id);

        return (
            <div className="fixed inset-0 bg-emerald-900/30 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4">
                <div className="bg-white dark:bg-gray-800 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[95vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-10 duration-300 border dark:border-gray-700 flex flex-col">
                    
                    <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">گزارش عملکرد</h3>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => shareReportAsImage('student-report-capture', `Report_${student.name}`)}
                                className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 p-2 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-900/60"
                                title="اشتراک‌گذاری تصویر"
                            >
                                <Icons.Upload size={20} />
                            </button>
                            <button onClick={() => setSelectedStudentForReport(null)} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600">
                                <Icons.Delete className="w-5 h-5 rotate-45" />
                            </button>
                        </div>
                    </div>

                    {/* Capture Area */}
                    <div id="student-report-capture" className="p-6 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                        
                        {/* Branding Header (Visible mostly in capture, but shown here too) */}
                        <div className="mb-6 border-b-2 border-emerald-500 pb-4 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                {student.avatarUrl ? (
                                    <img src={student.avatarUrl} className="w-16 h-16 rounded-full object-cover border-2 border-emerald-100" />
                                ) : (
                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><Icons.Users size={24}/></div>
                                )}
                                <div>
                                    <h2 className="text-xl font-black">{student.name}</h2>
                                    <p className="text-sm opacity-70">{data.name}</p>
                                    {student.phoneNumber && <p className="text-xs text-gray-500 mt-1">{student.phoneNumber}</p>}
                                </div>
                            </div>
                            <div className="text-left text-xs opacity-60 leading-5">
                                <p>{settings?.teacherName}</p>
                                <p>{formatJalaali(new Date().toISOString())}</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* 1. Summary Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl text-center border border-green-100 dark:border-green-900/30">
                                    <p className="text-green-600 dark:text-green-400 font-bold text-xl">{sPresent}</p>
                                    <p className="text-xs text-green-800 dark:text-green-300">حضور</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl text-center border border-red-100 dark:border-red-900/30">
                                    <p className="text-red-600 dark:text-red-400 font-bold text-xl">{sAbsent}</p>
                                    <p className="text-xs text-red-800 dark:text-red-300">غیبت</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl text-center border border-amber-100 dark:border-amber-900/30">
                                    <p className="text-amber-600 dark:text-amber-400 font-bold text-xl">{sLate}</p>
                                    <p className="text-xs text-amber-800 dark:text-amber-300">تاخیر</p>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-center border border-blue-100 dark:border-blue-900/30">
                                    <p className="text-blue-600 dark:text-blue-400 font-bold text-xl">{sPositive}</p>
                                    <p className="text-xs text-blue-800 dark:text-blue-300">امتیاز مثبت</p>
                                </div>
                            </div>

                            {/* 2. Grades Section */}
                            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 text-sm flex items-center gap-2">
                                    <Icons.BookOpen size={16}/>
                                    کارنامه نمرات
                                </h4>
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                    {data.type === ClassType.MODULAR ? (
                                        [1,2,3,4,5].map(i => {
                                            const score = perf?.gradesModular.find(g => g.moduleId === i)?.score;
                                            return (
                                                <div key={i} className="min-w-[80px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-2 text-center">
                                                    <span className="text-xs text-gray-400 block mb-1">پودمان {i}</span>
                                                    <span className={`font-bold ${score !== undefined ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300'}`}>
                                                        {score !== undefined ? score : '-'}
                                                    </span>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <>
                                            {[1,2].map(term => (
                                                <div key={term} className="flex gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                                                    <div className="text-center w-16">
                                                        <span className="text-[10px] text-gray-400 block">مستمر {term}</span>
                                                        <span className="font-bold text-sm text-gray-700 dark:text-white">
                                                            {perf?.gradesTerm.find(g => g.termId === term)?.continuous ?? '-'}
                                                        </span>
                                                    </div>
                                                    <div className="w-px bg-gray-200 dark:bg-gray-600"></div>
                                                    <div className="text-center w-16">
                                                        <span className="text-[10px] text-gray-400 block">پایانی {term}</span>
                                                        <span className="font-bold text-sm text-gray-700 dark:text-white">
                                                            {perf?.gradesTerm.find(g => g.termId === term)?.final ?? '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* 3. Trend Chart */}
                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 text-sm">روند امتیازات (رفتاری + درسی)</h4>
                                <div className="h-40 w-full dir-ltr">
                                    <ResponsiveContainer>
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                            <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                            <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{r: 3}} activeDot={{r: 5}} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* 4. Detailed Timeline */}
                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 text-sm border-b dark:border-gray-700 pb-2">تاریخچه جلسات</h4>
                                {sessionLogs.length > 0 ? (
                                    <div className="space-y-3">
                                        {sessionLogs.map((log: any) => (
                                            <div key={log.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-800 dark:text-white text-sm">{log.date}</span>
                                                        <span className="text-xs text-gray-400">({log.day})</span>
                                                    </div>
                                                    {log.status === 'PRESENT' && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded">حاضر</span>}
                                                    {log.status === 'ABSENT' && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded">غایب</span>}
                                                    {log.status === 'LATE' && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">تاخیر</span>}
                                                </div>
                                                
                                                <div className="flex flex-wrap gap-2 mb-1">
                                                    {log.issues.map((issue: string, idx: number) => (
                                                        <span key={idx} className="text-[10px] text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-100 dark:border-red-900/30">{issue}</span>
                                                    ))}
                                                    {log.positive > 0 && (
                                                        <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900/30">+{log.positive} امتیاز</span>
                                                    )}
                                                </div>
                                                
                                                {log.note && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-600">
                                                        "{log.note}"
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-400 text-sm py-4">هنوز جلسه‌ای برای این دانش‌آموز ثبت نشده است.</p>
                                )}
                            </div>
                        </div>
                        
                         <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-center text-[10px] text-gray-400 gap-2">
                             <span>mrhonaramoz.ir</span>
                             <span>•</span>
                             <span>مدیریت کلاس</span>
                         </div>
                    </div>
                </div>
            </div>
        );
      }

      return (
        <div className="pb-24 space-y-6">
            {showClassReport && renderClassReportModal()}
            {selectedStudentForReport && renderStudentReport()}
            
            <div className="grid grid-cols-1 gap-4">
                <button 
                    onClick={() => setShowClassReport(true)}
                    className="bg-white dark:bg-gray-800 border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                    <Icons.File size={24} />
                    <span className="font-bold">گزارش تصویری وضعیت کلاس</span>
                </button>
                <button 
                    onClick={handleFullExport}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <Icons.Download size={24} />
                    <span className="font-bold">دریافت خروجی اکسل</span>
                </button>
            </div>

            {/* Overall Chart */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-emerald-100 dark:border-gray-700">
                <h3 className="font-bold text-emerald-800 dark:text-emerald-400 mb-6 text-center flex items-center justify-center gap-2">
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
                        <div className="absolute inset-0 flex items-center justify-center text-gray-300 dark:text-gray-600">بدون داده</div>
                    )}
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <span className="block text-3xl font-black text-gray-700 dark:text-white">{data.sessions.length}</span>
                            <span className="text-xs text-gray-400">جلسه</span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-center gap-6 text-xs mt-4">
                    {overallData.map(d => (
                        <div key={d.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></div>
                            <span className="text-gray-600 dark:text-gray-300 font-medium">{d.name} ({d.value})</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Student List for Reports */}
            <div>
                <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 px-2 text-sm">گزارش عملکرد فردی</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.students.map(student => (
                        <div 
                            key={student.id} 
                            onClick={() => setSelectedStudentForReport(student.id)}
                            className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-3 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all active:scale-95"
                        >
                            {student.avatarUrl ? (
                                <img src={student.avatarUrl} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400"><Icons.Users size={16}/></div>
                            )}
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{student.name}</span>
                            <Icons.Back className="w-4 h-4 text-emerald-300 mr-auto rotate-180" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="min-h-screen bg-emerald-50/50 dark:bg-gray-900 font-vazir transition-colors duration-300">
      <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-4 shadow-sm sticky top-0 z-10 border-b border-emerald-100 dark:border-gray-700">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
            <Icons.Back className="w-6 h-6" />
            </button>
            <div className="flex-1 overflow-hidden cursor-pointer" onClick={() => setShowEditClassInfo(true)}>
                <div className="flex items-center gap-1">
                    <h1 className="font-black text-lg text-emerald-900 dark:text-emerald-400 truncate">{data.name}</h1>
                    <Icons.Pencil size={12} className="text-gray-400" />
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 truncate flex items-center gap-1">
                    {data.type === ClassType.MODULAR ? 'پودمانی' : 'ترمی'}
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="text-gray-500 dark:text-gray-400">{data.bookName}</span>
                </p>
            </div>
            <button onClick={handleDeleteClass} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors rounded-xl">
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
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex justify-around py-3 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20 max-w-3xl mx-auto">
        <NavButton tab="STUDENTS" current={currentTab} set={setCurrentTab} icon={Icons.Users} label="دانش‌آموزان" />
        <NavButton tab="SESSIONS" current={currentTab} set={setCurrentTab} icon={Icons.Calendar} label="جلسات" />
        <NavButton tab="GRADES" current={currentTab} set={setCurrentTab} icon={Icons.BookOpen} label="نمرات" />
        <NavButton tab="CHARTS" current={currentTab} set={setCurrentTab} icon={Icons.Chart} label="گزارش‌ها" />
      </div>

      {/* Add Student Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-emerald-900/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl border dark:border-gray-700">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">دانش‌آموز جدید</h3>
            <div className="space-y-4 mb-6">
                <input 
                  type="text" 
                  value={newStudentName}
                  onChange={e => setNewStudentName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900 dark:text-white"
                  placeholder="نام و نام خانوادگی"
                />
                <input 
                  type="tel" 
                  value={newStudentPhone}
                  onChange={e => setNewStudentPhone(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900 dark:text-white"
                  placeholder="شماره تماس (اختیاری)"
                  dir="ltr"
                />
            </div>
            <div className="flex gap-3">
                <button onClick={() => setShowAddStudent(false)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl">لغو</button>
                <button onClick={addStudent} className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold shadow-lg shadow-emerald-200 dark:shadow-none">ثبت</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-emerald-900/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl border dark:border-gray-700">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">ویرایش دانش‌آموز</h3>
            <div className="space-y-4 mb-6">
                <input 
                  type="text" 
                  value={newStudentName}
                  onChange={e => setNewStudentName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900 dark:text-white"
                  placeholder="نام و نام خانوادگی"
                />
                <input 
                  type="tel" 
                  value={newStudentPhone}
                  onChange={e => setNewStudentPhone(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900 dark:text-white"
                  placeholder="شماره تماس"
                  dir="ltr"
                />
            </div>
            <div className="flex gap-3">
                <button onClick={() => setEditingStudent(null)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl">لغو</button>
                <button onClick={saveEditedStudent} className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold shadow-lg shadow-emerald-200 dark:shadow-none">ذخیره</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Class Info Modal */}
      {showEditClassInfo && (
          <div className="fixed inset-0 bg-emerald-900/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl border dark:border-gray-700">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">ویرایش مشخصات کلاس</h3>
                  <div className="space-y-4 mb-6">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">نام کلاس</label>
                          <input 
                            type="text" 
                            value={editClassName}
                            onChange={e => setEditClassName(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900 dark:text-white"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">نام کتاب/درس</label>
                          <input 
                            type="text" 
                            value={editBookName}
                            onChange={e => setEditBookName(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-gray-900 dark:text-white"
                          />
                      </div>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setShowEditClassInfo(false)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl">لغو</button>
                      <button onClick={handleEditClassInfo} className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold shadow-lg shadow-emerald-200 dark:shadow-none">ذخیره</button>
                  </div>
              </div>
          </div>
      )}

      {/* New Session Confirmation Modal */}
      {showNewSessionModal && (
          <div className="fixed inset-0 bg-emerald-900/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl border dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-4 text-emerald-800 dark:text-emerald-400">
                      <Icons.Calendar size={24} />
                      <h3 className="text-lg font-black">شروع جلسه جدید</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">لطفاً تاریخ و روز جلسه را بررسی و تایید کنید.</p>
                  
                  <div className="space-y-3 mb-6">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">تاریخ</label>
                          <input 
                              type="text" 
                              value={newSessionDate}
                              onChange={e => setNewSessionDate(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-900 dark:text-white text-left"
                              dir="ltr"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">روز هفته</label>
                          <input 
                              type="text" 
                              value={newSessionDay}
                              onChange={e => setNewSessionDay(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-gray-900 dark:text-white"
                          />
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setShowNewSessionModal(false)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl">انصراف</button>
                      <button onClick={handleConfirmCreateSession} className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold shadow-lg shadow-emerald-200 dark:shadow-none">تایید و شروع</button>
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
            current === tab ? 'text-emerald-600 dark:text-emerald-400 -translate-y-1' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
    >
        <div className={`p-1 rounded-xl mb-1 ${current === tab ? 'bg-emerald-50 dark:bg-gray-700' : ''}`}>
            <Icon size={24} strokeWidth={current === tab ? 2.5 : 2} />
        </div>
        <span className="text-[10px] font-bold">{label}</span>
    </button>
);
