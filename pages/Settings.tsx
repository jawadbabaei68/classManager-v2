import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, AlertCircle, Database, HelpCircle, Code, Copy, CheckCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { hasSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, STORAGE_KEY_URL, STORAGE_KEY_KEY } from '../services/supabaseClient';
import { sqlSchema, helpReadme } from '../help/helpData';

const Settings: React.FC = () => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'sql' | 'readme'>('config');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setUrl(localStorage.getItem(STORAGE_KEY_URL) || '');
    setKey(localStorage.getItem(STORAGE_KEY_KEY) || '');
    setSaved(hasSupabaseConfig());
  }, []);

  const handleSave = () => {
    setError('');
    setSuccessMsg('');
    
    try {
      saveSupabaseConfig(url.trim(), key.trim());
      setSaved(true);
      setSuccessMsg('تنظیمات با موفقیت ذخیره شد. اکنون می‌توانید وارد شوید.');
      
      // Optional: Redirect to login after short delay if not logged in
      setTimeout(() => {
        // We don't force redirect, but we could
      }, 1500);
      
    } catch (err: any) {
      setError(err.message || 'خطا در ذخیره تنظیمات');
    }
  };

  const handleReset = () => {
    if (confirm('آیا مطمئن هستید؟ اطلاعات اتصال پاک خواهد شد.')) {
      clearSupabaseConfig();
      setUrl('');
      setKey('');
      setSaved(false);
      setSuccessMsg('');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('کپی شد!');
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-white rounded-xl shadow-sm overflow-x-auto">
        {[
          { id: 'config', label: 'اتصال دیتابیس', icon: Database },
          { id: 'sql', label: 'اسکیما SQL', icon: Code },
          { id: 'readme', label: 'راهنما', icon: HelpCircle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <Card title="تنظیمات Supabase">
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>برای استفاده از برنامه، اطلاعات پروژه Supabase خود را وارد کنید. این اطلاعات در حافظه دستگاه ذخیره می‌شود.</p>
            </div>

            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-green-100 text-green-700 rounded-xl text-sm flex items-center gap-2">
                <CheckCircle size={16} />
                {successMsg}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supabase URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full p-3 rounded-xl border bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-left ltr text-gray-900 placeholder-gray-400"
                placeholder="https://xyz.supabase.co"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supabase Anon Key</label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full p-3 rounded-xl border bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-left ltr text-gray-900 placeholder-gray-400"
                placeholder="eyJh..."
                dir="ltr"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button onClick={handleSave} fullWidth>
                <Save size={18} />
                {saved ? 'بروزرسانی اتصال' : 'ذخیره و اتصال'}
              </Button>
              {saved && (
                <Button variant="danger" onClick={handleReset}>
                  پاک کردن
                </Button>
              )}
            </div>
            
            {saved && (
               <Button variant="secondary" fullWidth onClick={() => navigate('/login')}>
                 بازگشت به صفحه ورود
               </Button>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'sql' && (
        <Card title="SQL Schema">
          <p className="text-sm text-gray-500 mb-4">
            این کدها را در بخش SQL Editor در Supabase اجرا کنید تا جداول ساخته شوند.
          </p>
          <div className="relative">
            <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto text-left" dir="ltr">
              {sqlSchema}
            </pre>
            <button 
              onClick={() => copyToClipboard(sqlSchema)}
              className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg"
            >
              <Copy size={16} />
            </button>
          </div>
        </Card>
      )}

      {activeTab === 'readme' && (
        <Card title="راهنمای پروژه">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
            {helpReadme}
          </pre>
        </Card>
      )}
    </div>
  );
};

export default Settings;