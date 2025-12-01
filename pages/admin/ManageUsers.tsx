import React, { useEffect, useState, useRef } from 'react';
import { Plus, Trash2, User, GraduationCap, Upload } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { getSupabase } from '../../services/supabaseClient';
import { Student, Teacher } from '../../types';
import * as XLSX from 'xlsx';

type Tab = 'students' | 'teachers';

const ManageUsers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    national_id: '',
    father_name: '', // for student
    personnel_id: '', // for teacher
    phone: '' // for teacher
  });

  const supabase = getSupabase();

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    
    if (activeTab === 'students') {
      const { data } = await supabase.from('students').select('*').order('created_at', { ascending: false });
      if (data) setStudents(data);
    } else {
      const { data } = await supabase.from('teachers').select('*').order('created_at', { ascending: false });
      if (data) setTeachers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    try {
      if (activeTab === 'students') {
        const { error } = await supabase.from('students').insert([{
          full_name: formData.full_name,
          national_id: formData.national_id,
          father_name: formData.father_name
        }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teachers').insert([{
          full_name: formData.full_name,
          personnel_id: formData.personnel_id,
          phone: formData.phone
        }]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      setFormData({ full_name: '', national_id: '', father_name: '', personnel_id: '', phone: '' });
      fetchData();
    } catch (err: any) {
      alert('خطا: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا مطمئن هستید؟') || !supabase) return;
    const table = activeTab === 'students' ? 'students' : 'teachers';
    await supabase.from(table).delete().eq('id', id);
    fetchData();
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Parse JSON
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          alert('فایل خالی است');
          return;
        }

        // Map data based on active tab
        const rowsToInsert = data.map(row => {
          // Flexible mapping: check for likely column names
          const fullName = row['Name'] || row['name'] || row['نام'] || row['نام و نام خانوادگی'] || '';
          const nationalId = row['NationalID'] || row['id'] || row['کدملی'] || row['کد ملی'] || String(Math.floor(Math.random() * 1000000000));
          const father = row['Father'] || row['father'] || row['نام پدر'] || '';
          
          if (!fullName) return null;

          return {
            full_name: fullName,
            national_id: String(nationalId),
            father_name: father
          };
        }).filter(Boolean);

        if (rowsToInsert.length > 0) {
          setLoading(true);
          const { error } = await supabase.from('students').upsert(rowsToInsert, { onConflict: 'national_id' });
          setLoading(false);
          
          if (error) {
            alert('خطا در وارد کردن داده‌ها: ' + error.message);
          } else {
            alert(`${rowsToInsert.length} دانش‌آموز با موفقیت وارد شدند.`);
            fetchData();
          }
        }
      } catch (err: any) {
        alert('خطا در خواندن فایل اکسل: ' + err.message);
        setLoading(false);
      }
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex bg-white p-1 rounded-xl shadow-sm">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'students' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <GraduationCap size={18} />
          دانش‌آموزان
        </button>
        <button
          onClick={() => setActiveTab('teachers')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'teachers' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <User size={18} />
          دبیران
        </button>
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-lg font-bold text-gray-800">
          لیست {activeTab === 'students' ? 'دانش‌آموزان' : 'دبیران'}
        </h2>
        <div className="flex gap-2">
          {activeTab === 'students' && (
             <>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleExcelImport} 
                 accept=".xlsx,.xls" 
                 className="hidden" 
               />
               <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={loading} className="text-xs px-3">
                 <Upload size={16} />
                 اکسل
               </Button>
             </>
          )}
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={20} />
            {activeTab === 'students' ? 'افزودن' : 'افزودن'}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="grid gap-3">
        {loading && <p className="text-center text-gray-500">در حال بارگذاری...</p>}
        
        {!loading && activeTab === 'students' ? (
          students.map((s) => (
            <Card key={s.id} className="flex justify-between items-center p-4">
              <div>
                <h3 className="font-bold text-gray-900">{s.full_name}</h3>
                <p className="text-sm text-gray-500">کدملی: {s.national_id} {s.father_name ? `| پدر: ${s.father_name}` : ''}</p>
              </div>
              <button onClick={() => handleDelete(s.id)} className="text-red-500 p-2 bg-red-50 rounded-lg">
                <Trash2 size={18} />
              </button>
            </Card>
          ))
        ) : (
          !loading && teachers.map((t) => (
            <Card key={t.id} className="flex justify-between items-center p-4">
              <div>
                <h3 className="font-bold text-gray-900">{t.full_name}</h3>
                <p className="text-sm text-gray-500">پرسنلی: {t.personnel_id || '-'}</p>
              </div>
              <button onClick={() => handleDelete(t.id)} className="text-red-500 p-2 bg-red-50 rounded-lg">
                <Trash2 size={18} />
              </button>
            </Card>
          ))
        )}
        
        {!loading && ((activeTab === 'students' && students.length === 0) || (activeTab === 'teachers' && teachers.length === 0)) && (
          <p className="text-center text-gray-500 py-8">موردی یافت نشد.</p>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={activeTab === 'students' ? 'تعریف دانش‌آموز جدید' : 'تعریف دبیر جدید'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نام و نام خانوادگی</label>
            <input
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-500"
            />
          </div>

          {activeTab === 'students' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">کد ملی</label>
                <input
                  required
                  value={formData.national_id}
                  onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-500 ltr text-right"
                  type="number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نام پدر</label>
                <input
                  value={formData.father_name}
                  onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          {activeTab === 'teachers' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">کد پرسنلی (اختیاری)</label>
                <input
                  value={formData.personnel_id}
                  onChange={(e) => setFormData({ ...formData, personnel_id: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-500 ltr text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">شماره تماس</label>
                <input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-500 ltr text-right"
                  type="tel"
                />
              </div>
            </>
          )}

          <Button type="submit" fullWidth>
            <Plus size={20} />
            ذخیره
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default ManageUsers;