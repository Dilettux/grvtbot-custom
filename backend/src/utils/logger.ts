// backend/src/utils/logger.ts
export const logger = {
  info: (msg: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, data || '');
  },
  error: (msg: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, error || '');
  },
  warn: (msg: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, data || '');
  },
  debug: (msg: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${msg}`, data || '');
    }
  },
};
