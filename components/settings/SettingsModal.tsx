import React, { useState } from 'react';
import { GlobalSettings } from '../../types';
import { Icons } from '../Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  cloudStatus: 'online' | 'offline' | 'error';
  generateSQLSchema: () => string;
  testConnection: (url: string, key: string) => Promise<{ success: boolean; message: string }>;
  saveSettings: (s: GlobalSettings) => Promise<void>;
  handleThemeChange: (theme: 'light' | 'dark') => Promise<void>;
  fullBackupToCloud: (onProgress: (msg: string) => void) => Promise<{ success: boolean; message: string }>;
  setIsSyncing: (s: boolean) => void;
  setSyncProgress: (p: any) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  cloudStatus,
  generateSQLSchema,
  testConnection,
  saveSettings,
  handleThemeChange,
  fullBackupToCloud,
  setIsSyncing,
  setSyncProgress
}) => {
  if (!isOpen) return null;

  const [expandedSection, setExpandedSection] = useState<'profile' | 'cloud' | 'data' | 'theme' | 'year' | null>(null);
  const [testConnMsg, setTestConnMsg] = useState('');
  const [showSchema, setShowSchema] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');

  const normalizeInput = (str: string | undefined) => {
      if (!str) return '';
      return str
      .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
      .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584))
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .trim();
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
      await testConnection(settings.supabaseUrl || '', settings.supabaseKey || '');
      // Cloud status update happens in parent hook usually, but testConnection returns result
  };

  const handleFullCloudBackup = async () => {
      if (window.confirm("آیا از ارسال تمام داده‌های گوشی به فضای ابری (جداول رابطه‌ای) اطمینان دارید؟")) {
          setIsSyncing(true);
          setSyncProgress({ show: true, msg: 'شروع پشتیبان‌گیری...', percent: 0 });
          
          const res = await fullBackupToCloud((msg) => {
              setSyncProgress((prev: any) => ({ ...prev, msg: msg }));
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
        <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-gray-900 dark:text-white">تنظیمات</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-red-500"><Icons.Delete className="w-5 h-5 rotate-45" /></button>
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
                        <span className="flex items-center gap-2"><Icons.Upload size={16}/> اتصال به فضای ابری (sql)</span>
                        <Icons.Back size={16} className={`transition-transform ${expandedSection === 'cloud' ? '-rotate-90' : 'rotate-90'}`}/>
                    </button>
                    {expandedSection === 'cloud' && (
                        <div className="p-4 space-y-3 bg-white dark:bg-gray-800">
                            <div className="text-xs text-gray-500 mb-2">اطلاعات پروژه sql خود را وارد کنید:</div>
                            <input 
                                type="text" 
                                placeholder="sql URL (https://sql.co)" 
                                value={settings.supabaseUrl || ''} 
                                onChange={e=>setSettings({...settings, supabaseUrl:e.target.value})} 
                                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white text-xs text-left text-gray-900"
                                dir="ltr"
                            />
                            <input 
                                type="password" 
                                placeholder="sql Key" 
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
                    <p className="text-xs font-bold text-gray-500">ساخته شده توسط جواد بابائی</p>
                    <a href="https://mrhonaramoz.ir" className="text-[10px] text-emerald-600 block mt-1">mrhonaramoz.ir</a>
                    <a href="https://t.me/jawadbabaei68" className="text-[10px] text-emerald-600 block mt-1">ارتباط با من</a>
                </div>
            </div>
        </div>
    </div>
  );
};
