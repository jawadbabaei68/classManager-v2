import { Classroom } from '../types';

const DB_NAME = 'ClassManagerDB';
const STORE_NAME = 'classes';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
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
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(classroom);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteClass = async (classId: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(classId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const updateClass = async (updatedClass: Classroom): Promise<void> => {
  return saveClass(updatedClass);
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