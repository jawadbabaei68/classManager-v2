import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Settings as SettingsIcon } from 'lucide-react';
import { getSupabase, hasSupabaseConfig } from '../services/supabaseClient';
import { Button } from '../components/ui/Button';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Clear error if user navigates away and back or changes input
  useEffect(() => {
    setError('');
  }, [email, password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!hasSupabaseConfig()) {
      setError('ابتدا تنظیمات دیتابیس را انجام دهید');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setError('خطا در اتصال به Supabase. تنظیمات را بررسی کنید.');
      return;
    }

    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else if (data.session) {
      // Check profile role (simplified)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single();
        
      if (profile) {
        localStorage.setItem('user_role', profile.role);
        navigate('/');
      } else {
        // Fallback if no profile exists yet
        localStorage.setItem('user_role', 'student'); // Default fallback
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-600 to-blue-800">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <LogIn size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ورود به مدرسه یار</h1>
          <p className="text-gray-500 mt-2">سامانه مدیریت هوشمند مدارس</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ایمیل</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-colors text-left text-gray-900 placeholder-gray-400"
              dir="ltr"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رمز عبور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-colors text-left text-gray-900 placeholder-gray-400"
              dir="ltr"
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'در حال ورود...' : 'ورود به حساب'}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t text-center">
          <Link to="/settings" className="inline-flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors text-sm">
            <SettingsIcon size={16} />
            تنظیمات دیتابیس و راهنما
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;