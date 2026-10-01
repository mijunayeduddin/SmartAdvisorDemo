import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';

// Types mirroring backend contracts (Pure Observer / Consumer)
interface Section {
  id: string;
  course_id?: string;
  course_code: string;
  section_number: number;
  capacity?: number;
  enrolled_count?: number;
  seats_available: number;
  room?: string;
  day_of_week?: string;
  start_time?: string;
  end_time?: string;
  faculty_name?: string;
  course_title?: string;
  course_credits?: string | number;
  is_milestone?: boolean;
}

interface FallbackProposal {
  status: string;
  requested: {
    courseCode: string;
    sectionNumber?: number;
    sectionId?: string;
    seatsAvailable?: number;
  };
  alternative?: {
    courseCode: string;
    sectionNumber: number;
    sectionId: string;
    title: string;
    seatsAvailable: number;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room: string;
    facultyName: string;
    rationale: string;
    criticalPathGain?: number;
  };
  strategyUsed?: string;
}

interface EventLogItem {
  id: string;
  time: string;
  type: string;
  detail: string;
  badgeColor: string;
}

export default function App() {
  const [enrolledSections, setEnrolledSections] = useState<Section[]>([]);
  const [fallbackProposal, setFallbackProposal] = useState<FallbackProposal | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Connecting...');
  const [isLoading, setIsLoading] = useState(true);
  const [eventLogs, setEventLogs] = useState<EventLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'schedule' | 'logs'>('schedule');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Determine backend host (localhost or network IP)
  const getBackendHost = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.hostname || 'localhost';
    }
    return '127.0.0.1';
  };

  const logEvent = useCallback((type: string, detail: string, badgeColor: string) => {
    const now = new Date();
    const timeStr = `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    setEventLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        time: timeStr,
        type,
        detail,
        badgeColor,
      },
      ...prev.slice(0, 19), // Keep latest 20 events
    ]);
  }, []);

  // Fetch initial schedule from backend
  const fetchInitialSchedule = useCallback(async () => {
    const host = getBackendHost();
    try {
      const res = await fetch(`http://${host}:5000/api/schedule/enrolled?studentId=2412800642`);
      const data = await res.json();
      if (data && Array.isArray(data.schedule)) {
        setEnrolledSections(data.schedule);
        const timestamp = new Date().toLocaleTimeString();
        setLastSyncTime(timestamp);
        logEvent('INIT', `Loaded ${data.schedule.length} enrolled sections from backend`, '#10b981');
      }
    } catch (err) {
      console.warn('[Mobile] Failed to fetch initial schedule:', err);
    } finally {
      setIsLoading(false);
    }
  }, [logEvent]);

  // Connect WebSocket Observer
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const host = getBackendHost();
    const wsUrl = `ws://${host}:5000/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        const now = new Date().toLocaleTimeString();
        setLastSyncTime(now);
        logEvent('WS_CONNECT', `Connected to backend observer at ${wsUrl}`, '#10b981');
        ws.send(JSON.stringify({ action: 'subscribe' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const timeStr = new Date().toLocaleTimeString();
          setLastSyncTime(timeStr);

          // 1. SCHEDULE_SYNC event (Cross-device real-time sync!)
          if (data.type === 'SCHEDULE_SYNC') {
            const payload = data.payload || {};
            logEvent(
              'SCHEDULE_SYNC',
              payload.action ? `${payload.action} ${payload.sectionId || ''}` : 'Schedule synchronized',
              '#3b82f6'
            );

            if (payload.schedule && Array.isArray(payload.schedule)) {
              setEnrolledSections(payload.schedule);
            } else if (payload.action === 'DROPPED' && payload.sectionId) {
              setEnrolledSections((prev) =>
                prev.filter(
                  (s) =>
                    s.id !== payload.sectionId &&
                    `${s.course_code}-${s.section_number}` !== payload.sectionId &&
                    s.course_code !== payload.sectionId
                )
              );
            } else if (payload.action === 'ENROLLED' && payload.section) {
              setEnrolledSections((prev) => {
                const filtered = prev.filter((s) => s.course_code !== payload.section.course_code);
                return [...filtered, payload.section];
              });
            }
          }

          // 2. FALLBACK_PROPOSED event (Emergency fallback alert arrives!)
          else if (data.type === 'FALLBACK_PROPOSED') {
            const proposal = data.payload;
            setFallbackProposal(proposal);
            logEvent(
              'FALLBACK_ALERT',
              `${proposal?.requested?.courseCode || 'Course'} full → Proposed ${proposal?.alternative?.courseCode || 'Alternative'}`,
              '#f59e0b'
            );
          }

          // 3. SEAT_UPDATE event
          else if (data.type === 'SEAT_UPDATE') {
            const payload = data.payload || {};
            logEvent(
              'SEAT_UPDATE',
              `${payload.courseCode || payload.sectionId} seats: ${payload.seatsAvailable}`,
              payload.seatsAvailable === 0 ? '#ef4444' : '#10b981'
            );

            setEnrolledSections((prev) =>
              prev.map((sec) => {
                if (
                  sec.id === payload.sectionId ||
                  (sec.course_code === payload.courseCode && sec.section_number === Number(payload.sectionNumber))
                ) {
                  return { ...sec, seats_available: Number(payload.seatsAvailable) };
                }
                return sec;
              })
            );
          }
        } catch (e) {
          console.error('[Mobile WS] Error parsing message:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        logEvent('WS_CLOSE', 'WebSocket disconnected. Reconnecting in 3s...', '#ef4444');
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn('[Mobile WS] Error:', err);
      };
    } catch (err) {
      console.error('[Mobile WS] Connection attempt failed:', err);
      setWsConnected(false);
    }
  }, [logEvent]);

  useEffect(() => {
    fetchInitialSchedule();
    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
      }
    };
  }, [fetchInitialSchedule, connectWebSocket]);

  // One-tap Accept Fallback
  const handleAcceptFallback = async () => {
    if (!fallbackProposal || !fallbackProposal.alternative) return;

    const alt = fallbackProposal.alternative;
    const targetSection: Section = {
      id: alt.sectionId,
      course_code: alt.courseCode,
      section_number: alt.sectionNumber,
      capacity: 35,
      enrolled_count: 35 - alt.seatsAvailable,
      seats_available: alt.seatsAvailable,
      day_of_week: alt.dayOfWeek,
      start_time: alt.startTime,
      end_time: alt.endTime,
      room: alt.room,
      faculty_name: alt.facultyName,
      course_title: alt.title,
      course_credits: 3,
    };

    // 1. Optimistic update
    const updated = [...enrolledSections.filter((s) => s.course_code !== targetSection.course_code), targetSection];
    setEnrolledSections(updated);
    setFallbackProposal(null);
    logEvent('ACCEPT_FALLBACK', `Accepted ${targetSection.course_code} §${targetSection.section_number}`, '#10b981');

    // 2. Broadcast to WebSocket Observer (Web client updates immediately!)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'SCHEDULE_SYNC',
          payload: {
            studentId: '2412800642',
            action: 'ENROLLED',
            section: targetSection,
            schedule: updated,
          },
        })
      );
    }

    // 3. Persist to backend
    const host = getBackendHost();
    try {
      await fetch(`http://${host}:5000/api/schedule/enrolled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: '2412800642',
          action: 'ENROLLED',
          section: targetSection,
          schedule: updated,
        }),
      });
    } catch (e) {
      console.error('[Mobile] Failed to persist accepted fallback:', e);
    }
  };

  // Drop Section from Mobile
  const handleDropSection = async (sectionId: string, courseCode: string) => {
    const updated = enrolledSections.filter(
      (s) => s.id !== sectionId && `${s.course_code}-${s.section_number}` !== sectionId && s.course_code !== courseCode
    );
    setEnrolledSections(updated);
    logEvent('DROP_COURSE', `Dropped ${courseCode}`, '#ef4444');

    // 1. Broadcast to WebSocket Observer
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'SCHEDULE_SYNC',
          payload: {
            studentId: '2412800642',
            action: 'DROPPED',
            sectionId,
            schedule: updated,
          },
        })
      );
    }

    // 2. Persist to backend
    const host = getBackendHost();
    try {
      await fetch(`http://${host}:5000/api/schedule/enrolled/${sectionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: '2412800642', sectionId }),
      });
    } catch (e) {
      console.error('[Mobile] Failed to persist drop:', e);
    }
  };

  // Demo Trigger: Simulate full section fallback (Emergency simulation)
  const handleSimulateFullSection = async () => {
    const host = getBackendHost();
    try {
      logEvent('SIMULATE', 'Testing emergency registration for full section (CSE311 §3)...', '#f59e0b');
      const res = await fetch(`http://${host}:5000/api/schedule/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: '2412800642',
          courseCode: 'CSE311',
          sectionNumber: 3,
          strategy: 'MilestonePriority',
          currentSchedule: enrolledSections,
        }),
      });

      const data: FallbackProposal = await res.json();
      if (data && (data.status === 'FALLBACK_PROPOSED' || data.alternative)) {
        setFallbackProposal(data);
        // Broadcast to WebSocket so web also shows the banner
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'FALLBACK_PROPOSED',
              payload: data,
            })
          );
        }
      }
    } catch (e) {
      console.error('[Mobile] Simulation trigger failed:', e);
    }
  };

  const totalCredits = enrolledSections.reduce((acc, sec) => acc + Number(sec.course_credits || 3), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />

      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>SA</Text>
            </View>
            <Text style={styles.headerTitle}>SmartAdvisor</Text>
            <View style={styles.mobileChip}>
              <Text style={styles.mobileChipText}>MOBILE</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>On-The-Go Emergency Dashboard</Text>
        </View>

        {/* Live Observer Status Indicator */}
        <View style={[styles.statusBadge, wsConnected ? styles.statusBadgeOnline : styles.statusBadgeOffline]}>
          <View style={[styles.statusDot, wsConnected ? styles.statusDotOnline : styles.statusDotOffline]} />
          <Text style={styles.statusText}>{wsConnected ? 'LIVE OBSERVER' : 'CONNECTING'}</Text>
        </View>
      </View>

      {/* Student Profile Bar */}
      <View style={styles.studentBar}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>Tariqul Islam</Text>
          <Text style={styles.studentSub}>ID: 2412800642 • BS CSE</Text>
        </View>
        <View style={styles.creditPill}>
          <Text style={styles.creditPillNumber}>{totalCredits}</Text>
          <Text style={styles.creditPillLabel}>Credits Drafted</Text>
        </View>
      </View>

      {/* Emergency Fallback Alert Banner (Amber / Red glow) */}
      {fallbackProposal && (
        <View id="mobile-fallback-banner" style={styles.emergencyBanner}>
          <View style={styles.emergencyGlow} />

          <View style={styles.emergencyHeaderRow}>
            <View style={styles.alertIconBadge}>
              <Text style={styles.alertIconText}>⚠️</Text>
            </View>
            <View style={styles.emergencyHeaderTexts}>
              <View style={styles.tagRow}>
                <View style={styles.fullTag}>
                  <Text style={styles.fullTagText}>0 SEATS LEFT</Text>
                </View>
                <View style={styles.strategyTag}>
                  <Text style={styles.strategyTagText}>
                    ⚡ {fallbackProposal.strategyUsed || 'Milestone Priority'}
                  </Text>
                </View>
              </View>
              <Text style={styles.emergencyTitle}>
                {fallbackProposal.requested.courseCode} §{fallbackProposal.requested.sectionNumber || 1} is FULL
              </Text>
            </View>
          </View>

          {fallbackProposal.alternative ? (
            <View style={styles.alternativeCard}>
              <View style={styles.alternativeTop}>
                <Text style={styles.alternativeCode}>
                  {fallbackProposal.alternative.courseCode} §{fallbackProposal.alternative.sectionNumber}
                </Text>
                <View style={styles.seatsOpenBadge}>
                  <Text style={styles.seatsOpenText}>
                    {fallbackProposal.alternative.seatsAvailable} seats open
                  </Text>
                </View>
              </View>

              <Text style={styles.alternativeTitle}>{fallbackProposal.alternative.title}</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailText}>
                  🕒 {fallbackProposal.alternative.dayOfWeek}{' '}
                  {fallbackProposal.alternative.startTime?.slice(0, 5)} -{' '}
                  {fallbackProposal.alternative.endTime?.slice(0, 5)}
                </Text>
                {fallbackProposal.alternative.room ? (
                  <Text style={styles.detailText}>📍 {fallbackProposal.alternative.room}</Text>
                ) : null}
                {fallbackProposal.alternative.facultyName ? (
                  <Text style={styles.detailText}>👤 {fallbackProposal.alternative.facultyName}</Text>
                ) : null}
              </View>

              <Text style={styles.rationaleText}>
                💡 {fallbackProposal.alternative.rationale}
              </Text>

              {/* Action Buttons: Prominent One-Tap Accept */}
              <View style={styles.bannerActions}>
                <TouchableOpacity
                  id="mobile-accept-fallback-btn"
                  onPress={handleAcceptFallback}
                  activeOpacity={0.8}
                  style={styles.acceptButton}
                >
                  <Text style={styles.acceptButtonText}>✓ One-Tap Accept Alternative</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFallbackProposal(null)}
                  activeOpacity={0.7}
                  style={styles.dismissButton}
                >
                  <Text style={styles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.noAltBox}>
              <Text style={styles.noAltText}>
                No alternative section without conflicts currently available for this requirement.
              </Text>
              <TouchableOpacity onPress={() => setFallbackProposal(null)} style={styles.dismissButton}>
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Navigation Tabs (Schedule vs Observer Logs) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('schedule')}
          style={[styles.tabItem, activeTab === 'schedule' && styles.tabItemActive]}
        >
          <Text style={[styles.tabItemText, activeTab === 'schedule' && styles.tabItemTextActive]}>
            Active Schedule ({enrolledSections.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('logs')}
          style={[styles.tabItem, activeTab === 'logs' && styles.tabItemActive]}
        >
          <Text style={[styles.tabItemText, activeTab === 'logs' && styles.tabItemTextActive]}>
            Live Observer Logs ({eventLogs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Connecting to SmartAdvisor Observer...</Text>
        </View>
      ) : activeTab === 'schedule' ? (
        <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
          {enrolledSections.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>Schedule is currently empty</Text>
              <Text style={styles.emptySubtitle}>
                Add courses on the web client or test emergency simulation below to see real-time updates.
              </Text>
            </View>
          ) : (
            enrolledSections.map((sec) => {
              const isCritical =
                sec.course_code === 'CSE311' ||
                sec.course_code === 'CSE327' ||
                sec.course_code === 'CSE225' ||
                sec.is_milestone;

              return (
                <View
                  key={sec.id || `${sec.course_code}-${sec.section_number}`}
                  id={`mobile-course-card-${sec.course_code}`}
                  style={styles.courseCard}
                >
                  <View style={styles.courseCardTop}>
                    <View style={styles.courseTitleBlock}>
                      <View style={styles.codeRow}>
                        <Text style={styles.courseCode}>
                          {sec.course_code} §{sec.section_number}
                        </Text>
                        {isCritical && (
                          <View style={styles.criticalBadge}>
                            <Text style={styles.criticalBadgeText}>CRITICAL PATH</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.courseTitleText} numberOfLines={1}>
                        {sec.course_title || 'Academic Requirement'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      id={`mobile-drop-btn-${sec.course_code}`}
                      onPress={() => handleDropSection(sec.id, sec.course_code)}
                      style={styles.dropButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropButtonText}>Drop</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardDetailsRow}>
                    <Text style={styles.cardDetailText}>
                      🕒 {sec.day_of_week || 'ST'} {sec.start_time?.slice(0, 5)} - {sec.end_time?.slice(0, 5)}
                    </Text>
                    {sec.room && <Text style={styles.cardDetailText}>📍 {sec.room}</Text>}
                    {sec.faculty_name && <Text style={styles.cardDetailText}>👤 {sec.faculty_name}</Text>}
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.seatsLeftBadge}>
                      <View style={styles.greenDot} />
                      <Text style={styles.seatsLeftText}>
                        {sec.seats_available !== undefined ? `${sec.seats_available} open seats` : 'Live'}
                      </Text>
                    </View>
                    <Text style={styles.creditsCount}>
                      {sec.course_credits ? `${sec.course_credits} credits` : '3.0 cr'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          {/* Quick Demo Test Action Buttons */}
          <View style={styles.demoSection}>
            <Text style={styles.demoSectionTitle}>Emergency Observer Demo Triggers</Text>
            <View style={styles.demoBtnRow}>
              <TouchableOpacity
                id="mobile-simulate-emergency-btn"
                onPress={handleSimulateFullSection}
                style={styles.demoButton}
                activeOpacity={0.8}
              >
                <Text style={styles.demoButtonText}>🚨 Simulate Full Section (CSE311 §3)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={fetchInitialSchedule}
                style={styles.refreshButton}
                activeOpacity={0.8}
              >
                <Text style={styles.refreshButtonText}>🔄 Sync</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.demoNote}>
              Observer Pattern: Any drop on Web or Mobile syncs within milliseconds without page reload.
            </Text>
          </View>
        </ScrollView>
      ) : (
        /* Real-Time WebSocket Event Feed */
        <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.logsHeading}>Real-Time WebSocket Observer Stream</Text>
          <Text style={styles.logsSub}>
            Live events dispatched by SeatAvailabilityPublisher in the Observer Pattern:
          </Text>

          {eventLogs.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={[styles.logTypeBadge, { backgroundColor: `${log.badgeColor}25`, borderColor: log.badgeColor }]}>
                  <Text style={[styles.logTypeText, { color: log.badgeColor }]}>{log.type}</Text>
                </View>
                <Text style={styles.logTime}>{log.time}</Text>
              </View>
              <Text style={styles.logDetail}>{log.detail}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Bottom Sync Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={[styles.footerPulseDot, wsConnected && styles.footerPulseDotActive]} />
          <Text style={styles.footerText}>
            Observer Sync: {lastSyncTime} • {wsConnected ? 'WebSocket Live' : 'Disconnected'}
          </Text>
        </View>
        <Text style={styles.footerRight}>CSE 327 Monorepo</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0d1322',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  mobileChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#3b82f620',
    borderWidth: 1,
    borderColor: '#3b82f640',
  },
  mobileChipText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusBadgeOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotOnline: {
    backgroundColor: '#10b981',
  },
  statusDotOffline: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  studentBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  studentSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  creditPill: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  creditPillNumber: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '800',
  },
  creditPillLabel: {
    color: '#93c5fd',
    fontSize: 9,
    fontWeight: '600',
  },
  emergencyBanner: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#1c140d',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  emergencyGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  alertIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertIconText: {
    fontSize: 16,
  },
  emergencyHeaderTexts: {
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  fullTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fullTagText: {
    color: '#fca5a5',
    fontSize: 9,
    fontWeight: '800',
  },
  strategyTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  strategyTagText: {
    color: '#fcd34d',
    fontSize: 9,
    fontWeight: '700',
  },
  emergencyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  alternativeCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#131b2c',
    borderWidth: 1,
    borderColor: '#24324f',
  },
  alternativeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alternativeCode: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '800',
  },
  seatsOpenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  seatsOpenText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  alternativeTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  detailRow: {
    marginTop: 6,
    gap: 3,
  },
  detailText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  rationaleText: {
    color: '#fcd34d',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  dismissButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  noAltBox: {
    marginTop: 8,
    padding: 10,
  },
  noAltText: {
    color: '#fca5a5',
    fontSize: 12,
    marginBottom: 8,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginTop: 12,
    gap: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tabItemActive: {
    backgroundColor: '#1e293b',
    borderColor: '#3b82f6',
  },
  tabItemText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  tabItemTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#1e293b',
    marginTop: 16,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  courseCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  courseCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  courseTitleBlock: {
    flex: 1,
    marginRight: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  courseCode: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  criticalBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  criticalBadgeText: {
    color: '#fcd34d',
    fontSize: 8,
    fontWeight: '800',
  },
  courseTitleText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  dropButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  dropButtonText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '700',
  },
  cardDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  cardDetailText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  seatsLeftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 5,
  },
  seatsLeftText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
  },
  creditsCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  demoSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#0d1322',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  demoSectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  demoBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoButton: {
    flex: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  demoButtonText: {
    color: '#fcd34d',
    fontSize: 12,
    fontWeight: '700',
  },
  refreshButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  demoNote: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 8,
    lineHeight: 14,
  },
  logsHeading: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  logsSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  logCard: {
    backgroundColor: '#111827',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  logTypeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  logTime: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logDetail: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#0b0f1a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  footerPulseDotActive: {
    backgroundColor: '#10b981',
  },
  footerText: {
    color: '#64748b',
    fontSize: 10,
  },
  footerRight: {
    color: '#475569',
    fontSize: 10,
  },
});
