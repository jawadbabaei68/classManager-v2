import React, { useState, useEffect } from 'react';
import { Classroom, ClassType, AIResource } from '../types';
import { getClasses, saveClass } from '../services/storageService';
import { Icons } from '../components/Icons';

interface HomeScreenProps {
  onSelectClass: (c: Classroom) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectClass }) => {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
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
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getClasses();
    setClasses(data);
    setLoading(false);
  };

  const processFile = async (file: File): Promise<AIResource> => {
    return new Promise((resolve, reject) => {
      // If it's an image, resize and compress it
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1024; // Resize large images to 1024px width
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
                // Compress to JPEG 70% quality
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
        // For non-images (PDF), read as is but warn if huge later
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
      // Hard limit for local processing/storage
      if (file.size > 20 * 1024 * 1024) {
        alert("حجم فایل انتخاب شده زیاد است. لطفاً فایلی کمتر از ۲۰ مگابایت انتخاب کنید.");
        e.target.value = ''; 
        return;
      }

      setIsProcessingFile(true);
      setUploadProgress(10); // Simulated start

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
      await loadData();
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

  return (
    <div className="min-h-screen bg-emerald-50 pb-24 font-vazir">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 px-6 py-5 shadow-sm border-b border-emerald-100">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-emerald-800 tracking-tight">مدیریت کلاس</h1>
            <p className="text-xs text-emerald-600 mt-1 font-medium">دستیار هوشمند معلم</p>
          </div>
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700">
            <Icons.BookOpen size={20} />
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {loading ? (
            <div className="flex justify-center pt-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center mt-32 opacity-60">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <Icons.Home className="w-10 h-10 text-emerald-500" />
            </div>
            <p className="text-emerald-800 font-bold text-lg">هنوز کلاسی ندارید</p>
            <p className="text-sm text-emerald-600 mt-2 max-w-xs leading-relaxed">
              برای شروع، دکمه‌ی «افزودن کلاس» را در پایین صفحه لمس کنید.
            </p>
          </div>
        ) : (
          classes.map((cls) => (
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
              <h3 className="text-xl font-black text-gray-900">کلاس تازه</h3>
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
                                <span className="text-xs text-emerald-600 font-bold">در حال پردازش و فشرده‌سازی...</span>
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
                 <p className="text-[10px] text-gray-400 mt-1 mr-1">تصاویر به صورت خودکار فشرده می‌شوند تا طرح درس سریع‌تر تولید شود.</p>
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
                  {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>ذخیره...</span>
                      </>
                  ) : (
                      'ساخت کلاس'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};