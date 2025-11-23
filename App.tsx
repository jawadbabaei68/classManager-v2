import React, { useState, useEffect } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ClassScreen } from './screens/ClassScreen';
import { Classroom } from './types';
import { App as CapacitorApp } from '@capacitor/app';
import { Icons } from './components/Icons';
import { checkLocalLicense, activateLicense, clearLicense } from './services/licenseService';

const App: React.FC = () => {
  // License State
  const [licenseStatus, setLicenseStatus] = useState<'LOADING' | 'VALID' | 'EXPIRED' | 'NOT_FOUND'>('LOADING');
  const [inputKey, setInputKey] = useState('');
  const [activationMsg, setActivationMsg] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  // App State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const status = await checkLocalLicense();
    setLicenseStatus(status);
  };

  // Handle Hardware Back Button
  useEffect(() => {
    const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (selectedClass) {
        setSelectedClass(null);
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      backButtonListener.then(listener => listener.remove());
    };
  }, [selectedClass]);

  const handleActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setIsActivating(true);
    setActivationMsg('');

    const result = await activateLicense(inputKey.trim());
    setIsActivating(false);
    
    if (result.success) {
      setLicenseStatus('VALID');
    } else {
      setActivationMsg(result.message);
    }
  };

  const handleRemoveLicense = async () => {
      await clearLicense();
      setLicenseStatus('NOT_FOUND');
      setActivationMsg('');
      setInputKey('');
  };

  // --- UI: Loading ---
  if (licenseStatus === 'LOADING') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // --- UI: Not Activated (Enter Key) ---
  if (licenseStatus === 'NOT_FOUND') {
    return (
      <div className="min-h-screen bg-emerald-50 dark:bg-gray-900 flex items-center justify-center p-6 font-vazir" dir="rtl">
        <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
              <Icons.Lock size={40} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">فعال‌سازی نرم‌افزار</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">لطفاً کد لایسنس خود را وارد کنید.</p>
          </div>

          <form onSubmit={handleActivation} className="space-y-6">
            <div>
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="XXXX-XXXX"
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-4 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg font-bold tracking-widest text-gray-900 dark:text-white"
                dir="ltr"
              />
            </div>
            
            {activationMsg && (
              <p className="text-red-500 text-sm font-bold text-center bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-900/30">
                {activationMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={isActivating || !inputKey}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex justify-center items-center gap-2"
            >
              {isActivating ? 'در حال بررسی...' : 'فعال‌سازی'}
              {!isActivating && <Icons.CheckCircle size={20} />}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- UI: Expired ---
  if (licenseStatus === 'EXPIRED') {
    return (
      <div className="min-h-screen bg-red-50 dark:bg-gray-900 flex items-center justify-center p-6 font-vazir" dir="rtl">
        <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 dark:text-red-400">
            <Icons.Absent size={40} />
          </div>
          <h1 className="text-2xl font-black text-red-600 dark:text-red-400 mb-4">اعتبار لایسنس پایان یافته</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
            مهلت استفاده از این نرم‌افزار به پایان رسیده است. لطفاً برای تمدید با پشتیبانی تماس بگیرید.
          </p>
          <button 
            onClick={handleRemoveLicense}
            className="text-gray-400 hover:text-gray-600 underline text-xs"
          >
            وارد کردن کد جدید
          </button>
        </div>
      </div>
    );
  }

  // --- Main App Flow (If License is VALID) ---
  if (isAuthenticated && selectedClass) {
    return (
      <ClassScreen 
        classroom={selectedClass} 
        onBack={() => setSelectedClass(null)} 
      />
    );
  }

  return (
    <HomeScreen 
      isAuthenticated={isAuthenticated}
      onLoginSuccess={() => setIsAuthenticated(true)}
      onLogout={() => {
        setIsAuthenticated(false);
        setSelectedClass(null);
      }}
      onSelectClass={setSelectedClass} 
    />
  );
};

export default App;