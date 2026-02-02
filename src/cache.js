/**
 * Session Cache Manager
 * Preloads and caches API data for instant access
 */

const API_URL = process.env.REACT_APP_API_URL;

// Cache keys
const CACHE_KEYS = {
  PATHWAYS: 'hh_pathways',
  CANONICAL_SERVICES: 'hh_canonical_services',
  POPULAR_SERVICES: 'hh_popular_services',
  PROVIDERS: 'hh_providers',
  CACHE_TIMESTAMP: 'hh_cache_timestamp'
};

// Cache duration: 30 minutes
const CACHE_DURATION = 30 * 60 * 1000;

// In-memory cache for faster access (avoids JSON parsing)
const memoryCache = {};

/**
 * Check if cache is still valid
 */
function isCacheValid() {
  const timestamp = sessionStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
  if (!timestamp) return false;
  return Date.now() - parseInt(timestamp) < CACHE_DURATION;
}

/**
 * Get data from cache (memory first, then sessionStorage)
 */
function getFromCache(key) {
  // Check memory cache first
  if (memoryCache[key]) {
    return memoryCache[key];
  }

  // Fall back to sessionStorage
  try {
    const data = sessionStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      memoryCache[key] = parsed; // Store in memory for faster subsequent access
      return parsed;
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }
  return null;
}

/**
 * Save data to cache (both memory and sessionStorage)
 */
function saveToCache(key, data) {
  memoryCache[key] = data;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Cache write error:', e);
  }
}

/**
 * Fetch and cache clinical pathways
 */
async function fetchPathways() {
  try {
    const response = await fetch(`${API_URL}/api/clinical-pathways`);
    const data = await response.json();
    if (data.success && data.data) {
      saveToCache(CACHE_KEYS.PATHWAYS, data.data);
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching pathways:', error);
  }
  return [];
}

/**
 * Fetch and cache canonical services
 */
async function fetchCanonicalServices() {
  try {
    const response = await fetch(`${API_URL}/api/canonical-services`);
    const data = await response.json();
    if (data.success && data.data) {
      saveToCache(CACHE_KEYS.CANONICAL_SERVICES, data.data);
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching canonical services:', error);
  }
  return [];
}

/**
 * Fetch and cache popular services
 */
async function fetchPopularServices() {
  try {
    const response = await fetch(`${API_URL}/api/search/popular`);
    const data = await response.json();
    if (data.success && data.data) {
      saveToCache(CACHE_KEYS.POPULAR_SERVICES, data.data);
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching popular services:', error);
  }
  return [];
}

/**
 * Fetch and cache providers list
 */
async function fetchProviders() {
  try {
    const response = await fetch(`${API_URL}/api/providers`);
    const data = await response.json();
    if (data.success && data.data) {
      saveToCache(CACHE_KEYS.PROVIDERS, data.data);
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching providers:', error);
  }
  return [];
}

/**
 * Initialize cache - preload all data
 * Call this when app loads
 */
export async function initializeCache(forceRefresh = false) {
  // Check if cache is valid and not forcing refresh
  if (!forceRefresh && isCacheValid()) {
    console.log('Using cached data');
    return {
      pathways: getFromCache(CACHE_KEYS.PATHWAYS) || [],
      canonicalServices: getFromCache(CACHE_KEYS.CANONICAL_SERVICES) || [],
      popularServices: getFromCache(CACHE_KEYS.POPULAR_SERVICES) || [],
      providers: getFromCache(CACHE_KEYS.PROVIDERS) || [],
      fromCache: true
    };
  }

  console.log('Fetching fresh data...');

  // Fetch all data in parallel
  const [pathways, canonicalServices, popularServices, providers] = await Promise.all([
    fetchPathways(),
    fetchCanonicalServices(),
    fetchPopularServices(),
    fetchProviders()
  ]);

  // Update cache timestamp
  sessionStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP, Date.now().toString());

  return {
    pathways,
    canonicalServices,
    popularServices,
    providers,
    fromCache: false
  };
}

/**
 * Get cached pathways (sync)
 */
export function getCachedPathways() {
  return getFromCache(CACHE_KEYS.PATHWAYS) || [];
}

/**
 * Get cached canonical services (sync)
 */
export function getCachedCanonicalServices() {
  return getFromCache(CACHE_KEYS.CANONICAL_SERVICES) || [];
}

/**
 * Get cached popular services (sync)
 */
export function getCachedPopularServices() {
  return getFromCache(CACHE_KEYS.POPULAR_SERVICES) || [];
}

/**
 * Get cached providers (sync)
 */
export function getCachedProviders() {
  return getFromCache(CACHE_KEYS.PROVIDERS) || [];
}

/**
 * Clear all cache
 */
export function clearCache() {
  Object.values(CACHE_KEYS).forEach(key => {
    sessionStorage.removeItem(key);
    delete memoryCache[key];
  });
}

/**
 * Cache search results for quick repeat searches
 */
const searchCache = new Map();
const MAX_SEARCH_CACHE = 20;

export function getCachedSearch(query) {
  return searchCache.get(query.toLowerCase().trim());
}

export function cacheSearchResult(query, result) {
  const key = query.toLowerCase().trim();

  // Limit cache size
  if (searchCache.size >= MAX_SEARCH_CACHE) {
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }

  searchCache.set(key, {
    result,
    timestamp: Date.now()
  });
}

const cacheModule = {
  initializeCache,
  getCachedPathways,
  getCachedCanonicalServices,
  getCachedPopularServices,
  getCachedProviders,
  clearCache,
  getCachedSearch,
  cacheSearchResult
};

export default cacheModule;
