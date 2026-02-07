/**
 * Validates geographic coordinates.
 * Returns an object with isValid boolean and an optional error message.
 * 
 * Valid coordinates:
 * - Latitude: -90 to 90 (inclusive)
 * - Longitude: -180 to 180 (inclusive)
 * - Both can be 0 (equator/prime meridian)
 * - Must be finite numbers
 */
export interface CoordinateValidationResult {
  isValid: boolean;
  reason?: string;
}

export function validateCoordinates(lat: number, lon: number): CoordinateValidationResult {
  // Check for NaN or non-finite values
  if (isNaN(lat) || isNaN(lon)) {
    return {
      isValid: false,
      reason: 'Coordinates contain invalid numeric values',
    };
  }

  if (!isFinite(lat) || !isFinite(lon)) {
    return {
      isValid: false,
      reason: 'Coordinates must be finite numbers',
    };
  }

  // Check latitude range
  if (lat < -90 || lat > 90) {
    return {
      isValid: false,
      reason: 'Latitude must be between -90 and 90 degrees',
    };
  }

  // Check longitude range
  if (lon < -180 || lon > 180) {
    return {
      isValid: false,
      reason: 'Longitude must be between -180 and 180 degrees',
    };
  }

  return { isValid: true };
}
