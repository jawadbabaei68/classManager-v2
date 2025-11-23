
import { Classroom, GlobalSettings } from '../types';

const DB_NAME = 'ClassManagerDB';
const STORE_CLASSES = 'classes';
const STORE_SETTINGS = 'settings';
const DB_VERSION = 2;

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
    const request = store.put(classroom);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
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
           // Backward compatibility: ensure availableYears exists
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

export const restoreData = async (data: Classroom[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLASSES, 'readwrite');
    const store = tx.objectStore(STORE_CLASSES);
    
    // Clear existing data
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
      // Add new data
      let completed = 0;
      if (data.length === 0) {
        resolve();
        return;
      }

      data.forEach(item => {
        const req = store.add(item);
        req.onsuccess = () => {
          completed++;
          if (completed === data.length) resolve();
        };
        req.onerror = () => reject(req.error);
      });
    };
    
    clearRequest.onerror = () => reject(clearRequest.error);
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
