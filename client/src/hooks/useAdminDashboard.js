import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;
const PAGE_SIZE = 15;
const CHART_MAX = 20;

export function useAdminDashboard(searchQuery = '') {
  const token = localStorage.getItem('pyrochain_token');
  const user = JSON.parse(localStorage.getItem('pyrochain_user') || '{}');

  const [allAlerts, setAllAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [currentFilter, setCurrentFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({ total: 0, active: 0, blockchain: 0, critical: 0 });
  const [sensorOnline, setSensorOnline] = useState(false);
  const [priorityZone, setPriorityZone] = useState(null);
  const [zoneList, setZoneList] = useState([]);
  const [bcQueue, setBcQueue] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [alarmActive, setAlarmActive] = useState(false);
  const [tempHistory, setTempHistory] = useState([]);
  const [smokeHistory, setSmokeHistory] = useState([]);
  const [labelHistory, setLabelHistory] = useState([]);
  const [severityCounts, setSeverityCounts] = useState({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NORMAL: 0 });

  const lastHeartbeatRef = useRef(0);
  const alarmTimerRef = useRef(null);
  const socketRef = useRef(null);
  const allAlertsRef = useRef([]);

  // Keep ref in sync
  useEffect(() => { allAlertsRef.current = allAlerts; }, [allAlerts]);

  // ── Toast ──
  const showToast = useCallback((title, type = 'info', body = '') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, type, body }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── Alarm ──
  const triggerAlarm = useCallback((isCritical) => {
    setAlarmActive(true);
    if (alarmTimerRef.current) clearTimeout(alarmTimerRef.current);
    alarmTimerRef.current = setTimeout(() => setAlarmActive(false), 8000);
  }, []);

  // ── Hardware Status ──
  const updateHardwareOnline = useCallback((isOnline) => setSensorOnline(isOnline), []);

  const checkHardwareStatus = useCallback(() => {
    if (lastHeartbeatRef.current > 0) {
      updateHardwareOnline((Date.now() - lastHeartbeatRef.current) < 40000);
      return;
    }
    fetch(`${API_BASE}/api/sensor-status`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.lastHeartbeat) {
          const latest = new Date(data.lastHeartbeat).getTime();
          const isOnline = (Date.now() - latest) < 40000;
          lastHeartbeatRef.current = isOnline ? latest : 0;
          updateHardwareOnline(isOnline);
        } else updateHardwareOnline(false);
      })
      .catch(() => updateHardwareOnline(false));
  }, [updateHardwareOnline]);

  // ── Charts update ──
  const pushChartPoint = useCallback((temperature, smokeLevel, ts) => {
    const lbl = new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTempHistory(p => [...p.slice(-(CHART_MAX - 1)), parseFloat(temperature).toFixed(1)]);
    setSmokeHistory(p => [...p.slice(-(CHART_MAX - 1)), parseInt(smokeLevel)]);
    setLabelHistory(p => [...p.slice(-(CHART_MAX - 1)), lbl]);
  }, []);

  // ── Severity counts ──
  const recalcCounts = useCallback((alerts) => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NORMAL: 0 };
    alerts.forEach(a => { counts[a.severity] = (counts[a.severity] || 0) + 1; });
    setSeverityCounts(counts);
    return counts;
  }, []);

  // ── Stats fetch ──
  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/fire-alert/stats`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.success) {
        const { total, activeAlerts, bchTotal, bySeverity } = data.data;
        const critStat = bySeverity?.find(s => s._id === 'CRITICAL');
        setStats({ total: total || 0, active: activeAlerts || 0, blockchain: bchTotal || 0, critical: critStat?.count || 0 });
      }
    } catch { /* ignore */ }
  }, [token]);

  // ── Handle new real-time alert ──
  const handleNewAlert = useCallback((alert) => {
    if (alert.severity === 'NORMAL') return;
    setAllAlerts(prev => {
      const updated = [alert, ...prev].slice(0, 500);
      recalcCounts(updated);
      return updated;
    });
    pushChartPoint(alert.temperature, alert.smokeLevel, alert.createdAt || new Date());
    const sevClass = alert.severity.toLowerCase();
    showToast(`${alert.severity} — ${alert.location || alert.deviceId}`, sevClass, `Temp: ${alert.temperature}°C | Smoke: ${alert.smokeLevel}`);
    if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') triggerAlarm(alert.severity === 'CRITICAL');
    fetchStats();
  }, [recalcCounts, pushChartPoint, showToast, triggerAlarm, fetchStats]);

  // ── Blockchain queue add ──
  const addToBlockchainQueue = useCallback((txHash, severity) => {
    setBcQueue(prev => [{ txHash, severity, id: Date.now() }, ...prev].slice(0, 5));
    setStats(prev => ({ ...prev, blockchain: prev.blockchain + 1 }));
  }, []);

  // ── Initial fetch ──
  const fetchAlerts = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/fire-alert?limit=200&sortBy=createdAt&order=desc`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data.success) {
        const valid = (data.data || []);
        setAllAlerts(valid);
        recalcCounts(valid);
        checkHardwareStatus();
        if (data.topPriority) setPriorityZone(data.topPriority);
        if (data.allZones) setZoneList(data.allZones);
        valid.slice(0, CHART_MAX).reverse().forEach(a => pushChartPoint(a.temperature, a.smokeLevel, a.createdAt));
      }
    } catch (e) {
      console.warn('[Fetch] Backend unavailable:', e.message);
    }
    fetchStats();
  }, [token, recalcCounts, checkHardwareStatus, pushChartPoint, fetchStats]);

  // ── Resolve alert ──
  const resolveAlert = useCallback(async (alertId) => {
    try {
      const r = await fetch(`${API_BASE}/api/fire-alert/${alertId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'RESOLVED', resolvedBy: user.username }),
      });
      if (r.ok) {
        setAllAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status: 'RESOLVED', alertActive: false } : a));
        showToast('✓ Alert resolved', 'low');
      }
    } catch {
      setAllAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status: 'RESOLVED', alertActive: false } : a));
      showToast('✓ Alert resolved (offline)', 'low');
    }
  }, [token, user.username, showToast]);

  // ── Socket.IO ──
  useEffect(() => {
    try {
      const socket = io(API_BASE, { transports: ['websocket', 'polling'] });
      socketRef.current = socket;
      socket.on('connect', () => socket.emit('get-zones'));
      socket.on('sensor-heartbeat', () => {
        lastHeartbeatRef.current = Date.now();
        updateHardwareOnline(true);
      });
      socket.on('new-alert', (data) => {
        handleNewAlert(data);
        if (data.topPriority) setPriorityZone(data.topPriority);
        if (data.allZones) setZoneList(data.allZones);
      });
      socket.on('blockchain-confirmed', ({ alertId, txHash, severity }) => {
        setAllAlerts(prev => prev.map(a => a._id === alertId ? { ...a, blockchainTxHash: txHash } : a));
        addToBlockchainQueue(txHash, severity);
        showToast('Blockchain confirmed for alert', 'info');
      });
      socket.on('alert-status-update', ({ alertId, status }) => {
        setAllAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status } : a));
      });
      socket.on('zones-update', ({ topPriority, allZones }) => {
        if (topPriority) setPriorityZone(topPriority);
        if (allZones) setZoneList(allZones);
      });
      return () => socket.disconnect();
    } catch { /* ignore */ }
  }, [handleNewAlert, updateHardwareOnline, addToBlockchainQueue, showToast]);

  // ── Init ──
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    const hwInterval = setInterval(checkHardwareStatus, 3000);
    return () => { clearInterval(interval); clearInterval(hwInterval); };
  }, [fetchAlerts, checkHardwareStatus]);

  // ── Apply filter ──
  useEffect(() => {
    let filtered = currentFilter === 'ALL' ? [...allAlerts] : allAlerts.filter(a => a.severity === currentFilter);
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        (a.location && a.location.toLowerCase().includes(q)) ||
        (a.deviceId && a.deviceId.toLowerCase().includes(q)) ||
        (a.status && a.status.toLowerCase().includes(q))
      );
    }

    setFilteredAlerts(filtered);
    setCurrentPage(1);
  }, [allAlerts, currentFilter, searchQuery]);

  const totalPages = Math.ceil(filteredAlerts.length / PAGE_SIZE);
  const pageAlerts = filteredAlerts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changePage = (dir) => setCurrentPage(p => Math.max(1, Math.min(totalPages, p + dir)));

  const triggerTestAlert = useCallback(() => {
    const testAlert = {
      _id: `test_${Date.now()}`,
      severity: 'CRITICAL',
      location: 'Sathyabama University - Lab 402',
      temperature: 85.5,
      smokeLevel: 1200,
      humidity: 45,
      status: 'ACTIVE',
      alertActive: true,
      deviceId: 'SIM_NODE_99',
      createdAt: new Date().toISOString()
    };
    handleNewAlert(testAlert);
  }, [handleNewAlert]);

  const logout = () => { localStorage.clear(); window.location.href = '/'; };

  return {
    user, allAlerts, filteredAlerts, pageAlerts,
    currentFilter, setCurrentFilter,
    currentPage, totalPages, changePage,
    stats, sensorOnline, priorityZone, zoneList, bcQueue,
    toasts, removeToast, alarmActive,
    tempHistory, smokeHistory, labelHistory, severityCounts,
    resolveAlert, triggerTestAlert, logout, API_BASE,
  };
}
