import { StoredAudioTrack } from '../types';

const DB_NAME = 'QuizShowAudioLibrary';
const DB_VERSION = 1;
const STORE_NAME = 'audio_tracks';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save an uploaded custom audio track into IndexedDB library
 */
export async function saveAudioToLibrary(
  name: string,
  dataUrl: string,
  type: 'bgMusic' | 'timer' | 'answer' | 'typewriter' | 'general'
): Promise<StoredAudioTrack> {
  const sizeBytes = Math.round((dataUrl.length * 3) / 4);
  const fileSizeStr = sizeBytes > 1024 * 1024
    ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(sizeBytes / 1024).toFixed(0)} KB`;

  const track: StoredAudioTrack = {
    id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name: name.replace(/\.[^/.]+$/, ''),
    dataUrl,
    type,
    uploadedAt: Date.now(),
    fileSizeStr,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(track);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to localStorage:', err);
    try {
      const existing = JSON.parse(localStorage.getItem('quiz_audio_library') || '[]');
      existing.unshift(track);
      localStorage.setItem('quiz_audio_library', JSON.stringify(existing.slice(0, 10)));
    } catch (e) {
      console.error('LocalStorage quota exceeded:', e);
    }
  }

  return track;
}

/**
 * Get all stored audio tracks from library
 */
export async function getStoredAudioTracks(): Promise<StoredAudioTrack[]> {
  try {
    const db = await openDB();
    return await new Promise<StoredAudioTrack[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const tracks = (req.result || []) as StoredAudioTrack[];
        tracks.sort((a, b) => b.uploadedAt - a.uploadedAt);
        resolve(tracks);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB load failed, falling back to localStorage:', err);
    try {
      const existing = JSON.parse(localStorage.getItem('quiz_audio_library') || '[]');
      return existing;
    } catch (e) {
      return [];
    }
  }
}

/**
 * Delete a stored audio track from library
 */
export async function deleteAudioTrackFromLibrary(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    try {
      const existing: StoredAudioTrack[] = JSON.parse(localStorage.getItem('quiz_audio_library') || '[]');
      const filtered = existing.filter(t => t.id !== id);
      localStorage.setItem('quiz_audio_library', JSON.stringify(filtered));
    } catch (e) {}
  }
}
