
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, UserPlus, FileText } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { getSupabase } from '../services/supabaseClient';

const Dashboard: React.FC = () => {
  const [role, setRole] = useState<string | null>(null);
  const [stats, setStats] = useState({ students: 0, classes: 0, teachers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const r = localStorage.getItem('user_role');
      setRole(r);
      const supabase = getSupabase();
      
      if (supabase && r === 'admin') {
        // Quick stats for admin (using head: true for count)
        const { count: sCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
        const { count: cCount } = await supabase.from('classes').select('*', { count: 'exact', head: true });
        const { count: tCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
        setStats({ students: sCount || 0, classes: cCount || 0, teachers: tCount || 0 });
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">در حال بارگذاری...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">پیشخوان</h2>
        <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
          {role === 'admin' ? 'مدیر سیستم' : role === 'teacher' ? 'دبیر' : 'کاربر'}
        </span>
      </div>

      {role === 'admin' && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none p-4">
            <div className="text-3xl font-bold mb-1">{stats.students}</div>
            <div className="text-blue-100 text-sm">دانش‌آموزان</div>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none p-4">
            <div className="text-3xl font-bold mb-1">{stats.classes}</div>
            <div className="text-purple-100 text-sm">کلاس‌ها</div>
          </Card>
        </div>
      )}

      <div className="grid gap-4">
        {role === 'admin' && (
          <>
            <Link to="/admin/classes">
              <Card className="flex items-center gap-4 hover:shadow-md transition-shadow p-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-xl">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">مدیریت کلاس‌ها</h3>
                  <p className="text-sm text-gray-500">تعریف کلاس و دروس</p>
                </div>
              </Card>
            </Link>
            <Link to="/admin/users">
              <Card className="flex items-center gap-4 hover:shadow-md transition-shadow p-4">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                  <UserPlus size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">مدیریت کاربران</h3>
                  <p className="text-sm text-gray-500">دبیران و دانش‌آموزان</p>
                </div>
              </Card>
            </Link>
          </>
        )}

        {(role === 'teacher' || role === 'admin') && (
           <Link to="/teacher/attendance">
             <Card className="flex items-center gap-4 hover:shadow-md transition-shadow p-4">
               <div className="p-3 bg-teal-100 text-teal-600 rounded-xl">
                 <Users size={24} />
               </div>
               <div>
                 <h3 className="font-bold text-gray-800">حضور و غیاب</h3>
                 <p className="text-sm text-gray-500">ثبت وضعیت دانش‌آموزان</p>
               </div>
             </Card>
           </Link>
        )}

        {role === 'teacher' && (
          <Link to="/teacher/grades">
            <Card className="flex items-center gap-4 hover:shadow-md transition-shadow p-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">ثبت نمرات</h3>
                <p className="text-sm text-gray-500">مدیریت نمرات کلاسی</p>
              </div>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
