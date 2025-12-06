import React, { useState, useEffect, useRef } from 'react';
import { Classroom, ClassType, AIResource, GlobalSettings, BackupPayload, Student, AttendanceStatus, CustomReport, CustomReportRow } from '../types';
import { getClasses, saveClass, restoreData, getSettings, saveSettings, updateClass, getCustomReports, saveCustomReport, deleteCustomReport } from '../services/storageService';
import { testConnection, generateSQLSchema, syncData, fullBackupToCloud } from '../services/supabaseService';
import { formatJalaali } from '../services/dateService';
import { Icons } from '../components/Icons';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';

// Sub Components
import { DashboardTiles } from '../components/home/DashboardTiles';
import { ClassList } from '../components/home/ClassList';
import { AbsenteesModalFull, StatsModal, SearchModal, BackupModal, RestoreModal, SyncProgressModal, ClassReportSelectModal } from '../components/home/HomeModals';
import { SettingsModal } from '../components/settings/SettingsModal';
import { CustomReportHub } from '../components/reports/CustomReportHub';
import { StudentReportModal, FullClassReportModal } from '../components/reports/ReportViewers';
import { shareElementAsImage } from '../utils/exportUtils';

interface HomeScreenProps {
  onSelectClass: (c: Classroom) => void;
  isAuthenticated: boolean;
  onLoginSuccess: () => void;
  onLogout: () => void;
}

const normalizeInput = (str: string | undefined) => {
    if (!str) return '';
    return str
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .trim();
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectClass, isAuthenticated, onLoginSuccess, onLogout }) => {
  // Data State
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Classroom[]>([]);
  const [customReports, setCustomReports] = useState<CustomReport[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View State
  const [viewMode, setViewMode] = useState<'dashboard' | 'classes'>('dashboard');

  // Auth UI State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showAbsenteesModal, setShowAbsenteesModal] = useState(false);

  // New Feature States
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedStudentReport, setSelectedStudentReport] = useState<{student: Student, classroom: Classroom} | null>(null);
  const [showClassReportSelect, setShowClassReportSelect] = useState(false);
  const [selectedClassForReport, setSelectedClassForReport] = useState<Classroom | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  
  // Stats Modal State
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Custom Report Modal State
  const [showReportHub, setShowReportHub] = useState(false);
  const [reportStep, setReportStep] = useState<'list' | 'create_name' | 'create_class' | 'editor'>('list');
  const [newReportName, setNewReportName] = useState('');
  const [activeReport, setActiveReport] = useState<CustomReport | null>(null);
  const [activeReportClass, setActiveReportClass] = useState<Classroom | null>(null);

  // Cloud & Sync State
  const [cloudStatus, setCloudStatus] = useState<'online' | 'offline' | 'error'>('offline');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Sync Progress Modal State
  const [syncProgress, setSyncProgress] = useState<{show: boolean, msg: string, percent: number}>({ show: false, msg: '', percent: 0 });
  
  // Edit Class State
  const [editingClass, setEditingClass] = useState<Classroom | null>(null);
  
  // Restore State
  const [restoreState, setRestoreState] = useState<{
      stage: 'idle' | 'reading' | 'parsing' | 'confirming' | 'restoring' | 'success' | 'error';
      message?: string;
      progress?: number;
      pendingData?: any;
  }>({ stage: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Settings State
  const [settings, setSettings] = useState<GlobalSettings>(() => {
     const localTheme = localStorage.getItem('theme_pref') as 'light' | 'dark' | null;
     const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
     
     return {
        teacherName: '', 
        username: '',
        password: '',
        currentAcademicYear: '1403-1404',
        availableYears: ['1403-1404'],
        theme: localTheme || (systemDark ? 'dark' : 'light'),
        supabaseUrl: '',
        supabaseKey: ''
     };
  });
  
  const [newClassName, setNewClassName] = useState('');
  const [newBookName, setNewBookName] = useState('');
  const [newClassType, setNewClassType] = useState<ClassType>(ClassType.MODULAR);
  const [attachedFile, setAttachedFile] = useState<AIResource | undefined>(undefined);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    initialize();
  }, [isAuthenticated]); 

  // Theme Listener: Auto switch based on system if no manual pref
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        if (!localStorage.getItem('theme_pref')) {
            const newTheme = e.matches ? 'dark' : 'light';
            setSettings(prev => ({ ...prev, theme: newTheme }));
            if (newTheme === 'dark') document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    // Initial check if no pref
    if (!localStorage.getItem('theme_pref')) {
         const systemDark = mediaQuery.matches;
         const theme = systemDark ? 'dark' : 'light';
         if (settings.theme !== theme) {
             setSettings(prev => ({...prev, theme}));
         }
    }

    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  useEffect(() => {
    if (settings.currentAcademicYear) {
      setFilteredClasses(classes.filter(c => c.academicYear === settings.currentAcademicYear));
    } else {
      setFilteredClasses([]);
    }
  }, [settings.currentAcademicYear, classes]);

  useEffect(() => {
      const checkConn = async () => {
          if (!settings.supabaseUrl || !settings.supabaseKey) {
              setCloudStatus('offline');
              return;
          }
          const res = await testConnection(settings.supabaseUrl, settings.supabaseKey);
          setCloudStatus(res.success ? 'online' : 'error');
      };

      if (isAuthenticated) {
          checkConn();
          const interval = setInterval(checkConn, 10000);
          return () => clearInterval(interval);
      }
  }, [isAuthenticated, settings.supabaseUrl, settings.supabaseKey]);

  const initialize = async () => {
    setLoading(true);
    const savedSettings = await getSettings();
    
    if (savedSettings) {
      const localTheme = localStorage.getItem('theme_pref');
      if (localTheme) {
          savedSettings.theme = localTheme as 'light' | 'dark';
      } else {
          savedSettings.theme = settings.theme;
      }

      setSettings(savedSettings);

      if (!savedSettings.password) {
          setShowSetupModal(true);
      } else if (!isAuthenticated) {
          setShowLoginModal(true);
      } else {
          setShowLoginModal(false);
          setShowSetupModal(false);
      }
    } else {
      setShowSetupModal(true);
    }
    
    const data = await getClasses();
    setClasses(data);
    const reports = await getCustomReports();
    setCustomReports(reports);
    setLoading(false);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const inputNorm = normalizeInput(loginPassword);
      const storedNorm = normalizeInput(settings.password);
      
      if (inputNorm === storedNorm) {
          setShowLoginModal(false);
          setLoginError('');
          setLoginPassword('');
          onLoginSuccess(); 
      } else {
          setLoginError('رمز عبور اشتباه است');
      }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.teacherName || !settings.currentAcademicYear || !settings.password || !settings.username) {
      alert("لطفاً تمامی فیلدها را پر کنید.");
      return;
    }
    
    const newSettings: GlobalSettings = {
        ...settings,
        username: normalizeInput(settings.username),
        password: normalizeInput(settings.password),
        availableYears: settings.availableYears.length > 0 ? settings.availableYears : [settings.currentAcademicYear],
        theme: settings.theme || 'light'
    };
    
    await saveSettings(newSettings);
    setSettings(newSettings);
    setShowSetupModal(false);
    onLoginSuccess(); 
  };

  const handleSyncNow = async () => {
      if (cloudStatus !== 'online') {
          const conn = await testConnection(settings.supabaseUrl || '', settings.supabaseKey || '');
          if (!conn.success) {
            alert("اتصال به سرور برقرار نیست.");
            return;
          }
      }
      
      setIsSyncing(true);
      setSyncProgress({ show: true, msg: 'شروع همگام‌سازی...', percent: 0 });
      
      const res = await syncData((msg) => {
          setSyncProgress(prev => ({ ...prev, msg: msg }));
      });
      
      setIsSyncing(false);
      setSyncProgress({ show: false, msg: '', percent: 0 });
      
      alert(res.message);
      if (res.success) {
          const updated = await getClasses();
          setClasses(updated);
      }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    
    localStorage.setItem('theme_pref', newTheme);
    
    const updatedSettings = { ...settings, theme: newTheme };
    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
  };

  const processFile = async (file: File): Promise<AIResource> => {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1024; 
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_WIDTH) {
              height = Math.round(height * (MAX_WIDTH / width));
              width = MAX_WIDTH;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve({
                    name: file.name,
                    mimeType: 'image/jpeg',
                    data: dataUrl.split(',')[1]
                });
            } else {
                reject(new Error("Canvas context failed"));
            }
          };
          img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const res = e.target?.result as string;
            resolve({
                name: file.name,
                mimeType: file.type,
                data: res.split(',')[1]
            });
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        alert("حجم فایل انتخاب شده زیاد است. لطفاً فایلی کمتر از ۲۰ مگابایت انتخاب کنید.");
        e.target.value = ''; 
        return;
      }
      setIsProcessingFile(true);
      try {
        const resource = await processFile(file);
        setAttachedFile(resource);
      } catch (error) {
        console.error("File processing error:", error);
        alert("خطا در پردازش فایل.");
        e.target.value = '';
      } finally {
        setIsProcessingFile(false);
      }
    }
  };

  const handleCreateOrUpdateClass = async () => {
    if (!newClassName.trim() || !newBookName.trim()) return;
    setIsSaving(true);
    try {
      if (editingClass) {
          const updatedClass: Classroom = {
              ...editingClass,
              name: newClassName,
              bookName: newBookName,
              type: newClassType,
              resources: attachedFile ? { ...editingClass.resources, mainFile: attachedFile } : editingClass.resources,
              updatedAt: Date.now()
          };
          await updateClass(updatedClass);
      } else {
          const newClass: Classroom = {
            id: Date.now().toString(),
            name: newClassName,
            bookName: newBookName,
            academicYear: settings.currentAcademicYear,
            type: newClassType,
            students: [],
            sessions: [],
            performance: [],
            resources: { 
              lessonPlans: [],
              mainFile: attachedFile 
            },
            updatedAt: Date.now()
          };
          await saveClass(newClass);
      }

      const updatedClasses = await getClasses();
      setClasses(updatedClasses);
      resetForm();
    } catch (error) {
      console.error("Storage error:", error);
      alert("خطا در ذخیره کلاس. ممکن است حجم فایل بسیار زیاد باشد.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditClassModal = (cls: Classroom, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingClass(cls);
      setNewClassName(cls.name);
      setNewBookName(cls.bookName);
      setNewClassType(cls.type);
      setAttachedFile(undefined);
      setShowModal(true);
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingClass(null);
    setNewClassName('');
    setNewBookName('');
    setAttachedFile(undefined);
    setNewClassType(ClassType.MODULAR);
  };
  
  const handleBackup = async () => {
    try {
        const currentSettings = await getSettings();
        const reports = await getCustomReports();
        const optimizedClasses = classes.map(cls => {
             const newResources = { ...cls.resources, lessonPlans: [] as string[] };
             if (newResources.mainFile && newResources.mainFile.data.length > 5 * 1024 * 1024) {
                 newResources.mainFile = undefined; 
             }
             return { ...cls, resources: newResources };
        });

        const payload: BackupPayload = {
            meta: {
                version: '2.0',
                date: new Date().toISOString(),
                app: 'ClassManagerPro'
            },
            classes: optimizedClasses,
            settings: currentSettings || settings,
            customReports: reports
        };
        
        const dataStr = JSON.stringify(payload);
        const fileName = `backup_full_${new Date().toISOString().slice(0,10).replace(/-/g, '')}.json`;

        if (Capacitor.isNativePlatform()) {
            await Filesystem.writeFile({
                path: fileName,
                data: dataStr,
                directory: Directory.Cache,
                encoding: Encoding.UTF8,
            });

            const uriResult = await Filesystem.getUri({
                directory: Directory.Cache,
                path: fileName,
            });

            await Share.share({
                title: 'پشتیبان‌گیری مدیریت کلاس',
                text: 'فایل پشتیبان کامل (اطلاعات و تنظیمات)',
                url: uriResult.uri,
                dialogTitle: 'ذخیره فایل پشتیبان',
            });
        } else {
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const linkElement = document.createElement("a");
            linkElement.setAttribute("href", dataUri);
            linkElement.setAttribute("download", fileName);
            document.body.appendChild(linkElement);
            linkElement.click();
            document.body.removeChild(linkElement);
        }
    } catch (error) {
        console.error("Backup error:", error);
        alert("خطا در ایجاد فایل پشتیبان: " + error);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreState({ stage: 'reading', progress: 10 });

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        setRestoreState({ stage: 'parsing', progress: 30 });
        
        await new Promise(r => setTimeout(r, 100));

        const parsedData = JSON.parse(json);
        
        let isValid = false;
        let count = 0;
        
        if (Array.isArray(parsedData)) {
            isValid = true;
            count = parsedData.length;
        } else if (parsedData && parsedData.classes && Array.isArray(parsedData.classes)) {
            isValid = true;
            count = parsedData.classes.length;
        }

        if (!isValid) {
            setRestoreState({ stage: 'error', message: 'فرمت فایل معتبر نیست.' });
            return;
        }

        setRestoreState({ 
            stage: 'confirming', 
            progress: 50, 
            pendingData: parsedData,
            message: `آیا از بازگردانی ${count} کلاس اطمینان دارید؟ تمامی اطلاعات فعلی حذف خواهند شد.`
        });

      } catch (error: any) {
        console.error("Restore parse error:", error);
        setRestoreState({ stage: 'error', message: 'خطا در خواندن فایل: ' + error.message });
      } finally {
        e.target.value = '';
      }
    };

    reader.onerror = () => {
        setRestoreState({ stage: 'error', message: 'خطا در باز کردن فایل.' });
        e.target.value = '';
    };

    reader.readAsText(file);
  };

  const confirmRestore = async () => {
      if (!restoreState.pendingData) return;
      
      try {
          setRestoreState({ stage: 'restoring', progress: 70, message: 'در حال بازنویسی اطلاعات...' });
          
          await new Promise(r => setTimeout(r, 100));

          await restoreData(restoreState.pendingData);
          
          setRestoreState({ stage: 'restoring', progress: 90, message: 'در حال بارگذاری مجدد...' });

          const updatedClasses = await getClasses();
          const updatedSettings = await getSettings();
          const updatedReports = await getCustomReports();
          
          setClasses(updatedClasses);
          setCustomReports(updatedReports);
          
          if (updatedSettings) {
             setSettings(updatedSettings);
             if (updatedSettings.theme) {
                 handleThemeChange(updatedSettings.theme);
             }
          }
          
          setRestoreState({ stage: 'success', progress: 100, message: 'عملیات با موفقیت انجام شد.' });
          
          setTimeout(() => {
              setRestoreState({ stage: 'idle' });
              setShowSettingsModal(false);
              setShowBackupModal(false);
              
              if (updatedSettings?.password) {
                  onLogout(); 
              } else if (updatedSettings?.teacherName) {
                  setShowSetupModal(false);
                  onLoginSuccess();
              } else {
                  setShowSetupModal(true);
              }
          }, 1500);

      } catch (error: any) {
          console.error("Restore DB error:", error);
          setRestoreState({ stage: 'error', message: 'خطا در دیتابیس: ' + error.message });
      }
  };

  const cancelRestore = () => {
      setRestoreState({ stage: 'idle' });
  };

  // --- Daily Absentees Feature ---
  const handleAbsenteesExport = async () => {
      try {
        const todayJalaali = formatJalaali(new Date().toISOString());
        const absenteesList: any[] = [];
        
        classes.forEach(cls => {
            cls.sessions.forEach(sess => {
                if (formatJalaali(sess.date) === todayJalaali) {
                    sess.records.forEach(rec => {
                        if (rec.attendance === 'ABSENT') {
                            const student = cls.students.find(s => s.id === rec.studentId);
                            if (student) {
                                absenteesList.push({
                                    student,
                                    className: cls.name,
                                    bookName: cls.bookName,
                                    session: sess
                                });
                            }
                        }
                    });
                }
            });
        });

        const wb = XLSX.utils.book_new();
          const wsData = [
              ["نام دانش‌آموز", "کلاس", "شماره تماس", "وضعیت", "تاریخ"]
          ];
          
          absenteesList.forEach(item => {
              wsData.push([
                  item.student.name,
                  item.className,
                  item.student.phoneNumber || "-",
                  "غایب",
                  todayJalaali
              ]);
          });
          
          const ws = XLSX.utils.aoa_to_sheet(wsData);
          ws['!views'] = [{ rightToLeft: true }];
          XLSX.utils.book_append_sheet(wb, ws, "غایبین روزانه");
          
          const fileName = `Absentees_${todayJalaali.replace(/\//g, '-')}.xlsx`;
          
          if (Capacitor.isNativePlatform()) {
               const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
               const savedFile = await Filesystem.writeFile({
                  path: fileName,
                  data: wbout,
                  directory: Directory.Cache
               });
               await Share.share({
                  title: 'لیست غایبین امروز',
                  url: savedFile.uri,
               });
          } else {
               XLSX.writeFile(wb, fileName);
          }
      } catch (error) {
          console.error("Export Error", error);
          alert("خطا در ایجاد خروجی اکسل.");
      }
  };
  
  // --- Custom Reports Logic ---
  const handleStartCreateReport = () => {
    setReportStep('create_name');
    setNewReportName('');
  };

  const handleReportNameSubmit = () => {
    if (!newReportName.trim()) return;
    setReportStep('create_class');
  };

  const handleSelectClassForReport = (cls: Classroom) => {
    // Initialize blank report rows
    const rows: CustomReportRow[] = cls.students.map(s => ({
        studentId: s.id,
        col1: '',
        col2: '',
        comment: ''
    }));

    const newReport: CustomReport = {
        id: Date.now().toString(),
        title: newReportName,
        classId: cls.id,
        className: cls.name,
        date: new Date().toISOString(),
        rows: rows,
        updatedAt: Date.now()
    };
    
    setActiveReport(newReport);
    setActiveReportClass(cls);
    setReportStep('editor');
  };

  const handleOpenExistingReport = (report: CustomReport) => {
    const cls = classes.find(c => c.id === report.classId);
    if (cls) {
        setActiveReport(report);
        setActiveReportClass(cls);
        setReportStep('editor');
    } else {
        alert("کلاس مربوط به این گزارش حذف شده است.");
    }
  };

  const handleSaveReport = async () => {
    if (activeReport) {
        await saveCustomReport(activeReport);
        const allReports = await getCustomReports();
        setCustomReports(allReports);
        alert('گزارش ذخیره شد.');
    }
  };

  const handleDeleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('آیا از حذف این گزارش مطمئن هستید؟')) {
        await deleteCustomReport(id);
        setCustomReports(prev => prev.filter(r => r.id !== id));
    }
  };

  const updateReportRow = (studentId: string, field: keyof CustomReportRow, value: string) => {
      if (!activeReport) return;
      
      const updatedRows = activeReport.rows.map(r => 
        r.studentId === studentId ? { ...r, [field]: value } : r
      );
      
      setActiveReport({ ...activeReport, rows: updatedRows });
  };

  const handleExportReportExcel = async () => {
      if (!activeReport || !activeReportClass) return;
      try {
          const wb = XLSX.utils.book_new();
          const wsData = [
              ["نام دانش‌آموز", "نمره/مورد ۱", "نمره/مورد ۲", "توضیحات"]
          ];
          
          activeReport.rows.forEach(row => {
              const student = activeReportClass?.students.find(s => s.id === row.studentId);
              if (student) {
                  wsData.push([
                      student.name,
                      row.col1,
                      row.col2,
                      row.comment
                  ]);
              }
          });
          
          const ws = XLSX.utils.aoa_to_sheet(wsData);
          ws['!views'] = [{ rightToLeft: true }];
          XLSX.utils.book_append_sheet(wb, ws, "گزارش");
          
          const currentJalaaliDate = formatJalaali(new Date().toISOString()).replace(/\//g, '-');
          const safeClassName = activeReportClass.name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
          const safeTitle = activeReport.title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
          const fileName = `${safeClassName}_${safeTitle}_${currentJalaaliDate}.xlsx`;
          
          if (Capacitor.isNativePlatform()) {
               const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
               const savedFile = await Filesystem.writeFile({
                  path: fileName,
                  data: wbout,
                  directory: Directory.Cache
               });
               await Share.share({
                  title: activeReport.title,
                  url: savedFile.uri,
               });
          } else {
               XLSX.writeFile(wb, fileName);
          }
      } catch (error) {
          console.error("Export Error", error);
          alert("خطا در ایجاد خروجی اکسل.");
      }
  };

  if (!isAuthenticated && !loading) {
      return (
        <div className="min-h-screen bg-emerald-50 dark:bg-gray-900 font-vazir flex items-center justify-center p-4">
            <RestoreModal restoreState={restoreState} onConfirm={confirmRestore} onCancel={cancelRestore} />
            {/* Setup Modal */}
            {showSetupModal && (
                <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-8 shadow-2xl">
                    <form onSubmit={handleSetupSubmit} className="space-y-4">
                        <h2 className="text-2xl font-black text-gray-900 text-center dark:text-white mb-6">راه‌اندازی اولیه</h2>
                        <input 
                            type="text" required placeholder="نام دبیر"
                            value={settings.teacherName} onChange={e => setSettings({...settings, teacherName: e.target.value})}
                            className="w-full bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl p-3"
                        />
                        <input 
                            type="text" required placeholder="نام کاربری"
                            value={settings.username} onChange={e => setSettings({...settings, username: e.target.value})}
                            className="w-full bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl p-3"
                        />
                        <input 
                            type="password" required placeholder="رمز عبور"
                            value={settings.password} onChange={e => setSettings({...settings, password: e.target.value})}
                            className="w-full bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl p-3"
                            dir="ltr"
                        />
                        <input 
                            type="text" required placeholder="سال تحصیلی (1404-1405)"
                            value={settings.currentAcademicYear} onChange={e => setSettings({...settings, currentAcademicYear: e.target.value})}
                            className="w-full bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl p-3 text-left"
                            dir="ltr"
                        />
                        <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold mt-4">شروع</button>
                        {/* <button type="button" onClick={handleRestoreClick} className="w-full text-emerald-600 text-sm font-bold mt-2">بازیابی اطلاعات</button> */}
                    </form>
                </div>
            )}
            
            {showLoginModal && !showSetupModal && (
                <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in">
                    <div className="text-center mb-6">
                        <Icons.Lock size={32} className="mx-auto text-emerald-600 mb-4" />
                        <h2 className="text-xl font-black text-gray-900 dark:text-white">خوش آمدید</h2>
                        <p className="text-emerald-700 font-bold">{settings.teacherName}</p>
                    </div>
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                        <input 
                            type="password" autoFocus placeholder="رمز عبور"
                            value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl p-3 text-center tracking-widest"
                            dir="ltr"
                        />
                        {loginError && <p className="text-red-500 text-xs text-center">{loginError}</p>}
                        <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">ورود</button>
                    </form>
                </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleRestoreFile} className="hidden" />
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 font-vazir transition-colors duration-300">
      <RestoreModal restoreState={restoreState} onConfirm={confirmRestore} onCancel={cancelRestore} />
      <SyncProgressModal show={syncProgress.show} msg={syncProgress.msg} />
      <AbsenteesModalFull isOpen={showAbsenteesModal} onClose={() => setShowAbsenteesModal(false)} classes={classes} onExport={handleAbsenteesExport} />
      <SearchModal isOpen={showSearchModal} onClose={() => setShowSearchModal(false)} classes={classes} onSelect={(d) => setSelectedStudentReport(d)} />
      <StudentReportModal 
        student={selectedStudentReport?.student || null} 
        classroom={selectedStudentReport?.classroom || null} 
        onClose={() => setSelectedStudentReport(null)} 
        shareReportAsImage={shareElementAsImage}
        onSelectClass={(cls) => {
            setSelectedStudentReport(null);
            setShowSearchModal(false);
            onSelectClass(cls);
        }}
      />
      <ClassReportSelectModal isOpen={showClassReportSelect} onClose={() => setShowClassReportSelect(false)} classes={classes} onSelect={(c) => setSelectedClassForReport(c)} />
      <FullClassReportModal classroom={selectedClassForReport} onClose={() => setSelectedClassForReport(null)} shareReportAsImage={shareElementAsImage} />
      <BackupModal isOpen={showBackupModal} onClose={() => setShowBackupModal(false)} onBackup={handleBackup} onRestoreClick={handleRestoreClick} />
      <StatsModal isOpen={showStatsModal} onClose={() => setShowStatsModal(false)} classes={classes} currentAcademicYear={settings.currentAcademicYear} />
      
      <CustomReportHub 
        isOpen={showReportHub} 
        onClose={() => setShowReportHub(false)} 
        reportStep={reportStep} 
        setReportStep={setReportStep} 
        customReports={customReports} 
        classes={classes} 
        activeReport={activeReport} 
        activeReportClass={activeReportClass} 
        newReportName={newReportName} 
        setNewReportName={setNewReportName}
        handleStartCreateReport={handleStartCreateReport}
        handleReportNameSubmit={handleReportNameSubmit}
        handleSelectClassForReport={handleSelectClassForReport}
        handleOpenExistingReport={handleOpenExistingReport}
        handleDeleteReport={handleDeleteReport}
        handleSaveReport={handleSaveReport}
        handleExportReportExcel={handleExportReportExcel}
        shareReportAsImage={shareElementAsImage}
        updateReportRow={updateReportRow}
      />
      
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
        settings={settings} 
        setSettings={setSettings} 
        cloudStatus={cloudStatus} 
        generateSQLSchema={generateSQLSchema} 
        testConnection={testConnection} 
        saveSettings={saveSettings} 
        handleThemeChange={handleThemeChange} 
        fullBackupToCloud={fullBackupToCloud} 
        setIsSyncing={setIsSyncing} 
        setSyncProgress={setSyncProgress} 
      />

      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-10 px-6 py-5 shadow-sm border-b border-gray-100 dark:border-gray-700 transition-all">
        <div className="flex justify-between items-center relative h-8">
          
          <div className="z-10 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full shadow-sm ${
                cloudStatus === 'online' ? 'bg-green-500 shadow-green-400/50' : 
                cloudStatus === 'error' ? 'bg-red-500 shadow-red-400/50' : 'bg-gray-400'
            }`} title={cloudStatus === 'online' ? 'متصل به سرور' : 'آفلاین'}></div>
            
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Icons.Users size={16} />
                </div>
                <div className="hidden md:block">
                     <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">خوش آمدید</p>
                     <p className="text-xs font-black text-emerald-800 dark:text-emerald-400">{settings.teacherName}</p>
                </div>
            </div>
            
            {cloudStatus === 'online' && (
                <button 
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className="mr-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    title="همگام‌سازی با سرور"
                >
                    <Icons.Upload size={16} className={`${isSyncing ? 'animate-bounce' : ''}`} />
                </button>
            )}
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
             <div className="bg-emerald-50 dark:bg-gray-700 border border-emerald-100 dark:border-gray-600 text-emerald-700 dark:text-emerald-300 text-[11px] md:text-xs font-black px-3 py-1.5 rounded-2xl shadow-sm flex items-center gap-1.5 select-none">
                <Icons.Calendar size={12} className="text-emerald-500 dark:text-emerald-400 opacity-80"/>
                <span className="pt-0.5">{settings.currentAcademicYear}</span>
             </div>
          </div>

          <div className="z-10 flex gap-2">
             <button onClick={onLogout} className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-400 hover:text-red-600">
                <Icons.LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4">
        {loading ? (
             <div className="flex justify-center pt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
        ) : viewMode === 'dashboard' ? (
            <DashboardTiles 
              setViewMode={setViewMode}
              setShowAbsenteesModal={setShowAbsenteesModal}
              setShowStatsModal={setShowStatsModal}
              setShowSearchModal={setShowSearchModal}
              setShowReportHub={setShowReportHub}
              setShowBackupModal={setShowBackupModal}
              setShowSettingsModal={setShowSettingsModal}
              setReportStep={setReportStep}
            />
        ) : (
            <ClassList 
              classes={classes}
              filteredClasses={filteredClasses}
              academicYear={settings.currentAcademicYear}
              setViewMode={setViewMode}
              onSelectClass={onSelectClass}
              openEditClassModal={openEditClassModal}
              setShowModal={setShowModal}
            />
        )}
      </div>

      {viewMode === 'classes' && (
          <button onClick={() => setShowModal(true)} className="fixed bottom-8 left-8 bg-emerald-600 text-white p-4 rounded-2xl shadow-xl hover:scale-105 transition-all z-20 flex items-center gap-2">
            <Icons.Plus className="w-6 h-6" /> <span className="font-bold text-sm hidden md:inline">کلاس جدید</span>
          </button>
      )}

      {/* Add Class Modal - Still simple enough to keep inline or extract if very strict */}
      {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-6">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">{editingClass ? 'ویرایش کلاس' : 'کلاس جدید'}</h3>
                  <input type="text" placeholder="نام کلاس" value={newClassName} onChange={e=>setNewClassName(e.target.value)} className="w-full mb-3 p-3 rounded-xl border dark:bg-gray-700 dark:text-white dark:border-gray-600 text-gray-900"/>
                  <input type="text" placeholder="نام درس" value={newBookName} onChange={e=>setNewBookName(e.target.value)} className="w-full mb-3 p-3 rounded-xl border dark:bg-gray-700 dark:text-white dark:border-gray-600 text-gray-900"/>
                  <div className="flex gap-2 mb-3">
                      <button onClick={()=>setNewClassType(ClassType.MODULAR)} className={`flex-1 p-2 rounded-lg border ${newClassType===ClassType.MODULAR?'bg-purple-50 border-purple-500 text-purple-700':'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>پودمانی</button>
                      <button onClick={()=>setNewClassType(ClassType.TERM)} className={`flex-1 p-2 rounded-lg border ${newClassType===ClassType.TERM?'bg-orange-50 border-orange-500 text-orange-700':'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>ترمی</button>
                  </div>
                  <div className="relative mb-4 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
                      <input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} className="absolute inset-0 opacity-0"/>
                      <span className="text-xs text-gray-500">{attachedFile ? attachedFile.name : 'انتخاب منبع (PDF/Image)'}</span>
                      {isProcessingFile && <div className="h-1 bg-emerald-500 w-full mt-2"></div>}
                  </div>
                  <div className="flex gap-3">
                      <button onClick={resetForm} className="flex-1 py-3 text-gray-500">انصراف</button>
                      <button onClick={handleCreateOrUpdateClass} disabled={isSaving} className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-bold">{isSaving?'در حال ذخیره...':'ذخیره'}</button>
                  </div>
              </div>
          </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleRestoreFile} className="hidden" />
    </div>
  );
};