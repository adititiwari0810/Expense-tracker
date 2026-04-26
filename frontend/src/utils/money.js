/**
 * Money utilities — cents ↔ display conversion.
 *
 * All money values are stored and transmitted as integer cents.
 * These helpers convert only at the UI boundary.
 */

/**
 * Convert a dollar string (e.g. "12.50") to integer cents (1250).
 * Returns null if the input is invalid.
 */
export function dollarsToCents(dollarString) {
  if (!dollarString || dollarString.trim() === '') return null;

  // Remove leading/trailing whitespace
  const cleaned = dollarString.trim();

  // Validate format: optional digits, optional decimal with up to 2 digits
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;

  // Use string manipulation to avoid floating-point errors
  const parts = cleaned.split('.');
  const wholePart = parseInt(parts[0], 10);
  let centsPart = 0;

  if (parts.length === 2) {
    const decimalStr = parts[1].padEnd(2, '0');
    centsPart = parseInt(decimalStr, 10);
  }

  return wholePart * 100 + centsPart;
}

/**
 * Convert integer cents (1250) to display string ("$12.50").
 */
export function centsToDisplay(cents) {
  if (cents === null || cents === undefined) return '$0.00';
  const negative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  const sign = negative ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
}

/**
 * Convert integer cents to a plain number string for form input (e.g. 1250 → "12.50").
 */
export function centsToInputValue(cents) {
  if (cents === null || cents === undefined) return '';
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `${dollars}.${String(remainder).padStart(2, '0')}`;
}
