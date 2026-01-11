import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { ClockIcon, ChatBubbleLeftIcon, ChartBarIcon, BellIcon, CalendarIcon, Squares2X2Icon, CurrencyEuroIcon } from '@heroicons/react/24/outline';
import CalendarMonth from '../components/CalendarMonth';

// Funktion: gibt die ISO-Datumsstrings (YYYY-MM-DD) für eine Kalenderwoche zurück (Mo-So)
// Berechnung nach ISO 8601: Woche 1 ist die Woche mit dem ersten Donnerstag des Jahres
const getWeekDates = (year, week) => {
  // Finde den 4. Januar (immer in KW1)
  const jan4 = new Date(year, 0, 4);
  // Berechne den Montag der KW1
  const dayOfWeek = jan4.getDay() || 7; // Sonntag = 7
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
  // Berechne den Montag der gewünschten Woche
  const targetMonday = new Date(mondayOfWeek1);
  targetMonday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
  // Erstelle Array mit 7 Tagen (Mo-So)
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(targetMonday);
    d.setDate(targetMonday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const MyVERP = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'dashboard';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [timeEntries, setTimeEntries] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [vacationRequests, setVacationRequests] = useState([]);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  // Update activeTab when URL changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    let meRes;
    let me = {};
    try {
      setErrors({});

      // Fetch current user first so we can request *only* their vacation requests
      try {
        meRes = await api.get('/users/me/');
        me = meRes.data || {};
      } catch (err) {
        me = {};
      }

      const endpoints = {
        time: api.get('/users/time-entries/'),
        messages: api.get('/users/messages/'),
        reminders: api.get('/users/reminders/'),
        // Always filter vacation requests to the current user in the personal dashboard
        vacation: api.get(`/users/vacation-requests/?user=${me.id}`),
        report: api.get('/users/time-entries/weekly_report/'),
        month: api.get('/users/time-entries/monthly_report/'),

      };

      const keys = Object.keys(endpoints);
      const promises = Object.values(endpoints);
      const results = await Promise.allSettled(promises);

      results.forEach((res, idx) => {
        const key = keys[idx];
        if (res.status === 'fulfilled') {
          const data = res.value.data;
          if (key === 'time') setTimeEntries(data.results || data);
          else if (key === 'messages') setMessages(data.results || data);
          else if (key === 'reminders') setReminders(data.results || data);
          else if (key === 'vacation') setVacationRequests(data.results || data);
          else if (key === 'report') setWeeklyReport(res.value.data);
          else if (key === 'month') setMonthlyReport(res.value.data);

        } else {
          // missing or failing endpoint — don't break the whole page
          const msg = res.reason?.response?.status
            ? `HTTP ${res.reason.response.status}`
            : res.reason?.message || String(res.reason);
          console.warn(`MyVERP: failed to load ${key}`, msg);
          setErrors((prev) => ({ ...prev, [key]: msg }));
        }
      });
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    } finally {
      setLoading(false);
    }
    // additionally fetch employee details (separate call)
    try {
      try {
        const empRes = await api.get('/users/employees/me/');
        setEmployeeDetails(empRes.data || null);
      } catch (err) {
        // fallback: try the id-based endpoint if present
        if (me && me.employee) {
          try {
            const empRes = await api.get(`/users/employees/${me.employee}/`);
            setEmployeeDetails(empRes.data);
          } catch (err2) {
            console.warn('Employee details nicht verfügbar', err2);
            setEmployeeDetails(null);
          }
        } else {
          setEmployeeDetails(null);
        }
      }
    } catch (err) {
      // ignore
    }
  };

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: Squares2X2Icon },
    { id: 'time-tracking', name: 'Zeiterfassung', icon: ClockIcon },
    { id: 'my-tickets', name: 'MyTickets', icon: ChatBubbleLeftIcon },
    { id: 'messages', name: 'Nachrichtencenter', icon: ChatBubbleLeftIcon },
    { id: 'reporting', name: 'Reporting', icon: ChartBarIcon },
    { id: 'reminders', name: 'Erinnerungen', icon: BellIcon },
    { id: 'vacation', name: 'Urlaub', icon: CalendarIcon },
    { id: 'travel-expenses', name: 'Reisekosten', icon: CalendarIcon },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <ClockIcon className="h-8 w-8 mr-3 text-blue-600" />
            MyVERP - Persönliche Verwaltung
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Ihre persönliche Arbeitszeiterfassung und Verwaltung.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6">
        <div className="border-b border-gray-200">
          <nav className="tab-scroll -mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchParams({ tab: tab.id });
                }}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'dashboard' && (
          <PersonalDashboardTab />
        )}
        {activeTab === 'time-tracking' && (
          <TimeTrackingTab
            timeEntries={timeEntries}
            weeklyReport={weeklyReport}
            monthlyReport={monthlyReport}
            onRefresh={fetchData}
            errors={errors}
          />
        )}
        {activeTab === 'my-tickets' && (
          <MyTicketsTab onRefresh={fetchData} errors={errors} />
        )}
        {activeTab === 'messages' && (
          <MessagesTab messages={messages} onRefresh={fetchData} errors={errors} />
        )}
        {activeTab === 'reporting' && (
          <ReportingTab weeklyReport={weeklyReport} monthlyReport={monthlyReport} errors={errors} />
        )}
        {activeTab === 'reminders' && (
          <RemindersTab reminders={reminders} onRefresh={fetchData} errors={errors} />
        )}
        {activeTab === 'vacation' && (
          <VacationTab vacationRequests={vacationRequests} employeeDetails={employeeDetails} onRefresh={fetchData} errors={errors} />
        )}
        {activeTab === 'travel-expenses' && (
          <TravelExpensesTab onRefresh={fetchData} />
        )}
      </div>
    </div>
  );
};

// TimeTrackingTab Component
const TimeTrackingTab = ({ timeEntries, weeklyReport, monthlyReport, onRefresh, errors }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  // Defaults for new time entry (persisted per browser via localStorage)
  const [defaults, setDefaults] = useState({ start_time: '08:00', end_time: '17:00', break_time: '00:30:00' });
  const [editingDefaults, setEditingDefaults] = useState({ start_time: '', end_time: '', break_time: '' });
  const [showDefaultsEditor, setShowDefaultsEditor] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    break_time: '00:30:00',
    description: ''
  });

  useEffect(() => {
    try {
      const s = localStorage.getItem('myverp.default_start_time');
      const e = localStorage.getItem('myverp.default_end_time');
      const b = localStorage.getItem('myverp.default_break_time');
      setDefaults({
        start_time: s || defaults.start_time,
        end_time: e || defaults.end_time,
        break_time: b || defaults.break_time
      });
      setEditingDefaults({ start_time: s || defaults.start_time, end_time: e || defaults.end_time, break_time: b || defaults.break_time });
    } catch (err) {
      console.warn('Could not load MyVERP defaults from localStorage', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDefaults = () => {
    try {
      localStorage.setItem('myverp.default_start_time', editingDefaults.start_time || '');
      localStorage.setItem('myverp.default_end_time', editingDefaults.end_time || '');
      localStorage.setItem('myverp.default_break_time', editingDefaults.break_time || '');
      setDefaults({ ...editingDefaults });
      setShowDefaultsEditor(false);
      // If modal is open, update form values if they're empty
      setFormData(prev => ({
        ...prev,
        start_time: prev.start_time || editingDefaults.start_time || '',
        end_time: prev.end_time || editingDefaults.end_time || '',
        break_time: prev.break_time || editingDefaults.break_time || '00:30:00'
      }));
    } catch (err) {
      console.error('Could not save MyVERP defaults', err);
    }
  };

  const resetDefaults = () => {
    const def = { start_time: '08:00', end_time: '17:00', break_time: '00:30:00' };
    localStorage.setItem('myverp.default_start_time', def.start_time);
    localStorage.setItem('myverp.default_end_time', def.end_time);
    localStorage.setItem('myverp.default_break_time', def.break_time);
    setDefaults(def);
    setEditingDefaults(def);
  };

  const openModal = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      start_time: defaults.start_time || '',
      end_time: defaults.end_time || '',
      break_time: defaults.break_time || '00:30:00',
      description: ''
    });
    setEditingEntryId(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEntryId) {
        await api.patch(`/users/time-entries/${editingEntryId}/`, formData);
      } else {
        await api.post('/users/time-entries/', formData);
      }
      await onRefresh();
      setShowModal(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        start_time: defaults.start_time || '',
        end_time: defaults.end_time || '',
        break_time: defaults.break_time || '00:30:00',
        description: ''
      });
      setEditingEntryId(null);
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
    }
  };

  const handleEditEntry = (entry) => {
    setFormData({
      date: entry.date,
      start_time: entry.start_time,
      end_time: entry.end_time,
      break_time: entry.break_time || '00:30:00',
      description: entry.description || ''
    });
    setEditingEntryId(entry.id);
    setShowModal(true);
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Zeiteintrag wirklich löschen?')) return;
    try {
      await api.delete(`/users/time-entries/${id}/`);
      await onRefresh();
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      alert('Fehler beim Löschen: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Arbeitszeiterfassung</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">Standard: <span className="font-medium">{defaults.start_time}–{defaults.end_time}</span>, Pause <span className="font-medium">{defaults.break_time}</span></div>
          <button
            onClick={() => setShowDefaultsEditor(v => !v)}
            className="inline-flex items-center rounded-md border border-gray-300 px-2 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Standardzeiten bearbeiten
          </button>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            <ClockIcon className="h-5 w-5 mr-2" />
            Zeiteintrag hinzufügen
          </button>
        </div>
      </div>

      {showDefaultsEditor && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-600">Startzeit</label>
              <input type="time" value={editingDefaults.start_time} onChange={(e)=>setEditingDefaults(prev=>({...prev, start_time: e.target.value}))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Endzeit</label>
              <input type="time" value={editingDefaults.end_time} onChange={(e)=>setEditingDefaults(prev=>({...prev, end_time: e.target.value}))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Pausenzeit (HH:MM:SS)</label>
              <input type="text" value={editingDefaults.break_time} onChange={(e)=>setEditingDefaults(prev=>({...prev, break_time: e.target.value}))} placeholder="00:30:00" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
            </div>
          </div>
          <div className="mt-3 flex justify-end space-x-2">
            <button type="button" onClick={saveDefaults} className="px-3 py-1 bg-blue-600 text-white rounded">Speichern</button>
            <button type="button" onClick={resetDefaults} className="px-3 py-1 bg-gray-200 text-gray-700 rounded">Auf Standard</button>
            <button type="button" onClick={()=>setShowDefaultsEditor(false)} className="px-3 py-1 bg-white text-gray-700 rounded border">Abbrechen</button>
          </div>
        </div>
      )}

      {errors?.time && (
        <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
          Einige Daten konnten nicht geladen werden: {errors.time}
        </div>
      )}

      {weeklyReport && (
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <h3 className="text-md font-medium text-gray-900 mb-2">Wochenbericht</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Gearbeitete Stunden</p>
              <p className="text-2xl font-bold text-blue-600">{(weeklyReport.actual_hours ?? 0)}h</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Soll-Stunden</p>
              <p className="text-2xl font-bold text-gray-600">{(weeklyReport.expected_hours_to_date ?? 0)}h</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Differenz</p>
              <p className={`text-2xl font-bold ${(weeklyReport.difference ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(weeklyReport.difference ?? 0) >= 0 ? '+' : ''}{(weeklyReport.difference ?? 0)}h
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Woche</p>
              <p className="text-sm text-gray-600">
                {new Date(weeklyReport.week_start).toLocaleDateString()} - {new Date(weeklyReport.week_end).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {monthlyReport && (
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <h3 className="text-md font-medium text-gray-900 mb-2">Monatsbericht</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Gearbeitete Stunden</p>
              <p className="text-2xl font-bold text-blue-600">{(monthlyReport.actual_hours ?? 0)}h</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Erwartet bis heute</p>
              <p className="text-2xl font-bold text-gray-600">{(monthlyReport.expected_hours_to_date ?? 0)}h</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Differenz</p>
              <p className={`text-2xl font-bold ${(monthlyReport.difference ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(monthlyReport.difference ?? 0) >= 0 ? '+' : ''}{(monthlyReport.difference ?? 0)}h
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {timeEntries.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">Keine Zeiteinträge vorhanden.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {timeEntries.map((entry) => (
              <li key={entry.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(entry.date).toLocaleDateString()} - {entry.start_time} bis {entry.end_time}
                    </p>
                    <p className="text-sm text-gray-500">{entry.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{entry.duration_display}</p>
                    <p className="text-xs text-gray-500">Pause: {entry.break_time}</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => handleEditEntry(entry)} className="text-sm text-blue-600 hover:text-blue-800">Bearbeiten</button>
                      <button onClick={() => handleDeleteEntry(entry.id)} className="text-sm text-red-600 hover:text-red-800">Löschen</button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal for adding time entry */}
      {showModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Neuer Zeiteintrag</h3>
                  <div className="mt-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Datum</label>
                        <input
                          type="date"
                          required
                          value={formData.date}
                          onChange={(e) => setFormData({...formData, date: e.target.value})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Startzeit</label>
                          <input
                            type="time"
                            required
                            value={formData.start_time}
                            onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Endzeit</label>
                          <input
                            type="time"
                            required
                            value={formData.end_time}
                            onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Pausenzeit (HH:MM:SS)</label>
                        <input
                          type="text"
                          value={formData.break_time}
                          onChange={(e) => setFormData({...formData, break_time: e.target.value})}
                          placeholder="00:30:00"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          rows={3}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                      </div>
                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => setShowModal(false)}
                          className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="submit"
                          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                        >
                          Speichern
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced MessagesTab with Inbox/Outbox
const MessagesTab = ({ messages: initialMessages, onRefresh, errors }) => {
  const [view, setView] = useState('inbox'); // 'inbox' or 'outbox'
  const [messages, setMessages] = useState(initialMessages || []);
  const [loading, setLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [users, setUsers] = useState([]);
  const [newMessage, setNewMessage] = useState({ user: '', title: '', content: '' });
  const [sending, setSending] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  useEffect(() => {
    fetchMessages();
    fetchUsers();
  }, [view]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const endpoint = view === 'inbox' ? '/users/messages/inbox/' : '/users/messages/outbox/';
      const response = await api.get(endpoint);
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/');
      setUsers(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleMarkRead = async (messageId) => {
    try {
      await api.post(`/users/messages/${messageId}/mark_read/`);
      fetchMessages();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleMarkUnread = async (messageId) => {
    try {
      await api.post(`/users/messages/${messageId}/mark_unread/`);
      fetchMessages();
    } catch (error) {
      console.error('Error marking message as unread:', error);
    }
  };

  const handleDelete = async (messageId) => {
    if (!window.confirm('Nachricht wirklich löschen?')) return;
    try {
      await api.post(`/users/messages/${messageId}/delete_message/`);
      setSelectedMessage(null);
      fetchMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.user || !newMessage.title.trim()) return;
    
    setSending(true);
    try {
      await api.post('/users/messages/', newMessage);
      setShowCompose(false);
      setNewMessage({ user: '', title: '', content: '' });
      if (view === 'outbox') fetchMessages();
      alert('Nachricht gesendet!');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Fehler beim Senden der Nachricht');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Nachrichtencenter</h2>
        <button
          onClick={() => setShowCompose(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <ChatBubbleLeftIcon className="h-4 w-4 mr-2" />
          Neue Nachricht
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="tab-scroll -mb-px flex space-x-8">
          <button
            onClick={() => setView('inbox')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              view === 'inbox'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Posteingang
          </button>
          <button
            onClick={() => setView('outbox')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              view === 'outbox'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Postausgang
          </button>
        </nav>
      </div>

      {errors?.messages && (
        <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">Fehler beim Laden: {errors.messages}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Message List */}
        <div className="lg:col-span-1 bg-white shadow rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 text-center">
              <ClockIcon className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              {view === 'inbox' ? 'Keine empfangenen Nachrichten' : 'Keine gesendeten Nachrichten'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {messages.map((message) => (
                <li
                  key={message.id}
                  onClick={() => setSelectedMessage(message)}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                    selectedMessage?.id === message.id ? 'bg-blue-50' : ''
                  } ${!message.is_read && view === 'inbox' ? 'bg-blue-25' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!message.is_read && view === 'inbox' ? 'font-bold' : 'font-medium'} text-gray-900 truncate`}>
                        {message.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {view === 'inbox' ? `Von: ${message.sender_name}` : `An: ${message.recipient_name}`}
                      </p>
                    </div>
                    <div className="flex items-center ml-2">
                      <span className="text-xs text-gray-400">{formatDate(message.created_at).split(',')[0]}</span>
                      {!message.is_read && view === 'inbox' && (
                        <span className="ml-2 inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
          {selectedMessage ? (
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{selectedMessage.title}</h3>
                  <p className="text-sm text-gray-500">
                    {view === 'inbox' ? `Von: ${selectedMessage.sender_name}` : `An: ${selectedMessage.recipient_name}`}
                    {' • '}
                    {formatDate(selectedMessage.created_at)}
                  </p>
                  {selectedMessage.message_type === 'ticket' && selectedMessage.related_ticket && (
                    <a
                      href={`/service/tickets/${selectedMessage.related_ticket}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      → Zum Ticket
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  {view === 'inbox' && (
                    <>
                      {selectedMessage.is_read ? (
                        <button
                          onClick={() => handleMarkUnread(selectedMessage.id)}
                          className="text-sm text-gray-600 hover:text-gray-800"
                        >
                          Als ungelesen
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkRead(selectedMessage.id)}
                          className="text-sm text-gray-600 hover:text-gray-800"
                        >
                          Als gelesen
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(selectedMessage.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Löschen
                  </button>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMessage.content}</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              Wählen Sie eine Nachricht aus der Liste
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowCompose(false)}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Neue Nachricht</h3>
              <form onSubmit={handleSendMessage}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Empfänger</label>
                    <select
                      value={newMessage.user}
                      onChange={(e) => setNewMessage(prev => ({ ...prev, user: e.target.value }))}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">-- Auswählen --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} ({u.username})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Betreff</label>
                    <input
                      type="text"
                      value={newMessage.title}
                      onChange={(e) => setNewMessage(prev => ({ ...prev, title: e.target.value }))}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nachricht</label>
                    <textarea
                      value={newMessage.content}
                      onChange={(e) => setNewMessage(prev => ({ ...prev, content: e.target.value }))}
                      rows={5}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCompose(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sending ? 'Senden...' : 'Senden'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReportingTab = ({ weeklyReport, monthlyReport, errors }) => {
  const [commissions, setCommissions] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null); // Will be set after fiscal year settings load
  const [totalCommission, setTotalCommission] = useState(0);
  const [fiscalYearStart, setFiscalYearStart] = useState({ month: 4, day: 1 });
  const [loadingCommissions, setLoadingCommissions] = useState(true);

  // Calculate current fiscal year based on settings
  const getCurrentFiscalYear = (month, day) => {
    const today = new Date();
    const fiscalYearStartDate = new Date(today.getFullYear(), month - 1, day);
    
    if (today >= fiscalYearStartDate) {
      return today.getFullYear();
    } else {
      return today.getFullYear() - 1;
    }
  };

  // Generate year options dynamically (current + 1 future + 9 past years)
  const getYearOptions = () => {
    const currentFiscalYear = getCurrentFiscalYear(fiscalYearStart.month, fiscalYearStart.day);
    const years = [];
    // Include next fiscal year, current, and past 9 years
    for (let i = -1; i <= 9; i++) {
      years.push(currentFiscalYear - i);
    }
    return years;
  };

  // Format fiscal year as "2025/2026"
  const formatFiscalYear = (year) => `${year}/${year + 1}`;

  useEffect(() => {
    fetchFiscalYearSettings();
  }, []);

  useEffect(() => {
    if (selectedYear !== null && fiscalYearStart.month) {
      fetchCommissions();
    }
  }, [selectedYear, fiscalYearStart]);

  const fetchFiscalYearSettings = async () => {
    try {
      const response = await api.get('/company-info/');
      if (response.data && response.data.length > 0) {
        const settings = response.data[0];
        const month = settings.fiscal_year_start_month || 4;
        const day = settings.fiscal_year_start_day || 1;
        setFiscalYearStart({ month, day });
        
        // Set selected year to current fiscal year after loading settings
        if (selectedYear === null) {
          setSelectedYear(getCurrentFiscalYear(month, day));
        }
      } else {
        // If no settings, use default and set year
        if (selectedYear === null) {
          setSelectedYear(getCurrentFiscalYear(4, 1));
        }
      }
    } catch (error) {
      console.error('Error loading fiscal year settings:', error);
      // On error, still set a default year
      if (selectedYear === null) {
        setSelectedYear(getCurrentFiscalYear(4, 1));
      }
    }
  };

  const fetchCommissions = async () => {
    setLoadingCommissions(true);
    try {
      // Get current user
      const meRes = await api.get('/users/me/');
      const userId = meRes.data.id;
      
      // Get employee ID from user
      const userDetails = await api.get(`/users/${userId}/`);
      const employeeId = userDetails.data.employee;
      
      if (!employeeId) {
        console.warn('User has no linked employee');
        setCommissions([]);
        setTotalCommission(0);
        setLoadingCommissions(false);
        return;
      }

      // Fetch commissions for the selected fiscal year
      const response = await api.get(`/customer-orders/employee-commissions/?employee=${employeeId}&fiscal_year=${selectedYear}`);
      const commissionsData = response.data.results || response.data || [];
      setCommissions(commissionsData);
      
      // Calculate total
      const total = commissionsData.reduce((sum, c) => sum + parseFloat(c.commission_amount || 0), 0);
      setTotalCommission(total);
    } catch (error) {
      console.error('Error loading commissions:', error);
      setCommissions([]);
      setTotalCommission(0);
    } finally {
      setLoadingCommissions(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-4">Reporting</h2>
      {errors?.report && (
        <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">Fehler beim Laden: {errors.report}</div>
      )}
      
      {/* Zeiterfassungsbilanz entfernt - befindet sich im Tab 'Zeiterfassung' */}

      {/* Commission Report */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <CurrencyEuroIcon className="h-5 w-5 mr-2 text-orange-600" />
            Provisionsbilanz
          </h3>
          {selectedYear !== null && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              {getYearOptions().map(year => (
                <option key={year} value={year}>
                  Geschäftsjahr {formatFiscalYear(year)}
                </option>
              ))}
            </select>
          )}
        </div>

        {loadingCommissions || selectedYear === null ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
              <span className="text-lg font-medium text-gray-700">Gesamtprovision {formatFiscalYear(selectedYear)}</span>
              <span className="text-2xl font-bold text-orange-600">€ {totalCommission.toFixed(2)}</span>
            </div>

            {commissions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CurrencyEuroIcon className="mx-auto h-12 w-12 mb-3" />
                <p className="text-sm">Keine Provisionen für das Geschäftsjahr {formatFiscalYear(selectedYear)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {commissions.map((commission, index) => (
                  <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded hover:bg-gray-100">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Auftrag #{commission.order_number || commission.customer_order}
                      </p>
                      <p className="text-xs text-gray-500">
                        {commission.customer_name} • {commission.commission_percentage}% von € {parseFloat(commission.order_net_total || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-600">€ {parseFloat(commission.commission_amount || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{commission.commission_rate}% Satz</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RemindersTab = ({ reminders, onRefresh, errors }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0]
  });

  // Fetch assigned tickets
  const [serviceTickets, setServiceTickets] = useState([]);
  const [visiviewTickets, setVisiviewTickets] = useState([]);
  const [salesTickets, setSalesTickets] = useState([]);
  const [troubleshootingTickets, setTroubleshootingTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  useEffect(() => {
    fetchAssignedTickets();
  }, []);

  const fetchAssignedTickets = async () => {
    setLoadingTickets(true);
    try {
      // Get current user
      const meRes = await api.get('/users/me/');
      const userId = meRes.data.id;

      // Fetch Service Tickets
      try {
        const serviceRes = await api.get(`/service/tickets/?assigned_to=${userId}`);
        setServiceTickets(serviceRes.data.results || serviceRes.data || []);
      } catch (err) {
        console.warn('Could not load service tickets', err);
        setServiceTickets([]);
      }

      // Fetch VisiView Tickets
      try {
        const visiviewRes = await api.get(`/visiview/tickets/?assigned_to=${userId}`);
        setVisiviewTickets(visiviewRes.data.results || visiviewRes.data || []);
      } catch (err) {
        console.warn('Could not load visiview tickets', err);
        setVisiviewTickets([]);
      }

      // Fetch Sales Tickets
      try {
        const salesRes = await api.get(`/sales/sales-tickets/?assigned_to=${userId}`);
        setSalesTickets(salesRes.data.results || salesRes.data || []);
      } catch (err) {
        console.warn('Could not load sales tickets', err);
        setSalesTickets([]);
      }

      // Fetch Troubleshooting Tickets
      try {
        const troubleshootingRes = await api.get(`/service/troubleshooting/?assigned_to=${userId}`);
        setTroubleshootingTickets(troubleshootingRes.data.results || troubleshootingRes.data || []);
      } catch (err) {
        console.warn('Could not load troubleshooting tickets', err);
        setTroubleshootingTickets([]);
      }
    } catch (err) {
      console.error('Error fetching assigned tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const openNewModal = () => {
    setEditingReminder(null);
    setFormData({
      title: '',
      description: '',
      due_date: new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const openEditModal = (reminder) => {
    setEditingReminder(reminder);
    setFormData({
      title: reminder.title || '',
      description: reminder.description || '',
      due_date: reminder.due_date ? reminder.due_date.split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingReminder) {
        await api.patch(`/users/reminders/${editingReminder.id}/`, formData);
      } else {
        await api.post('/users/reminders/', formData);
      }
      setShowModal(false);
      onRefresh();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern der Erinnerung');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Erinnerung wirklich löschen?')) return;
    try {
      await api.delete(`/users/reminders/${id}/`);
      onRefresh();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  const handleToggleComplete = async (id, isCompleted) => {
    try {
      await api.post(`/users/reminders/${id}/toggle_complete/`);
      onRefresh();
    } catch (error) {
      console.error('Fehler beim Ändern des Status:', error);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.post(`/users/reminders/${id}/dismiss/`);
      onRefresh();
    } catch (error) {
      console.error('Fehler beim Ausblenden:', error);
    }
  };

  // Sortiere nach Datum, nicht erledigte zuerst
  const sortedReminders = [...reminders]
    .filter(r => !r.is_dismissed)
    .sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });

  const isOverdue = (dueDate) => {
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today;
  };

  const isDueToday = (dueDate) => {
    const today = new Date().toISOString().split('T')[0];
    return dueDate.startsWith(today);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Erinnerungen</h2>
        <button
          onClick={openNewModal}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          <BellIcon className="h-5 w-5 mr-2" />
          Neue Erinnerung
        </button>
      </div>
      
      {errors?.reminders && (
        <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">Fehler beim Laden: {errors.reminders}</div>
      )}

      {/* Tickets moved to 'Meine Tickets' tab */}
      <div className="mb-6">
        <div className="bg-white shadow rounded-lg p-4 text-sm text-gray-700">
          Die Ticket-Übersichten (Service, VisiView, Sales) und Troubleshooting wurden in den Tab „Meine Tickets" verschoben.
          Sie finden dort alle zugewiesenen Tickets und Details.
          <div className="mt-3">
            <a href="?tab=my-tickets" className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm">Zu Meine Tickets</a>
          </div>
        </div>
      </div>
      
      {/* Reminders Section */}
      <div className="mb-6">
        <h3 className="text-md font-medium text-gray-900 mb-3">Persönliche Erinnerungen</h3>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {sortedReminders.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">Keine Erinnerungen vorhanden.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {sortedReminders.map((reminder) => {
              const overdue = !reminder.is_completed && isOverdue(reminder.due_date);
              const dueToday = !reminder.is_completed && isDueToday(reminder.due_date);
              return (
                <li key={reminder.id} className={`px-6 py-4 ${reminder.is_completed ? 'bg-gray-50' : overdue ? 'bg-red-50' : dueToday ? 'bg-yellow-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleComplete(reminder.id, reminder.is_completed)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          reminder.is_completed 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'border-gray-300 hover:border-blue-500'
                        }`}
                      >
                        {reminder.is_completed && '✓'}
                      </button>
                      <div className={reminder.is_completed ? 'opacity-50' : ''}>
                        <p className={`text-sm font-medium ${reminder.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {reminder.title}
                        </p>
                        {reminder.description && (
                          <p className="text-sm text-gray-500">{reminder.description}</p>
                        )}
                        {reminder.related_url && (
                          <a href={reminder.related_url} className="text-xs text-blue-600 hover:underline">
                            → Zum verknüpften Element
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-xs ${overdue ? 'text-red-600 font-medium' : dueToday ? 'text-yellow-600 font-medium' : 'text-gray-500'}`}>
                          {overdue ? '⚠️ Überfällig: ' : dueToday ? '📅 Heute: ' : ''}
                          {new Date(reminder.due_date).toLocaleDateString('de-DE')}
                        </p>
                        {reminder.related_object_type && (
                          <p className="text-xs text-gray-400">{reminder.related_object_type}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(reminder)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(reminder.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </div>

      {/* Modal für Neue/Bearbeiten Erinnerung */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingReminder ? 'Erinnerung bearbeiten' : 'Neue Erinnerung'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fälligkeitsdatum *</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const getBavarianHolidays = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  const addDays = (d) => {
    const dd = new Date(easter);
    dd.setDate(dd.getDate() + d);
    return dd.toISOString().slice(0,10);
  };
  const fixed = [
    `${year}-01-01`, `${year}-01-06`, `${year}-05-01`, `${year}-08-15`,
    `${year}-10-03`, `${year}-11-01`, `${year}-12-25`, `${year}-12-26`
  ];
  const variable = [addDays(-2), addDays(1), addDays(39), addDays(50), addDays(60)];
  return Array.from(new Set([...fixed, ...variable]));
};



// compute requested days more robustly: consider if start/end are non-working days so half-day flags only apply when that day counts
const computeRequestedDays = (startStr, endStr, work_days, startHalf=false, endHalf=false) => {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (end < start) return 0;

  const holidays = getBavarianHolidays(start.getFullYear()).concat(start.getFullYear()===end.getFullYear()?[]:getBavarianHolidays(end.getFullYear()));
  const mapping = {0:'sun',1:'mon',2:'tue',3:'wed',4:'thu',5:'fri',6:'sat'};
  const indices = [];
  for (let i=0;i<7;i++) if (work_days.includes(mapping[i])) indices.push(i);

  let cur = new Date(start);
  let count = 0;
  while (cur <= end) {
    const iso = cur.toISOString().slice(0,10);
    if (!holidays.includes(iso) && indices.includes(cur.getDay())) count += 1;
    cur.setDate(cur.getDate()+1);
  }

  // now apply half-day logic carefully
  let days = count;
  const startIso = start.toISOString().slice(0,10);
  const endIso = end.toISOString().slice(0,10);
  const startIsWorkday = (!getBavarianHolidays(start.getFullYear()).includes(startIso)) && indices.includes(start.getDay());
  const endIsWorkday = (!getBavarianHolidays(end.getFullYear()).includes(endIso)) && indices.includes(end.getDay());

  if (startIso === endIso) {
    // same day
    if (startHalf || endHalf) return 0.5;
    return days || 1;
  }

  if (startHalf && startIsWorkday) days -= 0.5;
  if (endHalf && endIsWorkday) days -= 0.5;

  if (days <= 0) days = 0.5;
  return days;
};

const VacationTab = ({ vacationRequests, employeeDetails, onRefresh, errors }) => {
  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState({ start_date: '', end_date: '', start_half: 'none', end_half: 'none', reason: '' });
  const [previewDays, setPreviewDays] = React.useState(0);
  const [previewRemaining, setPreviewRemaining] = React.useState(null);
  const [yearBalance, setYearBalance] = React.useState(null);
  const [adjustments, setAdjustments] = React.useState([]);
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());

  // calendar selection state
  const [selectedRange, setSelectedRange] = React.useState({ start: null, end: null });
  
  // Stable callback to prevent infinite re-render loop in CalendarMonth
  const handleCalendarSelect = React.useCallback(({ start, end }) => {
    setSelectedRange({ start, end });
  }, []);

  const formatDate = (s) => s ? new Date(s).toLocaleDateString() : '-';

  // Fetch year balance and adjustments
  React.useEffect(() => {
    const fetchYearData = async () => {
      // clear adjustments while loading to avoid showing stale data from previous year
      setAdjustments([]);
      try {
        const balanceRes = await api.get(`/users/vacation-year-balances/my_balance/?year=${selectedYear}`);
        setYearBalance(balanceRes.data);
      } catch (err) {
        console.warn('Jahresurlaubskonto nicht verfügbar:', err);
        setYearBalance(null);
      }
      try {
        // Only fetch adjustments for the current employee to avoid showing adjustments for all users
        if (employeeDetails && employeeDetails.id) {
          const adjustRes = await api.get(`/users/vacation-adjustments/?employee=${employeeDetails.id}&year=${selectedYear}`);
          setAdjustments(adjustRes.data.results || adjustRes.data || []);
        } else {
          setAdjustments([]);
        }
      } catch (err) {
        console.warn('Urlaubsanpassungen nicht verfügbar:', err);
        setAdjustments([]);
      }
    };
    fetchYearData();
  }, [selectedYear, employeeDetails]);

  React.useEffect(() => {
    // recompute preview when form or employee details change
    const work_days = employeeDetails ? (Array.isArray(employeeDetails.work_days) ? employeeDetails.work_days : ['mon','tue','wed','thu','fri']) : ['mon','tue','wed','thu','fri'];
    const startHalfFlag = form.start_half && form.start_half !== 'none';
    const endHalfFlag = form.end_half && form.end_half !== 'none';
    const d = computeRequestedDays(form.start_date, form.end_date, work_days, startHalfFlag, endHalfFlag);
    setPreviewDays(d);
    if (employeeDetails && typeof employeeDetails.vacation_balance !== 'undefined' && employeeDetails.vacation_balance !== null) {
      const bal = parseFloat(employeeDetails.vacation_balance);
      setPreviewRemaining((bal - d).toFixed(1));
    } else {
      setPreviewRemaining(null);
    }
  }, [form, employeeDetails]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const work_days = employeeDetails ? (Array.isArray(employeeDetails.work_days) ? employeeDetails.work_days : ['mon','tue','wed','thu','fri']) : ['mon','tue','wed','thu','fri'];
      const startHalfFlag = form.start_half && form.start_half !== 'none';
      const endHalfFlag = form.end_half && form.end_half !== 'none';
      const days = computeRequestedDays(form.start_date, form.end_date, work_days, startHalfFlag, endHalfFlag);

      // client-side guard: don't allow creating request that would overdraw balance
      if (employeeDetails && typeof employeeDetails.vacation_balance !== 'undefined' && employeeDetails.vacation_balance !== null) {
        const bal = parseFloat(employeeDetails.vacation_balance);
        if (bal - days < 0) {
          alert('Nicht genügend Urlaubstage verfügbar. Bitte prüfen oder HR kontaktieren.');
          return;
        }
      }

      await api.post('/users/vacation-requests/', { ...form, days_requested: days });
      setShowModal(false);
      setForm({ start_date: '', end_date: '', start_half: 'none', end_half: 'none', reason: '' });
      onRefresh();
    } catch (err) {
      console.error('Fehler beim Erstellen des Urlaubsantrags:', err);
      alert('Fehler beim Erstellen des Urlaubsantrags: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Year selector options (current year and previous 2 years)
  const yearOptions = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Urlaub</h2>
        <div className="flex items-center gap-4">
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-md border-gray-300 text-sm"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Neuen Antrag stellen</button>
        </div>
      </div>
      {errors?.vacation && (
        <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">Fehler beim Laden: {errors.vacation}</div>
      )}
      
      {/* Balance Overview */}
      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-gray-50 rounded">
          <div className="text-sm text-gray-500">Jahresanspruch {selectedYear}</div>
          <div className="text-xl font-semibold">{yearBalance?.entitlement !== undefined ? `${parseFloat(yearBalance.entitlement).toFixed(1)} Tage` : '-'}</div>
        </div>
        <div className="p-3 bg-blue-50 rounded">
          <div className="text-sm text-gray-500">Übertrag aus Vorjahr</div>
          <div className="text-xl font-semibold text-blue-700">{yearBalance?.carryover !== undefined ? `${parseFloat(yearBalance.carryover).toFixed(1)} Tage` : '-'}</div>
        </div>
        <div className="p-3 bg-orange-50 rounded">
          <div className="text-sm text-gray-500">Genommen</div>
          <div className="text-xl font-semibold text-orange-700">{yearBalance?.taken !== undefined ? `${parseFloat(yearBalance.taken).toFixed(1)} Tage` : '-'}</div>
        </div>
        <div className="p-3 bg-green-50 rounded">
          <div className="text-sm text-gray-500">Aktuelles Guthaben</div>
          <div className="text-xl font-semibold text-green-700">{(yearBalance && typeof yearBalance.balance !== 'undefined') ? `${parseFloat(yearBalance.balance).toFixed(1)} Tage` : (employeeDetails?.vacation_balance !== undefined ? `${parseFloat(employeeDetails.vacation_balance).toFixed(1)} Tage` : '-')}</div>
        </div>
      </div>

      {/* Calendar selector */}
      <div className="p-3 bg-white rounded border mb-4">
        <CalendarMonth vacationRequests={vacationRequests} onSelect={handleCalendarSelect} />

        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm">
            Ausgewählt: <span className="font-medium">{selectedRange.start ? formatDate(selectedRange.start) : '-'}{selectedRange.end ? ` — ${formatDate(selectedRange.end)}` : (selectedRange.start ? ' (einzeltag)' : '')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 bg-blue-600 text-white rounded" disabled={!selectedRange.start} onClick={() => {
              // apply selection to form and open modal
              const start = selectedRange.start;
              const end = selectedRange.end || selectedRange.start;
              setForm(prev => ({ ...prev, start_date: start, end_date: end }));
              setShowModal(true);
            }}>Neuen Urlaubsantrag</button>
            <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded" onClick={() => setSelectedRange({start:null,end:null})}>Auswahl zurücksetzen</button>
          </div>
        </div>
      </div>

      {/* Two columns: Requests left, Changelog right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Vacation Requests */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="text-sm font-medium text-gray-900">Urlaubsanträge {selectedYear}</h3>
          </div>
          {vacationRequests.filter(r => new Date(r.start_date).getFullYear() === selectedYear).length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">Keine Urlaubsanträge für {selectedYear} vorhanden.</div>
          ) : (
            <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {vacationRequests.filter(r => new Date(r.start_date).getFullYear() === selectedYear).map((request) => (
                <li key={request.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(request.start_date).toLocaleDateString()}
                        {request.start_half && request.start_half !== 'none' ? ` (${request.start_half_label})` : ''}
                        {' '}– {' '}
                        {new Date(request.end_date).toLocaleDateString()}
                        {request.end_half && request.end_half !== 'none' ? ` (${request.end_half_label})` : ''}
                      </p>
                      <p className="text-xs text-gray-500">{request.reason}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                        request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        request.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {request.status === 'approved' ? 'Genehmigt' : 
                         request.status === 'rejected' ? 'Abgelehnt' :
                         request.status === 'cancelled' ? 'Storniert' : 'Ausstehend'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{request.days_requested} Tage</p>
                      {request.status === 'pending' && (
                        <button onClick={async ()=>{
                          if (!window.confirm('Diesen ausstehenden Antrag wirklich löschen?')) return;
                          try {
                            await api.delete(`/users/vacation-requests/${request.id}/`);
                            onRefresh();
                          } catch (err) {
                            console.error('Fehler beim Löschen:', err);
                            alert('Fehler beim Löschen: ' + (err.response?.data?.detail || err.message));
                          }
                        }} className="text-xs text-red-600 hover:text-red-900 mt-1">Löschen</button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: Changelog */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="text-sm font-medium text-gray-900">Urlaubskonto Änderungsprotokoll</h3>
          </div>
          {adjustments.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">Keine Änderungen für {selectedYear} vorhanden.</div>
          ) : (
            <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {adjustments.map((adj) => (
                <li key={adj.id} className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{adj.adjustment_type_display}</p>
                      <p className="text-xs text-gray-500">{adj.reason}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(adj.created_at).toLocaleDateString()} {new Date(adj.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {adj.created_by_name && ` • ${adj.created_by_name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${parseFloat(adj.days) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(adj.days) >= 0 ? '+' : ''}{parseFloat(adj.days).toFixed(1)} Tage
                      </span>
                      <p className="text-xs text-gray-500">
                        {parseFloat(adj.balance_before).toFixed(1)} → {parseFloat(adj.balance_after).toFixed(1)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="font-medium mb-4">Neuer Urlaubsantrag</h3>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm">Startdatum</label>
                  <input type="date" required value={form.start_date} onChange={(e)=>setForm({...form, start_date: e.target.value})} className="mt-1 block w-full" />
                  <label className="block text-sm mt-2">Halber Tag (Beginn)</label>
                  <select value={form.start_half} onChange={(e)=>setForm({...form, start_half: e.target.value})} className="mt-1 block w-full">
                    <option value="none">Ganzer Tag</option>
                    <option value="am">Vormittag</option>
                    <option value="pm">Nachmittag</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm">Enddatum</label>
                  <input type="date" required value={form.end_date} onChange={(e)=>setForm({...form, end_date: e.target.value})} className="mt-1 block w-full" />
                  <label className="block text-sm mt-2">Halber Tag (Ende)</label>
                  <select value={form.end_half} onChange={(e)=>setForm({...form, end_half: e.target.value})} className="mt-1 block w-full">
                    <option value="none">Ganzer Tag</option>
                    <option value="am">Vormittag</option>
                    <option value="pm">Nachmittag</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm">Grund</label>
                <textarea value={form.reason} onChange={(e)=>setForm({...form, reason: e.target.value})} className="mt-1 block w-full" />
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm text-gray-500">Angefragte Tage</p>
                    <p className="text-lg font-semibold">{previewDays} Tage</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Verbleibend (falls verfügbar)</p>
                    <p className={`text-lg font-semibold ${previewRemaining !== null && parseFloat(previewRemaining) < 0 ? 'text-red-600' : 'text-gray-900'}`}>{previewRemaining !== null ? `${previewRemaining} Tage` : '-'}</p>
                  </div>
                </div>
                {previewRemaining !== null && parseFloat(previewRemaining) < 0 && (
                  <div className="mb-2 rounded-md bg-red-50 p-2 text-sm text-red-700">Dieser Antrag würde Ihr Urlaubskonto ins Minus bringen.</div>
                )}

                <div className="flex justify-end space-x-2">
                  <button type="button" onClick={()=>setShowModal(false)} className="px-3 py-1">Abbrechen</button>
                  <button type="submit" disabled={previewRemaining !== null && parseFloat(previewRemaining) < 0} className={`px-3 py-1 text-white rounded ${previewRemaining !== null && parseFloat(previewRemaining) < 0 ? 'bg-gray-400' : 'bg-blue-600'}`}>Antrag stellen</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== TravelExpensesTab Component ====================
const TravelExpensesTab = ({ onRefresh }) => {
  const [reports, setReports] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [selectedReport, setSelectedReport] = React.useState(null);
  const [perDiemRates, setPerDiemRates] = React.useState([]);
  const [formData, setFormData] = React.useState({
    calendar_week: getWeekNumber(new Date()),
    year: new Date().getFullYear()
  });

  // Helper function to get week number
  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  

  React.useEffect(() => {
    fetchReports();
    fetchPerDiemRates();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get('/users/travel-expenses/');
      setReports(res.data.results || res.data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Reisekosten:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPerDiemRates = async () => {
    try {
      const res = await api.get('/users/travel-per-diem-rates/country_city_options/');
      // API returns { options: [...] } (strings like 'Country' or 'Country - City')
      setPerDiemRates(res.data.options || res.data.results || res.data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Pauschalen:', err);
    }
  };

  const handleCreateReport = async (e) => {
    e.preventDefault();
    try {
      const weekDates = getWeekDates(formData.year, formData.calendar_week);
      const payload = {
        ...formData,
        destination: '-',
        country: 'Deutschland',
        purpose: '-',
        start_date: weekDates[0],
        end_date: weekDates[6]
      };
      const res = await api.post('/users/travel-expenses/', payload);
      setShowCreateModal(false);
      fetchReports();
      // Reload complete report data to ensure detail view works correctly
      const fullReport = await api.get(`/users/travel-expenses/${res.data.id}/`);
      setSelectedReport(fullReport.data);
    } catch (err) {
      console.error('Fehler beim Erstellen:', err);
      alert(err.response?.data?.detail || 'Fehler beim Erstellen der Abrechnung');
    }
  };

  const handleRemoveDay = async (reportId, dayId) => {
    if (!window.confirm('Reisetag wirklich entfernen?')) return;
    try {
      await api.delete(`/users/travel-expense-days/${dayId}/`);
      // Reload report
      const res = await api.get(`/users/travel-expenses/${reportId}/`);
      setSelectedReport(res.data);
    } catch (err) {
      console.error('Fehler beim Entfernen des Tages:', err);
    }
  };

  const handleAddDay = async (reportId, date) => {
    try {
      await api.post(`/users/travel-expenses/${reportId}/add_day/`, {
        date,
        location: '',
        country: 'Deutschland',
        travel_hours: 8  // Standardwert
      });
      // Reload report
      const res = await api.get(`/users/travel-expenses/${reportId}/`);
      setSelectedReport(res.data);
    } catch (err) {
      console.error('Fehler beim Hinzufügen des Tages:', err);
    }
  };

  const handleUpdateDay = async (dayId, updates) => {
    try {
      await api.patch(`/users/travel-expense-days/${dayId}/`, updates);
      // Reload report
      const res = await api.get(`/users/travel-expenses/${selectedReport.id}/`);
      setSelectedReport(res.data);
    } catch (err) {
      console.error('Fehler beim Aktualisieren des Tages:', err);
    }
  };

  const handleAddExpense = async (reportId, dayId, expenseData) => {
    try {
      const formData = new FormData();
      formData.append('day_id', dayId);
      formData.append('expense_type', expenseData.expense_type);
      formData.append('description', expenseData.description);
      formData.append('amount', expenseData.amount);
      if (expenseData.guest_names) formData.append('guest_names', expenseData.guest_names);
      if (expenseData.hospitality_reason) formData.append('hospitality_reason', expenseData.hospitality_reason);
      if (expenseData.receipt) formData.append('receipt', expenseData.receipt);
      
      await api.post(`/users/travel-expenses/${reportId}/add_expense/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Reload report
      const res = await api.get(`/users/travel-expenses/${reportId}/`);
      setSelectedReport(res.data);
    } catch (err) {
      console.error('Fehler beim Hinzufügen der Kosten:', err);
    }
  };
  
  const handleGeneratePdf = async (reportId) => {
    try {
      const response = await api.get(`/users/travel-expenses/${reportId}/generate_pdf/`, {
        responseType: 'blob'
      });
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reisekostenabrechnung_KW${selectedReport.calendar_week}_${selectedReport.year}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Fehler beim Generieren des PDF:', err);
    }
  };

  const handleSubmitReport = async (reportId) => {
    try {
      await api.post(`/users/travel-expenses/${reportId}/submit/`);
      fetchReports();
      setSelectedReport(null);
    } catch (err) {
      console.error('Fehler beim Einreichen:', err);
    }
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    submitted: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };

  const statusLabels = {
    draft: 'Entwurf',
    submitted: 'Eingereicht',
    approved: 'Genehmigt',
    rejected: 'Abgelehnt'
  };

  if (loading) {
    return <div className="flex justify-center items-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  // Detail view for a selected report
  if (selectedReport) {
    const weekDates = getWeekDates(selectedReport.year, selectedReport.calendar_week);
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <button onClick={() => setSelectedReport(null)} className="text-blue-600 hover:underline mb-2">← Zurück zur Übersicht</button>
            <h2 className="text-lg font-medium text-gray-900">
              Reisekostenabrechnung KW{selectedReport.calendar_week}/{selectedReport.year}
            </h2>
            <p className="text-sm text-gray-500">{selectedReport.destination} - {selectedReport.purpose}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs ${statusColors[selectedReport.status]}`}>
              {statusLabels[selectedReport.status]}
            </span>
            <button
              onClick={() => handleGeneratePdf(selectedReport.id)}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
            >
              📄 PDF generieren
            </button>
            {selectedReport.status === 'draft' && (
              <button
                onClick={() => handleSubmitReport(selectedReport.id)}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm"
              >
                Einreichen
              </button>
            )}
          </div>
        </div>

        {/* Week Calendar */}
        <div className="bg-white shadow rounded-lg p-4 mb-4">
          <h3 className="text-md font-medium mb-3">Wochenkalender</h3>
          <div className="grid grid-cols-7 gap-2">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, i) => (
              <div key={day} className="text-center">
                <div className="text-xs text-gray-500 mb-1">{day}</div>
                <div className="text-sm font-medium">{weekDates[i]?.slice(8)}</div>
                {selectedReport.days?.find(d => d.date === weekDates[i]) ? (
                  <div className="mt-1 p-2 bg-blue-50 rounded text-xs">
                    <div className="font-medium text-blue-700">
                      {parseFloat(selectedReport.days.find(d => d.date === weekDates[i]).day_total || 0).toFixed(2)}€
                    </div>
                  </div>
                ) : (
                  selectedReport.status === 'draft' && (
                    <button
                      onClick={() => handleAddDay(selectedReport.id, weekDates[i])}
                      className="mt-1 w-full p-1 border border-dashed border-gray-300 rounded text-xs text-gray-400 hover:border-blue-400 hover:text-blue-400"
                    >
                      + Tag
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Days detail */}
        {selectedReport.days?.map(day => (
          <DayExpenseCard
            key={day.id}
            day={day}
            reportId={selectedReport.id}
            onAddExpense={handleAddExpense}
            onRemoveDay={handleRemoveDay}
            onUpdateDay={handleUpdateDay}
            isDraft={selectedReport.status === 'draft'}
            perDiemRates={perDiemRates}
          />
        ))}

        {/* Summary */}
        <div className="bg-white shadow rounded-lg p-4 mt-4">
          <h3 className="text-md font-medium mb-2">Zusammenfassung</h3>
          <div className="flex justify-between text-lg font-bold">
            <span>Gesamtbetrag:</span>
            <span className="text-green-600">{parseFloat(selectedReport.total_amount || 0).toFixed(2)}€</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Reisekosten</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          + Neue Abrechnung
        </button>
      </div>

      {/* Reports List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Keine Reisekostenabrechnungen vorhanden.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">KW/Jahr</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reiseziel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zeitraum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Betrag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map(report => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">KW{report.calendar_week}/{report.year}</td>
                  <td className="px-4 py-3 text-sm">{report.destination}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(report.start_date).toLocaleDateString()} - {new Date(report.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{parseFloat(report.total_amount || 0).toFixed(2)}€</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${statusColors[report.status]}`}>
                      {statusLabels[report.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedReport(report)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Öffnen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black bg-opacity-30" onClick={() => setShowCreateModal(false)}></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium mb-4">Neue Reisekostenabrechnung</h3>
              <form onSubmit={handleCreateReport} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Jahr</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Kalenderwoche</label>
                    <select
                      value={formData.calendar_week}
                      onChange={e => setFormData({ ...formData, calendar_week: parseInt(e.target.value) })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                      required
                    >
                      {Array.from({ length: 53 }, (_, i) => {
                        const weekNum = i + 1;
                        const dates = getWeekDates(formData.year, weekNum);
                        const start = new Date(dates[0]);
                        const end = new Date(dates[6]);
                        return (
                          <option key={weekNum} value={weekNum}>
                            KW {weekNum} ({start.toLocaleDateString('de-DE')} - {end.toLocaleDateString('de-DE')})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Die einzelnen Reisetage, Orte und Reisezeiten können nach dem Erstellen in der Detailansicht eingetragen werden.
                </p>
                <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-md">
                    Abbrechen
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
                    Erstellen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for day expense cards
const DayExpenseCard = ({ day, reportId, onAddExpense, onRemoveDay, onUpdateDay, isDraft, perDiemRates = [] }) => {
  const [showAddExpense, setShowAddExpense] = React.useState(false);
  const [isEditingDay, setIsEditingDay] = React.useState(false);
  const [dayForm, setDayForm] = React.useState({
    location: day.location || '',
    country: day.country || 'Deutschland',
    travel_hours: day.travel_hours || 8
  });
  const [expenseForm, setExpenseForm] = React.useState({
    expense_type: 'transport',
    description: '',
    amount: '',
    guest_names: '',
    hospitality_reason: '',
    receipt: null
  });

  const expenseTypes = [
    { value: 'transport', label: 'Transport' },
    { value: 'hotel', label: 'Hotel' },
    { value: 'parking', label: 'Parken' },
    { value: 'shipping', label: 'Versand' },
    { value: 'hospitality', label: 'Bewirtung' },
    { value: 'other', label: 'Sonstiges' }
  ];

  const handleSubmitExpense = (e) => {
    e.preventDefault();
    onAddExpense(reportId, day.id, {
      ...expenseForm,
      amount: parseFloat(expenseForm.amount)
    });
    setExpenseForm({ expense_type: 'transport', description: '', amount: '', guest_names: '', hospitality_reason: '', receipt: null });
    setShowAddExpense(false);
  };

  const handleSaveDaySettings = () => {
    onUpdateDay(day.id, {
      location: dayForm.location,
      country: dayForm.country,
      travel_hours: parseFloat(dayForm.travel_hours) || 8
    });
    setIsEditingDay(false);
  };

  // Determine per-diem info text based on travel hours
  const getPerDiemInfo = () => {
    const hours = parseFloat(dayForm.travel_hours) || 0;
    if (hours >= 24) return 'Volle Tagespauschale';
    if (hours > 8) return 'Volle Tagespauschale (>8h)';
    return 'Halbe Tagespauschale (≤8h)';
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-3">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="font-medium">{new Date(day.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}</div>
          {!isEditingDay ? (
            <div className="text-sm text-gray-500">
              {day.location || '(kein Ort)'} ({day.country}) - {day.travel_hours || 0}h Reisezeit
              {isDraft && (
                <button 
                  onClick={() => setIsEditingDay(true)}
                  className="ml-2 text-blue-600 hover:underline"
                >
                  bearbeiten
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-2 bg-gray-50 p-3 rounded">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500">Ort</label>
                  <input
                    type="text"
                    value={dayForm.location}
                    onChange={e => setDayForm({ ...dayForm, location: e.target.value })}
                    placeholder="z.B. München"
                    className="mt-1 block w-full rounded-md border-gray-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Land</label>
                  <select
                    value={dayForm.country + (dayForm.location ? ' - ' + dayForm.location : '')}
                    onChange={e => {
                      const val = e.target.value;
                      if (val.includes(' - ')) {
                        const [c, ...rest] = val.split(' - ');
                        const city = rest.join(' - ');
                        setDayForm({ ...dayForm, country: c, location: city });
                      } else {
                        setDayForm({ ...dayForm, country: val, location: '' });
                      }
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 text-sm"
                  >
                    <option value="Deutschland">Deutschland</option>
                    {perDiemRates.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Reisezeit (Stunden)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={dayForm.travel_hours}
                    onChange={e => setDayForm({ ...dayForm, travel_hours: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 text-sm"
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500">{getPerDiemInfo()}</div>
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveDaySettings}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  Speichern
                </button>
                <button 
                  onClick={() => {
                    setDayForm({ location: day.location || '', country: day.country || 'Deutschland', travel_hours: day.travel_hours || 8 });
                    setIsEditingDay(false);
                  }}
                  className="px-2 py-1 text-gray-600 text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-start space-x-2">
          <div className="text-right">
            <div className="text-sm text-gray-500">Tagespauschale</div>
            <div className="font-medium text-green-600">{parseFloat(day.per_diem_applied || 0).toFixed(2)}€</div>
          </div>
          {isDraft && (
            <button
              onClick={() => onRemoveDay(reportId, day.id)}
              className="text-red-600 hover:text-red-800 text-sm"
              title="Tag entfernen"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Expenses list */}
      {day.expenses?.length > 0 && (
        <div className="border-t pt-2 mb-2">
          {day.expenses.map(exp => (
            <div key={exp.id} className="flex justify-between items-start text-sm py-1">
              <div>
                <span>{exp.expense_type_display}: {exp.description}</span>
                {exp.receipt_url && (
                  <a 
                    href={exp.receipt_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:underline text-xs"
                  >
                    📎 Beleg
                  </a>
                )}
              </div>
              <span className="font-medium">{parseFloat(exp.amount || 0).toFixed(2)}€</span>
            </div>
          ))}
        </div>
      )}

      {isDraft && (
        <>
          {!showAddExpense ? (
            <button
              onClick={() => setShowAddExpense(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              + Kosten hinzufügen
            </button>
          ) : (
            <form onSubmit={handleSubmitExpense} className="border-t pt-3 mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={expenseForm.expense_type}
                  onChange={e => setExpenseForm({ ...expenseForm, expense_type: e.target.value })}
                  className="rounded-md border-gray-300 text-sm"
                >
                  {expenseTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Betrag €"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="rounded-md border-gray-300 text-sm"
                  required
                />
              </div>
              <input
                type="text"
                placeholder="Beschreibung"
                value={expenseForm.description}
                onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="w-full rounded-md border-gray-300 text-sm"
                required
              />
              {expenseForm.expense_type === 'hospitality' && (
                <>
                  <input
                    type="text"
                    placeholder="Gastnamen"
                    value={expenseForm.guest_names}
                    onChange={e => setExpenseForm({ ...expenseForm, guest_names: e.target.value })}
                    className="w-full rounded-md border-gray-300 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Bewirtungsgrund"
                    value={expenseForm.hospitality_reason}
                    onChange={e => setExpenseForm({ ...expenseForm, hospitality_reason: e.target.value })}
                    className="w-full rounded-md border-gray-300 text-sm"
                  />
                </>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Beleg (optional, JPG/PDF)</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={e => setExpenseForm({ ...expenseForm, receipt: e.target.files[0] || null })}
                  className="w-full text-sm text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddExpense(false)} className="text-sm px-2 py-1">Abbrechen</button>
                <button type="submit" className="text-sm px-2 py-1 bg-blue-600 text-white rounded">Hinzufügen</button>
              </div>
            </form>
          )}
        </>
      )}

      <div className="border-t mt-2 pt-2 flex justify-end font-medium">
        Tagesgesamt: {parseFloat(day.day_total || 0).toFixed(2)}€
      </div>
    </div>
  );
};

// PersonalDashboardTab Component - Persönliche Schnellzugriffe
const PersonalDashboardTab = () => {
  const STORAGE_KEY = 'myverp_dashboard_modules';
  const MAIN_DASHBOARD_KEY = 'myverp_main_dashboard_widgets';
  
  // MyVERP-spezifische Widgets für das Haupt-Dashboard (basierend auf MyVERP Tabs)
  const myverpWidgets = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊', description: 'Persönliches Dashboard' },
    { id: 'time-tracking', name: 'Zeiterfassung', icon: '⏱️', description: 'Arbeitszeitübersicht' },
    { id: 'my-tickets', name: 'Meine Tickets', icon: '🎫', description: 'Zugewiesene Tickets' },
    { id: 'messages', name: 'Nachrichten', icon: '💬', description: 'Ungelesene Nachrichten' },
    { id: 'reporting', name: 'Reporting', icon: '📈', description: 'Auswertungen & Berichte' },
    { id: 'reminders', name: 'Erinnerungen', icon: '🔔', description: 'Anstehende Erinnerungen' },
    { id: 'vacation', name: 'Urlaub', icon: '🏖️', description: 'Urlaubsanträge & Guthaben' },
    { id: 'travel-expenses', name: 'Reisekosten', icon: '✈️', description: 'Reisekostenabrechnungen' },
  ];
  
  // Alle verfügbaren Module - hierarchisch nach Hauptmodulen gegliedert
  const allModules = [
    // Finance
    { id: 'finance', name: 'Finance', route: '/finance', icon: '💰', category: 'Finance' },
    
    // Procurement
    { id: 'procurement', name: 'Procurement', route: '/procurement', icon: '📦', category: 'Procurement' },
    { id: 'suppliers', name: 'Lieferanten', route: '/procurement/suppliers', icon: '🏢', category: 'Procurement' },
    { id: 'trading', name: 'Handelsware', route: '/procurement/trading-goods', icon: '📦', category: 'Procurement' },
    { id: 'materials-supplies', name: 'Material & Supplies', route: '/procurement/materials-supplies', icon: '🧪', category: 'Procurement' },
    { id: 'purchase-orders', name: 'Bestellungen', route: '/procurement/orders', icon: '🛒', category: 'Procurement' },
    { id: 'loans', name: 'Leihgeräte', route: '/procurement/loans', icon: '🔄', category: 'Procurement' },
    { id: 'product-collections', name: 'Produktsammlungen', route: '/procurement/product-collections', icon: '📋', category: 'Procurement' },
    
    // Inventory
    { id: 'inventory', name: 'Wareneingang & Lager', route: '/inventory/warehouse', icon: '🏭', category: 'Inventory' },
    
    // Sales / Orders
    { id: 'sales', name: 'Sales / Orders', route: '/sales', icon: '💼', category: 'Sales / Orders' },
    { id: 'customers', name: 'Kunden', route: '/sales/customers', icon: '👤', category: 'Sales / Orders' },
    { id: 'dealers', name: 'Händler', route: '/sales/dealers', icon: '🤝', category: 'Sales / Orders' },
    { id: 'pricelists', name: 'Preislisten', route: '/sales/pricelists', icon: '💲', category: 'Sales / Orders' },
    { id: 'projects', name: 'Projekte', route: '/sales/projects', icon: '📁', category: 'Sales / Orders' },
    { id: 'systems', name: 'Systeme', route: '/sales/systems', icon: '🖥️', category: 'Sales / Orders' },
    { id: 'quotations', name: 'Angebote', route: '/sales/quotations', icon: '📋', category: 'Sales / Orders' },
    { id: 'orders', name: 'Aufträge', route: '/sales/order-processing', icon: '📑', category: 'Sales / Orders' },
    { id: 'marketing', name: 'Marketing', route: '/sales/marketing', icon: '📣', category: 'Sales / Orders' },
    { id: 'sales-tickets', name: 'Sales Tickets', route: '/sales/tickets', icon: '🎫', category: 'Sales / Orders' },
    
    // HR
    { id: 'hr', name: 'HR', route: '/hr', icon: '👥', category: 'HR' },
    { id: 'employees', name: 'Mitarbeiter', route: '/hr/employees', icon: '👤', category: 'HR' },
    
    // Manufacturing
    { id: 'manufacturing', name: 'Manufacturing', route: '/manufacturing', icon: '🏭', category: 'Manufacturing' },
    { id: 'vs-hardware', name: 'VS-Hardware', route: '/manufacturing/vs-hardware', icon: '🔧', category: 'Manufacturing' },
    { id: 'production-orders', name: 'Fertigungsaufträge', route: '/manufacturing/production-orders', icon: '⚙️', category: 'Manufacturing' },
    
    // VisiView
    { id: 'visiview', name: 'VisiView', route: '/visiview', icon: '🔬', category: 'VisiView' },
    { id: 'visiview-products', name: 'VisiView Produkte', route: '/visiview/products', icon: '🔬', category: 'VisiView' },
    { id: 'visiview-licenses', name: 'Lizenzen', route: '/visiview/licenses', icon: '🔑', category: 'VisiView' },
    { id: 'visiview-tickets', name: 'VisiView Tickets', route: '/visiview/tickets', icon: '🎫', category: 'VisiView' },
    { id: 'visiview-macros', name: 'Macros', route: '/visiview/macros', icon: '📜', category: 'VisiView' },
    
    // Service
    { id: 'service', name: 'Service', route: '/service', icon: '🛠️', category: 'Service' },
    { id: 'vs-service', name: 'VS-Service Produkte', route: '/service/vs-service', icon: '🛠️', category: 'Service' },
    { id: 'service-tickets', name: 'Service Tickets', route: '/service/tickets', icon: '🎫', category: 'Service' },
    { id: 'rma', name: 'RMA-Fälle', route: '/service/rma', icon: '🔄', category: 'Service' },
    { id: 'troubleshooting', name: 'Troubleshooting', route: '/service/troubleshooting', icon: '🔍', category: 'Service' },
    
    // BI
    { id: 'bi', name: 'BI', route: '/bi', icon: '📊', category: 'BI' },
    
    // Documents
    { id: 'documents', name: 'Documents', route: '/documents', icon: '📄', category: 'Documents' },
    
    // Settings
    { id: 'settings', name: 'Settings', route: '/settings', icon: '⚙️', category: 'Settings' },
    { id: 'users', name: 'Benutzer', route: '/settings/users', icon: '👥', category: 'Settings' },
    { id: 'exchange-rates', name: 'Wechselkurse', route: '/settings/currency-exchange-rates', icon: '💱', category: 'Settings' },
    { id: 'company', name: 'Firmendaten', route: '/settings/company-info', icon: '🏛️', category: 'Settings' },
  ];
  
  // Standard-Module die initial aktiviert sind
  const defaultModules = ['customers', 'quotations', 'orders', 'suppliers', 'trading', 'inventory'];
  const defaultMainDashboardWidgets = ['time-tracking', 'messages', 'reminders'];
  
  // Legacy-ID-Mapping für Abwärtskompatibilität (alte IDs -> neue IDs)
  const LEGACY_MODULE_ID_MAP = {
    'order-processing': 'orders',
    'warehouse': 'inventory',
    'purchase-orders': 'purchase-orders',
    'materials-supplies': 'materials-supplies'
  };

  // Normalize saved module ids: map legacy ids and filter unknown ids
  const normalizeModuleIds = (ids) => {
    if (!Array.isArray(ids)) return [];
    const validIds = new Set(allModules.map(m => m.id));
    return Array.from(new Set(ids.map(id => LEGACY_MODULE_ID_MAP[id] || id).filter(i => validIds.has(i))));
  };

  // Geladene Auswahl aus localStorage
  const loadSavedModules = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeModuleIds(JSON.parse(saved));
    } catch (e) {
      console.warn('Fehler beim Laden der gespeicherten Module:', e);
    }
    return defaultModules;
  };
  
  const loadMainDashboardWidgets = () => {
    try {
      const saved = localStorage.getItem(MAIN_DASHBOARD_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Fehler beim Laden der Haupt-Dashboard-Widgets:', e);
    }
    return defaultMainDashboardWidgets;
  };
  
  const [selectedModules, setSelectedModules] = React.useState(loadSavedModules);
  const [mainDashboardWidgets, setMainDashboardWidgets] = React.useState(loadMainDashboardWidgets);
  const [showSettings, setShowSettings] = React.useState(false);
  
  // Speichern bei Änderung
  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedModules));
  }, [selectedModules]);
  
  React.useEffect(() => {
    localStorage.setItem(MAIN_DASHBOARD_KEY, JSON.stringify(mainDashboardWidgets));
  }, [mainDashboardWidgets]);
  
  const toggleModule = (moduleId) => {
    setSelectedModules(prev => {
      if (prev.includes(moduleId)) {
        return prev.filter(id => id !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };
  
  const toggleMainDashboardWidget = (widgetId) => {
    setMainDashboardWidgets(prev => {
      if (prev.includes(widgetId)) {
        return prev.filter(id => id !== widgetId);
      } else {
        return [...prev, widgetId];
      }
    });
  };
  
  const activeModules = allModules.filter(m => selectedModules.includes(m.id));
  const categories = [...new Set(allModules.map(m => m.category))];
  
  const colorClasses = {
    'Finance': 'bg-emerald-500 hover:bg-emerald-600',
    'Procurement': 'bg-orange-500 hover:bg-orange-600',
    'Inventory': 'bg-violet-500 hover:bg-violet-600',
    'Sales / Orders': 'bg-blue-500 hover:bg-blue-600',
    'HR': 'bg-pink-500 hover:bg-pink-600',
    'Manufacturing': 'bg-gray-600 hover:bg-gray-700',
    'VisiView': 'bg-cyan-500 hover:bg-cyan-600',
    'Service': 'bg-amber-500 hover:bg-amber-600',
    'BI': 'bg-indigo-500 hover:bg-indigo-600',
    'Documents': 'bg-teal-500 hover:bg-teal-600',
    'Settings': 'bg-purple-500 hover:bg-purple-600',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Mein Dashboard</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          ⚙️ Anpassen
        </button>
      </div>
      
      {/* MyVERP Quick Links */}
      {!showSettings && (
        <>
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-700 mb-3">MyVERP Schnellzugriff</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <a href="#" onClick={(e) => { e.preventDefault(); }} className="bg-sky-500 hover:bg-sky-600 text-white p-4 rounded-lg shadow-lg transition-all">
                <div className="text-center">
                  <div className="text-2xl mb-1">⏱️</div>
                  <div className="text-sm font-semibold">Zeiterfassung</div>
                </div>
              </a>
              <a href="#" onClick={(e) => { e.preventDefault(); }} className="bg-indigo-500 hover:bg-indigo-600 text-white p-4 rounded-lg shadow-lg transition-all">
                <div className="text-center">
                  <div className="text-2xl mb-1">💬</div>
                  <div className="text-sm font-semibold">Nachrichten</div>
                </div>
              </a>
              <a href="#" onClick={(e) => { e.preventDefault(); }} className="bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-lg shadow-lg transition-all">
                <div className="text-center">
                  <div className="text-2xl mb-1">🔔</div>
                  <div className="text-sm font-semibold">Erinnerungen</div>
                </div>
              </a>
              <a href="#" onClick={(e) => { e.preventDefault(); }} className="bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-lg shadow-lg transition-all">
                <div className="text-center">
                  <div className="text-2xl mb-1">🏖️</div>
                  <div className="text-sm font-semibold">Urlaub</div>
                </div>
              </a>
              <a href="#" onClick={(e) => { e.preventDefault(); }} className="bg-rose-500 hover:bg-rose-600 text-white p-4 rounded-lg shadow-lg transition-all">
                <div className="text-center">
                  <div className="text-2xl mb-1">✈️</div>
                  <div className="text-sm font-semibold">Reisekosten</div>
                </div>
              </a>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-700 mb-3">Modul-Schnellzugriff</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {activeModules.map((module) => {
                const colorClass = colorClasses[module.category] || 'bg-gray-500 hover:bg-gray-600';
                return (
                  <a
                    key={module.id}
                    href={module.route}
                    className={`${colorClass} text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">{module.icon}</div>
                      <div className="text-lg font-semibold">{module.name}</div>
                      <div className="text-xs opacity-75">{module.category}</div>
                    </div>
                  </a>
                );
              })}
              {activeModules.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-8">
                  Keine Module ausgewählt. Klicken Sie auf "Anpassen", um Module hinzuzufügen.
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Einstellungen / Modul-Auswahl */}
      {showSettings && (
        <div className="bg-white shadow rounded-lg p-6">
          {/* Haupt-Dashboard Widget Auswahl */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Widgets im Haupt-Dashboard</h3>
            <p className="text-sm text-gray-500 mb-4">
              Wählen Sie die MyVERP-Widgets aus, die auf dem Haupt-Dashboard angezeigt werden sollen.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {myverpWidgets.map(widget => (
                <label
                  key={widget.id}
                  className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    mainDashboardWidgets.includes(widget.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={mainDashboardWidgets.includes(widget.id)}
                    onChange={() => toggleMainDashboardWidget(widget.id)}
                    className="sr-only"
                  />
                  <span className="text-2xl mb-2">{widget.icon}</span>
                  <span className="text-sm font-medium text-gray-700 text-center">{widget.name}</span>
                  <span className="text-xs text-gray-500 text-center">{widget.description}</span>
                  {mainDashboardWidgets.includes(widget.id) && (
                    <span className="mt-2 text-blue-500 text-lg">✓</span>
                  )}
                </label>
              ))}
            </div>
          </div>
          
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Module für Schnellzugriff auswählen</h3>
            <p className="text-sm text-gray-500 mb-6">
              Wählen Sie die Module aus, die in Ihrem persönlichen Dashboard angezeigt werden sollen.
            </p>
            
            {categories.map(category => (
              <div key={category} className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">{category}</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {allModules.filter(m => m.category === category).map(module => (
                    <label
                      key={module.id}
                      className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedModules.includes(module.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModules.includes(module.id)}
                        onChange={() => toggleModule(module.id)}
                        className="sr-only"
                      />
                      <span className="text-2xl mr-3">{module.icon}</span>
                      <span className="text-sm font-medium text-gray-700">{module.name}</span>
                      {selectedModules.includes(module.id) && (
                        <span className="ml-auto text-blue-500">✓</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <button
              onClick={() => {
                setSelectedModules(defaultModules);
                setMainDashboardWidgets(defaultMainDashboardWidgets);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Auf Standard zurücksetzen
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// MyTicketsTab Component - zeigt dem User zugewiesene Tickets aus allen Systemen
const MyTicketsTab = ({ onRefresh, errors }) => {
  const [tickets, setTickets] = useState({
    visiview: [],
    service: [],
    sales: []
  });
  const [createdTickets, setCreatedTickets] = useState({
    visiview: [],
    service: [],
    sales: []
  });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // all, visiview, service, sales
  const [activeCreatedFilter, setActiveCreatedFilter] = useState('all'); // Filter für erstellte Tickets

  useEffect(() => {
    fetchMyTickets();
  }, []);

  const fetchMyTickets = async () => {
    setLoading(true);
    try {
      // Hole den aktuellen User
      const meRes = await api.get('/users/me/');
      const userId = meRes.data.id;

      // Hole Tickets aus allen Systemen, wo der User zugewiesen ist
      const [vvRes, serviceRes, salesRes] = await Promise.allSettled([
        api.get(`/visiview/tickets/?assigned_to=${userId}`),
        api.get(`/service/tickets/?assigned_to=${userId}`),
        api.get(`/sales/sales-tickets/?assigned_to=${userId}`)
      ]);

      setTickets({
        visiview: vvRes.status === 'fulfilled' ? (vvRes.value.data.results || vvRes.value.data || []) : [],
        service: serviceRes.status === 'fulfilled' ? (serviceRes.value.data.results || serviceRes.value.data || []) : [],
        sales: salesRes.status === 'fulfilled' ? (salesRes.value.data.results || salesRes.value.data || []) : []
      });
      // Hole zusätzlich alle Tickets, die vom User erstellt wurden
      const [vvCreatedRes, serviceCreatedRes, salesCreatedRes] = await Promise.allSettled([
        api.get(`/visiview/tickets/?created_by=${userId}`),
        api.get(`/service/tickets/?created_by=${userId}`),
        api.get(`/sales/sales-tickets/?created_by=${userId}`)
      ]);

      setCreatedTickets({
        visiview: vvCreatedRes.status === 'fulfilled' ? (vvCreatedRes.value.data.results || vvCreatedRes.value.data || []) : [],
        service: serviceCreatedRes.status === 'fulfilled' ? (serviceCreatedRes.value.data.results || serviceCreatedRes.value.data || []) : [],
        sales: salesCreatedRes.status === 'fulfilled' ? (salesCreatedRes.value.data.results || salesCreatedRes.value.data || []) : []
      });
    } catch (error) {
      console.error('Fehler beim Laden der Tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'new': 'bg-blue-100 text-blue-800',
      'assigned': 'bg-purple-100 text-purple-800',
      'in_progress': 'bg-yellow-100 text-yellow-800',
      'waiting_customer': 'bg-orange-100 text-orange-800',
      'waiting_thirdparty': 'bg-orange-100 text-orange-800',
      'testing': 'bg-indigo-100 text-indigo-800',
      'tested': 'bg-green-100 text-green-800',
      'resolved': 'bg-green-100 text-green-800',
      'closed': 'bg-gray-100 text-gray-800',
      'no_solution': 'bg-red-100 text-red-800',
      'rejected': 'bg-red-100 text-red-800',
      'review': 'bg-purple-100 text-purple-800',
      'completed': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'text-gray-500',
      'normal': 'text-blue-500',
      'high': 'text-orange-500',
      'urgent': 'text-red-500',
      'immediate': 'text-red-700'
    };
    return colors[priority] || 'text-gray-500';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const allTickets = [
    ...tickets.visiview.map(t => ({ ...t, type: 'visiview', link: `/visiview/tickets/${t.id}` })),
    ...tickets.service.map(t => ({ ...t, type: 'service', link: `/service/tickets/${t.id}` })),
    ...tickets.sales.map(t => ({ ...t, type: 'sales', link: `/sales/tickets/${t.id}` }))
  ];

  const filteredTickets = activeFilter === 'all'
    ? allTickets
    : allTickets.filter(t => t.type === activeFilter);

  // Sortiere nach Erstellungsdatum (neueste zuerst)
  const sortedTickets = [...filteredTickets].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  // Erstellte Tickets - gleiche Logik
  const allCreatedTickets = [
    ...createdTickets.visiview.map(t => ({ ...t, type: 'visiview', link: `/visiview/tickets/${t.id}` })),
    ...createdTickets.service.map(t => ({ ...t, type: 'service', link: `/service/tickets/${t.id}` })),
    ...createdTickets.sales.map(t => ({ ...t, type: 'sales', link: `/sales/tickets/${t.id}` }))
  ];

  const filteredCreatedTickets = activeCreatedFilter === 'all'
    ? allCreatedTickets
    : allCreatedTickets.filter(t => t.type === activeCreatedFilter);

  const sortedCreatedTickets = [...filteredCreatedTickets].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            mir zugewiesene Tickets ({sortedTickets.length})
          </h2>
          <button
            onClick={fetchMyTickets}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Aktualisieren
          </button>
        </div>

        {/* Filter */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 text-sm rounded-md ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Alle ({allTickets.length})
          </button>
          <button
            onClick={() => setActiveFilter('visiview')}
            className={`px-4 py-2 text-sm rounded-md ${
              activeFilter === 'visiview'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            VisiView ({tickets.visiview.length})
          </button>
          <button
            onClick={() => setActiveFilter('service')}
            className={`px-4 py-2 text-sm rounded-md ${
              activeFilter === 'service'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Service ({tickets.service.length})
          </button>
          <button
            onClick={() => setActiveFilter('sales')}
            className={`px-4 py-2 text-sm rounded-md ${
              activeFilter === 'sales'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sales ({tickets.sales.length})
          </button>
        </div>

        {/* Tickets Liste */}
        {sortedTickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Keine Tickets zugewiesen
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priorität</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Erstellt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedTickets.map((ticket) => (
                  <tr key={`${ticket.type}-${ticket.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        ticket.type === 'visiview' ? 'bg-indigo-100 text-indigo-800' :
                        ticket.type === 'service' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {ticket.type === 'visiview' ? 'VisiView' :
                         ticket.type === 'service' ? 'Service' : 'Sales'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{ticket.ticket_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ticket.title}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ticket.priority && (
                        <span className={`text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(ticket.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <a
                        href={ticket.link}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Öffnen
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Von mir erstellte Tickets */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">von mir erstellte Tickets ({sortedCreatedTickets.length})</h2>
          <button
            onClick={fetchMyTickets}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Aktualisieren
          </button>
        </div>

        {/* Filter */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveCreatedFilter('all')}
            className={`px-4 py-2 text-sm rounded-md ${
              activeCreatedFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Alle ({allCreatedTickets.length})
          </button>
          <button
            onClick={() => setActiveCreatedFilter('visiview')}
            className={`px-4 py-2 text-sm rounded-md ${
              activeCreatedFilter === 'visiview'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            VisiView ({createdTickets.visiview.length})
          </button>
          <button
            onClick={() => setActiveCreatedFilter('service')}
            className={`px-4 py-2 text-sm rounded-md ${
              activeCreatedFilter === 'service'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Service ({createdTickets.service.length})
          </button>
          <button
            onClick={() => setActiveCreatedFilter('sales')}
            className={`px-4 py-2 text-sm rounded-md ${
              activeCreatedFilter === 'sales'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sales ({createdTickets.sales.length})
          </button>
        </div>

        {/* Tickets Liste */}
        {sortedCreatedTickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Keine Tickets erstellt
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priorität</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Erstellt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedCreatedTickets.map((ticket) => (
                  <tr key={`${ticket.type}-${ticket.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        ticket.type === 'visiview' ? 'bg-indigo-100 text-indigo-800' :
                        ticket.type === 'service' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {ticket.type === 'visiview' ? 'VisiView' :
                         ticket.type === 'service' ? 'Service' : 'Sales'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{ticket.ticket_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ticket.title}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ticket.priority && (
                        <span className={`text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(ticket.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <a
                        href={ticket.link}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Öffnen
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyVERP;