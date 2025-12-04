import React from 'react';
import { Icons } from '../Icons';

interface DashboardTilesProps {
  setViewMode: (mode: 'dashboard' | 'classes') => void;
  setShowAbsenteesModal: (show: boolean) => void;
  setShowStatsModal: (show: boolean) => void;
  setShowSearchModal: (show: boolean) => void;
  setShowReportHub: (show: boolean) => void;
  setShowBackupModal: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  setReportStep: (step: 'list' | 'create_name' | 'create_class' | 'editor') => void;
  version?: string;
}

export const DashboardTiles: React.FC<DashboardTilesProps> = ({
  setViewMode,
  setShowAbsenteesModal,
  setShowStatsModal,
  setShowSearchModal,
  setShowReportHub,
  setShowBackupModal,
  setShowSettingsModal,
  setReportStep,
  version = '3.1.2'
}) => {
  return (
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
           <p>نسخه: {version} </p>
           <p>آقای هنرآموز</p>
      </div>
    </div>
  );
};
