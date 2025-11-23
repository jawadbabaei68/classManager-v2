
import React, { useState, useEffect, useRef } from 'react';
import { Classroom, ClassType, AIResource, GlobalSettings } from '../types';
import { getClasses, saveClass, restoreData, getSettings, saveSettings } from '../services/storageService';
import { Icons } from '../components/Icons';

interface HomeScreenProps {
  onSelectClass: (c: Classroom) => void;
}

// Helper to normalize numbers (Persian/Arabic to English) and trim whitespace
const normalizeInput = (str: string | undefined) => {
    if (!str) return '';
    return str
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584))
    .trim();
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectClass }) => {
  // Data State
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Visibility toggle

  // UI State
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  
  // Global Settings State
  const [settings, setSettings] = useState<GlobalSettings>({ 
    teacherName: '', 
    username: '',
    password: '',
    currentAcademicYear: '1403-1404',
    availableYears: ['1403-1404']
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
  
  // Restore State
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    // Strict filtering: Only show classes for the ACTIVE year
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
      // If settings exist but no password (old version migration), force setup
      if (!savedSettings.password) {
          setSettings(prev => ({ ...prev, ...savedSettings }));
          setShowSetupModal(true);
      } else {
          // Normal flow: stored settings found, require login
          setSettings(savedSettings);
          setShowLoginModal(true);
      }
    } else {
      // First time install
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
      
      // Compare normalized versions to handle number differences
      if (inputNorm === storedNorm) {
          setIsAuthenticated(true);
          setShowLoginModal(false);
          setLoginError('');
          setLoginPassword('');
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
    
    const newSettings = {
        ...settings,
        // Save normalized credentials to avoid future issues
        username: normalizeInput(settings.username),
        password: normalizeInput(settings.password),
        availableYears: settings.availableYears.length > 0 ? settings.availableYears : [settings.currentAcademicYear]
    };
    
    await saveSettings(newSettings);
    setSettings(newSettings);
    setShowSetupModal(false);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
      setIsAuthenticated(false);
      setLoginPassword('');
      setLoginError('');
      setShowLoginModal(true);
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

  const handleCreateClass = async () => {
    if (!newClassName.trim() || !newBookName.trim()) return;
    
    setIsSaving(true);
    try {
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

  const resetForm = () => {
    setShowModal(false);
    setNewClassName('');
    setNewBookName('');
    setAttachedFile(undefined);
    setNewClassType(ClassType.MODULAR);
    setUploadProgress(0);
  };

  // --- Backup & Restore Logic ---
  const handleBackup = () => {
    const dataStr = JSON.stringify(classes);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `backup_class_manager_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const parsedData = JSON.parse(json);
        
        if (!Array.isArray(parsedData)) {
          throw new Error("Invalid backup format");
        }

        if (window.confirm("آیا مطمئن هستید؟ با بازگردانی نسخه پشتیبان، تمام اطلاعات فعلی حذف و جایگزین خواهد شد.")) {
           await restoreData(parsedData);
           const updatedClasses = await getClasses();
           setClasses(updatedClasses);
           alert("بازیابی اطلاعات با موفقیت انجام شد.");
           setShowSettingsModal(false);
        }
      } catch (error) {
        console.error("Restore error:", error);
        alert("خطا در بازیابی فایل. لطفا از سالم بودن فایل بک‌آپ اطمینان حاصل کنید.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  // --- Auth Check Render ---
  if (!isAuthenticated) {
      return (
        <div className="min-h-screen bg-emerald-50 font-vazir flex items-center justify-center p-4">
            {/* Setup Modal */}
            {showSetupModal && (
                <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                            <Icons.Settings size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900">راه‌اندازی اولیه</h2>
                        <p className="text-gray-500 text-sm mt-2">لطفاً اطلاعات کاربری خود را تعیین کنید.</p>
                    </div>
                    
                    <form onSubmit={handleSetupSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">نام و نام خانوادگی دبیر</label>
                            <input 
                                type="text"
                                required
                                value={settings.teacherName}
                                onChange={e => setSettings({...settings, teacherName: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">نام کاربری</label>
                            <input 
                                type="text"
                                required
                                value={settings.username}
                                onChange={e => setSettings({...settings, username: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">رمز عبور (جهت ورود به برنامه)</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={settings.password}
                                    onChange={e => setSettings({...settings, password: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none pl-10 text-left"
                                    dir="ltr"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-3 top-3 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <Icons.EyeOff size={20}/> : <Icons.Eye size={20}/>}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">سال تحصیلی جاری</label>
                            <input 
                                type="text"
                                required
                                value={settings.currentAcademicYear}
                                onChange={e => setSettings({...settings, currentAcademicYear: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                                dir="ltr"
                                placeholder="1403-1404"
                            />
                        </div>
                        <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg mt-4">
                            ذخیره و شروع
                        </button>
                    </form>
                </div>
            )}

            {/* Login Modal */}
            {showLoginModal && !showSetupModal && (
                <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                            <Icons.Lock size={32} />
                        </div>
                        <h2 className="text-xl font-black text-gray-900">خوش آمدید</h2>
                        <p className="text-emerald-700 font-bold text-sm mt-2">{settings.teacherName}</p>
                    </div>
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">رمز عبور</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    autoFocus
                                    value={loginPassword}
                                    onChange={e => setLoginPassword(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none text-center tracking-widest"
                                    dir="ltr"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-3 top-3 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <Icons.EyeOff size={20}/> : <Icons.Eye size={20}/>}
                                </button>
                            </div>
                        </div>
                        {loginError && <p className="text-red-500 text-xs font-bold text-center">{loginError}</p>}
                        <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg">
                            ورود
                        </button>
                    </form>
                </div>
            )}
        </div>
      );
  }

  // --- Main App Render ---
  return (
    <div className="min-h-screen bg-emerald-50 pb-24 font-vazir">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 px-6 py-5 shadow-sm border-b border-emerald-100 transition-all">
        <div className="flex justify-between items-center relative">
          {/* Left Side: Title & Teacher */}
          <div className="z-10">
            <h1 className="text-xl md:text-2xl font-black text-emerald-800 tracking-tight">مدیریت کلاس</h1>
            <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
              {settings.teacherName ? `دبیر: ${settings.teacherName}` : 'دستیار هوشمند معلم'}
            </p>
          </div>

          {/* Center: Academic Year Badge */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
             <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] md:text-xs font-black px-3 py-1.5 rounded-2xl shadow-sm flex items-center gap-1.5 select-none">
                <Icons.Calendar size={12} className="text-emerald-500 opacity-80"/>
                <span className="pt-0.5">{settings.currentAcademicYear}</span>
             </div>
          </div>

          {/* Right Side: Settings & Logout */}
          <div className="z-10 flex gap-2">
             <button 
                onClick={handleLogout}
                className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm"
                title="خروج"
            >
                <Icons.LogOut size={20} />
            </button>
            <button 
                onClick={() => setShowSettingsModal(true)}
                className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 hover:bg-emerald-200 transition-colors shadow-sm"
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        ) : filteredClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center mt-20 opacity-80">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Icons.Home className="w-10 h-10 text-emerald-500" />
            </div>
            <p className="text-emerald-900 font-black text-xl mb-2">سال تحصیلی {settings.currentAcademicYear}</p>
            <p className="text-sm text-emerald-700 font-medium mb-4">هیچ کلاسی در این سال ثبت نشده است.</p>
            <button 
               onClick={() => setShowModal(true)}
               className="text-emerald-600 text-sm border border-emerald-200 px-4 py-2 rounded-xl hover:bg-emerald-50"
            >
              + ایجاد اولین کلاس
            </button>
          </div>
        ) : (
          filteredClasses.map((cls) => (
            <div 
              key={cls.id} 
              onClick={() => onSelectClass(cls)}
              className="group bg-white p-5 rounded-2xl shadow-sm hover:shadow-md border border-emerald-100/50 transition-all duration-300 cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 transition-all group-hover:w-2"></div>
              <div className="flex justify-between items-start pl-2">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{cls.name}</h2>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mb-3">
                    <Icons.BookOpen size={14} />
                    {cls.bookName}
                  </p>
                  
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                      cls.type === ClassType.MODULAR 
                        ? 'bg-purple-50 text-purple-600 border border-purple-100' 
                        : 'bg-orange-50 text-orange-600 border border-orange-100'
                    }`}>
                      {cls.type === ClassType.MODULAR ? 'پودمانی' : 'ترمی'}
                    </span>
                    <span className="text-[10px] bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full border border-gray-100">
                      {cls.students.length} دانش‌آموز
                    </span>
                  </div>
                </div>
                <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600">
                  <Icons.Back className="w-5 h-5 rotate-180" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-8 left-8 bg-emerald-600 text-white p-4 rounded-2xl shadow-emerald-300/50 shadow-xl hover:bg-emerald-700 hover:scale-105 transition-all z-20 flex items-center gap-2"
      >
        <Icons.Plus className="w-6 h-6" />
        <span className="font-bold text-sm hidden md:inline">کلاس جدید</span>
      </button>

      {/* Add Class Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-emerald-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900">کلاس تازه ({settings.currentAcademicYear})</h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-red-500">
                <Icons.Delete className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">عنوان کلاس</label>
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all text-sm text-gray-900 placeholder-gray-400"
                  placeholder="مثال: ریاضی دهم - الف"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">نام کتاب / درس</label>
                <input 
                  type="text" 
                  value={newBookName}
                  onChange={(e) => setNewBookName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all text-sm text-gray-900 placeholder-gray-400"
                  placeholder="مثال: ریاضی و آمار ۱"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">نوع نمره‌دهی</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNewClassType(ClassType.MODULAR)}
                    className={`p-3 rounded-xl text-sm font-bold transition-all border-2 ${
                      newClassType === ClassType.MODULAR 
                      ? 'bg-purple-50 border-purple-500 text-purple-700' 
                      : 'bg-white border-transparent text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    پودمانی
                  </button>
                  <button
                    onClick={() => setNewClassType(ClassType.TERM)}
                    className={`p-3 rounded-xl text-sm font-bold transition-all border-2 ${
                      newClassType === ClassType.TERM 
                      ? 'bg-orange-50 border-orange-500 text-orange-700' 
                      : 'bg-white border-transparent text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    ترمی
                  </button>
                </div>
              </div>

              <div>
                 <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">منبع درسی (PDF یا تصویر)</label>
                 <div className="relative">
                    <input 
                        type="file" 
                        accept="application/pdf,image/*"
                        onChange={handleFileSelect}
                        disabled={isProcessingFile}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    />
                    <div className={`w-full border-2 border-dashed rounded-xl p-4 text-center transition-colors ${attachedFile ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                        {isProcessingFile ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{width: `${uploadProgress}%`}}></div>
                                </div>
                                <span className="text-xs text-emerald-600 font-bold">در حال پردازش...</span>
                            </div>
                        ) : attachedFile ? (
                            <div className="flex items-center justify-center gap-2 text-emerald-600">
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
                  className="flex-1 py-3 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  انصراف
                </button>
                <button 
                  onClick={handleCreateClass}
                  disabled={isProcessingFile || isSaving}
                  className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-transform active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2"
                >
                  {isSaving ? 'ذخیره...' : 'ساخت کلاس'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
         <div className="fixed inset-0 bg-emerald-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-gray-900">تنظیمات</h3>
                    <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-red-500">
                        <Icons.Delete className="w-5 h-5 rotate-45" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Active Year Management */}
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-3 text-emerald-800">
                            <Icons.Calendar size={18} />
                            <h4 className="font-bold text-sm">سال تحصیلی</h4>
                        </div>

                        {/* Switch Year */}
                        <div className="mb-4">
                            <label className="block text-xs text-emerald-600 mb-1.5 font-bold">انتخاب سال فعال</label>
                            <select 
                                value={settings.currentAcademicYear}
                                onChange={(e) => handleSwitchYear(e.target.value)}
                                className="w-full bg-white border border-emerald-200 rounded-lg p-2 text-sm text-gray-800 font-bold focus:ring-2 focus:ring-emerald-500 outline-none dir-ltr text-center"
                            >
                                {settings.availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        {/* Create New Year */}
                        <div className="border-t border-emerald-200 pt-3">
                            <label className="block text-xs text-emerald-600 mb-1.5 font-bold">ایجاد سال جدید</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    placeholder="مثال: 1404-1405"
                                    value={newYearInput}
                                    onChange={(e) => setNewYearInput(e.target.value)}
                                    className="flex-1 bg-white border border-emerald-200 rounded-lg p-2 text-sm text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none dir-ltr text-center"
                                />
                                <button 
                                    onClick={handleCreateYear}
                                    disabled={!newYearInput.trim()}
                                    className="bg-emerald-600 text-white px-3 py-2 rounded-lg shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Icons.Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Data Management */}
                    <div className="space-y-3">
                         <h4 className="font-bold text-sm text-gray-700 px-1">داده‌ها</h4>
                         <button onClick={handleBackup} className="w-full flex items-center justify-between bg-white border border-gray-200 p-3 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 transition-colors group">
                             <div className="flex items-center gap-3">
                                 <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg"><Icons.Save size={18}/></div>
                                 <span className="text-sm font-bold text-gray-700">پشتیبان‌گیری کامل</span>
                             </div>
                         </button>

                         <button onClick={handleRestoreClick} className="w-full flex items-center justify-between bg-white border border-gray-200 p-3 rounded-xl hover:bg-amber-50 hover:border-amber-200 transition-colors group">
                             <div className="flex items-center gap-3">
                                 <div className="bg-amber-100 text-amber-600 p-2 rounded-lg"><Icons.Upload size={18}/></div>
                                 <span className="text-sm font-bold text-gray-700">بازیابی نسخه پشتیبان</span>
                             </div>
                         </button>
                         <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleRestoreFile}
                            accept=".json"
                            className="hidden"
                         />
                    </div>

                    {/* About */}
                    <div className="text-center pt-4 border-t border-gray-100">
                        <div className="bg-gray-50 rounded-xl p-4 mt-1">
                            <p className="text-sm font-bold text-gray-700 mb-1">تولید شده توسط جواد بابائی</p>
                            <a 
                                href="https://mrhonaramoz.ir" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-emerald-600 text-xs font-bold hover:underline flex items-center justify-center gap-1"
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
    </div>
  );
};
