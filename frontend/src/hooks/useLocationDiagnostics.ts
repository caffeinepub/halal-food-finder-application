import { useState, useEffect } from 'react';

export interface LocationDiagnostics {
  isSecureContext: boolean;
  isGeolocationSupported: boolean;
  permissionState: PermissionState | 'unknown';
}

export function useLocationDiagnostics(): LocationDiagnostics {
  const [permissionState, setPermissionState] = useState<PermissionState | 'unknown'>('unknown');

  useEffect(() => {
    // Check permission state if Permissions API is available
    if ('permissions' in navigator && 'geolocation' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          setPermissionState(result.state);
          
          // Listen for permission changes
          result.addEventListener('change', () => {
            setPermissionState(result.state);
          });
        })
        .catch(() => {
          // Permissions API not fully supported
          setPermissionState('unknown');
        });
    }
  }, []);

  return {
    isSecureContext: window.isSecureContext,
    isGeolocationSupported: 'geolocation' in navigator,
    permissionState,
  };
}
