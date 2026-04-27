import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  LayoutDashboard, MessageSquare, LogOut, Users, Lightbulb,
  BarChart3, FileText, Settings, Copy
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import './AdminDashboard.css';
import ToolManager from "./ToolManager";

/* ---------------- Helpers for status UI ---------------- */
/* Suggestions (unchanged) */
const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'approved', label: 'Approved' },
  { value: 'working',  label: 'Working'  },
  { value: 'rejected', label: 'Rejected' },
];

/* ✅ Feedback tab dropdown options — ONLY these three */
const FEEDBACK_STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'resolved', label: 'Resolved' },
  { value: 'reviewed', label: 'Reviewed' },
];

/* Suggestions badge classes */
const statusClass = (s) => {
  switch ((s || 'pending').toLowerCase()) {
    case 'approved': return 'badge badge-green';
    case 'working':  return 'badge badge-blue';
    case 'rejected': return 'badge badge-red';
    default:         return 'badge badge-grey';
  }
};

/* ---- Normalization helpers (for Feedback) ---- */
const normalizeStatus = (raw) => {
  // normalize: lowercase + collapse spaces/dashes/underscores to single '_'
  const v = (raw || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_'); // "in review" -> "in_review", "to-do" -> "to_do"

  // ✅ EXACT matches only (no substring includes)
  const isOneOf = (val, arr) => arr.includes(val);

  if (isOneOf(v, ['reviewed', 'in_review', 'under_review', 'review'])) {
    return 'reviewed';
  }
  if (isOneOf(v, ['resolved', 'viewed', 'read'])) {
    return 'resolved';
  }
  if (isOneOf(v, ['pending', 'awaiting', 'open', 'todo', 'to_do'])) {
    return 'pending';
  }
  return 'pending';
};

const toTitle = (s) => (s || '').replace(/\b\w/g, m => m.toUpperCase());

/* Feedback status badge color mapping */
const fbStatusClass = (s) => {
  switch ((s || '').toLowerCase()) {
    case 'reviewed': return 'action-login';   // green-ish
    case 'pending':  return 'action-update';  // amber
    case 'resolved': return 'action-update';  // amber/neutral
    default:         return 'action-update';
  }
};

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');

  // THEME + TIME + PAGE SIZE (Settings)
  const [theme, setTheme] = useState(() => localStorage.getItem('admin_theme') || 'dark');
  const [use12hr, setUse12hr] = useState(() => (localStorage.getItem('admin_time_12hr') ?? '1') === '1');
  const [pageSize, setPageSize] = useState(() => Number(localStorage.getItem('admin_page_size') || 10));

  // DATA
  const [feedbacks, setFeedbacks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dashboardStats, setDashboardStats] = useState({
    total_users: 0, daily_uses: 0, active_tools: 0, total_tools: 0, open_feedbacks: 0, as_of: null,
  });

  // ------- Suggestions (real aggregated) -------
  const [userSuggs, setUserSuggs] = useState([]);
  const [userSuggsLoading, setUserSuggsLoading] = useState(false);
  const [userSuggsError, setUserSuggsError] = useState('');

  // Dashboard Action Center previews
  const [suggPreview, setSuggPreview] = useState([]);       // top 5 pending by likes
  const [pendingSuggCount, setPendingSuggCount] = useState(0);
  const [openFbPreview, setOpenFbPreview] = useState([]);   // latest 5 open feedback

  // ------- Analytics -------
  const [overview, setOverview] = useState(null);
  const [usageSeries, setUsageSeries] = useState([]);
  const [topTools, setTopTools] = useState([]);
  const [suggStatus, setSuggStatus] = useState({ overall: {}, series: [] });
  const [activeUsers, setActiveUsers] = useState([]);

  // ------- Logs Filters & pagination -------
  const [logQ, setLogQ] = useState('');
  const [logAction, setLogAction] = useState('');
  const [logFrom, setLogFrom] = useState('');
  const [logTo, setLogTo] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const logsPageSize = 10;
  const paginatedLogs = useMemo(
    () => logs.slice((logsPage - 1) * logsPageSize, logsPage * logsPageSize),
    [logs, logsPage]
  );

  // ------- Suggestions Filters & pagination -------
  const [suggQ, setSuggQ] = useState('');
  const [suggStatusFilter, setSuggStatusFilter] = useState('');
  const [suggFrom, setSuggFrom] = useState('');
  const [suggTo, setSuggTo] = useState('');
  const [suggMinLikes, setSuggMinLikes] = useState('');
  const [suggSort, setSuggSort] = useState('likes_desc'); // likes_desc | likes_asc | date_desc | date_asc
  const [suggPage, setSuggPage] = useState(1);

  // ------- Feedback Filters & pagination -------
  const [fbQ, setFbQ] = useState('');
  const [fbStatus, setFbStatus] = useState('');
  const [fbRatingMin, setFbRatingMin] = useState('');
  const [fbRatingMax, setFbRatingMax] = useState('');
  const [fbFrom, setFbFrom] = useState('');
  const [fbTo, setFbTo] = useState('');
  const [fbPage, setFbPage] = useState(1);

  // ------- Users Filters & pagination -------
  const [userQ, setUserQ] = useState('');
  const [userFrom, setUserFrom] = useState('');
  const [userTo, setUserTo] = useState('');
  const [usersPage, setUsersPage] = useState(1);

  // -------- Tools (Application master) + Modal --------
  const [tools, setTools] = useState([]);                // /applications list
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [toolsModalMode, setToolsModalMode] = useState('top');

  // same base as api.js — TIP: in dev set VITE_API_URL=/api and use Vite proxy
const API_BASE = import.meta.env.VITE_API_URL;

  const menuItems = [
    { id: 'dashboard',   label: 'Dashboard',   icon: <LayoutDashboard size={20} /> },
    { id: 'users',       label: 'Users',       icon: <Users size={20} /> },
    { id: 'feedback',    label: 'Feedback',    icon: <MessageSquare size={20} /> },
    { id: 'suggestions', label: 'Suggestions', icon: <Lightbulb size={20} /> },
    { id: 'analytics',   label: 'Analytics',   icon: <BarChart3 size={20} /> },
    { id: 'settings',    label: 'Settings',    icon: <Settings size={20} /> },
    { id: 'logs',        label: 'Logs',        icon: <FileText size={20} /> },
    { id: 'tools',       label: 'Manage Tools',icon: <Settings size={20} /> },
  ];

  /* ---------------- Initial Dashboard data + Previews ---------------- */
useEffect(() => {
  const token = localStorage.getItem("admin_token");
  if (!token) return; // ✅ don't even call
  fetchAllData();
}, []);

const fetchAllData = async () => {
  const token = localStorage.getItem("admin_token");
  if (!token || !API_BASE) {
    console.warn("Skipping admin API calls. Missing token or API_BASE.");
    setLoading(false);
    return;
  }

  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };

    const [fbRes, logsRes, usersRes, statsRes, appsRes] = await Promise.all([
      axios.get(`${API_BASE}/api/admin/feedbacks`, config),
      axios.get(`${API_BASE}/api/admin/logs`, config).catch(() => ({ data: [] })),
      axios.get(`${API_BASE}/api/admin/users`, config).catch(() => ({ data: [] })),
      axios.get(`${API_BASE}/api/admin/dashboard-stats`, config).catch(() => ({ data: null })),
      axios.get(`${API_BASE}/api/admin/tools`, config),
    ]);

    // ✅ rest of your existing logic unchanged

      // Normalize feedback status
      const fbs = (fbRes.data || []).map(r => ({
        ...r,
        status: normalizeStatus(r.status ?? r.state ?? r.feedback_status)
      }));

      setFeedbacks(fbs);
      setLogs(logsRes.data || []);
      setUsers(usersRes.data || []);

      // Applications master (source of truth for total tools)
      const appList = Array.isArray(appsRes?.data) ? appsRes.data : [];
      setTools(appList);

      if (statsRes?.data) {
        setDashboardStats({
          ...statsRes.data,
          total_tools: appList.length, // override with master count
        });
        // Store top tools from dashboard stats (for modal and chart fallback)
        if (Array.isArray(statsRes.data.top_tools)) {
          setTopTools(statsRes.data.top_tools);
        }
      } else {
        setDashboardStats(s => ({ ...s, total_tools: appList.length }));
      }

      // Dashboard previews
      buildOpenFeedbackPreview(fbs);
      await loadSuggestionsPreview(token);
    } catch (err) {
      console.error('Fetch Error:', err);
      if (err?.response?.status === 401) handleLogout();
    } finally {
      setLoading(false);
    }
  };

  // ✅ Build open feedback (latest 5) preview — only Pending/Reviewed/Open (NOT resolved)
  function buildOpenFeedbackPreview(all) {
    const OPEN_STATUSES = new Set(['pending', 'reviewed', 'open']);
    const norm = (v) => (v || '').toString().trim().toLowerCase();
    const latestOpen = [...all]
      .filter(r => OPEN_STATUSES.has(norm(r.status)))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
    setOpenFbPreview(latestOpen);
  }

  // Suggestions preview for Dashboard (top 5 pending by likes)
  async function loadSuggestionsPreview(token) {
    try {
      const hdrs = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
      const res = await axios.get(`${API_BASE}/api/admin/user-suggestions`, hdrs);
      const arr = Array.isArray(res.data) ? res.data : [];
      const pending = arr.filter(s => (s.status || 'pending').toLowerCase() === 'pending');
      const top5 = [...pending].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5);
      setPendingSuggCount(pending.length);
      setSuggPreview(top5);
    } catch (e) {
      console.warn('Preview suggestions load failed (dashboard):', e?.message);
      setPendingSuggCount(0);
      setSuggPreview([]);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    onLogout();
  };

  /* ---------------- Load suggestions tab data on demand ---------------- */
  useEffect(() => {
    if (activeTab === 'suggestions') {
      loadAllUserSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadAllUserSuggestions = async () => {
    setUserSuggsError('');
    setUserSuggsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setUserSuggsError('Not authenticated');
        setUserSuggs([]);
        return;
      }
      const res = await axios.get(`${API_BASE}/api/admin/user-suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserSuggs(Array.isArray(res.data) ? res.data : []);
      setSuggPage(1);
    } catch (e) {
      console.error('Admin user-suggestions load error:', e);
      setUserSuggs([]);
      setUserSuggsError(e?.response?.data?.detail || e?.message || 'Failed to load suggestions');
    } finally {
      setUserSuggsLoading(false);
    }
  };

  /* ---------------- Suggestions: Update status (no prompt) ---------------- */
  const updateSuggestionStatus = async (id, newStatus, note = '') => {
    try {
      const token = localStorage.getItem('admin_token');
      await axios.patch(
        `${API_BASE}/api/admin/user-suggestions/${id}/status`,
        { status: newStatus, admin_note: note || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (activeTab === 'suggestions') await loadAllUserSuggestions();
      await loadSuggestionsPreview(token);
    } catch (e) {
      console.warn('Suggestion status update failed', e?.response?.data?.detail || e?.message);
    }
  };
  const handleAdminDeleteSuggestion = async (id) => {
  if (!window.confirm("Delete this suggestion permanently?")) return;

  try {
    const token = localStorage.getItem("admin_token");
    await axios.delete(
      `${API_BASE}/api/admin/user-suggestions/${id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Refresh table
    await loadAllUserSuggestions();
    await loadSuggestionsPreview(token);
  } catch (e) {
    console.error("Delete error:", e);
    alert("Failed to delete");
  }
};
  const askAndUpdate = async (id, value) => { await updateSuggestionStatus(id, value, ''); };

  /* ---------------- Feedback: Update feedback status (dropdown) ---------------- */
  async function updateFeedbackStatus(id, newStatus) {
    // Optimistic UI
    const prev = feedbacks;
    const normalized = normalizeStatus(newStatus);
    const optimistic = prev.map(r => r.id === id ? { ...r, status: normalized } : r);
    setFeedbacks(optimistic);

    try {
      const token = localStorage.getItem('admin_token');
      const hdrs = { headers: { Authorization: `Bearer ${token}` } };

      // @app.patch("/api/admin/feedbacks/{fb_id}")
      await axios.patch(`${API_BASE}/api/admin/feedbacks/${id}`, { status: newStatus }, hdrs);

      // Optional: re-fetch to stay in perfect sync
      try {
        const fbRes = await axios.get(`${API_BASE}/api/admin/feedbacks`, hdrs);
        const fbs = (fbRes.data || []).map(r => ({
          ...r,
          status: normalizeStatus(r.status ?? r.state ?? r.feedback_status)
        }));
        setFeedbacks(fbs);
        buildOpenFeedbackPreview(fbs);
      } catch { /* no-op */ }
    } catch (e) {
      // Revert on error
      console.warn('Feedback status update failed', e?.response?.status, e?.response?.data);
      setFeedbacks(prev);
    }
  }

  /* ---------------- Analytics: load when tab opens ---------------- */
  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function loadAnalytics() {
    try {
      const token = localStorage.getItem('admin_token');
      const hdrs = { headers: { Authorization: `Bearer ${token}` } };

      const [ov, us, tt, ss, au] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/analytics/overview`, hdrs),
        axios.get(`${API_BASE}/api/admin/analytics/usage-series?days=14`, hdrs),
        axios.get(`${API_BASE}/api/admin/analytics/tools`, hdrs),
        axios.get(`${API_BASE}/api/admin/analytics/suggestions-status`, hdrs),
        axios.get(`${API_BASE}/api/admin/analytics/active-users?days=14`, hdrs),
      ]);

      setOverview(ov.data || null);
      setUsageSeries(us.data || []);
      setTopTools(tt.data || []); // analytics fallback
      setSuggStatus(ss.data || { overall: {}, series: [] });
      setActiveUsers(au.data || []);
    } catch (e) {
      console.error('Analytics load failed', e);
    }
  }

  /* ---------------- Logs: filters & reload ---------------- */
  async function reloadLogs() {
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams();
      if (logQ) params.set('q', logQ);
      if (logAction) params.set('action', logAction);
      if (logFrom) params.set('frm', logFrom);
      if (logTo) params.set('to', logTo);

      const res = await axios.get(`${API_BASE}/api/admin/logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(Array.isArray(res.data) ? res.data : []);
      setLogsPage(1);
    } catch (e) {
      console.error('Logs reload failed', e);
    }
  }

  /* ---------------- CSV helper ---------------- */
  function downloadCSV(name, columns, rows) {
    if (!rows?.length) return;
    const header = columns.map(c => c.header).join(',');
    const body = rows.map(r => columns.map(c => {
      const v = typeof c.get === 'function' ? c.get(r) : r[c.key];
      const s = (v ?? '').toString().replace(/"/g, '""');
      return `"${s}"`;
    }).join(',')).join('\n');
    const csv = header + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------------- Helpers ---------------- */
  const fmtDate = (d) =>
    new Date(d).toLocaleString('en-US', use12hr ? { hour12: true } : { hour12: false });

  const asOf = (ts) =>
    ts ? new Date(ts).toLocaleString('en-US', { hour12: use12hr }) : null;

  /* ---------------- Client-side filters (Suggestions/Feedback/Users) ---------------- */
  const inDateRange = (iso, from, to) => {
    if (!iso) return true;
    const t = new Date(iso).getTime();
    if (from) {
      const f = new Date(from + 'T00:00:00').getTime();
      if (t < f) return false;
    }
    if (to) {
      const tt = new Date(to + 'T23:59:59').getTime();
      if (t > tt) return false;
    }
    return true;
  };

  // Suggestions derived
  const suggFiltered = useMemo(() => {
    let arr = [...userSuggs];
    if (suggQ.trim()) {
      const q = suggQ.toLowerCase();
      arr = arr.filter(s =>
        (s.tool_idea || '').toLowerCase().includes(q) ||
        (s.note || '').toLowerCase().includes(q) ||
        (s.user_name || '').toLowerCase().includes(q) ||
        (s.user_email || '').toLowerCase().includes(q)
      );
    }
    if (suggStatusFilter) {
      arr = arr.filter(s => (s.status || 'pending') === suggStatusFilter);
    }
    if (suggMinLikes) {
      const m = parseInt(suggMinLikes, 10) || 0;
      arr = arr.filter(s => (s.likes || 0) >= m);
    }
    arr = arr.filter(s => inDateRange(s.created_at, suggFrom, suggTo));
    switch (suggSort) {
      case 'likes_asc':  arr.sort((a, b) => (a.likes || 0) - (b.likes || 0)); break;
      case 'likes_desc': arr.sort((a, b) => (b.likes || 0) - (a.likes || 0)); break;
      case 'date_asc':   arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
      case 'date_desc':  arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
      default: break;
    }
    return arr;
  }, [userSuggs, suggQ, suggStatusFilter, suggFrom, suggTo, suggMinLikes, suggSort]);

  const suggPaginated = useMemo(
    () => suggFiltered.slice((suggPage - 1) * pageSize, suggPage * pageSize),
    [suggFiltered, suggPage, pageSize]
  );

  // Feedback derived
  const fbFiltered = useMemo(() => {
    let arr = [...feedbacks];
    if (fbQ.trim()) {
      const q = fbQ.toLowerCase();
      arr = arr.filter(f =>
        (f.tool_name || '').toLowerCase().includes(q) ||
        (f.category || '').toLowerCase().includes(q) ||
        (f.message || '').toLowerCase().includes(q)
      );
    }
    if (fbStatus) arr = arr.filter(f => normalizeStatus(f.status) === fbStatus);
    const minR = fbRatingMin ? Number(fbRatingMin) : null;
    const maxR = fbRatingMax ? Number(fbRatingMax) : null;
    if (minR !== null) arr = arr.filter(f => Number(f.rating || 0) >= minR);
    if (maxR !== null) arr = arr.filter(f => Number(f.rating || 0) <= maxR);
    arr = arr.filter(f => inDateRange(f.created_at, fbFrom, fbTo));
    return arr;
  }, [feedbacks, fbQ, fbStatus, fbRatingMin, fbRatingMax, fbFrom, fbTo]);

  const fbPaginated = useMemo(
    () => fbFiltered.slice((fbPage - 1) * pageSize, fbPage * pageSize),
    [fbFiltered, fbPage, pageSize]
  );

  // Users derived
  const usersFiltered = useMemo(() => {
    let arr = [...users];
    if (userQ.trim()) {
      const q = userQ.toLowerCase();
      arr = arr.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }
    arr = arr.filter(u => inDateRange(u.created_at, userFrom, userTo));
    return arr;
  }, [users, userQ, userFrom, userTo]);

  const usersPaginated = useMemo(
    () => usersFiltered.slice((usersPage - 1) * pageSize, usersPage * pageSize),
    [usersFiltered, usersPage, pageSize]
  );

  /* ---------------- Page clamping so lists never look empty ---------------- */
  useEffect(() => {
    const total = suggFiltered.length;
    if (total === 0) { setSuggPage(1); return; }
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (suggPage > maxPage) setSuggPage(1);
  }, [suggFiltered, pageSize]); // eslint-disable-line

  useEffect(() => {
    const total = fbFiltered.length;
    if (total === 0) { setFbPage(1); return; }
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (fbPage > maxPage) setFbPage(1);
  }, [fbFiltered, pageSize]); // eslint-disable-line

  useEffect(() => {
    const total = usersFiltered.length;
    if (total === 0) { setUsersPage(1); return; }
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (usersPage > maxPage) setUsersPage(1);
  }, [usersFiltered, pageSize]); // eslint-disable-line

  // Small chip style helper

  useEffect(() => {
  if (showToolsModal) {
    // lock background scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }
}, [showToolsModal]);

  const chipStyle = { display:'inline-block', marginLeft:6, padding:'2px 6px', fontSize:11, borderRadius:999,
    background:'var(--panel-2)', border:'1px solid var(--border)', color:'var(--muted)' };

  if (loading) return <div className="admin-loader">Loading Admin Panel...</div>;

  const safeTopTools = Array.isArray(topTools) ? topTools : [];

  return (
    <div className={`admin-dashboard-container ${theme === 'dark' ? 'dark-theme' : 'light-theme'}
 ${showToolsModal ? 'modal-open' : ''}`}>

      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon"></div> ADMIN
        </div>
        <nav className="admin-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="logout-btn" onClick={handleLogout}><LogOut size={20} /> Logout</button>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header">
          <div className="header-info">
            <h2>Company Admin Panel</h2>
            <p>Internal use only</p>
          </div>
          <div className="admin-profile">
            <span>Anshika</span>
            <div className="profile-img"></div>
          </div>
        </header>

        <div className="content-body">
          {/* 1) DASHBOARD (Lifetime snapshot + Action Center) */}
          {activeTab === 'dashboard' && (
            <>
              {/* KPI CARDS */}
              <div className="stats-grid">
                <div
                  className="stat-card clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveTab('users')}
                >
                  <p>Total Users <span style={chipStyle}>lifetime</span></p>
                  <h3>{dashboardStats.total_users ?? 0}</h3>
                  {dashboardStats?.as_of && (
                    <div style={{fontSize: 11, color: 'var(--muted)', marginTop: 4}}>
                      as of {asOf(dashboardStats.as_of)}
                    </div>
                  )}
                </div>

                <div
                  className="stat-card clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveTab('analytics')}
                >
                  <p>Daily Uses <span style={chipStyle}>today</span></p>
                  <h3>{dashboardStats.daily_uses ?? 0}</h3>
                </div>

                <div
                  className="stat-card clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => { setToolsModalMode('top'); setShowToolsModal(true); }}
                  title="View active tools"
                >
                  <p>Most Used Tools <span style={chipStyle}>top 5</span></p>
                  <h3>{dashboardStats.active_tools ?? 0}</h3>
                </div>

                <div
                  className="stat-card clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => { setToolsModalMode('all'); setShowToolsModal(true); }}
                  title="View all tools"
                >
                  <p>Total Tools <span style={chipStyle}>lifetime</span></p>
                  <h3>
                    {Array.isArray(tools) ? tools.length : (dashboardStats.total_tools ?? 0)}
                  </h3>
                </div>

                <div
                  className="stat-card clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveTab('feedback')}
                >
                  <p>Total Feedbacks <span style={chipStyle}>lifetime</span></p>
                  <h3>{dashboardStats.total_feedbacks ?? feedbacks.length ?? 0}</h3>
                </div>

                <div
                  className="stat-card clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveTab('suggestions')}
                >
                  <p>Pending Suggestions <span style={chipStyle}>action</span></p>
                  <h3>{pendingSuggCount}</h3>
                </div>
              </div>

              {/* CHARTS (high level) */}
              <div className="charts-container-grid">
                <div className="chart-box">
                  <h4>Usage Trend</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={feedbacks.slice(0, 10) /* fallback demo if analytics not loaded */}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey={'tool_name'} stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#222', border: 'none', color: '#fff' }} />
                      <Line type="monotone" dataKey={'rating'} stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-box">
                  <h4>Top Tools</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={safeTopTools.length ? safeTopTools : feedbacks.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey={safeTopTools.length ? 'tool' : 'tool_name'} stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#222', border: 'none', color: '#fff' }} />
                      <Bar dataKey={safeTopTools.length ? 'count' : 'rating'} fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ACTION CENTER */}
              <div className="charts-container-grid">
                {/* Pending Suggestions (Top 5 by Likes) */}
                <div className="chart-box">
                  <h4>Pending Suggestions (Top 5 by Likes)</h4>
                  <table className="feedback-table" style={{ tableLayout: 'fixed' }}>
                   <thead>
  <tr>
    <th style={{ width: '18%' }}>User</th>
    <th style={{ width: '30%' }}>Idea</th>
    <th style={{ width: '14%' }}>Created</th>
    <th style={{ width: '10%' }}>Likes</th>
    <th style={{ width: '14%' }}>Status</th>
    <th style={{ width: '14%' }}>Quick Action</th>
  </tr>
</thead>
                    <tbody>
                      {suggPreview.length ? suggPreview.map(s => (
                        <tr key={s.id}>

  {/* USER */}
  <td>
    {s.user_name || "—"}
    {s.user_email && <div className="subtext">{s.user_email}</div>}
  </td>

  {/* IDEA */}
  <td>
    <div className="idea-strong">{s.tool_idea || "—"}</div>
    {s.note && (
      <>
        <div className="subtext" style={{ fontWeight: 600, marginTop: 4 }}>
          Note:
        </div>
        <div className="subtext">{s.note}</div>
      </>
    )}
  </td>

  {/* CREATED — its OWN HEADING + VALUE */}
  <td>
    <div className="subtext" style={{ fontWeight: 600 }}>
      Created:
    </div>
    <div className="subtext" style={{ color: "#6b7280" }}>
      {new Date(s.created_at).toLocaleString()}
    </div>
  </td>

  {/* LIKES */}
  <td style={{ textAlign: "center" }}>
    <span className="like-pill">❤️ {s.likes || 0}</span>
  </td>

  {/* STATUS */}
  <td>
    <span className={statusClass(s.status)}>
      {toTitle(s.status || "pending")}
    </span>
  </td>

  {/* QUICK ACTION DROPDOWN */}
  <td>
    <select
      className="select-small"
      value={s.status}
      onChange={(e) => {
        const val = e.target.value;
        if (val === "delete") {
          handleAdminDeleteSuggestion(s.id);
        } else {
          askAndUpdate(s.id, val);
        }
      }}
    >
      {STATUS_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
      <option value="delete">Delete ❌</option>
    </select>
  </td>
</tr>
                      )) : (
                        <tr><td colSpan={4}>No pending suggestions.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Open Feedbacks (Latest 5) */}
                <div className="chart-box">
                  <h4>Open Feedbacks (Latest 5)</h4>
                  <table className="feedback-table" style={{ tableLayout:'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{width:'30%'}}>Tool</th>
                        <th style={{width:'40%'}}>Message</th>
                        <th style={{width:'15%'}}>Rating</th>
                        <th style={{width:'15%'}}>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openFbPreview.length ? openFbPreview.map(fb => (
                        <tr key={fb.id}>
                          <td><span className="badge-tool">{fb.tool_name}</span></td>
                          <td className="msg-cell" title={fb.message || ''}>{fb.message || '—'}</td>
                          <td>{fb.rating ?? '-'}</td>
                          <td style={{whiteSpace:'nowrap'}}>{fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '-'}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4}>All caught up! 🎉</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 2) FEEDBACK TAB */}
          {activeTab === 'feedback' && (
            <div className="table-container">
              <div className="logs-filter-bar">
                <div className="field">
                  <label>Search</label>
                  <input value={fbQ} onChange={(e) => setFbQ(e.target.value)} placeholder="tool/category/message" />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={fbStatus} onChange={(e) => setFbStatus(e.target.value)}>
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="reviewed">Reviewed</option>
                  </select>
                </div>
                <div className="field">
                  <label>Rating Min</label>
                  <input type="number" min="0" max="5" value={fbRatingMin} onChange={(e)=>setFbRatingMin(e.target.value)} />
                </div>
                <div className="field">
                  <label>Rating Max</label>
                  <input type="number" min="0" max="5" value={fbRatingMax} onChange={(e)=>setFbRatingMax(e.target.value)} />
                </div>
                <div className="field">
                  <label>From</label>
                  <input type="date" value={fbFrom} onChange={(e)=>setFbFrom(e.target.value)} />
                </div>
                <div className="field">
                  <label>To</label>
                  <input type="date" value={fbTo} onChange={(e)=>setFbTo(e.target.value)} />
                </div>
                <button className="btn-apply" onClick={() => { setFbPage(1); }}>Apply</button>
                <button
                  className="btn-apply" style={{ background: '#10b981' }}
                  onClick={() => downloadCSV('feedbacks', [
                    { header: 'Tool',     key: 'tool_name' },
                    { header: 'Category', key: 'category'  },
                    { header: 'Rating',   key: 'rating'    },
                    { header: 'Status',   key: 'status'    },
                    { header: 'Message',  key: 'message'   },
                    { header: 'Created',  get: r => r.created_at ? new Date(r.created_at).toISOString() : '' }
                  ], fbFiltered)}
                >
                  Download CSV
                </button>
              </div>

              <h3>All User Feedbacks</h3>
              <FeedbackTable data={fbPaginated} updateFeedbackStatus={updateFeedbackStatus} />
              <Pagination
                page={fbPage}
                total={fbFiltered.length}
                pageSize={pageSize}
                onPrev={() => setFbPage(p => Math.max(1, p - 1))}
                onNext={() => setFbPage(p => (p * pageSize >= fbFiltered.length ? p : p + 1))}
              />
            </div>
          )}

          {/* 3) LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="table-container">
              {/* FILTER BAR */}
              <div className="logs-filter-bar">
                <div className="field">
                  <label>Search</label>
                  <input
                    value={logQ}
                    onChange={(e) => setLogQ(e.target.value)}
                    placeholder="admin/email/action/target"
                  />
                </div>

                <div className="field">
                  <label>Action</label>
                  <select value={logAction} onChange={(e) => setLogAction(e.target.value)}>
                    <option value="">All</option>
                    <option value="ADMIN_LOGIN">Admin Login</option>
                    <option value="UPDATE_SUGGESTION_STATUS">Suggestion Status Update</option>
                    <option value="DELETE_FEEDBACK">Feedback Deleted</option>
                  </select>
                </div>

                <div className="field">
                  <label>From</label>
                  <input type="date" value={logFrom} onChange={(e) => setLogFrom(e.target.value)} />
                </div>

                <div className="field">
                  <label>To</label>
                  <input type="date" value={logTo} onChange={(e) => setLogTo(e.target.value)} />
                </div>

                <button className="btn-apply" onClick={reloadLogs}>Apply</button>

                {/* CSV BUTTON */}
                <button
                  className="btn-apply"
                  style={{ background: "#10b981" }}
                  onClick={() => downloadCSV('audit_logs', [
                    { header: 'Time',   get: r => new Date(r.timestamp).toISOString() },
                    { header: 'Admin',  key: 'admin_email' },
                    { header: 'Action', key: 'action' },
                    { header: 'Target', key: 'target' },
                  ], logs)}
                >
                  Download CSV
                </button>

                {/* DATE FORMAT TOGGLE */}
                <button
                  className="btn-apply"
                  style={{ background: "#6366f1" }}
                  onClick={() => setUse12hr(!use12hr)}
                >
                  {use12hr ? "24‑Hour" : "12‑Hour"}
                </button>
              </div>

              <h3>Audit Logs</h3>
              {/* TABLE */}
              <table className="feedback-table logs-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Target</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedLogs.map(log => (
                    <tr key={log.id}>
                      <td>{fmtDate(log.timestamp)}</td>
                      <td>{log.admin_email}</td>
                      <td>
                        <span
                          className={
                            "action-tag " +
                            (log.action.includes("LOGIN")
                              ? "action-login"
                              : log.action.includes("DELETE")
                              ? "action-delete"
                              : "action-update")
                          }
                        >
                          {log.action}
                        </span>
                      </td>
                      <td>
                        {log.target}
                        <span
                          className="copy-btn"
                          title="Copy"
                          onClick={() => navigator.clipboard.writeText(log.target)}
                          style={{ marginLeft: 6, display: 'inline-flex', verticalAlign: 'middle' }}
                        >
                          <Copy size={14} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* PAGINATION */}
              <Pagination
                page={logsPage}
                total={logs.length}
                pageSize={logsPageSize}
                onPrev={() => setLogsPage(p => Math.max(1, p - 1))}
                onNext={() => setLogsPage(p => (p * logsPageSize >= logs.length ? p : p + 1))}
              />
            </div>
          )}

          {/* 4) USERS TAB */}
          {activeTab === 'users' && (
            <div className="table-container">
              <div className="logs-filter-bar">
                <div className="field">
                  <label>Search</label>
                  <input value={userQ} onChange={(e)=>setUserQ(e.target.value)} placeholder="name/email" />
                </div>
                <div className="field">
                  <label>From</label>
                  <input type="date" value={userFrom} onChange={(e)=>setUserFrom(e.target.value)} />
                </div>
                <div className="field">
                  <label>To</label>
                  <input type="date" value={userTo} onChange={(e)=>setUserTo(e.target.value)} />
                </div>
                <button className="btn-apply" onClick={() => setUsersPage(1)}>Apply</button>
                <button
                  className="btn-apply" style={{ background: '#10b981' }}
                  onClick={() => downloadCSV('users', [
                    { header: 'Name',    key: 'name'  },
                    { header: 'Email',   key: 'email' },
                    { header: 'Joined',  get: r => r.created_at ? new Date(r.created_at).toISOString() : '' }
                  ], usersFiltered)}
                >
                  Download CSV
                </button>
              </div>

              <h3>Registered Users</h3>
              <UsersTable data={usersPaginated} />
              <Pagination
                page={usersPage}
                total={usersFiltered.length}
                pageSize={pageSize}
                onPrev={() => setUsersPage(p => Math.max(1, p - 1))}
                onNext={() => setUsersPage(p => (p * pageSize >= usersFiltered.length ? p : p + 1))}
              />
            </div>
          )}

          {/* 5) SUGGESTIONS TAB — REAL (user_suggestions) */}
{activeTab === 'suggestions' && (
  <div className="table-container wide suggestions-card">
    <div className="logs-filter-bar">
      <div className="field">
        <label>Search</label>
        <input
          value={suggQ}
          onChange={(e) => setSuggQ(e.target.value)}
          placeholder="user/idea/note/email"
        />
      </div>

      <div className="field">
        <label>Status</label>
        <select
          value={suggStatusFilter}
          onChange={(e) => setSuggStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Min Likes</label>
        <input
          type="number"
          min="0"
          value={suggMinLikes}
          onChange={(e) => setSuggMinLikes(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Sort</label>
        <select value={suggSort} onChange={(e)=>setSuggSort(e.target.value)}>
          <option value="likes_desc">Likes ⤓</option>
          <option value="likes_asc">Likes ⤒</option>
          <option value="date_desc">Date ⤓</option>
          <option value="date_asc">Date ⤒</option>
        </select>
      </div>

      <div className="field">
        <label>From</label>
        <input type="date" value={suggFrom} onChange={(e)=>setSuggFrom(e.target.value)} />
      </div>

      <div className="field">
        <label>To</label>
        <input type="date" value={suggTo} onChange={(e)=>setSuggTo(e.target.value)} />
      </div>

      <button className="btn-apply" onClick={() => setSuggPage(1)}>Apply</button>
    </div>

    <h3>All User Suggestions</h3>

    <table className="feedback-table" style={{ tableLayout: 'fixed' }}>
    <thead>
  <tr>
    <th style={{ width: '10%' }}>User</th>
    <th style={{ width: '8%' }}>Idea</th>
    <th style={{ width: '8%' }}>Note</th>
    <th style={{ width: '10%' }}>Created</th>
    <th style={{ width: '5%' }}>Likes</th>
    <th style={{ width: '8%' }}>Status</th>
    <th style={{ width: '10%' }}>Quick Action</th>
  </tr>
</thead>


      <tbody>
        {userSuggsLoading ? (
          <tr><td colSpan={5}>Loading...</td></tr>
        ) : userSuggsError ? (
          <tr><td colSpan={5} style={{ color: "#ef4444" }}>{userSuggsError}</td></tr>
        ) : (
          suggPaginated.map(s => (
           <tr key={s.id}>

  {/* USER */}
  <td>
    {s.user_name || "—"}
    {s.user_email && <div className="subtext">{s.user_email}</div>}
  </td>

  {/* IDEA */}
  <td>
    <div className="idea-strong">{s.tool_idea || "—"}</div>
  </td>

  {/* NOTE - ITS OWN COLUMN */}
  <td>
    {s.note ? (
      <>
        <div className="subtext" style={{ fontWeight: 600 }}>
        </div>
        <div className="subtext">{s.note}</div>
      </>
    ) : (
      <div className="subtext">—</div>
    )}
  </td>

  {/* CREATED - ITS OWN COLUMN */}
  <td>
    <div className="subtext" style={{ fontWeight: 600 }}>
      Created:
    </div>
    <div className="subtext" style={{ color: "#9ca3af" }}>
      {new Date(s.created_at).toLocaleString()}
    </div>
  </td>

  {/* LIKES */}
  <td style={{ textAlign: "center" }}>
    <span className="like-pill">❤️ {s.likes || 0}</span>
  </td>

  {/* STATUS */}
  <td>
    <span className={statusClass(s.status)}>
      {toTitle(s.status || "pending")}
    </span>
  </td>

  {/* QUICK ACTION */}
  <td>
    <select
      className="select-small"
      value={s.status}
      onChange={(e) => {
        const val = e.target.value;
        if (val === "delete") handleAdminDeleteSuggestion(s.id);
        else askAndUpdate(s.id, val);
      }}
    >
      {STATUS_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
      <option value="delete">Delete ❌</option>
    </select>
  </td>

</tr>
          ))
        )}
      </tbody>
    </table>

    <Pagination
      page={suggPage}
      total={suggFiltered.length}
      pageSize={pageSize}
      onPrev={() => setSuggPage(p => Math.max(1, p - 1))}
      onNext={() => setSuggPage(p => (p * pageSize >= suggFiltered.length ? p : p + 1))}
    />
  </div>
)}
          {/* 6) ANALYTICS TAB (14d scope) */}
          {activeTab === 'analytics' && (
            <div className="analytics-grid">
              {/* Overview cards */}
              <div className="stats-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                  <p>Total Users <span style={chipStyle}>(14d scope may vary)</span></p>
                  <h3>{overview?.total_users ?? 0}</h3>
                  {overview?.as_of && (
                    <div style={{fontSize: 11, color: 'var(--muted)', marginTop: 4}}>
                      as of {asOf(overview.as_of)}
                    </div>
                  )}
                </div>
                <div className="stat-card">
                  <p>Total Feedbacks <span style={chipStyle}>(14d)</span></p>
                  <h3>{overview?.total_feedbacks ?? 0}</h3>
                </div>
                <div className="stat-card">
                  <p>Total Tools <span style={chipStyle}>(14d)</span></p>
                  <h3>{overview?.total_tools ?? overview?.active_tools ?? (safeTopTools.length ?? 0)}</h3>
                </div>
                <div className="stat-card">
                  <p>Suggestions (Approved/Working) <span style={chipStyle}>(14d)</span></p>
                  <h3>
                    {(overview?.approved_suggestions ?? 0)} / {(overview?.working_suggestions ?? 0)}
                  </h3>
                </div>
              </div>

              <div className="charts-container-grid">
                {/* Usage Trend (last 14 days) */}
                <div className="chart-box">
                  <h4>Usage Trend (14d)</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={usageSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#222', border: 'none', color: '#fff' }} />
                      <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Active Users (last 14 days) */}
                <div className="chart-box">
                  <h4>Active Users (14d)</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={activeUsers}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#222', border: 'none', color: '#fff' }} />
                      <Line type="monotone" dataKey="active_users" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Top Tools (bar) */}
                <div className="chart-box">
                  <h4>Top Tools (14d)</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={safeTopTools}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="tool" stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#222', border: 'none', color: '#fff' }} />
                      <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tools Usage (compact table) */}
                <div className="chart-box">
                  <h4>Tools Usage (Last 14d)</h4>

                  {/* Summary line */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8, color: 'var(--muted)' }}>
                    <span>Total Tools: <strong>{overview?.total_tools ?? overview?.active_tools ?? (safeTopTools?.length ?? 0)}</strong></span>
                    <span>Top Listed: <strong>{safeTopTools?.length ?? 0}</strong></span>
                  </div>

                  {/* Compact table */}
                  <table className="feedback-table" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '60%' }}>Tool</th>
                        <th style={{ width: '40%' }}>Uses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(safeTopTools.length ? safeTopTools : []).slice(0, 8).map((t, i) => (
                        <tr key={t.tool ?? i}>
                          <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.tool}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {t.count}
                          </td>
                        </tr>
                      ))}
                      {(!safeTopTools || safeTopTools.length === 0) && (
                        <tr><td colSpan={2}>No tool usage data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Suggestions Status (overall + series) */}
                <div className="chart-box">
                  <h4>Suggestions Status (14d)</h4>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    {['pending', 'working', 'approved', 'rejected'].map((k) => (
                      <span key={k} className={statusClass(k)}>{k.toUpperCase()}: {suggStatus?.overall?.[k] ?? 0}</span>
                    ))}
                  </div>

                  {/* Daily Created */}
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={suggStatus.series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#222', border: 'none', color: '#fff' }} />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* 7) SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="table-container">
              <h3>Settings</h3>

              <div className="logs-filter-bar">
                <div className="field">
                  <label>Theme</label>
                  <select value={theme} onChange={(e)=>setTheme(e.target.value)}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>

                <div className="field">
                  <label>Time Format</label>
                  <select value={use12hr ? '12' : '24'} onChange={(e)=>setUse12hr(e.target.value === '12')}>
                    <option value="12">12‑Hour</option>
                    <option value="24">24‑Hour</option>
                  </select>
                </div>

                <div className="field">
                  <label>Rows per page</label>
                  <input
                    type="number" min="5" max="50"
                    value={pageSize}
                    onChange={(e)=>setPageSize(Math.min(50, Math.max(5, Number(e.target.value || 10))))}
                  />
                </div>
              </div>

              <p>These settings persist locally for the admin UI.</p>
            </div>
          )}

          {activeTab === "tools" && (
  <ToolManager
    tools={tools}
    API_BASE={API_BASE}
    loadTools={() => fetchAllData()}
  />
)}
        </div>

        {/* Tools Modal (Top-Used) */}
        {showToolsModal && (
  <div className="modal-overlay" onClick={() => setShowToolsModal(false)}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
  <h3 style={{ marginRight: 'auto' }}>Tools</h3>
  <div style={{ display:'flex', gap:8, marginRight:8 }}>
    <button className={`btn-small ${toolsModalMode === 'top' ? 'active' : ''}`} onClick={() => setToolsModalMode('top')}>Most Used</button>
    <button className={`btn-small ${toolsModalMode === 'all' ? 'active' : ''}`} onClick={() => setToolsModalMode('all')}>All</button>
  </div>
  <button onClick={() => setShowToolsModal(false)}>×</button>
</div>

      <div className="modal-body">
        {toolsModalMode === 'top' ? (
          // ---------- TOP (usage) ----------
          (topTools?.length ? (
            <table className="feedback-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '70%' }}>Tool</th>
                  <th style={{ width: '30%' }}>Total Uses</th>
                </tr>
              </thead>
              <tbody>
                {topTools.map((t, i) => (
                  <tr key={t.tool ?? i}>
                    <td style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {t.tool}
                    </td>
                    <td style={{ whiteSpace:'nowrap' }}>{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 12, color: 'var(--muted)' }}>No usage data available.</div>
          ))
        ) : (
          // ---------- ALL (applications master) ----------
          (tools?.length ? (
            <table className="feedback-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '44%' }}>Tool</th>
                  <th style={{ width: '24%' }}>Category</th>
                  <th style={{ width: '16%' }}>Status</th>
                  <th style={{ width: '16%' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((app) => (
                  <tr key={app.id}>
                    <td style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {app.name || '-'}
                    </td>
                    <td>{app.category || '-'}</td>
                    <td>
                      <span className={`badge ${String(app.status || '').toLowerCase().match(/active|enabled|live/) ? 'badge-green' : 'badge-grey'}`}>
                        {app.status || '-'}
                      </span>
                    </td>
                    <td style={{ whiteSpace:'nowrap' }}>
                      {app.created_at ? new Date(app.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 12, color: 'var(--muted)' }}>No tools found.</div>
          ))
        )}
      </div>
    </div>
  </div>
)}

      </main>
    </div>
  );
};

/* ---------------- Sub-Components ---------------- */

const Pagination = ({ page, total, pageSize, onPrev, onNext }) => (
  <div className="pagination-container">
    <button className="page-btn" disabled={page <= 1} onClick={onPrev}>Prev</button>
    <span className="page-info">Page {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
    <button className="page-btn" disabled={page * pageSize >= total} onClick={onNext}>Next</button>
  </div>
);

/* ✅ Feedback table with ONLY Pending/Seen/Reviewed */
const FeedbackTable = ({ data, updateFeedbackStatus }) => (
  <table className="feedback-table">
    <thead>
      <tr><th>Tool</th><th>Category</th><th>Rating</th><th>Message</th><th>Status</th></tr>
    </thead>
    <tbody>
      {data.map(fb => {
        const s = normalizeStatus(fb.status);
        return (
          <tr key={fb.id}>
            <td><span className="badge-tool">{fb.tool_name}</span></td>
            <td>{fb.category}</td>
            <td>{fb.rating} ⭐</td>
            <td className="msg-cell">{fb.message}</td>
            <td className="status-cell">
              <div className="status-wrap">
                <span className={`action-tag ${fbStatusClass(s)}`} title={toTitle(s)}>
                  {toTitle(s)}
                </span>
                <select
                  value={s}  // controlled select
                  onChange={(e) => updateFeedbackStatus(fb.id, e.target.value)}
                  className="select-small"
                  aria-label="Change feedback status"
                  title={toTitle(s)}
                >
                  {FEEDBACK_STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const UsersTable = ({ data }) => (
  <table className="feedback-table">
    <thead>
      <tr><th>Name</th><th>Email</th><th>Joined Date</th></tr>
    </thead>
    <tbody>
      {data.length > 0 ? data.map(u => (
        <tr key={u.id}>
          <td>{u.name}</td>
          <td>{u.email}</td>
          <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
        </tr>
      )) : <tr><td colSpan="3">No registered users found.</td></tr>}
    </tbody>
  </table>
);

export default AdminDashboard;
