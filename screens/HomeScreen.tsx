
import React, { useState, useEffect, useRef } from 'react';
import { Classroom, ClassType, AIResource, GlobalSettings, BackupPayload } from '../types';
import { getClasses, saveClass, restoreData, getSettings, saveSettings, updateClass } from '../services/storageService';
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

// Helper to normalize numbers (Persian/Arabic to English) and trim whitespace
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
  const [showPassword, setShowPassword] = useState(false);

  // UI State
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  
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
        theme: localTheme || (systemDark ? 'dark' : 'light')
     };
  });
  
  // Year Management State
  const [newYearInput, setNewYearInput] = useState('');
  
  // Form State
  const [newClassName, setNewClassName] = useState('');
  const [newBookName, setNewBookName] = useState('');
  const [newClassType, setNewClassType] = useState<ClassType>(ClassType.MODULAR);
  const [attachedFile, setAttachedFile] = useState<AIResource | undefined>(undefined);
  
  // Upload Progress State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    initialize();
  }, [isAuthenticated]); 

  // Apply Theme Effect
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

  // --- Settings Update (Teacher Profile) ---
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
          // Update Mode
          const updatedClass: Classroom = {
              ...editingClass,
              name: newClassName,
              bookName: newBookName,
              type: newClassType,
              // If new file attached, update it, otherwise keep existing
              resources: attachedFile ? { ...editingClass.resources, mainFile: attachedFile } : editingClass.resources
          };
          await updateClass(updatedClass);
      } else {
          // Create Mode
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
            }
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
      setAttachedFile(undefined); // Reset file input
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

  // --- Backup & Restore Logic ---
  
  const handleBackup = async () => {
    try {
        const payload: BackupPayload = {
            meta: {
                version: '2.0',
                date: new Date().toISOString(),
                app: 'ClassManagerPro'
            },
            classes: classes,
            settings: settings
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
        
        // Wait briefly for UI to update
        await new Promise(r => setTimeout(r, 100));

        const parsedData = JSON.parse(json);
        
        // Validate
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
          
          // Wait briefly for UI update
          await new Promise(r => setTimeout(r, 100));

          await restoreData(restoreState.pendingData);
          
          setRestoreState({ stage: 'restoring', progress: 90, message: 'در حال بارگذاری مجدد...' });

          // Refresh Data
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
          
          // Close modal after success
          setTimeout(() => {
              setRestoreState({ stage: 'idle' });
              setShowSettingsModal(false);
              
              // Check if we need to force re-auth or exit setup
              if (updatedSettings?.password) {
                  setShowSetupModal(false);
                  setShowLoginModal(true);
              } else if (updatedSettings?.teacherName) {
                  // If restore has valid data but no password (legacy), just login
                  setShowSetupModal(false);
                  onLoginSuccess();
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

  // --- Render Helpers --- //
  
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
                           
                           {/* Progress Bar */}
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

  // --- Auth Check Render ---
  if (!isAuthenticated && !loading) {
      return (
        <div className="min-h-screen bg-emerald-50 dark:bg-gray-900 font-vazir flex items-center justify-center p-4">
            {renderRestoreModal()}

            {/* Setup Modal */}
            {showSetupModal && (
                <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-8 shadow-2xl">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
                            <Icons.Settings size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">راه‌اندازی اولیه</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">لطفاً اطلاعات کاربری خود را تعیین کنید.</p>
                    </div>
                    
                    <form onSubmit={handleSetupSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 mr-1">نام و نام خانوادگی دبیر</label>
                            <input 
                                type="text"
                                required
                                value={settings.teacherName}
                                onChange={e => setSettings({...settings, teacherName: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 mr-1">نام کاربری</label>
                            <input 
                                type="text"
                                required
                                value={settings.username}
                                onChange={e => setSettings({...settings, username: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 mr-1">رمز عبور (جهت ورود به برنامه)</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={settings.password}
                                    onChange={e => setSettings({...settings, password: e.target.value})}
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none pl-10 text-left"
                                    dir="ltr"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {showPassword ? <Icons.EyeOff size={20}/> : <Icons.Eye size={20}/>}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 mr-1">سال تحصیلی جاری</label>
                            <input 
                                type="text"
                                required
                                value={settings.currentAcademicYear}
                                onChange={e => setSettings({...settings, currentAcademicYear: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                                dir="ltr"
                                placeholder="1403-1404"
                            />
                        </div>
                        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold shadow-lg mt-4">
                            ذخیره و شروع
                        </button>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
                             <p className="text-xs text-gray-400 mb-2">قبلاً نسخه پشتیبان تهیه کرده‌اید؟</p>
                             <button 
                                type="button"
                                onClick={handleRestoreClick}
                                className="text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center justify-center gap-2 mx-auto hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-4 py-2 rounded-xl transition-colors"
                             >
                                <Icons.Upload size={16} />
                                بازیابی اطلاعات
                             </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Login Modal */}
            {showLoginModal && !showSetupModal && (
                <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
                            <Icons.Lock size={32} />
                        </div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white">خوش آمدید</h2>
                        <p className="text-emerald-700 dark:text-emerald-400 font-bold text-sm mt-2">{settings.teacherName}</p>
                    </div>
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 mr-1">رمز عبور</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    autoFocus
                                    value={loginPassword}
                                    onChange={e => setLoginPassword(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none text-center tracking-widest"
                                    dir="ltr"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {showPassword ? <Icons.EyeOff size={20}/> : <Icons.Eye size={20}/>}
                                </button>
                            </div>
                        </div>
                        {loginError && <p className="text-red-500 text-xs font-bold text-center">{loginError}</p>}
                        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-lg">
                            ورود
                        </button>
                    </form>
                </div>
            )}
            
            {/* Hidden File Input for Restore - Always available */}
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleRestoreFile}
                accept="*" 
                className="hidden"
            />
        </div>
      );
  }

  // --- Main App Render ---
  return (
    <div className="min-h-screen bg-emerald-50 dark:bg-gray-900 pb-24 font-vazir transition-colors duration-300">
      {renderRestoreModal()}

      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-10 px-6 py-5 shadow-sm border-b border-emerald-100 dark:border-gray-700 transition-all">
        <div className="flex justify-between items-center relative h-8">
          {/* Left Side: Teacher Info (Replaced Title) */}
          <div className="z-10 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Icons.Users size={16} />
            </div>
            <div>
                 <p className="text-xs text-gray-400 dark:text-gray-500 font-bold">خوش آمدید</p>
                 <p className="text-sm font-black text-emerald-800 dark:text-emerald-400">
                  {settings.teacherName || 'دبیر محترم'}
                </p>
            </div>
          </div>

          {/* Center: Academic Year Badge */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
             <div className="bg-emerald-50 dark:bg-gray-700 border border-emerald-100 dark:border-gray-600 text-emerald-700 dark:text-emerald-300 text-[11px] md:text-xs font-black px-3 py-1.5 rounded-2xl shadow-sm flex items-center gap-1.5 select-none">
                <Icons.Calendar size={12} className="text-emerald-500 dark:text-emerald-400 opacity-80"/>
                <span className="pt-0.5">{settings.currentAcademicYear}</span>
             </div>
          </div>

          {/* Right Side: Settings & Logout */}
          <div className="z-10 flex gap-2">
             <button 
                onClick={onLogout}
                className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 transition-colors shadow-sm"
                title="خروج"
            >
                <Icons.LogOut size={20} />
            </button>
            <button 
                onClick={() => setShowSettingsModal(true)}
                className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors shadow-sm"
                title="تنظیمات"
            >
                <Icons.Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {loading ? (
            <div className="flex justify-center pt-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 dark:border-emerald-400"></div>
            </div>
        ) : filteredClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center mt-20 opacity-80">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Icons.Home className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
            </div>
            <p className="text-emerald-900 dark:text-emerald-100 font-black text-xl mb-2">سال تحصیلی {settings.currentAcademicYear}</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-500 font-medium mb-4">هیچ کلاسی در این سال ثبت نشده است.</p>
            <button 
               onClick={() => setShowModal(true)}
               className="text-emerald-600 dark:text-emerald-400 text-sm border border-emerald-200 dark:border-emerald-800 px-4 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
            >
              + ایجاد اولین کلاس
            </button>
          </div>
        ) : (
          filteredClasses.map((cls) => (
            <div 
              key={cls.id} 
              onClick={() => onSelectClass(cls)}
              className="group bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm hover:shadow-md border border-emerald-100/50 dark:border-gray-700 transition-all duration-300 cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 dark:bg-emerald-600 transition-all group-hover:w-2"></div>
              <div className="flex justify-between items-start pl-2">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{cls.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-3">
                    <Icons.BookOpen size={14} />
                    {cls.bookName}
                  </p>
                  
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                      cls.type === ClassType.MODULAR 
                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-100 dark:border-purple-800' 
                        : 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 border border-orange-100 dark:border-orange-800'
                    }`}>
                      {cls.type === ClassType.MODULAR ? 'پودمانی' : 'ترمی'}
                    </span>
                    <span className="text-[10px] bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-2.5 py-1 rounded-full border border-gray-100 dark:border-gray-600">
                      {cls.students.length} دانش‌آموز
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="bg-emerald-50 dark:bg-gray-700 p-2 rounded-xl text-emerald-600 dark:text-emerald-400 self-end">
                        <Icons.Back className="w-5 h-5" />
                    </div>
                    {/* Edit Button on Card */}
                    <button 
                        onClick={(e) => openEditClassModal(cls, e)}
                        className="p-2 rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Icons.Pencil size={18} />
                    </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-8 left-8 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white p-4 rounded-2xl shadow-emerald-300/50 dark:shadow-emerald-900/50 shadow-xl hover:scale-105 transition-all z-20 flex items-center gap-2"
      >
        <Icons.Plus className="w-6 h-6" />
        <span className="font-bold text-sm hidden md:inline">کلاس جدید</span>
      </button>

      {/* Add/Edit Class Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-emerald-900/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">{editingClass ? 'ویرایش کلاس' : 'کلاس تازه'}</h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-red-500">
                <Icons.Delete className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 mr-1">عنوان کلاس</label>
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-600 outline-none transition-all text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="مثال: ریاضی دهم - الف"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 mr-1">نام کتاب / درس</label>
                <input 
                  type="text" 
                  value={newBookName}
                  onChange={(e) => setNewBookName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-600 outline-none transition-all text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="مثال: ریاضی و آمار ۱"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 mr-1">نوع نمره‌دهی</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNewClassType(ClassType.MODULAR)}
                    className={`p-3 rounded-xl text-sm font-bold transition-all border-2 ${
                      newClassType === ClassType.MODULAR 
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300' 
                      : 'bg-white dark:bg-gray-700 border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    پودمانی
                  </button>
                  <button
                    onClick={() => setNewClassType(ClassType.TERM)}
                    className={`p-3 rounded-xl text-sm font-bold transition-all border-2 ${
                      newClassType === ClassType.TERM 
                      ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-500 text-orange-700 dark:text-orange-300' 
                      : 'bg-white dark:bg-gray-700 border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    ترمی
                  </button>
                </div>
              </div>

              <div>
                 <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 mr-1">
                    {editingClass ? 'تغییر منبع درسی (اختیاری)' : 'منبع درسی (PDF یا تصویر)'}
                 </label>
                 <div className="relative">
                    <input 
                        type="file" 
                        accept="application/pdf,image/*"
                        onChange={handleFileSelect}
                        disabled={isProcessingFile}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    />
                    <div className={`w-full border-2 border-dashed rounded-xl p-4 text-center transition-colors ${attachedFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}>
                        {isProcessingFile ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{width: `${uploadProgress}%`}}></div>
                                </div>
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">در حال پردازش...</span>
                            </div>
                        ) : attachedFile ? (
                            <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                                <Icons.Present size={18} />
                                <span className="text-xs font-bold truncate max-w-[200px]">{attachedFile.name}</span>
                            </div>
                        ) : (
                            <div className="text-gray-400 flex flex-col items-center gap-1">
                                <Icons.Upload size={20} />
                                <span className="text-xs">انتخاب فایل (حداکثر ۲۰ مگابایت)</span>
                            </div>
                        )}
                    </div>
                 </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={resetForm}
                  disabled={isProcessingFile || isSaving}
                  className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  انصراف
                </button>
                <button 
                  onClick={handleCreateOrUpdateClass}
                  disabled={isProcessingFile || isSaving}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 dark:shadow-none transition-transform active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2"
                >
                  {isSaving ? 'ذخیره...' : (editingClass ? 'ویرایش کلاس' : 'ساخت کلاس')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
         <div className="fixed inset-0 bg-emerald-900/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto border dark:border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">تنظیمات</h3>
                    <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-red-500">
                        <Icons.Delete className="w-5 h-5 rotate-45" />
                    </button>
                </div>

                <div className="space-y-6">
                    
                    {/* User Profile Edit */}
                    <div className="bg-emerald-50 dark:bg-gray-900/50 rounded-xl p-4 border border-emerald-100 dark:border-gray-700">
                         <div className="flex items-center gap-2 mb-3 text-emerald-800 dark:text-emerald-400">
                            <Icons.Users size={18} />
                            <h4 className="font-bold text-sm">مشخصات دبیر</h4>
                        </div>
                        <div className="space-y-3">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">نام دبیر</label>
                                <input 
                                    type="text"
                                    value={settings.teacherName}
                                    onChange={e => setSettings({...settings, teacherName: e.target.value})}
                                    className="w-full bg-white dark:bg-gray-700 border border-emerald-200 dark:border-gray-600 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">نام کاربری</label>
                                <input 
                                    type="text"
                                    value={settings.username}
                                    onChange={e => setSettings({...settings, username: e.target.value})}
                                    className="w-full bg-white dark:bg-gray-700 border border-emerald-200 dark:border-gray-600 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">رمز عبور</label>
                                <div className="relative">
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        value={settings.password}
                                        onChange={e => setSettings({...settings, password: e.target.value})}
                                        className="w-full bg-white dark:bg-gray-700 border border-emerald-200 dark:border-gray-600 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500 dir-ltr pl-8 text-left"
                                        dir="ltr"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute left-2 top-2 text-gray-400"
                                    >
                                        {showPassword ? <Icons.EyeOff size={16}/> : <Icons.Eye size={16}/>}
                                    </button>
                                </div>
                             </div>
                             <button 
                                onClick={handleUpdateProfile}
                                className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                             >
                                به‌روزرسانی مشخصات
                             </button>
                        </div>
                    </div>

                    {/* Theme Toggle */}
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-1 flex">
                        <button 
                            onClick={() => handleThemeChange('light')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                                settings.theme !== 'dark' 
                                ? 'bg-white text-emerald-600 shadow-sm' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                            }`}
                        >
                            <Icons.Sun size={16} />
                            روز
                        </button>
                        <button 
                             onClick={() => handleThemeChange('dark')}
                             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                                settings.theme === 'dark' 
                                ? 'bg-gray-800 text-emerald-400 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icons.Moon size={16} />
                            شب
                        </button>
                    </div>

                    {/* Active Year Management */}
                    <div className="bg-emerald-50 dark:bg-gray-900/50 rounded-xl p-4 border border-emerald-100 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-3 text-emerald-800 dark:text-emerald-400">
                            <Icons.Calendar size={18} />
                            <h4 className="font-bold text-sm">سال تحصیلی</h4>
                        </div>

                        {/* Switch Year */}
                        <div className="mb-4">
                            <label className="block text-xs text-emerald-600 dark:text-emerald-500 mb-1.5 font-bold">انتخاب سال فعال</label>
                            <select 
                                value={settings.currentAcademicYear}
                                onChange={(e) => handleSwitchYear(e.target.value)}
                                className="w-full bg-white dark:bg-gray-700 border border-emerald-200 dark:border-gray-600 rounded-lg p-2 text-sm text-gray-800 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none dir-ltr text-center"
                            >
                                {settings.availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        {/* Create New Year */}
                        <div className="border-t border-emerald-200 dark:border-gray-700 pt-3">
                            <label className="block text-xs text-emerald-600 dark:text-emerald-500 mb-1.5 font-bold">ایجاد سال جدید</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    placeholder="مثال: 1404-1405"
                                    value={newYearInput}
                                    onChange={(e) => setNewYearInput(e.target.value)}
                                    className="flex-1 min-w-0 bg-white dark:bg-gray-700 border border-emerald-200 dark:border-gray-600 rounded-lg p-2 text-sm text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none dir-ltr text-center"
                                />
                                <button 
                                    onClick={handleCreateYear}
                                    disabled={!newYearInput.trim()}
                                    className="bg-emerald-600 text-white px-3 py-2 rounded-lg shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                >
                                    <Icons.Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Data Management */}
                    <div className="space-y-3">
                         <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 px-1">داده‌ها</h4>
                         <button onClick={handleBackup} className="w-full flex items-center justify-between bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-gray-600 hover:border-emerald-200 transition-colors group">
                             <div className="flex items-center gap-3">
                                 <div className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg"><Icons.Save size={18}/></div>
                                 <span className="text-sm font-bold text-gray-700 dark:text-gray-200">پشتیبان‌گیری کامل</span>
                             </div>
                         </button>

                         <button onClick={handleRestoreClick} className="w-full flex items-center justify-between bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl hover:bg-amber-50 dark:hover:bg-gray-600 hover:border-amber-200 transition-colors group">
                             <div className="flex items-center gap-3">
                                 <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 p-2 rounded-lg"><Icons.Upload size={18}/></div>
                                 <span className="text-sm font-bold text-gray-700 dark:text-gray-200">بازیابی نسخه پشتیبان</span>
                             </div>
                         </button>
                    </div>

                    {/* About */}
                    <div className="text-center pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mt-1">
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">تولید شده توسط جواد بابائی</p>
                            <a 
                                href="https://mrhonaramoz.ir" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:underline flex items-center justify-center gap-1"
                            >
                                mrhonaramoz.ir
                                <Icons.BookOpen size={12} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
         </div>
      )}
      
      {/* Hidden File Input for Restore - Always available */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleRestoreFile}
        accept="*" 
        className="hidden"
      />
    </div>
  );
};
