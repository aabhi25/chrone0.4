// Date utility functions for IST timezone handling

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current date in IST timezone as YYYY-MM-DD string
 */
export function getCurrentDateIST(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

/**
 * Get current time in IST timezone as HH:MM string
 */
export function getCurrentTimeIST(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
}

/**
 * Get current date and time in IST timezone
 */
export function getCurrentDateTimeIST(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
}

/**
 * Convert a date string to IST date string
 */
export function toISTDateString(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Format date for display in IST
 */
export function formatDateIST(dateInput: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return new Intl.DateTimeFormat('en-IN', {
    ...defaultOptions,
    ...options
  }).format(date);
}

/**
 * Check if a date string is today in IST
 */
export function isToday(dateString: string): boolean {
  return dateString === getCurrentDateIST();
}