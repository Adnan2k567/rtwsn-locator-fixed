import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRelay } from './useRelay';
import { clearCache, getCacheSize } from './debounceCache';

function RelayDebugPanelBody() {
  const [showPanel, setShowPanel] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const { isRelaying, relayCount } = useRelay();
  const prevRelayCount = useRef(relayCount);

  useEffect(() => {
    if (relayCount > prevRelayCount.current) {
      const msg = `>> relayed at ${new Date().toTimeString().slice(0, 8)}`;
      setLogs((l) => [msg, ...l].slice(0, 5));
    }
    prevRelayCount.current = relayCount;
  }, [relayCount]);

  if (!showPanel) {
    return (
      <Pressable
        accessibilityLabel="Open relay debug panel"
        onPress={() => setShowPanel(true)}
        style={styles.peekButton}>
        <Text style={styles.peekLabel}>D</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>[RELAY DEBUG]</Text>
      <View style={styles.metricsRow}>
        <Text style={styles.metric}>
          status: {isRelaying ? 'ACTIVE' : 'INACTIVE'}
        </Text>
        <Text style={styles.metric}>relays: {relayCount}</Text>
        <Text style={styles.metric}>cache: {getCacheSize()}</Text>
      </View>
      <ScrollView style={styles.logScroll} showsVerticalScrollIndicator={false}>
        {logs.map((line, i) => (
          <Text key={`${line}-${i}`} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
      <View style={styles.actionsRow}>
        <Pressable onPress={() => clearCache()} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>CLEAR CACHE</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            setLogs((l) => ['SIM-TEST-001', ...l].slice(0, 5))
          }
          style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>SIM SOS</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => setShowPanel(false)} style={styles.closeHit}>
        <Text style={styles.closeText}>CLOSE</Text>
      </Pressable>
    </View>
  );
}

export default function RelayDebugPanel() {
  if (!__DEV__) return null;
  return <RelayDebugPanelBody />;
}

const styles = StyleSheet.create({
  peekButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: 'rgba(10,10,10,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
    padding: 16,
    fontFamily: 'monospace',
  },
  title: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#666',
    fontFamily: 'monospace',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  metric: {
    fontSize: 11,
    color: '#CCC',
    fontFamily: 'monospace',
  },
  logScroll: {
    flex: 1,
    marginTop: 8,
    minHeight: 0,
  },
  logLine: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionBtnText: {
    fontSize: 10,
    color: '#888',
    fontFamily: 'monospace',
  },
  closeHit: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  closeText: {
    fontSize: 9,
    color: '#555',
    fontFamily: 'monospace',
  },
});
