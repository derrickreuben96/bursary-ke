/**
 * Formatting utilities for currency, dates, and numbers
 */

/**
 * Formats a number as Kenyan Shillings
 * @example formatKES(25000000) -> "KES 25,000,000"
 */
export function formatKES(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats a number with commas
 * @example formatNumber(5000) -> "5,000"
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-KE").format(num);
}

/**
 * Formats a percentage
 * @example formatPercentage(0.95) -> "95%"
 */
export function formatPercentage(decimal: number): string {
  return `${Math.round(decimal * 100)}%`;
}

/**
 * Formats a date in Kenyan format
 * @example formatDate(new Date()) -> "23 Jan 2026"
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Formats a date with time
 * @example formatDateTime(new Date()) -> "23 Jan 2026, 10:30 AM"
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Formats a phone number to Kenyan format
 * @example formatPhoneNumber("0712345678") -> "+254 712 345 678"
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");
  
  // Handle Kenyan numbers
  if (digits.startsWith("254") && digits.length === 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  
  if (digits.startsWith("0") && digits.length === 10) {
    return `+254 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  
  return phone;
}

/**
 * Calculates relative time from now
 * @example getRelativeTime(new Date(Date.now() - 86400000)) -> "1 day ago"
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return "Just now";
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? "s" : ""} ago`;
  }
  
  return formatDate(date);
}
