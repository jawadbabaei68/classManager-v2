
import React, { useState, useEffect, useRef } from 'react';
import { Classroom, Student, Session, ClassType, AttendanceStatus, GlobalSettings, StudentPerformance } from '../types';
import { updateClass, deleteClass, getSettings } from '../services/storageService';
import { formatJalaali, parseJalaaliToIso } from '../services/dateService';
import { Icons } from '../components/Icons';
import { SessionScreen } from './SessionScreen';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { exportClassReportPDF } from '../utils/exportPdf'; 

// Sub Components
import { StudentListTab, SessionListTab, GradesTab, ChartsTab } from '../components/class/ClassTabs';
import { AddStudentModal, EditStudentModal, NewSessionModal, EditClassInfoModal } from '../components/class/ClassModals';
import { StudentReportModal, FullClassReportModal } from '../components/reports/ReportViewers';
import { shareElementAsImage } from '../utils/exportUtils';
import { Button } from '../components/ui/Button';

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
  const [showIndividualReport, setShowIndividualReport] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  
  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // New/Edit Session Modal State
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionDay, setNewSessionDay] = useState('');
  const [newSessionModule, setNewSessionModule] = useState<number>(1);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

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

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      if (window.confirm("آیا از حذف این جلسه اطمینان دارید؟")) {
          const updated = { ...data, sessions: data.sessions.filter(s => s.id !== sessionId) };
          await handleUpdate(updated);
      }
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
                     phoneNumber: row[1] ? String(row[1]) : undefined 
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

  // --- Full Excel Export Logic ---
  const handleFullExport = async () => {
    try {
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

        const currentJalaaliDate = formatJalaali(new Date().toISOString()).replace(/\//g, '-');
        const safeName = data.name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
        const fileName = `${safeName}_${currentJalaaliDate}.xlsx`;
        
        if (Capacitor.isNativePlatform()) {
             const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
             
             // Save to Cache directory which is safe and usually doesn't require complex permissions
             const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: wbout,
                directory: Directory.Cache
             });

             await Share.share({
                title: 'خروجی اکسل کلاس',
                text: `گزارش کلاس ${data.name}`,
                url: savedFile.uri,
                dialogTitle: 'اشتراک‌گذاری فایل اکسل',
             });
        } else {
             XLSX.writeFile(wb, fileName);
        }

    } catch (error) {
        console.error("Excel Export Error", error);
        alert("خطا در ایجاد فایل اکسل: " + error);
    }
  };

  const handlePDFExport = async () => {
    try {
        await exportClassReportPDF(data);
    } catch (error) {
        console.error("PDF Export Error", error);
        alert("خطا در ایجاد فایل PDF. لطفاً اینترنت خود را بررسی کنید (برای دریافت فونت).");
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400; 
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          } else {
            resolve(img.src);
          }
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, studentId?: string) => {
    const file = e.target.files?.[0];
    if (file && studentId) {
      try {
        const compressedData = await compressImage(file);
        const updatedStudents = data.students.map(s => 
          s.id === studentId ? { ...s, avatarUrl: compressedData } : s
        );
        handleUpdate({ ...data, students: updatedStudents });
      } catch (error) {
        console.error("Image processing error", error);
        alert("خطا در پردازش تصویر");
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (uploadStudentId) {
          handleImageUpload(e, uploadStudentId);
      }
      e.target.value = ''; 
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
        quality: 60,
        width: 400,
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
      
      setEditingSession(null);
      setNewSessionDate(todayStr);
      setNewSessionDay(dayName);
      setNewSessionModule(1);
      setShowNewSessionModal(true);
  };

  const handleEditSession = (session: Session, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingSession(session);
      setNewSessionDate(formatJalaali(session.date));
      setNewSessionDay(session.dayOfWeek);
      setNewSessionModule(session.moduleId || 1);
      setShowNewSessionModal(true);
  };

  const handleConfirmCreateOrEditSession = () => {
    const isoDate = parseJalaaliToIso(newSessionDate);
    if (!isoDate) {
        alert("فرمت تاریخ نادرست است");
        return;
    }

    if (editingSession) {
        // Edit Mode
        const updatedSessions = data.sessions.map(s => s.id === editingSession.id ? {
            ...s,
            date: isoDate,
            dayOfWeek: newSessionDay,
            moduleId: newSessionModule
        } : s);
        
        handleUpdate({ ...data, sessions: updatedSessions });
        setEditingSession(null);
    } else {
        // Create Mode
        const newSession: Session = {
            id: Date.now().toString(),
            classId: data.id,
            moduleId: newSessionModule,
            date: isoDate,
            dayOfWeek: newSessionDay,
            records: []
        };
        setActiveSession(newSession);
    }
    setShowNewSessionModal(false);
  };

  const saveSession = (updatedSession: Session, shouldExit: boolean) => {
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

  const updateModularGrade = (studentId: string, moduleId: 1|2|3|4|5, field: 'examScore' | 'classroomPositive' | 'classroomNegative', value: number) => {
      const existingPerf = data.performance?.find(p => p.studentId === studentId);
      const perfList = data.performance?.filter(p => p.studentId !== studentId) || [];
      
      const newGrades = existingPerf ? [...existingPerf.gradesModular] : [];
      let idx = newGrades.findIndex(g => g.moduleId === moduleId);
      
      if (idx === -1) {
          newGrades.push({ moduleId, score: 0 });
          idx = newGrades.length - 1;
      }

      // Automatically calculate positive and negative points from session records
      let calculatedPos = 0;
      let calculatedNeg = 0;
      data.sessions.forEach(sess => {
          const sModule = sess.moduleId || 1; 
          
          if (sModule === moduleId) {
              const rec = sess.records.find(r => r.studentId === studentId);
              if (rec) {
                  calculatedPos += rec.positivePoints || 0;
                  if (rec.discipline.sleep) calculatedNeg += 0.5;
                  if (rec.discipline.badBehavior) calculatedNeg += 0.5;
                  if (rec.discipline.expelled) calculatedNeg += 1;
              }
          }
      });

      const currentGrade = newGrades[idx];
      const updatedGrade = { ...currentGrade };

      if (field === 'examScore') {
          updatedGrade.examScore = isNaN(value) ? undefined : value;
      }

      updatedGrade.classroomPositive = calculatedPos;
      updatedGrade.classroomNegative = calculatedNeg;

      const exam = updatedGrade.examScore || 0;
      updatedGrade.score = exam + calculatedPos - calculatedNeg;

      newGrades[idx] = updatedGrade;

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

  if (activeSession) {
    return (
        <SessionScreen 
            session={activeSession}
            students={data.students}
            allSessions={data.sessions}
            resource={data.resources.mainFile}
            onUpdate={(updatedSession, shouldExit) => saveSession(updatedSession, shouldExit)}
            classType={data.type}
        />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-vazir pb-20 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-b-3xl shadow-sm border-b border-gray-100 dark:border-gray-700 sticky top-0 z-40">
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
        {currentTab === 'STUDENTS' && (
            <StudentListTab 
                students={data.students}
                setSelectedStudentForReport={setSelectedStudentForReport}
                setShowIndividualReport={setShowIndividualReport}
                triggerProfileImagePicker={triggerProfileImagePicker}
                handleEditStudent={handleEditStudent}
                handleDeleteStudent={handleDeleteStudent}
            />
        )}

        {currentTab === 'SESSIONS' && (
            <SessionListTab 
                sessions={data.sessions}
                classType={data.type} 
                setActiveSession={setActiveSession}
                deleteSession={deleteSession}
                onEditSession={handleEditSession} // Pass the edit handler
            />
        )}

        {currentTab === 'GRADES' && (
             <GradesTab 
                data={data}
                updateModularGrade={updateModularGrade}
                updateTermGrade={updateTermGrade}
             />
        )}

        {currentTab === 'CHARTS' && (
            <ChartsTab 
                setShowClassReport={setShowClassReport}
                handleFullExport={handleFullExport}
                handlePDFExport={handlePDFExport}
            />
        )}
      </div>

      {/* Floating Action Button (Only for Sessions and Students) */}
      {(currentTab === 'SESSIONS' || currentTab === 'STUDENTS') && (
          <Button 
            onClick={currentTab === 'SESSIONS' ? openSessionModal : () => setShowAddStudent(true)}
            className="fixed bottom-6 left-6 z-20 shadow-xl shadow-emerald-500/30 !bg-emerald-600 !text-white !opacity-100 hover:!bg-emerald-700 active:!scale-95 border-2 border-white dark:border-gray-800"
            variant="primary"
            size="lg"
          >
            {currentTab === 'SESSIONS' ? 'جلسه جدید' : 'دانش‌آموز جدید'}
          </Button>
      )}

      {/* Modals */}
      <AddStudentModal 
        isOpen={showAddStudent} 
        onClose={() => setShowAddStudent(false)} 
        newStudentName={newStudentName}
        setNewStudentName={setNewStudentName}
        newStudentPhone={newStudentPhone}
        setNewStudentPhone={setNewStudentPhone}
        handleExcelImport={handleExcelImport}
        addStudent={addStudent}
      />
      
      <EditStudentModal 
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        newStudentName={newStudentName}
        setNewStudentName={setNewStudentName}
        newStudentPhone={newStudentPhone}
        setNewStudentPhone={setNewStudentPhone}
        saveEditedStudent={saveEditedStudent}
      />

      <NewSessionModal 
        isOpen={showNewSessionModal}
        onClose={() => setShowNewSessionModal(false)}
        newSessionDate={newSessionDate}
        setNewSessionDate={setNewSessionDate}
        newSessionDay={newSessionDay}
        newSessionModule={newSessionModule}
        setNewSessionModule={setNewSessionModule}
        classType={data.type}
        handleConfirmCreateSession={handleConfirmCreateOrEditSession}
        isEditing={!!editingSession}
      />

      <EditClassInfoModal 
        isOpen={showEditClassInfo}
        onClose={() => setShowEditClassInfo(false)}
        editClassName={editClassName}
        setEditClassName={setEditClassName}
        editBookName={editBookName}
        setEditBookName={setEditBookName}
        handleEditClassInfo={handleEditClassInfo}
        handleDeleteClass={handleDeleteClass}
      />

      {showClassReport && (
        <FullClassReportModal 
            classroom={data} 
            onClose={() => setShowClassReport(false)} 
            shareReportAsImage={shareElementAsImage} 
        />
      )}
      
      {showIndividualReport && selectedStudentForReport && (
        <StudentReportModal 
            student={selectedStudentForReport}
            classroom={data}
            onClose={() => setShowIndividualReport(false)}
            shareReportAsImage={shareElementAsImage}
        />
      )}
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileInputChange} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
};
