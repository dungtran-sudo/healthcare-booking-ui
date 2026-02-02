import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeCache } from './cache';

const CacheContext = createContext(null);

export function CacheProvider({ children }) {
  const [cacheData, setCacheData] = useState({
    pathways: [],
    canonicalServices: [],
    popularServices: [],
    providers: [],
    isLoading: true,
    isReady: false
  });

  useEffect(() => {
    const loadCache = async () => {
      try {
        const data = await initializeCache();
        setCacheData({
          ...data,
          isLoading: false,
          isReady: true
        });
        console.log(
          `Cache ready: ${data.pathways.length} pathways, ` +
          `${data.canonicalServices.length} services, ` +
          `${data.popularServices.length} popular ` +
          `(${data.fromCache ? 'from cache' : 'fresh'})`
        );
      } catch (error) {
        console.error('Cache initialization error:', error);
        setCacheData(prev => ({
          ...prev,
          isLoading: false,
          isReady: false
        }));
      }
    };

    loadCache();
  }, []);

  // Function to refresh cache
  const refreshCache = async () => {
    setCacheData(prev => ({ ...prev, isLoading: true }));
    const data = await initializeCache(true);
    setCacheData({
      ...data,
      isLoading: false,
      isReady: true
    });
  };

  return (
    <CacheContext.Provider value={{ ...cacheData, refreshCache }}>
      {children}
    </CacheContext.Provider>
  );
}

export function useCache() {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
}

export default CacheContext;
