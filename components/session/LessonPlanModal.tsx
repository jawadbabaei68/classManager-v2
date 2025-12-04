import React from 'react';
import { DailyLessonPlan } from '../../types';
import { Icons } from '../Icons';

interface LessonPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    lessonPlan: DailyLessonPlan;
    setLessonPlan: React.Dispatch<React.SetStateAction<DailyLessonPlan>>;
}

export const LessonPlanModal: React.FC<LessonPlanModalProps> = ({ isOpen, onClose, lessonPlan, setLessonPlan }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl border dark:border-gray-700 my-auto">
                <div className="flex justify-between items-center mb-6">
                     <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Icons.File className="text-purple-600 dark:text-purple-400" />
                        طرح درس روزانه
                     </h3>
                     <button onClick={onClose} className="text-gray-400 hover:text-red-500">
                         <Icons.Delete className="w-5 h-5 rotate-45" />
                     </button>
                </div>
                
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">موضوع درس</label>
                        <input 
                           type="text" 
                           value={lessonPlan.topic}
                           onChange={e => setLessonPlan({...lessonPlan, topic: e.target.value})}
                           className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">اهداف رفتاری</label>
                        <textarea 
                           rows={3}
                           value={lessonPlan.objectives}
                           onChange={e => setLessonPlan({...lessonPlan, objectives: e.target.value})}
                           className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white text-sm"
                           placeholder="دانش‌آموز پس از پایان درس باید بتواند..."
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">روش تدریس</label>
                            <input 
                                type="text"
                                value={lessonPlan.method}
                                onChange={e => setLessonPlan({...lessonPlan, method: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">وسایل مورد نیاز</label>
                            <input 
                                type="text"
                                value={lessonPlan.materials}
                                onChange={e => setLessonPlan({...lessonPlan, materials: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white text-sm"
                            />
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">فعالیت‌های یادگیری</label>
                        <textarea 
                           rows={3}
                           value={lessonPlan.activities}
                           onChange={e => setLessonPlan({...lessonPlan, activities: e.target.value})}
                           className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white text-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">ارزشیابی</label>
                        <textarea 
                           rows={2}
                           value={lessonPlan.evaluation}
                           onChange={e => setLessonPlan({...lessonPlan, evaluation: e.target.value})}
                           className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white text-sm"
                        />
                     </div>
                </div>

                <div className="mt-6">
                    <button onClick={onClose} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-200 dark:shadow-none transition-colors">
                        تایید و بستن
                    </button>
                </div>
            </div>
        </div>
    );
};
