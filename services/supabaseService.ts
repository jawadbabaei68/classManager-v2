
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSettings, getClasses, bulkUpsertClasses, saveSettings } from './storageService';
import { Classroom, ClassType, Student, Session, SessionRecord, StudentPerformance } from '../types';

let supabaseInstance: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

export const getSupabaseClient = async () => {
  const settings = await getSettings();
  if (!settings?.supabaseUrl || !settings?.supabaseKey) return null;

  if (supabaseInstance && currentUrl === settings.supabaseUrl && currentKey === settings.supabaseKey) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(settings.supabaseUrl, settings.supabaseKey, {
        auth: {
            persistSession: false
        }
    });
    currentUrl = settings.supabaseUrl;
    currentKey = settings.supabaseKey;
    return supabaseInstance;
  } catch (error) {
    console.error("sql Init Error", error);
    return null;
  }
};

export const testConnection = async (url: string, key: string): Promise<{ success: boolean; message: string }> => {
  try {
    const client = createClient(url, key);
    const res = await fetch(`${url}/rest/v1/`, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
        }
    });

    if (res.status === 200 || res.status === 404) {
        return { success: true, message: 'اتصال با موفقیت برقرار شد.' };
    }
    return { success: false, message: 'خطا در اتصال. لطفاً URL و Key را بررسی کنید.' };

  } catch (error: any) {
    return { success: false, message: 'خطا: ' + error.message };
  }
};

export const generateSQLSchema = () => {
    return `
ارتباط با پشتیبان :
    09150470023


    `;
};

// --- Helpers for Decomposition & Reconstruction ---

const chunkArray = <T>(array: T[], size: number): T[][] => {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

const insertInChunks = async (supabase: SupabaseClient, table: string, data: any[]) => {
    const chunks = chunkArray(data, 1000); // Process 1000 records at a time
    for (const chunk of chunks) {
        const { error } = await supabase.from(table).insert(chunk);
        if (error) throw error;
    }
};

const uploadClassToSupabase = async (supabase: SupabaseClient, cls: Classroom, onProgress: (msg: string) => void) => {
    
    // Optimize Resources
    const optimizedResources = { ...cls.resources, lessonPlans: [] };
    // Remove very large files (> 5MB Base64) to prevent payload failures
    if (optimizedResources.mainFile && optimizedResources.mainFile.data.length > 5 * 1024 * 1024) {
        optimizedResources.mainFile = undefined;
    }

    // 1. Upsert Class Info (Fast)
    onProgress(`ارسال کلاس: ${cls.name}`);
    await supabase.from('classes').upsert({
        id: cls.id,
        name: cls.name,
        book_name: cls.bookName,
        academic_year: cls.academicYear,
        type: cls.type,
        resources: optimizedResources,
        updated_at: cls.updatedAt || Date.now()
    });

    // 2. Clear Old Data (Optimized with Cascade)
    // Deleting students and sessions will automatically cascade delete grades and session_records
    // This reduces the number of delete requests from 4 to 2, and lets the DB handle the heavy lifting.
    onProgress('پاکسازی داده‌های قدیمی...');
    await Promise.all([
        supabase.from('students').delete().eq('class_id', cls.id),
        supabase.from('sessions').delete().eq('class_id', cls.id)
    ]);

    // 3. Prepare Payloads
    const studentsPayload = cls.students.map(s => ({
        id: s.id,
        class_id: cls.id,
        name: s.name,
        phone_number: s.phoneNumber,
        avatar_url: s.avatarUrl
    }));

    const sessionsPayload = cls.sessions.map(s => ({
        id: s.id,
        class_id: cls.id,
        date: s.date,
        day_of_week: s.dayOfWeek,
        lesson_plan: s.lessonPlan
    }));

    // 4. Insert Students & Sessions (Parallel)
    onProgress('ارسال دانش‌آموزان و جلسات...');
    await Promise.all([
        studentsPayload.length > 0 ? insertInChunks(supabase, 'students', studentsPayload) : Promise.resolve(),
        sessionsPayload.length > 0 ? insertInChunks(supabase, 'sessions', sessionsPayload) : Promise.resolve()
    ]);

    // 5. Prepare Child Payloads
    const recordsPayload: any[] = [];
    cls.sessions.forEach(sess => {
        sess.records.forEach(rec => {
            recordsPayload.push({
                unique_id: `${sess.id}_${rec.studentId}`,
                session_id: sess.id,
                student_id: rec.studentId,
                attendance: rec.attendance,
                discipline: rec.discipline,
                positive_points: rec.positivePoints,
                note: rec.note
            });
        });
    });

    const gradesPayload: any[] = [];
    if (cls.performance) {
        cls.performance.forEach(p => {
            gradesPayload.push({
                student_id: p.studentId,
                class_id: cls.id,
                grades_modular: p.gradesModular,
                grades_term: p.gradesTerm
            });
        });
    }

    // 6. Insert Grades & Records (Parallel)
    onProgress('ارسال نمرات و سوابق...');
    await Promise.all([
        recordsPayload.length > 0 ? insertInChunks(supabase, 'session_records', recordsPayload) : Promise.resolve(),
        gradesPayload.length > 0 ? insertInChunks(supabase, 'grades', gradesPayload) : Promise.resolve()
    ]);
};

const downloadClassFromSupabase = async (supabase: SupabaseClient, classData: any): Promise<Classroom> => {
    const clsId = classData.id;

    // Fetch Relations
    const { data: students } = await supabase.from('students').select('*').eq('class_id', clsId);
    const { data: sessions } = await supabase.from('sessions').select('*').eq('class_id', clsId);
    const { data: grades } = await supabase.from('grades').select('*').eq('class_id', clsId);
    
    // For records, we need all records for these sessions
    // Ideally we would join, but separate queries are easier to manage in JS
    let records: any[] = [];
    if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s: any) => s.id);
        
        // Chunk query if too many sessions (Supabase 'in' filter limit)
        // Although local apps rarely have >100 sessions per class, safe to chunk.
        const chunkedIds = chunkArray(sessionIds, 50);
        for (const chunk of chunkedIds) {
             const { data: recs } = await supabase.from('session_records').select('*').in('session_id', chunk);
             if (recs) records = [...records, ...recs];
        }
    }

    // Reconstruct Students
    const studentObjs: Student[] = (students || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        phoneNumber: s.phone_number,
        avatarUrl: s.avatar_url
    }));

    // Reconstruct Sessions
    const sessionObjs: Session[] = (sessions || []).map((s: any) => ({
        id: s.id,
        classId: clsId,
        date: s.date,
        dayOfWeek: s.day_of_week,
        lessonPlan: s.lesson_plan,
        records: records.filter((r: any) => r.session_id === s.id).map((r: any) => ({
            sessionId: r.session_id,
            studentId: r.student_id,
            attendance: r.attendance,
            discipline: r.discipline,
            positivePoints: Number(r.positive_points),
            note: r.note
        }))
    }));

    // Reconstruct Performance
    const perfObjs: StudentPerformance[] = (grades || []).map((g: any) => ({
        studentId: g.student_id,
        gradesModular: g.grades_modular || [],
        gradesTerm: g.grades_term || []
    }));

    return {
        id: classData.id,
        name: classData.name,
        bookName: classData.book_name,
        academicYear: classData.academic_year,
        type: classData.type as ClassType,
        resources: classData.resources || { lessonPlans: [] },
        updatedAt: Number(classData.updated_at),
        students: studentObjs,
        sessions: sessionObjs,
        performance: perfObjs
    };
};

export const syncData = async (onProgress: (msg: string) => void): Promise<{ success: boolean; message: string }> => {
  const supabase = await getSupabaseClient();
  if (!supabase) return { success: false, message: 'تنظیمات Supabase کامل نیست.' };

  try {
    onProgress('در حال دریافت لیست کلاس‌ها...');
    const localClasses = await getClasses();
    const { data: cloudClassesRaw, error } = await supabase.from('classes').select('*');
    
    if (error) throw error;
    const cloudClasses = cloudClassesRaw || [];
    
    const toUpload: Classroom[] = [];
    const toDownloadIds: any[] = [];

    const cloudMap = new Map(cloudClasses.map((c: any) => [c.id, c]));
    const localMap = new Map(localClasses.map(c => [c.id, c]));

    // Compare
    for (const local of localClasses) {
        const cloud = cloudMap.get(local.id) as any;
        if (!cloud) {
            toUpload.push(local);
        } else {
            const localTime = local.updatedAt || 0;
            const cloudTime = Number(cloud.updated_at) || 0;
            // Use a threshold (e.g., 1 second) to prevent ping-pong syncing on slight clock diffs
            if (localTime > cloudTime + 1000) {
                toUpload.push(local);
            } else if (cloudTime > localTime + 1000) {
                toDownloadIds.push(cloud);
            }
        }
    }

    for (const cloud of cloudClasses) {
        if (!localMap.has(cloud.id)) {
            toDownloadIds.push(cloud);
        }
    }

    if (toUpload.length === 0 && toDownloadIds.length === 0) {
        return { success: true, message: 'اطلاعات به‌روز است.' };
    }

    // Upload
    for (let i = 0; i < toUpload.length; i++) {
        const cls = toUpload[i];
        onProgress(`آپلود کلاس (${i+1}/${toUpload.length}): ${cls.name}`);
        await uploadClassToSupabase(supabase, cls, onProgress);
    }

    // Download
    const downloadedClasses: Classroom[] = [];
    for (let i = 0; i < toDownloadIds.length; i++) {
        const cloudMeta = toDownloadIds[i];
        onProgress(`دانلود کلاس (${i+1}/${toDownloadIds.length}): ${cloudMeta.name}`);
        const fullClass = await downloadClassFromSupabase(supabase, cloudMeta);
        downloadedClasses.push(fullClass);
    }

    if (downloadedClasses.length > 0) {
        onProgress('ذخیره داده‌های دریافت شده...');
        await bulkUpsertClasses(downloadedClasses);
    }

    return { 
        success: true, 
        message: `همگام‌سازی تکمیل شد.\nارسال: ${toUpload.length} کلاس\nدریافت: ${toDownloadIds.length} کلاس` 
    };

  } catch (error: any) {
    console.error("Sync Error", error);
    return { success: false, message: 'خطا: ' + error.message };
  }
};

export const fullBackupToCloud = async (onProgress: (msg: string) => void): Promise<{ success: boolean; message: string }> => {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, message: 'تنظیمات Supabase کامل نیست.' };
  
    try {
      const localClasses = await getClasses();
      if (localClasses.length === 0) return { success: true, message: 'داده‌ای وجود ندارد.' };
  
      for (let i = 0; i < localClasses.length; i++) {
          const cls = localClasses[i];
          onProgress(`پشتیبان‌گیری کلاس (${i+1}/${localClasses.length}): ${cls.name}`);
          await uploadClassToSupabase(supabase, cls, (m)=> onProgress(m));
      }
  
      return { success: true, message: 'تمامی داده‌ها در جداول رابطه‌ای ذخیره شدند.' };
    } catch (error: any) {
      return { success: false, message: 'خطا در آپلود: ' + error.message };
    }
};