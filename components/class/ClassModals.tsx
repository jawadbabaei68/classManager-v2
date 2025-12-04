
import React from 'react';
import { Icons } from '../Icons';

interface AddStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    newStudentName: string;
    setNewStudentName: (val: string) => void;
    newStudentPhone: string;
    setNewStudentPhone: (val: string) => void;
    handleExcelImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    addStudent: () => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, newStudentName, setNewStudentName, newStudentPhone, setNewStudentPhone, handleExcelImport, addStudent }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">افزودن دانش‌آموز</h3>
                
                <div className="space-y-3 mb-6">
                    <input 
                      type="text" 
                      placeholder="نام و نام خانوادگی" 
                      value={newStudentName} 
                      onChange={e => setNewStudentName(e.target.value)} 
                      className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none focus:border-emerald-500 dark:text-white"
                      autoFocus
                    />
                    <input 
                      type="tel" 
                      placeholder="شماره تماس (اختیاری)" 
                      value={newStudentPhone} 
                      onChange={e => setNewStudentPhone(e.target.value)} 
                      className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none focus:border-emerald-500 dark:text-white"
                    />
                </div>

                {/* Batch Import Button */}
                <div className="mb-4 relative border-t pt-4">
                    <p className="text-xs text-center text-gray-400 mb-2">یا وارد کردن لیست از اکسل</p>
                    <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <button className="w-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-xl text-sm font-bold">انتخاب فایل اکسل</button>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-gray-500 font-bold">لغو</button>
                    <button onClick={addStudent} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none">افزودن</button>
                </div>
            </div>
        </div>
    );
};

interface EditStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    newStudentName: string;
    setNewStudentName: (val: string) => void;
    newStudentPhone: string;
    setNewStudentPhone: (val: string) => void;
    saveEditedStudent: () => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({ isOpen, onClose, newStudentName, setNewStudentName, newStudentPhone, setNewStudentPhone, saveEditedStudent }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">ویرایش دانش‌آموز</h3>
                <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} className="w-full p-3 mb-3 rounded-xl bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 dark:text-white"/>
                <input type="tel" value={newStudentPhone} onChange={e => setNewStudentPhone(e.target.value)} className="w-full p-3 mb-6 rounded-xl bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 dark:text-white"/>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 text-gray-500 font-bold">لغو</button>
                    <button onClick={saveEditedStudent} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold">ذخیره</button>
                </div>
            </div>
        </div>
    );
};

interface NewSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    newSessionDate: string;
    setNewSessionDate: (val: string) => void;
    newSessionDay: string;
    setNewSessionDay: (val: string) => void;
    newSessionModule: number;
    setNewSessionModule: (val: number) => void;
    handleConfirmCreateSession: () => void;
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({ 
    isOpen, onClose, 
    newSessionDate, setNewSessionDate, 
    newSessionDay, setNewSessionDay, 
    newSessionModule, setNewSessionModule,
    handleConfirmCreateSession 
}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600 dark:text-purple-400">
                        <Icons.Calendar size={32} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">جلسه جدید</h3>
                </div>
                
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block px-1">پودمان</label>
                        <select 
                            value={newSessionModule} 
                            onChange={e => setNewSessionModule(Number(e.target.value))}
                            className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-center font-bold dark:text-white outline-none"
                        >
                            {[1, 2, 3, 4, 5].map(m => (
                                <option key={m} value={m}>پودمان {m}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block px-1">تاریخ جلسه</label>
                        <input type="text" value={newSessionDate} onChange={e => setNewSessionDate(e.target.value)} className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-center font-bold text-lg dark:text-white" dir="ltr"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block px-1">روز هفته</label>
                        <input type="text" value={newSessionDay} onChange={e => setNewSessionDay(e.target.value)} className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-center font-bold dark:text-white"/>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-gray-500 font-bold">لغو</button>
                    <button onClick={handleConfirmCreateSession} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none">ایجاد</button>
                </div>
            </div>
        </div>
    );
};

interface EditClassInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    editClassName: string;
    setEditClassName: (val: string) => void;
    editBookName: string;
    setEditBookName: (val: string) => void;
    handleEditClassInfo: () => void;
    handleDeleteClass: () => void;
}

export const EditClassInfoModal: React.FC<EditClassInfoModalProps> = ({ isOpen, onClose, editClassName, setEditClassName, editBookName, setEditBookName, handleEditClassInfo, handleDeleteClass }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
               <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">ویرایش اطلاعات کلاس</h3>
                  <input type="text" placeholder="نام کلاس" value={editClassName} onChange={e => setEditClassName(e.target.value)} className="w-full mb-3 p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                  <input type="text" placeholder="نام درس" value={editBookName} onChange={e => setEditBookName(e.target.value)} className="w-full mb-6 p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                  
                  <button onClick={handleEditClassInfo} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold mb-3">ذخیره تغییرات</button>
                  <button onClick={handleDeleteClass} className="w-full border border-red-200 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-red-900/20">حذف کلاس</button>
                  <button onClick={onClose} className="w-full mt-2 text-gray-400 text-sm">بازگشت</button>
               </div>
          </div>
    );
};
