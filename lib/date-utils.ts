/**
 * Parse a date string from the API, treating naive timestamps as UTC
 */
export function parseApiDate(dateString: string): Date {
  // If the timestamp doesn't have a timezone indicator, treat it as UTC
  return new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
}

/**
 * Format a date string as "time ago" (e.g., "2h ago", "3d ago")
 */
export function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = parseApiDate(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Handle future dates or invalid dates
  if (seconds < 0) return 'just now';
  if (isNaN(seconds)) return 'unknown';

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Calculate hours elapsed since a date, treating naive timestamps as UTC
 */
export function getHoursSince(dateString: string): number {
  const now = new Date();
  const date = parseApiDate(dateString);
  return Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60));
}
