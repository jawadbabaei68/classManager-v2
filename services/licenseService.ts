import { Preferences } from '@capacitor/preferences';
import { OnlineLicenseData, LicenseInfo } from '../types';

// Updated URL as requested
const LICENSE_API_URL = 'https://mrhonaramoz.ir/licenses.json';
const LICENSE_STORAGE_KEY = 'app_license_data';

export const checkLocalLicense = async (): Promise<'VALID' | 'EXPIRED' | 'NOT_FOUND'> => {
  const { value } = await Preferences.get({ key: LICENSE_STORAGE_KEY });
  
  if (!value) return 'NOT_FOUND';

  try {
    const license: LicenseInfo = JSON.parse(value);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (today > license.end) {
      return 'EXPIRED';
    }
    
    // Optional: Check start date if needed, usually we just care about expiration
    // if (today < license.start) return 'INVALID';

    return 'VALID';
  } catch (e) {
    return 'NOT_FOUND';
  }
};

export const activateLicense = async (inputKey: string): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. Fetch JSON from GitHub
    const response = await fetch(LICENSE_API_URL, { cache: 'no-store' });
    if (!response.ok) {
      return { success: false, message: 'خطا در برقراری ارتباط با سرور.' };
    }

    const data: OnlineLicenseData = await response.json();
    const licenseData = data[inputKey];

    // 2. Validate Key existence
    if (!licenseData) {
      return { success: false, message: 'کد لایسنس نامعتبر است.' };
    }

    // 3. Validate Date
    const today = new Date().toISOString().split('T')[0];
    if (today > licenseData.end) {
      return { success: false, message: 'مهلت استفاده از این لایسنس به پایان رسیده است.' };
    }

    // 4. Save to Preferences
    const licenseToSave: LicenseInfo = {
      key: inputKey,
      start: licenseData.start,
      end: licenseData.end
    };

    await Preferences.set({
      key: LICENSE_STORAGE_KEY,
      value: JSON.stringify(licenseToSave),
    });

    return { success: true, message: 'فعال‌سازی با موفقیت انجام شد.' };

  } catch (error) {
    console.error(error);
    return { success: false, message: 'خطا در فعال‌سازی. لطفاً اتصال اینترنت را بررسی کنید.' };
  }
};

export const clearLicense = async () => {
    await Preferences.remove({ key: LICENSE_STORAGE_KEY });
};