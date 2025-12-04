import React from 'react';
import { Classroom } from '../../types';
import { Icons } from '../Icons';

interface ClassListProps {
  classes: Classroom[];
  filteredClasses: Classroom[];
  academicYear: string;
  setViewMode: (mode: 'dashboard') => void;
  onSelectClass: (cls: Classroom) => void;
  openEditClassModal: (cls: Classroom, e: React.MouseEvent) => void;
  setShowModal: (show: boolean) => void;
}

export const ClassList: React.FC<ClassListProps> = ({
  filteredClasses,
  academicYear,
  setViewMode,
  onSelectClass,
  openEditClassModal,
  setShowModal
}) => {
  return (
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
                <p className="text-emerald-900 dark:text-emerald-100 font-black text-xl mb-2">سال تحصیلی {academicYear}</p>
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
  );
};
