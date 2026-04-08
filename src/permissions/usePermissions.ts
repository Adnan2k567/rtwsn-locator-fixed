import { useState, useEffect } from 'react';
import { Platform, PermissionsAndroid, Linking } from 'react-native';

export const usePermissions = () => {
    const [status, setStatus] = useState<'unknown' | 'granted' | 'denied' | 'blocked'>('unknown');
    const hasAll = status === 'granted';

    const checkAll = async (): Promise<boolean> => {
        try {
            if (Platform.OS !== 'android') return false;

            let permissionsToRequest: string[] = [];
            if ((Platform.Version as number) >= 31) {
                permissionsToRequest = [
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                ];
            } else {
                permissionsToRequest = [
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ];
            }

            let allGranted = true;
            for (const req of permissionsToRequest) {
                const granted = await PermissionsAndroid.check(req as any);
                if (!granted) {
                    allGranted = false;
                    break;
                }
            }

            if (allGranted) {
                setStatus('granted');
                return true;
            }

            setStatus('denied');
            return false;
        } catch (err) {
            console.warn(err);
            return false;
        }
    };

    const requestAll = async (): Promise<boolean> => {
        try {
            if (Platform.OS !== 'android') return false;

            let permissionsToRequest: string[] = [];
            if ((Platform.Version as number) >= 31) {
                permissionsToRequest = [
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                ];
            } else {
                permissionsToRequest = [
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ];
            }

            const result = await PermissionsAndroid.requestMultiple(permissionsToRequest as any);

            let allGranted = true;
            let anyBlocked = false;

            for (const key of Object.keys(result)) {
                const pKey = key as keyof typeof result;
                if (result[pKey] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
                    anyBlocked = true;
                    allGranted = false;
                } else if (result[pKey] !== PermissionsAndroid.RESULTS.GRANTED) {
                    allGranted = false;
                }
            }

            if (anyBlocked) {
                setStatus('blocked');
                Linking.openSettings();
                return false;
            }

            if (allGranted) {
                setStatus('granted');
                return true;
            }

            setStatus('denied');
            return false;
        } catch (err) {
            console.warn(err);
            return false;
        }
    };

    useEffect(() => {
        checkAll();
    }, []);

    return { status, hasAll, checkAll, requestAll };
};
