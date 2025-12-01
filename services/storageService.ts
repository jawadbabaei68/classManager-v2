
import { Classroom, GlobalSettings, BackupPayload, CustomReport } from '../types';

const DB_NAME = 'ClassManagerDB';
const STORE_CLASSES = 'classes';
const STORE_SETTINGS = 'settings';
const STORE_REPORTS = 'custom_reports';
const DB_VERSION = 3;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CLASSES)) {
        db.createObjectStore(STORE_CLASSES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_REPORTS)) {
        db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getClasses = async (): Promise<Classroom[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CLASSES, 'readonly');
      const store = tx.objectStore(STORE_CLASSES);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error getting classes:", error);
    return [];
  }
};

export const saveClass = async (classroom: Classroom): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLASSES, 'readwrite');
    const store = tx.objectStore(STORE_CLASSES);
    
    // Always update the timestamp when saving locally
    const classWithTimestamp = { ...classroom, updatedAt: Date.now() };
    
    const request = store.put(classWithTimestamp);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const bulkUpsertClasses = async (classes: Classroom[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLASSES, 'readwrite');
    const store = tx.objectStore(STORE_CLASSES);
    
    classes.forEach(cls => {
        store.put(cls);
    });
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const deleteClass = async (classId: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLASSES, 'readwrite');
    const store = tx.objectStore(STORE_CLASSES);
    const request = store.delete(classId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const updateClass = async (updatedClass: Classroom): Promise<void> => {
  return saveClass(updatedClass);
};

// --- Custom Reports ---

export const getCustomReports = async (): Promise<CustomReport[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REPORTS, 'readonly');
      const store = tx.objectStore(STORE_REPORTS);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return [];
  }
};

export const saveCustomReport = async (report: CustomReport): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORTS, 'readwrite');
    const store = tx.objectStore(STORE_REPORTS);
    const request = store.put({ ...report, updatedAt: Date.now() });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteCustomReport = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORTS, 'readwrite');
    const store = tx.objectStore(STORE_REPORTS);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Global Settings ---

export const getSettings = async (): Promise<GlobalSettings | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.get('global');
      
      request.onsuccess = () => {
        const data = request.result;
        if (data) {
           // Backward compatibility
           if (!data.availableYears) {
             data.availableYears = [data.currentAcademicYear];
           }
           resolve(data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return null;
  }
};

export const saveSettings = async (settings: GlobalSettings): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    const store = tx.objectStore(STORE_SETTINGS);
    const request = store.put({ ...settings, id: 'global' });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Restore ---

export const restoreData = async (data: any): Promise<void> => {
  const db = await openDB();
  
  // Normalize Data
  let classesToRestore: Classroom[] = [];
  let settingsToRestore: GlobalSettings | null = null;
  let reportsToRestore: CustomReport[] = [];

  if (Array.isArray(data)) {
      // Old Format: Just an array of classes
      classesToRestore = data;
  } else if (data && typeof data === 'object') {
      // New Format: BackupPayload
      if (data.classes && Array.isArray(data.classes)) {
          classesToRestore = data.classes;
      }
      if (data.settings) {
          settingsToRestore = data.settings;
      }
      if (data.customReports && Array.isArray(data.customReports)) {
          reportsToRestore = data.customReports;
      }
  } else {
      throw new Error("فرمت فایل نامعتبر است.");
  }

  // Add timestamps if missing
  classesToRestore = classesToRestore.map(c => ({
      ...c,
      updatedAt: c.updatedAt || Date.now()
  }));

  return new Promise((resolve, reject) => {
    // Include STORE_REPORTS in transaction if it exists (it should with v3)
    const stores = [STORE_CLASSES, STORE_SETTINGS, STORE_REPORTS];
    const tx = db.transaction(stores, 'readwrite');
    
    const classStore = tx.objectStore(STORE_CLASSES);
    const settingsStore = tx.objectStore(STORE_SETTINGS);
    const reportStore = tx.objectStore(STORE_REPORTS);
    
    // Clear existing stores
    classStore.clear();
    reportStore.clear();
    
    if (settingsToRestore) {
        settingsStore.put({ ...settingsToRestore, id: 'global' });
    }

    // Add classes
    classesToRestore.forEach(item => {
        classStore.add(item);
    });

    // Add reports
    reportsToRestore.forEach(item => {
        reportStore.add(item);
    });

    // Wait for the transaction to complete successfully
    tx.oncomplete = () => resolve();
    
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error("Transaction aborted"));
  });
};

export const exportToCSV = (classroom: Classroom) => {
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Student Name,ID\n";
  
  classroom.students.forEach(student => {
    csvContent += `${student.name},${student.id}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${classroom.name}_export.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
