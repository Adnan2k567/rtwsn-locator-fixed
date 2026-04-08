import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';

interface PermissionModalProps {
    visible: boolean;
    onAccept: () => void;
    onDismiss: () => void;
}

const PermissionModal: React.FC<PermissionModalProps> = ({ visible, onAccept, onDismiss }) => {
    return (
        <Modal visible={visible} transparent={true} animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.redRule} />
                    <Text style={styles.label}>PERMISSIONS REQUIRED</Text>
                    <Text style={styles.heading}>Safety Mesh needs access</Text>

                    <View style={styles.row}>
                        <View style={styles.square} />
                        <View style={styles.textContainer}>
                            <Text style={styles.rowTitle}>Bluetooth</Text>
                            <Text style={styles.rowBody}>Detects and broadcasts SOS signals nearby</Text>
                        </View>
                    </View>


                    <View style={styles.row}>
                        <View style={styles.square} />
                        <View style={styles.textContainer}>
                            <Text style={styles.rowTitle}>Background</Text>
                            <Text style={styles.rowBody}>Keeps the mesh alive when your screen is off</Text>
                        </View>
                    </View>

                    <Text style={styles.privacyNote}>No data leaves your device.</Text>

                    <TouchableOpacity style={styles.continueButton} onPress={onAccept}>
                        <Text style={styles.continueText}>Continue</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.notNowButton} onPress={onDismiss}>
                        <Text style={styles.notNowText}>Not Now</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'flex-end',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 28,
    },
    redRule: {
        width: 40,
        height: 3,
        backgroundColor: '#E8001C',
        borderRadius: 2,
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        letterSpacing: 3,
        color: '#999999',
        fontWeight: '600',
    },
    heading: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0A0A0A',
        marginTop: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 16,
    },
    square: {
        width: 8,
        height: 8,
        backgroundColor: '#E8001C',
        marginTop: 4,
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0A0A0A',
    },
    rowBody: {
        fontSize: 12,
        color: '#888888',
        marginTop: 2,
    },
    privacyNote: {
        fontSize: 12,
        color: '#999999',
        marginTop: 20,
    },
    continueButton: {
        backgroundColor: '#0A0A0A',
        height: 52,
        borderRadius: 8,
        marginTop: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    notNowButton: {
        marginTop: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notNowText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
    },
});

export default PermissionModal;

export { usePermissions } from './usePermissions';
