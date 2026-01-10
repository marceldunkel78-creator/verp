import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import VisiViewLicenseSearch from '../components/VisiViewLicenseSearch';
import {
  ClockIcon,
  PlusIcon,
  ArrowPathIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';

const VisiViewMaintenanceTime = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Berechtigungen prüfen
  const canWriteMaintenanceTime = user?.is_superuser || user?.can_write_visiview_maintenance_time;
  const canReadLicenses = user?.is_superuser || user?.can_read_visiview_licenses || user?.can_read_visiview;
  
  // Liste der Zeitaufwendungen
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Neue Zeitaufwendung
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [selectedLicenseId, setSelectedLicenseId] = useState(null);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [maintenanceBalance, setMaintenanceBalance] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  
  // Timer State
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef(null);
  
  // Formular
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    user: '',
    activity: '',
    task_type: '',
    hours_spent: '',
    comment: '',
    is_goodwill: false
  });

  // Lade Zeitaufwendungen
  const fetchTimeEntries = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/visiview/maintenance-time-entries/?page=${page}&ordering=${sortDirection === 'desc' ? '-' : ''}${sortField}`);
      setTimeEntries(response.data.results || response.data);
      setTotalPages(Math.ceil((response.data.count || response.data.length) / 20));
    } catch (error) {
      console.error('Error fetching time entries:', error);
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortDirection]);

  // Lade Mitarbeiter
  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users/employees/');
      setEmployees(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  useEffect(() => {
    fetchTimeEntries();
    fetchEmployees();
  }, [fetchTimeEntries]);

  // Timer Logik
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerRunning]);

  const formatTimer = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const secondsToHours = (seconds) => {
    return (seconds / 3600).toFixed(2);
  };

  const startTimer = () => {
    setTimerRunning(true);
  };

  const pauseTimer = () => {
    setTimerRunning(false);
  };

  const stopTimer = () => {
    setTimerRunning(false);
    // Übertrage Zeit ins Formular
    const hours = secondsToHours(timerSeconds);
    setForm(prev => ({ ...prev, hours_spent: hours }));
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerSeconds(0);
  };

  // Lizenz-Auswahl Handler
  const handleLicenseChange = async (licenseId, licenseData) => {
    setSelectedLicenseId(licenseId);
    setSelectedLicense(licenseData);
    
    if (licenseId) {
      try {
        const response = await api.get(`/visiview/licenses/${licenseId}/maintenance/`);
        setMaintenanceBalance(response.data.current_balance);
      } catch (error) {
        console.error('Error fetching maintenance balance:', error);
        setMaintenanceBalance(null);
      }
    } else {
      setMaintenanceBalance(null);
    }
  };

  // Neue Zeitaufwendung öffnen
  const openNewEntry = () => {
    setShowNewEntry(true);
    setSelectedLicenseId(null);
    setSelectedLicense(null);
    setMaintenanceBalance(null);
    setTimerSeconds(0);
    setTimerRunning(false);
    setForm({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      user: '',
      activity: '',
      task_type: '',
      hours_spent: '',
      comment: '',
      is_goodwill: false
    });
    // Timer automatisch starten
    setTimeout(() => setTimerRunning(true), 100);
  };

  // Speichern
  const handleSave = async () => {
    if (!selectedLicenseId) {
      alert('Bitte wählen Sie eine Lizenz aus');
      return;
    }
    if (!form.user || !form.activity || !form.task_type || !form.hours_spent) {
      alert('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/visiview/licenses/${selectedLicenseId}/add_time_expenditure/`, form);
      setShowNewEntry(false);
      resetTimer();
      fetchTimeEntries();
    } catch (error) {
      console.error('Error saving time entry:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  // Sortierung
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUpIcon className="h-4 w-4 inline ml-1" />
      : <ChevronDownIcon className="h-4 w-4 inline ml-1" />;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE');
  };

  const getBalanceColor = () => {
    if (maintenanceBalance === null) return '';
    const balance = parseFloat(maintenanceBalance);
    if (balance > 0) return 'text-green-600 bg-green-100 border-green-300';
    return 'text-red-600 bg-red-100 border-red-300';
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClockIcon className="h-7 w-7 text-indigo-600" />
            Maintenance Zeiterfassung
          </h1>
          <p className="text-gray-500 mt-1">Zeitaufwendungen für VisiView-Lizenzen erfassen</p>
        </div>
        {canWriteMaintenanceTime ? (
          <button
            onClick={openNewEntry}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Neue Zeitaufwendung
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed" title="Keine Schreibberechtigung">
            <LockClosedIcon className="h-5 w-5" />
            Keine Schreibberechtigung
          </div>
        )}
      </div>

      {/* Neue Zeitaufwendung Panel */}
      {showNewEntry && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg mb-6 overflow-hidden">
          <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Neue Zeitaufwendung erfassen</h2>
            <button
              onClick={() => { setShowNewEntry(false); resetTimer(); }}
              className="text-white hover:text-indigo-200"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Linke Spalte: Lizenzsuche & Balance */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    VisiView-Lizenz auswählen *
                  </label>
                  <VisiViewLicenseSearch
                    value={selectedLicenseId}
                    onChange={handleLicenseChange}
                    required
                  />
                </div>
                
                {/* Maintenance Balance */}
                {selectedLicenseId && maintenanceBalance !== null && (
                  <div className={`p-4 rounded-lg border-2 ${getBalanceColor()}`}>
                    <div className="text-sm font-medium mb-1">Aktuelles Maintenance-Guthaben</div>
                    <div className="text-2xl font-bold">
                      {parseFloat(maintenanceBalance) >= 0 ? '+' : ''}{parseFloat(maintenanceBalance).toFixed(2)} h
                    </div>
                  </div>
                )}
                
                {/* Timer */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-2">Timer</div>
                  <div className="text-4xl font-mono font-bold text-center text-gray-900 mb-4">
                    {formatTimer(timerSeconds)}
                  </div>
                  <div className="flex justify-center gap-2">
                    {!timerRunning ? (
                      <button
                        onClick={startTimer}
                        className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <PlayIcon className="h-5 w-5" />
                        Start
                      </button>
                    ) : (
                      <button
                        onClick={pauseTimer}
                        className="flex items-center gap-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      >
                        <PauseIcon className="h-5 w-5" />
                        Pause
                      </button>
                    )}
                    <button
                      onClick={stopTimer}
                      disabled={timerSeconds === 0}
                      className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <StopIcon className="h-5 w-5" />
                      Stop & Übernehmen
                    </button>
                    <button
                      onClick={resetTimer}
                      className="flex items-center gap-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      <ArrowPathIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Mittlere & Rechte Spalte: Formular */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({...form, date: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({...form, time: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter *</label>
                  <select
                    value={form.user}
                    onChange={(e) => setForm({...form, user: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Auswählen...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aktivität *</label>
                    <select
                      value={form.activity}
                      onChange={(e) => setForm({...form, activity: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Auswählen...</option>
                      <option value="email_support">Email Support</option>
                      <option value="remote_support">Remote Support</option>
                      <option value="phone_support">Telefon Support</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tätigkeit *</label>
                    <select
                      value={form.task_type}
                      onChange={(e) => setForm({...form, task_type: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Auswählen...</option>
                      <option value="training">Schulung</option>
                      <option value="testing">Test</option>
                      <option value="bugs">Bugs</option>
                      <option value="other">Sonstiges</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aufgewendete Zeit (h) *</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={form.hours_spent}
                      onChange={(e) => setForm({...form, hours_spent: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="z.B. 1.5"
                      required
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.is_goodwill}
                        onChange={(e) => setForm({...form, is_goodwill: e.target.checked})}
                        className="h-4 w-4 text-indigo-600 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">Kulanz</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar</label>
                  <textarea
                    value={form.comment}
                    onChange={(e) => setForm({...form, comment: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Beschreibung der Tätigkeit..."
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => { setShowNewEntry(false); resetTimer(); }}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !selectedLicenseId}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste der Zeitaufwendungen */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Letzte Zeitaufwendungen</h2>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : timeEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Keine Zeitaufwendungen vorhanden
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('date')}
                  >
                    Datum <SortIcon field="date" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lizenz
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kunde
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('activity')}
                  >
                    Aktivität <SortIcon field="activity" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mitarbeiter
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('hours_spent')}
                  >
                    Zeit <SortIcon field="hours_spent" />
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kulanz
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {timeEntries.map(entry => (
                  <tr 
                    key={entry.id} 
                    className={canReadLicenses ? "hover:bg-gray-50 cursor-pointer" : ""}
                    onClick={() => canReadLicenses && navigate(`/visiview/licenses/${entry.license}`)}
                    title={canReadLicenses ? "Lizenz anzeigen" : "Keine Berechtigung für Lizenzen"}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(entry.date)}
                      {entry.time && <span className="text-gray-500 ml-2">{entry.time}</span>}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${canReadLicenses ? 'text-indigo-600' : 'text-gray-500'}`}>
                      {entry.license_serial || entry.serial_number || '-'}
                      {!canReadLicenses && <LockClosedIcon className="h-3 w-3 inline ml-1" />}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.customer_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.activity_display || entry.activity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.user_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {parseFloat(entry.hours_spent).toFixed(2)} h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {entry.is_goodwill && (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                          Kulanz
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Zurück
                </button>
                <span className="text-sm text-gray-500">
                  Seite {page} von {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Weiter
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VisiViewMaintenanceTime;
