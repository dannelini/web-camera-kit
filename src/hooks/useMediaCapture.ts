import { useState, useCallback, useEffect } from 'react';
import { CapturedMedia, CameraMode } from '../types/media';
import { mediaDatabase, StoredMediaData } from '../utils/indexedDb';

export const useMediaCapture = () => {
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted media on initialization
  useEffect(() => {
    const loadPersistedMedia = async () => {
      try {
        console.log('Loading persisted media from IndexedDB...');
        const storedMedia = await mediaDatabase.getAllMedia();
        
        if (storedMedia.length > 0) {
          const restoredMedia: CapturedMedia[] = storedMedia.map((stored: StoredMediaData) => ({
            id: stored.id,
            type: stored.type,
            url: URL.createObjectURL(stored.blob),
            blob: stored.blob,
            timestamp: stored.timestamp,
            filename: stored.filename,
            indexedDbId: stored.id // Store the IndexedDB ID for future reference
          }));
          
          // Sort by timestamp (newest first)
          restoredMedia.sort((a, b) => b.timestamp - a.timestamp);
          
          setCapturedMedia(restoredMedia);
          console.log(`Restored ${restoredMedia.length} media items from IndexedDB`);
        }
      } catch (error) {
        console.error('Failed to load persisted media:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersistedMedia();
  }, []);

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      capturedMedia.forEach(media => {
        if (media.url.startsWith('blob:')) {
          URL.revokeObjectURL(media.url);
        }
      });
    };
  }, []);

  const addMedia = useCallback(async (media: CapturedMedia) => {
    try {
      // Store in IndexedDB first
      const storedData: StoredMediaData = {
        id: media.id,
        type: media.type,
        blob: media.blob,
        timestamp: media.timestamp,
        filename: media.filename
      };
      
      const indexedDbId = await mediaDatabase.storeMedia(storedData);
      
      // Add IndexedDB ID to media object
      const mediaWithId: CapturedMedia = {
        ...media,
        indexedDbId
      };
      
      // Update state
      setCapturedMedia(prev => [mediaWithId, ...prev]);
      console.log('Media added and persisted:', media.id);
    } catch (error) {
      console.error('Failed to persist media, adding to memory only:', error);
      // Still add to memory even if persistence fails
      setCapturedMedia(prev => [media, ...prev]);
    }
  }, []);

  const removeMedia = useCallback(async (id: string) => {
    setCapturedMedia(prev => {
      const mediaToRemove = prev.find(m => m.id === id);
      if (mediaToRemove) {
        // Revoke object URL
        if (mediaToRemove.url.startsWith('blob:')) {
          URL.revokeObjectURL(mediaToRemove.url);
        }
        
        // Remove from IndexedDB if it has an indexed ID
        if (mediaToRemove.indexedDbId) {
          mediaDatabase.deleteMedia(mediaToRemove.indexedDbId).catch(error => {
            console.error('Failed to delete media from IndexedDB:', error);
          });
        }
      }
      return prev.filter(m => m.id !== id);
    });
  }, []);

  const clearAllMedia = useCallback(async () => {
    try {
      // Clear from IndexedDB
      await mediaDatabase.clearAllMedia();
      console.log('All media cleared from IndexedDB');
    } catch (error) {
      console.error('Failed to clear media from IndexedDB:', error);
    }
    
    // Revoke all object URLs and clear state
    capturedMedia.forEach(media => {
      if (media.url.startsWith('blob:')) {
        URL.revokeObjectURL(media.url);
      }
    });
    setCapturedMedia([]);
  }, [capturedMedia]);

  const downloadMedia = useCallback((media: CapturedMedia) => {
    const link = document.createElement('a');
    
    if (window.innerWidth <= 768) {
      // Mobile download handling
      try {
        link.href = media.url;
        link.download = media.filename;
        link.style.display = 'none';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        document.body.appendChild(link);
        setTimeout(() => {
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
          }, 100);
        }, 10);
        
      } catch (error) {
        console.error('Mobile download failed, trying fallback:', error);
        window.open(media.url, '_blank');
      }
    } else {
      // Desktop: Use standard approach
      link.href = media.url;
      link.download = media.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);

  const downloadMediaBlob = useCallback((media: CapturedMedia) => {
    try {
      const blob = media.blob;
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      
    document.body.appendChild(link);
    link.click();
      
      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error('Blob download failed, using fallback:', error);
      downloadMedia(media);
    }
  }, []);

  const createMediaFromBlob = useCallback((blob: Blob, type: CameraMode): CapturedMedia => {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let url: string;
    try {
      url = URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating object URL:', error);
      url = '';
    }
    
    const timestamp = Date.now();
    const extension = type === 'photo' ? 'jpg' : 'webm';
    const filename = `${type}_${new Date(timestamp).toISOString().slice(0, 19).replace(/[:.]/g, '-')}.${extension}`;

    return {
      id,
      type,
      url,
      blob,
      timestamp,
      filename
    };
  }, []);

  return {
    capturedMedia,
    isCapturing,
    isLoading,
    setIsCapturing,
    addMedia,
    removeMedia,
    clearAllMedia,
    downloadMedia,
    downloadMediaBlob,
    createMediaFromBlob
  };
};