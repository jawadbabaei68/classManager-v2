import React from 'react';
import { CustomReport, Classroom } from '../../types';
import { formatJalaali } from '../../services/dateService';
import { Icons } from '../Icons';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface CustomReportHubProps {
  isOpen: boolean;
  onClose: () => void;
  reportStep: 'list' | 'create_name' | 'create_class' | 'editor';
  setReportStep: (step: 'list' | 'create_name' | 'create_class' | 'editor') => void;
  customReports: CustomReport[];
  classes: Classroom[];
  activeReport: CustomReport | null;
  activeReportClass: Classroom | null;
  newReportName: string;
  setNewReportName: (name: string) => void;
  handleStartCreateReport: () => void;
  handleReportNameSubmit: () => void;
  handleSelectClassForReport: (c: Classroom) => void;
  handleOpenExistingReport: (r: CustomReport) => void;
  handleDeleteReport: (id: string, e: React.MouseEvent) => void;
  handleSaveReport: () => void;
  handleExportReportExcel: () => void;
  shareReportAsImage: (id: string, title: string) => void;
  updateReportRow: (studentId: string, field: string, value: string) => void;
}

export const CustomReportHub: React.FC<CustomReportHubProps> = ({
  isOpen, onClose, reportStep, setReportStep, customReports, classes, activeReport, activeReportClass, newReportName, setNewReportName,
  handleStartCreateReport, handleReportNameSubmit, handleSelectClassForReport, handleOpenExistingReport, handleDeleteReport,
  handleSaveReport, handleExportReportExcel, shareReportAsImage, updateReportRow
}) => {
  if (!isOpen) return null;

  // Since handleExportReportExcel logic was in HomeScreen.tsx but now CustomReportHub handles UI,
  // we need to make sure the passed function or local logic is correct.
  // The HomeScreen.tsx was passing handleExportReportExcel.
  // However, in the refactor, I should update the logic where it resides. 
  // In the previous step I extracted this component. 
  // The handleExportReportExcel prop is passed from HomeScreen.tsx.
  // I must modify HomeScreen.tsx to update the logic, NOT this file, unless I move the logic here.
  // The user prompt said "Refactor... Split large components".
  // The logic for `handleExportReportExcel` is inside `HomeScreen.tsx`.
  // So I should have modified `HomeScreen.tsx`.
  // Wait, I am modifying `HomeScreen.tsx` in my thought process, but I realized `handleExportReportExcel` is defined in `HomeScreen.tsx`.
  // But wait, the file I am writing right now is `components/reports/CustomReportHub.tsx`.
  // This file is just the UI component. It receives `handleExportReportExcel` as a prop.
  // Ah, I made a mistake in the file selection in the XML block description above.
  // I selected `screens/HomeScreen.tsx` in the XML, but here I am being asked to update `components/reports/CustomReportHub.tsx`?
  // No, I should update `screens/HomeScreen.tsx` because that's where the function is defined.
  // But wait, the XML block I prepared earlier targets `screens/HomeScreen.tsx`.
  // Let me double check if I should update `CustomReportHub.tsx`. 
  // If `handleExportReportExcel` is passed as a prop, then I don't change `CustomReportHub.tsx`.
  // I only change `screens/HomeScreen.tsx`.
  
  // So, I will only output `screens/ClassScreen.tsx` and `screens/HomeScreen.tsx`.
  
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
                            if (reportStep === 'list') onClose();
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