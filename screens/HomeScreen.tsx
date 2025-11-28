import React, { useState, useEffect, useRef } from 'react';
import { Classroom, ClassType, AIResource, GlobalSettings, BackupPayload } from '../types';
import { getClasses, saveClass, restoreData, getSettings, saveSettings, updateClass } from '../services/storageService';
import { getSupabaseClient, testConnection, generateSQLSchema, syncData, fullBackupToCloud } from '../services/supabaseService';
import { Icons } from '../components/Icons';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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
    .trim();
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectClass, isAuthenticated, onLoginSuccess, onLogout }) => {
  // Data State
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Auth UI State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'profile' | 'cloud' | 'data' | 'theme' | 'year' | null>(null);

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
      if (savedSettings.theme) {
          localStorage.setItem('theme_pref', savedSettings.theme);
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
      localStorage.setItem('theme_pref', settings.theme || 'light');
      setShowSetupModal(true);
    }
    
    const data = await getClasses();
    setClasses(data);
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
        // Fetch latest settings from DB to ensure password is included
        const currentSettings = await getSettings();

        // Optimize classes for backup
        const optimizedClasses = classes.map(cls => {
             // Create a shallow copy of resources
             const newResources = { ...cls.resources, lessonPlans: [] as string[] };
             
             // Remove very large files (> 5MB Base64) to prevent backup bloat/crash
             // Essential data (grades, attendance) is preserved, but huge attachments are skipped.
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
            settings: currentSettings || settings
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
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', fileName);
            linkElement.click();
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
          
          setClasses(updatedClasses);
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
              
              if (updatedSettings?.password) {
                  // Force logout to require re-authentication with new password
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
    <div className="min-h-screen bg-emerald-50 dark:bg-gray-900 pb-24 font-vazir transition-colors duration-300">
      {renderRestoreModal()}
      {renderSyncProgressModal()}

      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-10 px-6 py-5 shadow-sm border-b border-emerald-100 dark:border-gray-700 transition-all">
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
            <button onClick={() => setShowSettingsModal(true)} className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-700">
                <Icons.Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {loading ? (
            <div className="flex justify-center pt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
        ) : filteredClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center mt-20 opacity-80">
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

      <button onClick={() => setShowModal(true)} className="fixed bottom-8 left-8 bg-emerald-600 text-white p-4 rounded-2xl shadow-xl hover:scale-105 transition-all z-20 flex items-center gap-2">
        <Icons.Plus className="w-6 h-6" /> <span className="font-bold text-sm hidden md:inline">کلاس جدید</span>
      </button>

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

                    {/* 4. Theme & Data */}
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
                                <div className="border-t pt-3 space-y-2">
                                     <button onClick={handleBackup} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300">
                                         <Icons.Save size={16} className="text-emerald-500"/> پشتیبان‌گیری لوکال
                                     </button>
                                     <button onClick={handleRestoreClick} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300">
                                         <Icons.Upload size={16} className="text-amber-500"/> بازیابی لوکال
                                     </button>
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