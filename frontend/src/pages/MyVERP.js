import React, { useState, useEffect } from 'react';

import api from '../services/api';
import { ClockIcon, ChatBubbleLeftIcon, ChartBarIcon, BellIcon, CalendarIcon } from '@heroicons/react/24/outline';
import CalendarMonth from '../components/CalendarMonth';

const MyVERP = () => {
  const [activeTab, setActiveTab] = useState('time-tracking');
  const [timeEntries, setTimeEntries] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [vacationRequests, setVacationRequests] = useState([]);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setErrors({});
      const endpoints = {
        time: api.get('/users/time-entries/'),
        messages: api.get('/users/messages/'),
        reminders: api.get('/users/reminders/'),
        vacation: api.get('/users/vacation-requests/'),
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
    // additionally fetch /users/me and employee details (separate call)
    try {
      const meRes = await api.get('/users/me/');
      try {
        const empRes = await api.get('/users/employees/me/');
        setEmployeeDetails(empRes.data || null);
      } catch (err) {
        // fallback: try the id-based endpoint if present
        if (meRes.data && meRes.data.employee) {
          try {
            const empRes = await api.get(`/users/employees/${meRes.data.employee}/`);
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
    { id: 'time-tracking', name: 'Zeiterfassung', icon: ClockIcon },
    { id: 'messages', name: 'Nachrichtencenter', icon: ChatBubbleLeftIcon },
    { id: 'reporting', name: 'Reporting', icon: ChartBarIcon },
    { id: 'reminders', name: 'Erinnerungen', icon: BellIcon },
    { id: 'vacation', name: 'Urlaub', icon: CalendarIcon },
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
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
        {activeTab === 'time-tracking' && (
          <TimeTrackingTab
            timeEntries={timeEntries}
            weeklyReport={weeklyReport}
            monthlyReport={monthlyReport}
            onRefresh={fetchData}
            errors={errors}
          />
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
      </div>
    </div>
  );
};

// TimeTrackingTab Component
const TimeTrackingTab = ({ timeEntries, weeklyReport, monthlyReport, onRefresh, errors }) => {
  const [showModal, setShowModal] = useState(false);
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
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users/time-entries/', formData);
      onRefresh();
      setShowModal(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        start_time: defaults.start_time || '',
        end_time: defaults.end_time || '',
        break_time: defaults.break_time || '00:30:00',
        description: ''
      });
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
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

// Placeholder components for other tabs
const MessagesTab = ({ messages, onRefresh, errors }) => (
  <div>
    <h2 className="text-lg font-medium text-gray-900 mb-4">Nachrichtencenter</h2>
    {errors?.messages && (
      <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">Fehler beim Laden: {errors.messages}</div>
    )}
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      {messages.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500">Keine Nachrichten vorhanden.</div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {messages.map((message) => (
            <li key={message.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{message.title}</p>
                  <p className="text-sm text-gray-500">{message.content}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{new Date(message.created_at).toLocaleDateString()}</p>
                  {!message.is_read && <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

const ReportingTab = ({ weeklyReport, monthlyReport, errors }) => (
  <div>
    <h2 className="text-lg font-medium text-gray-900 mb-4">Reporting</h2>
    {errors?.report && (
      <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">Fehler beim Laden: {errors.report}</div>
    )}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h3 className="text-md font-medium text-gray-900 mb-2">Aktuelle Woche</h3>
        {weeklyReport ? (
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex justify-between"><span>Gearbeitete Stunden</span><span className="font-bold">{weeklyReport.actual_hours}h</span></div>
            <div className="flex justify-between"><span>Erwartet bis heute</span><span className="font-bold">{weeklyReport.expected_hours_to_date}h</span></div>
            <div className="flex justify-between"><span>Wöchentliches Soll</span><span className="font-bold">{weeklyReport.weekly_target}h</span></div>
            <div className="flex justify-between mt-2"><span>Differenz</span><span className={`font-bold ${weeklyReport.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>{weeklyReport.difference >= 0 ? '+' : ''}{weeklyReport.difference}h</span></div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-4 text-sm text-gray-500">Keine Wochen-Daten verfügbar.</div>
        )}
      </div>
      <div>
        <h3 className="text-md font-medium text-gray-900 mb-2">Aktueller Monat</h3>
        {monthlyReport ? (
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex justify-between"><span>Gearbeitete Stunden</span><span className="font-bold">{monthlyReport.actual_hours}h</span></div>
            <div className="flex justify-between"><span>Erwartet bis heute</span><span className="font-bold">{monthlyReport.expected_hours_to_date}h</span></div>
            <div className="flex justify-between mt-2"><span>Differenz</span><span className={`font-bold ${monthlyReport.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>{monthlyReport.difference >= 0 ? '+' : ''}{monthlyReport.difference}h</span></div>
            <div className="text-xs text-gray-500 mt-2">Arbeitstage bis heute: {monthlyReport.workdays_count_to_date}</div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-4 text-sm text-gray-500">Keine Monats-Daten verfügbar.</div>
        )}
      </div>
    </div>
  </div>
);

const RemindersTab = ({ reminders, onRefresh, errors }) => (
  <div>
    <h2 className="text-lg font-medium text-gray-900 mb-4">Erinnerungen</h2>
    {errors?.reminders && (
      <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">Fehler beim Laden: {errors.reminders}</div>
    )}
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      {reminders.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500">Keine Erinnerungen vorhanden.</div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {reminders.map((reminder) => (
            <li key={reminder.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{reminder.title}</p>
                  <p className="text-sm text-gray-500">{reminder.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{new Date(reminder.due_date).toLocaleString()}</p>
                  {reminder.is_completed && <span className="text-green-600">✓ Erledigt</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

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

  // calendar selection state
  const [selectedRange, setSelectedRange] = React.useState({ start: null, end: null });

  const formatDate = (s) => s ? new Date(s).toLocaleDateString() : '-';


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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Urlaub</h2>
        <div>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Neuen Antrag stellen</button>
        </div>
      </div>
      {errors?.vacation && (
        <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">Fehler beim Laden: {errors.vacation}</div>
      )}
      <div className="mb-4">
        <div className="p-3 bg-gray-50 rounded mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Aktuelles Urlaubskonto</div>
            <div className="text-xl font-semibold">{employeeDetails && employeeDetails.vacation_balance !== undefined ? `${parseFloat(employeeDetails.vacation_balance).toFixed(1)} Tage` : '-'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Jahresurlaub</div>
            <div className="text-xl font-semibold">{employeeDetails && employeeDetails.annual_vacation_days !== undefined ? `${employeeDetails.annual_vacation_days} Tage` : '-'}</div>
          </div>
        </div>

        {/* Calendar selector */}
        <div className="p-3 bg-white rounded border">
          <CalendarMonth vacationRequests={vacationRequests} onSelect={({start,end}) => setSelectedRange({start,end})} />

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

      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {vacationRequests.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">Keine Urlaubsanträge vorhanden.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {vacationRequests.map((request) => (
              <li key={request.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(request.start_date).toLocaleDateString()}
                      {request.start_half && request.start_half !== 'none' ? ` (${request.start_half_label})` : ''}
                      {' '}– {' '}
                      {new Date(request.end_date).toLocaleDateString()}
                      {request.end_half && request.end_half !== 'none' ? ` (${request.end_half_label})` : ''}
                    </p>
                    <p className="text-sm text-gray-500">{request.reason}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      request.status === 'approved' ? 'bg-green-100 text-green-800' :
                      request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      request.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {request.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{request.days_requested} Tage</p>
                    {request.status === 'pending' && (
                      <div className="mt-2">
                        <button onClick={async ()=>{
                          if (!window.confirm('Diesen ausstehenden Antrag wirklich löschen?')) return;
                          try {
                            await api.delete(`/users/vacation-requests/${request.id}/`);
                            onRefresh();
                          } catch (err) {
                            console.error('Fehler beim Löschen:', err);
                            alert('Fehler beim Löschen: ' + (err.response?.data?.detail || err.message));
                          }
                        }} className="text-sm text-red-600 hover:text-red-900">Löschen</button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
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

export default MyVERP;