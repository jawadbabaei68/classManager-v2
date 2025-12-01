
import React, { useState, useEffect, useRef } from 'react';
import { Classroom, ClassType, AIResource, GlobalSettings, BackupPayload, Student, AttendanceStatus, CustomReport, CustomReportRow } from '../types';
import { getClasses, saveClass, restoreData, getSettings, saveSettings, updateClass, getCustomReports, saveCustomReport, deleteCustomReport } from '../services/storageService';
import { getSupabaseClient, testConnection, generateSQLSchema, syncData, fullBackupToCloud } from '../services/supabaseService';
import { formatJalaali } from '../services/dateService';
import { Icons } from '../components/Icons';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, CartesianGrid, LabelList, YAxis } from 'recharts';
import html2canvas from 'html2canvas';

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
  const [expandedSection, setExpandedSection] = useState<'profile' | 'cloud' | 'data' | 'theme' | 'year' | null>(null);

  // New Feature States
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchClassFilter, setSearchClassFilter] = useState('');
  const [selectedStudentReport, setSelectedStudentReport] = useState<{student: Student, classroom: Classroom} | null>(null);
  const [showClassReportSelect, setShowClassReportSelect] = useState(false);
  const [selectedClassForReport, setSelectedClassForReport] = useState<Classroom | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  
  // Stats Modal State
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsTab, setStatsTab] = useState<'absent' | 'sleep' | 'discipline' | 'expelled'>('absent');

  // Custom Report Modal State
  const [showReportHub, setShowReportHub] = useState(false);
  const [reportStep, setReportStep] = useState<'list' | 'create_name' | 'create_class' | 'editor'>('list');
  const [newReportName, setNewReportName] = useState('');
  const [activeReport, setActiveReport] = useState<CustomReport | null>(null);
  const [activeReportClass, setActiveReportClass] = useState<Classroom | null>(null);

  // Cloud & Sync State
  const [cloudStatus, setCloudStatus] = useState<'online' | 'offline' | 'error'>('offline');
  const [isSyncing, setIsSyncing] = useState(false);
  const [testConnMsg, setTestConnMsg] = useState('');
  const [showSchema, setShowSchema] = useState(false);
  
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
  
  const [newYearInput, setNewYearInput] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newBookName, setNewBookName] = useState('');
  const [newClassType, setNewClassType] = useState<ClassType>(ClassType.MODULAR);
  const [attachedFile, setAttachedFile] = useState<AIResource | undefined>(undefined);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    initialize();
  }, [isAuthenticated]); 

  // Theme Listener: Auto switch based on system if no manual pref
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        // Only auto-switch if user hasn't manually set a preference in this session/storage
        // We check localStorage for explicit override.
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

  const toggleSection = (section: typeof expandedSection) => {
      setExpandedSection(expandedSection === section ? null : section);
  };

  const handleUpdateProfile = async () => {
      if (!settings.teacherName || !settings.username || !settings.password) {
          alert("فیلدها نباید خالی باشند.");
          return;
      }
      const updatedSettings = {
          ...settings,
          username: normalizeInput(settings.username),
          password: normalizeInput(settings.password)
      };
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
      alert("مشخصات کاربری به‌روزرسانی شد.");
  };

  const handleTestConnection = async () => {
      setTestConnMsg('در حال تست...');
      if (!settings.supabaseUrl || !settings.supabaseKey) {
          setTestConnMsg('لطفاً URL و Key را وارد کنید.');
          return;
      }
      const res = await testConnection(settings.supabaseUrl, settings.supabaseKey);
      setTestConnMsg(res.message);
      if (res.success) {
          await saveSettings(settings);
      }
  };

  const handleSaveCloudSettings = async () => {
      await saveSettings(settings);
      setTestConnMsg('تنظیمات ابری ذخیره شد.');
      const res = await testConnection(settings.supabaseUrl || '', settings.supabaseKey || '');
      setCloudStatus(res.success ? 'online' : 'error');
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

  const handleFullCloudBackup = async () => {
      if (window.confirm("آیا از ارسال تمام داده‌های گوشی به فضای ابری (جداول رابطه‌ای) اطمینان دارید؟")) {
          setIsSyncing(true);
          setSyncProgress({ show: true, msg: 'شروع پشتیبان‌گیری...', percent: 0 });
          
          const res = await fullBackupToCloud((msg) => {
              setSyncProgress(prev => ({ ...prev, msg: msg }));
          });
          
          setIsSyncing(false);
          setSyncProgress({ show: false, msg: '', percent: 0 });
          alert(res.message);
      }
  };

  const copySchemaToClipboard = () => {
      navigator.clipboard.writeText(generateSQLSchema());
      alert("کد SQL کپی شد.");
  };

  const handleCreateYear = async () => {
      if (!newYearInput.trim()) return;
      if (settings.availableYears.includes(newYearInput.trim())) {
          alert("این سال تحصیلی قبلاً ایجاد شده است.");
          return;
      }

      const updatedSettings = {
          ...settings,
          currentAcademicYear: newYearInput.trim(),
          availableYears: [...settings.availableYears, newYearInput.trim()].sort().reverse()
      };

      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
      setNewYearInput('');
      alert(`سال تحصیلی جدید (${updatedSettings.currentAcademicYear}) ایجاد و فعال شد.`);
  };

  const handleSwitchYear = async (year: string) => {
      const updatedSettings = {
          ...settings,
          currentAcademicYear: year
      };
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
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
      setUploadProgress(10); 
      try {
        const resource = await processFile(file);
        setUploadProgress(100);
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
    setUploadProgress(0);
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

  // --- Search Logic ---
  const handleSearch = () => {
      const results: { student: Student, classroom: Classroom }[] = [];
      const query = normalizeInput(searchQuery).toLowerCase();
      
      classes.forEach(cls => {
          // If class filter is on, skip other classes
          if (searchClassFilter && cls.id !== searchClassFilter) return;

          cls.students.forEach(s => {
              if (normalizeInput(s.name).toLowerCase().includes(query)) {
                  results.push({ student: s, classroom: cls });
              }
          });
      });
      return results;
  };

  // --- Daily Absentees Feature ---
  const getTodayAbsentees = () => {
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
    return absenteesList;
  };

  const handleAbsenteesExport = async () => {
      try {
          const absentees = getTodayAbsentees();
          const today = formatJalaali(new Date().toISOString());
          
          const wb = XLSX.utils.book_new();
          const wsData = [
              ["نام دانش‌آموز", "کلاس", "شماره تماس", "وضعیت", "تاریخ"]
          ];
          
          absentees.forEach(item => {
              wsData.push([
                  item.student.name,
                  item.className,
                  item.student.phoneNumber || "-",
                  "غایب",
                  today
              ]);
          });
          
          const ws = XLSX.utils.aoa_to_sheet(wsData);
          ws['!views'] = [{ rightToLeft: true }];
          XLSX.utils.book_append_sheet(wb, ws, "غایبین روزانه");
          
          const fileName = `Absentees_${today.replace(/\//g, '-')}.xlsx`;
          
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
  
  const shareReportAsImage = async (elementId: string, title: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    const EXPORT_WIDTH = 800; 
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0'; 
    container.style.left = '0'; 
    container.style.zIndex = '-9999';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    const clone = element.cloneNode(true) as HTMLElement;
    
    clone.style.width = `${EXPORT_WIDTH}px`;
    clone.style.minWidth = `${EXPORT_WIDTH}px`;
    clone.style.maxWidth = `${EXPORT_WIDTH}px`;
    clone.style.height = 'auto'; 
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.position = 'relative';
    clone.style.margin = '0';
    clone.style.padding = '20px';
    clone.style.borderRadius = '0';
    clone.style.boxShadow = 'none';
    clone.style.transform = 'none';
    
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

    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const canvas = await html2canvas(clone, {
        scale: 2, 
        useCORS: true,
        backgroundColor: isDark ? '#111827' : '#ffffff',
        width: EXPORT_WIDTH,
        windowWidth: EXPORT_WIDTH, 
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: (doc) => {
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
          
          const fileName = `CustomReport_${activeReport.title.replace(/\s/g, '_')}.xlsx`;
          
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

  const renderCustomReportModal = () => {
    if (!showReportHub) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className={`bg-white dark:bg-gray-800 w-full rounded-3xl p-6 shadow-2xl flex flex-col ${reportStep === 'editor' ? 'max-w-4xl h-[90vh]' : 'max-w-md max-h-[80vh]'}`}>
                
                {/* Header */}
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Icons.Report className="text-pink-500" />
                        {reportStep === 'list' ? 'لیست گزارشات سفارشی' : 
                         reportStep === 'create_name' ? 'ایجاد گزارش جدید' :
                         reportStep === 'create_class' ? 'انتخاب کلاس' :
                         activeReport?.title}
                    </h3>
                    <div className="flex gap-2">
                         {reportStep === 'editor' && (
                             <>
                                <button onClick={() => shareReportAsImage('custom-report-table', `Report_${activeReport?.title}`)} className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-xl" title="ذخیره تصویر">
                                    <Icons.Camera size={20} />
                                </button>
                                <button onClick={handleExportReportExcel} className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-2 rounded-xl" title="اکسل">
                                    <Icons.Download size={20} />
                                </button>
                                <button onClick={handleSaveReport} className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl" title="ذخیره">
                                    <Icons.Save size={20} />
                                </button>
                             </>
                         )}
                         <button onClick={() => {
                             if (reportStep === 'list') setShowReportHub(false);
                             else if (reportStep === 'editor') setReportStep('list');
                             else setReportStep('list');
                         }} className="text-gray-400 hover:text-red-500 p-2">
                             <Icons.XCircle size={24} />
                         </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    
                    {reportStep === 'list' && (
                        <div className="space-y-4">
                            <button onClick={handleStartCreateReport} className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex items-center justify-center gap-2 text-gray-500 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-gray-700 transition-all">
                                <Icons.Plus size={24} />
                                <span className="font-bold">ایجاد گزارش جدید</span>
                            </button>

                            <div className="space-y-2">
                                {customReports.length === 0 ? (
                                    <p className="text-center text-gray-400 py-4">هنوز گزارشی ایجاد نکرده‌اید.</p>
                                ) : (
                                    customReports.map(report => (
                                        <div key={report.id} onClick={() => handleOpenExistingReport(report)} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">{report.title}</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{report.className} | {formatJalaali(report.date)}</p>
                                            </div>
                                            <button onClick={(e) => handleDeleteReport(report.id, e)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                                                <Icons.Delete size={18} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {reportStep === 'create_name' && (
                        <div className="space-y-4 pt-4">
                            <p className="text-sm text-gray-600 dark:text-gray-300">لطفاً عنوانی برای این گزارش وارد کنید:</p>
                            <input 
                                type="text" 
                                value={newReportName}
                                onChange={e => setNewReportName(e.target.value)}
                                placeholder="مثال: نمرات ماهانه، لیست اردو، ..."
                                className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:border-pink-500 outline-none text-gray-900 dark:text-white"
                                autoFocus
                            />
                            <button onClick={handleReportNameSubmit} disabled={!newReportName.trim()} className="w-full bg-pink-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">ادامه</button>
                        </div>
                    )}

                    {reportStep === 'create_class' && (
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">کلاس مورد نظر را انتخاب کنید:</p>
                            {classes.map(c => (
                                <div key={c.id} onClick={() => handleSelectClassForReport(c)} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center">
                                    <span className="font-bold text-gray-900 dark:text-white">{c.name}</span>
                                    <Icons.Back className="rotate-180 text-gray-400" size={16} />
                                </div>
                            ))}
                        </div>
                    )}

                    {reportStep === 'editor' && activeReport && activeReportClass && (
                        <div id="custom-report-table" className="bg-white dark:bg-gray-800 p-2">
                            <div className="mb-4 text-center border-b border-gray-100 dark:border-gray-700 pb-4">
                                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1">{activeReport.title}</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{activeReport.className} | {formatJalaali(activeReport.date)}</p>
                            </div>
                            
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-pink-600 text-white">
                                        <th className="p-3 rounded-tr-xl w-12 text-center">#</th>
                                        <th className="p-3 text-right">نام دانش‌آموز</th>
                                        <th className="p-3 w-24">نمره/مورد ۱</th>
                                        <th className="p-3 w-24">نمره/مورد ۲</th>
                                        <th className="p-3 rounded-tl-xl">توضیحات</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-900 dark:text-gray-100">
                                    {activeReport.rows.map((row, idx) => {
                                        const student = activeReportClass.students.find(s => s.id === row.studentId);
                                        if (!student) return null;
                                        return (
                                            <tr key={row.studentId} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="p-2 text-center">{idx + 1}</td>
                                                <td className="p-2 font-bold">{student.name}</td>
                                                <td className="p-1">
                                                    <input 
                                                        type="text" 
                                                        value={row.col1} 
                                                        onChange={e => updateReportRow(row.studentId, 'col1', e.target.value)}
                                                        className="w-full bg-gray-50 dark:bg-gray-700 p-2 rounded text-center outline-none focus:bg-white dark:focus:bg-gray-600 border border-transparent focus:border-pink-300"
                                                    />
                                                </td>
                                                <td className="p-1">
                                                    <input 
                                                        type="text" 
                                                        value={row.col2} 
                                                        onChange={e => updateReportRow(row.studentId, 'col2', e.target.value)}
                                                        className="w-full bg-gray-50 dark:bg-gray-700 p-2 rounded text-center outline-none focus:bg-white dark:focus:bg-gray-600 border border-transparent focus:border-pink-300"
                                                    />
                                                </td>
                                                <td className="p-1">
                                                    <input 
                                                        type="text" 
                                                        value={row.comment} 
                                                        onChange={e => updateReportRow(row.studentId, 'comment', e.target.value)}
                                                        className="w-full bg-gray-50 dark:bg-gray-700 p-2 rounded outline-none focus:bg-white dark:focus:bg-gray-600 border border-transparent focus:border-pink-300"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
             </div>
        </div>
    );
  };

  const renderRestoreModal = () => {
      if (restoreState.stage === 'idle') return null;
      return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
              <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl border dark:border-gray-700 text-center">
                  {restoreState.stage === 'error' ? (
                      <div className="text-center">
                          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                              <Icons.Delete size={32} />
                          </div>
                          <h3 className="text-xl font-black text-red-600 dark:text-red-400 mb-2">خطا</h3>
                          <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">{restoreState.message}</p>
                          <button onClick={cancelRestore} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">بستن</button>
                      </div>
                  ) : restoreState.stage === 'confirming' ? (
                      <div>
                          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                              <Icons.Upload size={32} />
                          </div>
                          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">تایید بازیابی</h3>
                          <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">{restoreState.message}</p>
                          <div className="flex gap-3">
                              <button onClick={cancelRestore} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-xl">انصراف</button>
                              <button onClick={confirmRestore} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-emerald-700">تایید</button>
                          </div>
                      </div>
                  ) : (
                      <div className="py-4">
                           {restoreState.stage === 'success' ? (
                               <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 animate-in zoom-in">
                                   <Icons.Present size={32} />
                               </div>
                           ) : (
                               <div className="w-16 h-16 mx-auto mb-4 relative">
                                   <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                                   <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
                               </div>
                           )}
                           
                           <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                               {restoreState.stage === 'success' ? 'انجام شد' : 'در حال پردازش'}
                           </h3>
                           <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{restoreState.message || 'لطفاً صبر کنید...'}</p>
                           
                           {restoreState.stage !== 'success' && (
                               <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                   <div 
                                      className="bg-emerald-500 h-full transition-all duration-300 ease-out" 
                                      style={{ width: `${restoreState.progress || 0}%` }}
                                   ></div>
                               </div>
                           )}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderSyncProgressModal = () => {
    if (!syncProgress.show) return null;
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl border dark:border-gray-700 text-center animate-in zoom-in">
                <div className="w-20 h-20 mx-auto mb-6 relative">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Icons.Upload className="w-8 h-8 text-blue-500 animate-pulse" />
                    </div>
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">در حال همگام‌سازی...</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-bold animate-pulse">{syncProgress.msg}</p>
            </div>
        </div>
    );
  };

  const renderStatsModal = () => {
    if (!showStatsModal) return null;

    // Helper to calculate top 10 stats
    const getStats = (type: typeof statsTab) => {
        const list: {student: Student, classroom: Classroom, count: number}[] = [];
        
        // Use all classes, not just filtered ones, for global stats
        classes.forEach(cls => {
            // Only consider current year if needed, but "across all classes" usually implies active ones
            if (settings.currentAcademicYear && cls.academicYear !== settings.currentAcademicYear) return;

            cls.students.forEach(std => {
                let count = 0;
                cls.sessions.forEach(sess => {
                    const r = sess.records.find(rec => rec.studentId === std.id);
                    if (r) {
                        if (type === 'absent' && r.attendance === AttendanceStatus.ABSENT) count++;
                        if (type === 'sleep' && r.discipline?.sleep) count++;
                        if (type === 'discipline' && r.discipline?.badBehavior) count++;
                        if (type === 'expelled' && r.discipline?.expelled) count++;
                    }
                });
                
                if (count > 0) {
                    list.push({ student: std, classroom: cls, count });
                }
            });
        });

        // Sort descending and take top 10
        return list.sort((a,b) => b.count - a.count).slice(0, 10);
    };

    const data = getStats(statsTab);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Icons.Trophy className="text-amber-500" /> برترین‌های آماری
                    </h3>
                    <button onClick={() => setShowStatsModal(false)} className="text-gray-400 hover:text-red-500"><Icons.XCircle size={24}/></button>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-4 overflow-x-auto no-scrollbar">
                    <button onClick={() => setStatsTab('absent')} className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${statsTab === 'absent' ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>غایبین</button>
                    <button onClick={() => setStatsTab('sleep')} className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${statsTab === 'sleep' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>خواب</button>
                    <button onClick={() => setStatsTab('discipline')} className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${statsTab === 'discipline' ? 'bg-white dark:bg-gray-600 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>انضباطی</button>
                    <button onClick={() => setStatsTab('expelled')} className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${statsTab === 'expelled' ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>اخراج</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 pb-10">
                            <Icons.CheckCircle size={48} className="mb-2 opacity-20" />
                            <p>موردی یافت نشد.</p>
                        </div>
                    ) : (
                        data.map((item, idx) => (
                            <div key={idx} className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ml-3 shrink-0 
                                    ${idx === 0 ? 'bg-amber-100 text-amber-600' : 
                                      idx === 1 ? 'bg-gray-200 text-gray-600' : 
                                      idx === 2 ? 'bg-orange-100 text-orange-600' : 
                                      'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                                    {idx + 1}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.student.name}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.classroom.name}</p>
                                </div>

                                <div className={`px-3 py-1 rounded-lg text-xs font-bold ml-2
                                    ${statsTab === 'absent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                      statsTab === 'sleep' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                      statsTab === 'discipline' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                                      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                                    {item.count} مورد
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
                    <p className="text-[10px] text-gray-400">آمار مربوط به سال تحصیلی {settings.currentAcademicYear} می‌باشد.</p>
                </div>
             </div>
        </div>
    );
  };

  const renderAbsenteesModal = () => {
      if (!showAbsenteesModal) return null;
      const list = getTodayAbsentees();
      const todayDate = new Date().toLocaleDateString('fa-IR');

      return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                      <div>
                          <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                              <Icons.UserX className="text-red-500" size={20} />
                              غایبین امروز
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{todayDate}</p>
                      </div>
                      <button onClick={() => setShowAbsenteesModal(false)} className="text-gray-400 hover:text-red-500 p-2">
                          <Icons.XCircle size={24} />
                      </button>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                      {list.length === 0 ? (
                          <div className="text-center py-10 text-gray-400">
                              <Icons.CheckCircle size={48} className="mx-auto mb-2 opacity-30 text-emerald-500" />
                              <p className="font-bold">خوشبختانه امروز هیچ غایبی ندارید!</p>
                          </div>
                      ) : (
                          list.map((item, idx) => (
                              <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 font-bold">
                                          {item.student.name.charAt(0)}
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-gray-900 dark:text-white text-sm">{item.student.name}</h4>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.className}</p>
                                      </div>
                                  </div>
                                  {item.student.phoneNumber && (
                                      <a href={`tel:${item.student.phoneNumber}`} className="bg-white dark:bg-gray-600 p-2 rounded-lg text-emerald-600 dark:text-emerald-400 shadow-sm">
                                          <Icons.Phone size={16} />
                                      </a>
                                  )}
                              </div>
                          ))
                      )}
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                      {list.length > 0 && (
                          <button onClick={handleAbsenteesExport} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700">
                              <Icons.Download size={18} /> خروجی اکسل
                          </button>
                      )}
                      <button onClick={() => setShowAbsenteesModal(false)} className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl">بستن</button>
                  </div>
              </div>
          </div>
      );
  };

  const renderSearchModal = () => {
    if (!showSearchModal) return null;
    const results = searchQuery ? handleSearch() : [];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl h-[70vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Icons.Users className="text-blue-500" /> جستجوی دانش‌آموز
                    </h3>
                    <button onClick={() => setShowSearchModal(false)} className="text-gray-400 hover:text-red-500"><Icons.XCircle size={24}/></button>
                </div>
                
                <div className="space-y-3 mb-4">
                    <input 
                        type="text" 
                        placeholder="نام دانش‌آموز..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none focus:border-blue-500 dark:text-white"
                        autoFocus
                    />
                    <select 
                        value={searchClassFilter} 
                        onChange={e => setSearchClassFilter(e.target.value)}
                        className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none dark:text-white"
                    >
                        <option value="">همه کلاس‌ها</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {searchQuery && results.length === 0 ? (
                        <p className="text-center text-gray-400 mt-4">موردی یافت نشد.</p>
                    ) : (
                        results.map(({student, classroom}, idx) => (
                            <div key={`${student.id}-${idx}`} onClick={() => setSelectedStudentReport({student, classroom})} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold">
                                        {student.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{student.name}</h4>
                                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                                             <Icons.BookOpen size={10} className="inline"/>
                                             <span>{classroom.name}</span>
                                             <span className="mx-0.5 opacity-50">|</span>
                                             <span>{classroom.bookName}</span>
                                        </div>
                                    </div>
                                </div>
                                <Icons.Back className="rotate-180 text-gray-400" size={16} />
                            </div>
                        ))
                    )}
                </div>
             </div>
        </div>
    );
  };

  const renderStudentReportModal = () => {
    if (!selectedStudentReport) return null;
    const { student, classroom } = selectedStudentReport;
    
    // Copy logic for FULL report stats
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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
             <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 rounded-t-3xl z-10">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">پرونده تحصیلی</h3>
                    <div className="flex gap-2">
                         <button onClick={() => shareReportAsImage('home-individual-report', `Report_${student.name}`)} className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-xl" title="ذخیره تصویر">
                             <Icons.Camera size={20} />
                         </button>
                         <button onClick={() => setSelectedStudentReport(null)} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 p-2 rounded-xl">
                             <Icons.XCircle size={20} />
                         </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-4 md:p-6" id="home-individual-report">
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

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-3xl">
                     <button onClick={() => {
                        setSelectedStudentReport(null);
                        setShowSearchModal(false);
                        onSelectClass(classroom);
                     }} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-700 transition-colors">
                        ورود به کلاس
                     </button>
                </div>
             </div>
        </div>
    );
  };

  const renderClassReportSelectModal = () => {
    if (!showClassReportSelect) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl max-h-[70vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Icons.Chart className="text-purple-500" /> انتخاب کلاس
                    </h3>
                    <button onClick={() => setShowClassReportSelect(false)} className="text-gray-400 hover:text-red-500"><Icons.XCircle size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                     {classes.length === 0 ? <p className="text-center text-gray-400">کلاسی وجود ندارد</p> : 
                      classes.map(c => (
                         <div key={c.id} onClick={() => setSelectedClassForReport(c)} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center">
                             <div className="flex flex-col">
                                 <span className="font-bold text-gray-900 dark:text-white">{c.name}</span>
                                 <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{c.bookName}</span>
                             </div>
                             <Icons.Back className="rotate-180 text-gray-400" size={16} />
                         </div>
                      ))
                     }
                </div>
             </div>
        </div>
    );
  };
  
  const shareClassReportImage = async (elementId: string, title: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    const EXPORT_WIDTH = 800; 
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0'; 
    container.style.left = '0'; 
    container.style.zIndex = '-9999';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    const clone = element.cloneNode(true) as HTMLElement;
    
    clone.style.width = `${EXPORT_WIDTH}px`;
    clone.style.minWidth = `${EXPORT_WIDTH}px`;
    clone.style.maxWidth = `${EXPORT_WIDTH}px`;
    clone.style.height = 'auto'; 
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.position = 'relative';
    clone.style.margin = '0';
    clone.style.padding = '20px';
    clone.style.borderRadius = '0';
    clone.style.boxShadow = 'none';
    clone.style.transform = 'none';
    
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

    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const canvas = await html2canvas(clone, {
        scale: 2, 
        useCORS: true,
        backgroundColor: isDark ? '#111827' : '#ffffff',
        width: EXPORT_WIDTH,
        windowWidth: EXPORT_WIDTH,
        onclone: (doc) => {
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

  const renderFullClassReportModal = () => {
    if (!selectedClassForReport) return null;
    const data = selectedClassForReport;

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
                        <button onClick={() => shareClassReportImage('class-report-content', `ClassReport_${data.name}`)} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors">
                            <Icons.Camera size={18} /> <span className="hidden sm:inline">ذخیره تصویر</span>
                        </button>
                        <button onClick={() => setSelectedClassForReport(null)} className="text-gray-400 hover:text-red-500 p-2">
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
                                        <th className="p-3 rounded-tl-xl">نمره منفی</th>
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

                                        return (
                                            <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="p-3 text-center">{idx + 1}</td>
                                                <td className="p-3 font-bold">{s.name}</td>
                                                <td className="p-3 text-center text-red-500">{absent || '-'}</td>
                                                <td className="p-3 text-center text-amber-500">{late || '-'}</td>
                                                <td className="p-3 text-center text-emerald-600">{posScore || '-'}</td>
                                                <td className="p-3 text-center text-red-600">{negScore || '-'}</td>
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
  
  const renderBackupModal = () => {
      if (!showBackupModal) return null;
      return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
                   <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                       <Icons.Save size={32} />
                   </div>
                   <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6">پشتیبان‌گیری و بازیابی</h3>
                   
                   <div className="space-y-3">
                       <button onClick={handleBackup} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2">
                           <Icons.Save size={20}/> ایجاد فایل پشتیبان
                       </button>
                       <button onClick={handleRestoreClick} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2">
                           <Icons.Upload size={20}/> بازیابی فایل پشتیبان
                       </button>
                   </div>
                   
                   <button onClick={() => setShowBackupModal(false)} className="mt-6 text-gray-400 text-sm">بازگشت</button>
              </div>
          </div>
      );
  };

  if (!isAuthenticated && !loading) {
      return (
        <div className="min-h-screen bg-emerald-50 dark:bg-gray-900 font-vazir flex items-center justify-center p-4">
            {renderRestoreModal()}
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
                            type="text" required placeholder="سال تحصیلی (1403-1404)"
                            value={settings.currentAcademicYear} onChange={e => setSettings({...settings, currentAcademicYear: e.target.value})}
                            className="w-full bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl p-3 text-left"
                            dir="ltr"
                        />
                        <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold mt-4">شروع</button>
                        <button type="button" onClick={handleRestoreClick} className="w-full text-emerald-600 text-sm font-bold mt-2">بازیابی اطلاعات</button>
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
      {renderRestoreModal()}
      {renderSyncProgressModal()}
      {renderAbsenteesModal()}
      {renderSearchModal()}
      {renderStudentReportModal()}
      {renderClassReportSelectModal()}
      {renderFullClassReportModal()}
      {renderBackupModal()}
      {renderStatsModal()}
      {renderCustomReportModal()}

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
            // TILE DASHBOARD - CHANGED TO 2 COLS, BIGGER ICONS
            <div className="max-w-4xl mx-auto">
                <div className="grid grid-cols-2 gap-4 auto-rows-fr">
                    {/* 1. Classes */}
                    <button onClick={() => setViewMode('classes')} className="bg-white dark:bg-gray-800 h-32 md:h-40 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all active:scale-[0.98] group">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Icons.BookOpen size={36} />
                        </div>
                        <span className="font-black text-sm text-gray-800 dark:text-white">کلاس‌ها</span>
                    </button>

                     {/* 2. Daily Absentees */}
                    <button onClick={() => setShowAbsenteesModal(true)} className="bg-white dark:bg-gray-800 h-32 md:h-40 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all active:scale-[0.98] group">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Icons.UserX size={36} />
                        </div>
                        <span className="font-black text-sm text-gray-800 dark:text-white">غایبین</span>
                    </button>

                     {/* 3. Top Reports */}
                    <button onClick={() => setShowStatsModal(true)} className="bg-white dark:bg-gray-800 h-32 md:h-40 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all active:scale-[0.98] group">
                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Icons.Trophy size={36} />
                        </div>
                        <span className="font-black text-sm text-gray-800 dark:text-white">برترین‌ها</span>
                    </button>

                    {/* 4. Student Search */}
                    <button onClick={() => setShowSearchModal(true)} className="bg-white dark:bg-gray-800 h-32 md:h-40 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all active:scale-[0.98] group">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Icons.Users size={36} />
                        </div>
                        <span className="font-black text-sm text-gray-800 dark:text-white">جستجو</span>
                    </button>

                    {/* 5. Create Custom Report */}
                    <button onClick={() => { setShowReportHub(true); setReportStep('list'); }} className="bg-white dark:bg-gray-800 h-32 md:h-40 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all active:scale-[0.98] group">
                        <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 text-pink-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Icons.Report size={36} />
                        </div>
                        <span className="font-black text-sm text-gray-800 dark:text-white">گزارش‌ساز</span>
                    </button>

                     {/* 6. Backup & Restore */}
                    <button onClick={() => setShowBackupModal(true)} className="bg-white dark:bg-gray-800 h-32 md:h-40 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all active:scale-[0.98] group">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Icons.Save size={36} />
                        </div>
                        <span className="font-black text-sm text-gray-800 dark:text-white">پشتیبان‌گیری</span>
                    </button>

                    {/* 7. Settings (Spanning full width or just taking slot) */}
                    <button onClick={() => setShowSettingsModal(true)} className="col-span-2 bg-white dark:bg-gray-800 h-24 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row items-center justify-center gap-4 hover:shadow-lg transition-all active:scale-[0.98] group">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Icons.Settings size={28} />
                        </div>
                        <span className="font-black text-sm text-gray-800 dark:text-white">تنظیمات برنامه</span>
                    </button>
                </div>
                
                <div className="mt-8 text-center text-gray-400 text-xs">
                     <p>نسخه: 3.1.2 </p>
                     <p>آقای هنرآموز</p>
                </div>
            </div>
        ) : (
            // CLASSES LIST VIEW
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setViewMode('dashboard')} className="bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                        <Icons.Back size={20} />
                    </button>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">لیست کلاس‌ها</h2>
                </div>

                {filteredClasses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center mt-10 opacity-80">
                        <Icons.Home className="w-16 h-16 text-emerald-300 mb-4" />
                        <p className="text-emerald-900 dark:text-emerald-100 font-black text-xl mb-2">سال تحصیلی {settings.currentAcademicYear}</p>
                        <p className="text-sm text-emerald-700 mb-4">هیچ کلاسی ثبت نشده است.</p>
                        <button onClick={() => setShowModal(true)} className="text-emerald-600 border border-emerald-200 px-4 py-2 rounded-xl">+ ایجاد کلاس</button>
                    </div>
                ) : (
                    filteredClasses.map((cls) => (
                        <div key={cls.id} onClick={() => onSelectClass(cls)} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm hover:shadow-md border border-emerald-100/50 dark:border-gray-700 transition-all cursor-pointer relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 group-hover:w-2 transition-all"></div>
                        <div className="flex justify-between items-start pl-2">
                            <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{cls.name}</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-1"><Icons.BookOpen size={14}/> {cls.bookName}</p>
                            <div className="flex gap-2">
                                <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{cls.students.length} دانش‌آموز</span>
                            </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="bg-emerald-50 dark:bg-gray-700 p-2 rounded-xl text-emerald-600"><Icons.Back className="w-5 h-5"/></div>
                                <button onClick={(e) => openEditClassModal(cls, e)} className="p-2 text-gray-400 hover:text-emerald-600"><Icons.Pencil size={18}/></button>
                            </div>
                        </div>
                        </div>
                    ))
                )}
            </div>
        )}
      </div>

      {viewMode === 'classes' && (
          <button onClick={() => setShowModal(true)} className="fixed bottom-8 left-8 bg-emerald-600 text-white p-4 rounded-2xl shadow-xl hover:scale-105 transition-all z-20 flex items-center gap-2">
            <Icons.Plus className="w-6 h-6" /> <span className="font-bold text-sm hidden md:inline">کلاس جدید</span>
          </button>
      )}

      {/* Add Class Modal */}
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

      {/* Settings Modal */}
      {showSettingsModal && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">تنظیمات</h3>
                    <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-red-500"><Icons.Delete className="w-5 h-5 rotate-45" /></button>
                </div>

                <div className="space-y-3">
                    
                    {/* 1. Teacher Profile */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <button onClick={() => toggleSection('profile')} className="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 font-bold text-sm text-gray-900 dark:text-white">
                            <span className="flex items-center gap-2"><Icons.Users size={16}/> مشخصات دبیر</span>
                            <Icons.Back size={16} className={`transition-transform ${expandedSection === 'profile' ? '-rotate-90' : 'rotate-90'}`}/>
                        </button>
                        {expandedSection === 'profile' && (
                            <div className="p-4 space-y-3 bg-white dark:bg-gray-800">
                                <input type="text" placeholder="نام دبیر" value={settings.teacherName} onChange={e=>setSettings({...settings, teacherName:e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm text-gray-900"/>
                                <input type="text" placeholder="نام کاربری" value={settings.username} onChange={e=>setSettings({...settings, username:e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm text-gray-900"/>
                                <input type="password" placeholder="رمز عبور" value={settings.password} onChange={e=>setSettings({...settings, password:e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm text-left text-gray-900" dir="ltr"/>
                                <button onClick={handleUpdateProfile} className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold">بروزرسانی</button>
                            </div>
                        )}
                    </div>

                    {/* 2. Cloud Settings (Supabase) */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <button onClick={() => toggleSection('cloud')} className="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 font-bold text-sm text-gray-900 dark:text-white">
                            <span className="flex items-center gap-2"><Icons.Upload size={16}/> اتصال به فضای ابری (Supabase)</span>
                            <Icons.Back size={16} className={`transition-transform ${expandedSection === 'cloud' ? '-rotate-90' : 'rotate-90'}`}/>
                        </button>
                        {expandedSection === 'cloud' && (
                            <div className="p-4 space-y-3 bg-white dark:bg-gray-800">
                                <div className="text-xs text-gray-500 mb-2">اطلاعات پروژه Supabase خود را وارد کنید:</div>
                                <input 
                                    type="text" 
                                    placeholder="Supabase URL (https://xyz.supabase.co)" 
                                    value={settings.supabaseUrl || ''} 
                                    onChange={e=>setSettings({...settings, supabaseUrl:e.target.value})} 
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white text-xs text-left text-gray-900"
                                    dir="ltr"
                                />
                                <input 
                                    type="password" 
                                    placeholder="Supabase Anon Key" 
                                    value={settings.supabaseKey || ''} 
                                    onChange={e=>setSettings({...settings, supabaseKey:e.target.value})} 
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white text-xs text-left text-gray-900"
                                    dir="ltr"
                                />
                                
                                <div className="flex gap-2 pt-2">
                                    <button onClick={handleTestConnection} className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100">تست اتصال</button>
                                    <button onClick={handleSaveCloudSettings} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-emerald-700">ذخیره</button>
                                </div>
                                {testConnMsg && <p className="text-xs text-center font-bold text-gray-600 mt-1">{testConnMsg}</p>}

                                <div className="border-t pt-3 mt-2">
                                    <button onClick={() => setShowSchema(!showSchema)} className="text-xs text-gray-500 underline mb-2 w-full text-right">نمایش کد ساخت جدول (SQL)</button>
                                    {showSchema && (
                                        <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-[10px] font-mono text-left dir-ltr relative text-gray-900 dark:text-gray-300">
                                            <pre className="overflow-x-auto whitespace-pre-wrap h-32">{generateSQLSchema()}</pre>
                                            <button onClick={copySchemaToClipboard} className="absolute top-1 right-1 bg-white p-1 rounded border text-xs">Copy</button>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t pt-3 mt-2">
                                    <button onClick={handleFullCloudBackup} className="w-full bg-purple-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center justify-center gap-2">
                                        <Icons.Upload size={14} />
                                        همگام‌سازی کامل با دیتابیس رابطه‌ای
                                    </button>
                                    <p className="text-[10px] text-gray-400 mt-1 text-center">داده‌های شما در 5 جدول مجزا ذخیره می‌شوند.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. Year Management */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <button onClick={() => toggleSection('year')} className="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 font-bold text-sm text-gray-900 dark:text-white">
                            <span className="flex items-center gap-2"><Icons.Calendar size={16}/> مدیریت سال تحصیلی</span>
                            <Icons.Back size={16} className={`transition-transform ${expandedSection === 'year' ? '-rotate-90' : 'rotate-90'}`}/>
                        </button>
                        {expandedSection === 'year' && (
                            <div className="p-4 space-y-3 bg-white dark:bg-gray-800">
                                <label className="text-xs font-bold block text-gray-700 dark:text-gray-400">سال فعال:</label>
                                <select 
                                    value={settings.currentAcademicYear} 
                                    onChange={(e) => handleSwitchYear(e.target.value)}
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm text-center text-gray-900"
                                    dir="ltr"
                                >
                                    {settings.availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <div className="flex gap-2 pt-2 border-t">
                                    <input type="text" placeholder="سال جدید (1404-1405)" value={newYearInput} onChange={e=>setNewYearInput(e.target.value)} className="flex-1 min-w-0 p-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm text-center text-gray-900" dir="ltr"/>
                                    <button onClick={handleCreateYear} className="bg-emerald-600 text-white px-3 rounded-lg"><Icons.Plus/></button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. Theme */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                         <button onClick={() => toggleSection('theme')} className="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 font-bold text-sm text-gray-900 dark:text-white">
                            <span className="flex items-center gap-2"><Icons.Settings size={16}/> عمومی</span>
                            <Icons.Back size={16} className={`transition-transform ${expandedSection === 'theme' ? '-rotate-90' : 'rotate-90'}`}/>
                        </button>
                        {expandedSection === 'theme' && (
                            <div className="p-4 space-y-3 bg-white dark:bg-gray-800">
                                <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
                                    <button onClick={()=>handleThemeChange('light')} className={`flex-1 py-1 rounded text-xs font-bold text-gray-700 dark:text-gray-300 ${settings.theme!=='dark'?'bg-white shadow text-gray-900':''}`}>روز</button>
                                    <button onClick={()=>handleThemeChange('dark')} className={`flex-1 py-1 rounded text-xs font-bold text-gray-700 dark:text-gray-300 ${settings.theme==='dark'?'bg-gray-700 text-white shadow':''}`}>شب</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* About */}
                    <div className="text-center pt-4 border-t">
                        <p className="text-xs font-bold text-gray-500">تولید شده توسط جواد بابائی</p>
                        <a href="https://mrhonaramoz.ir" className="text-[10px] text-emerald-600 block mt-1">mrhonaramoz.ir</a>
                    </div>
                </div>
            </div>
         </div>
      )}
      
      <input type="file" ref={fileInputRef} onChange={handleRestoreFile} className="hidden" />
    </div>
  );
};
