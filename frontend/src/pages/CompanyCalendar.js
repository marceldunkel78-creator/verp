import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDaysIcon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  FunnelIcon,
  ChartBarIcon,
  XMarkIcon,
  ClockIcon,
  BellIcon,
  UserIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import api from '../utils/api';

// Hilfsfunktionen für Datum
const formatDate = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Konvertiert ein Date-String zu einem Date-Objekt ohne Zeitzone-Verschiebung
const parseDateString = (dateStr) => {
  if (!dateStr) return new Date(); // Fallback auf heute
  try {
    // Parse YYYY-MM-DD direkt ohne Zeitzone
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date();
    const [year, month, day] = parts.map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return new Date();
    return new Date(year, month - 1, day);
  } catch (e) {
    console.error('Error parsing date:', dateStr, e);
    return new Date();
  }
};

const getMonthDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  
  // Tage vom Vormonat (falls Monat nicht mit Montag beginnt)
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Montag = 0
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }
  
  // Tage des aktuellen Monats
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  
  // Tage vom nächsten Monat (um 6 Wochen zu füllen)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }
  
  return days;
};

const getWeekDays = (date) => {
  const days = [];
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
};

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Hilfsfunktion um ganztägige Events über mehrere Tage zu expandieren
const expandMultiDayEvents = (events) => {
  const expanded = [];
  events.forEach(event => {
    if (event.is_all_day && event.end_date && event.end_date !== event.start_date) {
      // Multi-Day Event - für jeden Tag eine Kopie erstellen
      const start = parseDateString(event.start_date);
      const end = parseDateString(event.end_date);
      const current = new Date(start);
      
      while (current <= end) {
        expanded.push({
          ...event,
          display_date: formatDate(current),
          is_multi_day: true,
          is_first_day: formatDate(current) === event.start_date,
          is_last_day: formatDate(current) === event.end_date
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      expanded.push({ ...event, display_date: event.start_date, is_multi_day: false });
    }
  });
  return expanded;
};

// Öffnet das Modal zum Erstellen eines neuen Termins mit voreingestelltem Datum/Zeit
const handleCreateOnDate = (dateObj, opts = {}) => {
  const dateKey = formatDate(dateObj);
  const endDateKey = opts.endDate ? formatDate(opts.endDate) : dateKey;
  const startTime = opts.time || '';
  const endTime = opts.timeEnd || '';
  const isAllDay = !startTime;

  return {
    id: null,
    title: '',
    description: '',
    event_type: 'other',
    start_date: dateKey,
    end_date: endDateKey,
    start_time: startTime,
    end_time: endTime,
    is_all_day: isAllDay,
    recurrence_type: 'none',
    recurrence_end_date: '',
    assigned_to: '',
    reminders: []
  };
};



// Event Modal Komponente
const EventModal = ({ isOpen, onClose, event, onSave, eventTypes, users }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'other',
    start_date: formatDate(new Date()),
    end_date: formatDate(new Date()),
    start_time: '',
    end_time: '',
    is_all_day: true,
    recurrence_type: 'none',
    recurrence_end_date: '',
    assigned_to: '',
    reminders: []
  });
  
  const [reminderRecipient, setReminderRecipient] = useState('');
  const [reminderTiming, setReminderTiming] = useState(60);
  const [notifyAll, setNotifyAll] = useState(false);
  const [updateAllInSeries, setUpdateAllInSeries] = useState(false);
  const [isRecurringSeries, setIsRecurringSeries] = useState(false);
  
  useEffect(() => {
    if (event) {
      const isRecurring = (event.recurrence_type && event.recurrence_type !== 'none') || event.parent_event;
      setIsRecurringSeries(isRecurring);
      setUpdateAllInSeries(false);
      
      // Bei Serienterminen: Wenn es eine Instanz ist, lade Parent-Daten für Anzeige
      const recurrenceType = event.parent_event ? event.parent_event_details?.recurrence_type : event.recurrence_type;
      const recurrenceEndDate = event.parent_event ? event.parent_event_details?.recurrence_end_date : event.recurrence_end_date;
      
      setFormData({
        title: event.title || '',
        description: event.description || '',
        event_type: event.event_type || 'other',
        start_date: event.start_date || formatDate(new Date()),
        end_date: event.end_date || event.start_date || formatDate(new Date()),
        start_time: event.start_time || '',
        end_time: event.end_time || '',
        is_all_day: event.is_all_day !== false,
        recurrence_type: recurrenceType || 'none',
        recurrence_end_date: recurrenceEndDate || '',
        assigned_to: event.assigned_to || '',
        reminders: event.reminders || []
      });
    } else {
      setIsRecurringSeries(false);
      setUpdateAllInSeries(false);
      setFormData({
        title: '',
        description: '',
        event_type: 'other',
        start_date: formatDate(new Date()),
        end_date: formatDate(new Date()),
        start_time: '',
        end_time: '',
        is_all_day: true,
        recurrence_type: 'none',
        recurrence_end_date: '',
        assigned_to: '',
        reminders: []
      });
    }
  }, [event, isOpen]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Bei Serienterminen: Frage ob alle oder nur dieser Termin geändert werden soll
    if (isRecurringSeries && event?.id) {
      const updateAll = window.confirm(
        'Dies ist ein Serientermin.\n\n' +
        'OK: Alle Termine der Serie ändern\n' +
        'Abbrechen: Nur diesen Termin ändern'
      );
      setUpdateAllInSeries(updateAll);
      
      // Entferne recurrence_end_date beim Update, da es schreibgeschützt ist
      const { recurrence_end_date, recurrence_type, ...dataToSend } = formData;
      
      onSave({
        ...dataToSend,
        start_time: formData.is_all_day ? null : formData.start_time,
        end_time: formData.is_all_day ? null : formData.end_time,
        assigned_to: formData.assigned_to || null,
        update_series: updateAll
      });
    } else {
      // Bereite Daten für neue Termine oder normale Updates vor
      const dataToSend = {
        ...formData,
        start_time: formData.is_all_day ? null : formData.start_time,
        end_time: formData.is_all_day ? null : formData.end_time,
        assigned_to: formData.assigned_to || null
      };
      
      // Entferne recurrence_end_date wenn keine Wiederholung gewählt
      if (formData.recurrence_type === 'none' || !formData.recurrence_end_date) {
        delete dataToSend.recurrence_end_date;
      }
      
      onSave(dataToSend);
    }
  };
  
  const addReminder = () => {
    const newReminder = {
      recipient: notifyAll ? null : (reminderRecipient || null),
      notify_all: notifyAll,
      minutes_before: reminderTiming
    };
    setFormData({ ...formData, reminders: [...formData.reminders, newReminder] });
    setReminderRecipient('');
    setNotifyAll(false);
  };
  
  const removeReminder = (index) => {
    const newReminders = formData.reminders.filter((_, i) => i !== index);
    setFormData({ ...formData, reminders: newReminders });
  };
  
  const manualEventTypes = eventTypes.filter(t => t.is_manual);
  
  const reminderTimingOptions = [
    { value: 0, label: 'Zum Zeitpunkt' },
    { value: 5, label: '5 Minuten vorher' },
    { value: 15, label: '15 Minuten vorher' },
    { value: 30, label: '30 Minuten vorher' },
    { value: 60, label: '1 Stunde vorher' },
    { value: 120, label: '2 Stunden vorher' },
    { value: 1440, label: '1 Tag vorher' },
    { value: 2880, label: '2 Tage vorher' },
    { value: 10080, label: '1 Woche vorher' },
  ];
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">
            {event?.id ? 'Termin bearbeiten' : 'Neuer Termin'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <XMarkIcon className="h-6 w-6 dark:text-gray-400" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Titel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Titel *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          
          {/* Termintyp */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Termintyp *
            </label>
            <select
              value={formData.event_type}
              onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {manualEventTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Ganztägig */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_all_day"
              checked={formData.is_all_day}
              onChange={(e) => setFormData({ ...formData, is_all_day: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="is_all_day" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Ganztägig
            </label>
          </div>
          
          {/* Datum */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Startdatum *
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  setFormData({ 
                    ...formData, 
                    start_date: newStartDate,
                    // Setze Enddatum auf Startdatum, wenn es leer ist oder vor dem neuen Startdatum liegt
                    end_date: !formData.end_date || formData.end_date < newStartDate ? newStartDate : formData.end_date
                  });
                }}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Enddatum
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
          
          {/* Zeit (nur wenn nicht ganztägig) */}
          {!formData.is_all_day && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Startzeit
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formData.start_time ? formData.start_time.split(':')[0] : ''}
                    onChange={(e) => {
                      const hour = e.target.value.padStart(2, '0');
                      const minute = formData.start_time ? formData.start_time.split(':')[1] : '00';
                      const newTime = `${hour}:${minute}`;
                      setFormData({ 
                        ...formData, 
                        start_time: newTime,
                        // Setze Endzeit auf die gleiche Zeit, wenn sie leer ist oder gleich der alten Startzeit war
                        end_time: !formData.end_time || formData.end_time === formData.start_time ? newTime : formData.end_time
                      });
                    }}
                    className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Std</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                  <select
                    value={formData.start_time ? formData.start_time.split(':')[1] : ''}
                    onChange={(e) => {
                      const hour = formData.start_time ? formData.start_time.split(':')[0] : '00';
                      const minute = e.target.value.padStart(2, '0');
                      const newTime = `${hour}:${minute}`;
                      setFormData({ 
                        ...formData, 
                        start_time: newTime,
                        // Setze Endzeit auf die gleiche Zeit, wenn sie leer ist oder gleich der alten Startzeit war
                        end_time: !formData.end_time || formData.end_time === formData.start_time ? newTime : formData.end_time
                      });
                    }}
                    className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Min</option>
                    {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                      <option key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Endzeit
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formData.end_time ? formData.end_time.split(':')[0] : ''}
                    onChange={(e) => {
                      const hour = e.target.value.padStart(2, '0');
                      const minute = formData.end_time ? formData.end_time.split(':')[1] : '00';
                      setFormData({ ...formData, end_time: `${hour}:${minute}` });
                    }}
                    className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Std</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                  <select
                    value={formData.end_time ? formData.end_time.split(':')[1] : ''}
                    onChange={(e) => {
                      const hour = formData.end_time ? formData.end_time.split(':')[0] : '00';
                      const minute = e.target.value.padStart(2, '0');
                      setFormData({ ...formData, end_time: `${hour}:${minute}` });
                    }}
                    className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Min</option>
                    {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                      <option key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          
          {/* Wiederholung - Anzeige für bestehende Serientermine */}
          {isRecurringSeries && event?.id ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <ClockIcon className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Serientermin</h3>
              </div>
              <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <p><strong>Wiederholung:</strong> {formData.recurrence_type === 'daily' ? 'Täglich' : formData.recurrence_type === 'weekly' ? 'Wöchentlich' : formData.recurrence_type === 'monthly' ? 'Monatlich' : formData.recurrence_type === 'yearly' ? 'Jährlich' : 'Keine'}</p>
                {formData.recurrence_end_date && (
                  <p><strong>Bis:</strong> {parseDateString(formData.recurrence_end_date).toLocaleDateString('de-DE')}</p>
                )}
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                Beim Speichern können Sie wählen, ob nur dieser oder alle Termine geändert werden sollen.
              </p>
            </div>
          ) : (
            <>
              {/* Wiederholung - nur für neue Termine */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Wiederholung
                </label>
                <select
                  value={formData.recurrence_type}
                  onChange={(e) => setFormData({ ...formData, recurrence_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={event?.id}
                >
                  <option value="none">Keine Wiederholung</option>
                  <option value="daily">Täglich</option>
                  <option value="weekly">Wöchentlich</option>
                  <option value="monthly">Monatlich</option>
                  <option value="yearly">Jährlich</option>
                </select>
              </div>
              
              {/* Wiederholen bis (nur wenn Wiederholung ausgewählt) */}
              {formData.recurrence_type !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Wiederholen bis *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.recurrence_end_date}
                    onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    disabled={event?.id}
                  />
                </div>
              )}
            </>
          )}
          
          {/* Beschreibung */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Beschreibung
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          
          {/* Zugewiesen an */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Zugewiesen an
            </label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">-- Keiner --</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} ({user.username})
                </option>
              ))}
            </select>
          </div>
          
          {/* Erinnerungen */}
          <div className="border-t pt-4 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <BellIcon className="h-4 w-4 mr-1" />
              Erinnerungen
            </h3>
            
            {/* Bestehende Erinnerungen */}
            {formData.reminders.length > 0 && (
              <div className="space-y-2 mb-3">
                {formData.reminders.map((reminder, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    <span className="text-sm dark:text-gray-300">
                      {reminder.notify_all ? 'Alle' : (users.find(u => u.id === reminder.recipient)?.username || 'Unbekannt')}
                      {' - '}
                      {reminderTimingOptions.find(o => o.value === reminder.minutes_before)?.label || `${reminder.minutes_before} Min.`}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeReminder(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Neue Erinnerung hinzufügen */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Empfänger</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="notify_all"
                    checked={notifyAll}
                    onChange={(e) => setNotifyAll(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="notify_all" className="text-sm text-gray-600 dark:text-gray-400">Alle</label>
                </div>
                {!notifyAll && (
                  <select
                    value={reminderRecipient}
                    onChange={(e) => setReminderRecipient(e.target.value)}
                    className="mt-1 w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">-- Empfänger wählen --</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Wann</label>
                <select
                  value={reminderTiming}
                  onChange={(e) => setReminderTiming(parseInt(e.target.value))}
                  className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {reminderTimingOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={addReminder}
                disabled={!notifyAll && !reminderRecipient}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Statistik Panel Komponente
const StatisticsPanel = ({ statistics, eventTypes }) => {
  if (!statistics) return null;
  
  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 dark:text-white flex items-center">
        <ChartBarIcon className="h-5 w-5 mr-2" />
        Statistik
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div className="text-2xl font-bold text-blue-600">{statistics.total_events}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Termine gesamt</div>
        </div>
      </div>
      
      {/* Nach Typ */}
      {Object.keys(statistics.events_by_type || {}).length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nach Termintyp</h4>
          <div className="space-y-1">
            {Object.entries(statistics.events_by_type).map(([type, data]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: data.color }}
                  />
                  <span className="text-sm dark:text-gray-300">{data.label}</span>
                </div>
                <span className="text-sm font-medium dark:text-gray-300">{data.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Nach Benutzer */}
      {(statistics.events_by_user || []).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nach Benutzer</h4>
          <div className="space-y-1">
            {statistics.events_by_user.map(user => (
              <div key={user.user_id} className="flex items-center justify-between">
                <span className="text-sm dark:text-gray-300">{user.name}</span>
                <span className="text-sm font-medium dark:text-gray-300">{user.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Hauptkomponente
const CompanyCalendar = () => {
  const [view, setView] = useState('month'); // 'month', 'week', 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [statistics, setStatistics] = useState(null);
  
  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Auswahl für Range-Selection (Monat)
  const [selectionStart, setSelectionStart] = useState(null); // Date
  const [selectionEnd, setSelectionEnd] = useState(null); // Date

  // Auswahl für Week (Datum + Stunde)
  const [weekSelectionStart, setWeekSelectionStart] = useState(null); // { date: Date, hour: number }
  const [weekSelectionEnd, setWeekSelectionEnd] = useState(null); // { date: Date, hour: number }

  // --- Selection helpers (inside component so we can access state) ---
  const isSameDay = (a, b) => formatDate(a) === formatDate(b);

  // Friendly display helper: accepts Date or date-string
  const formatDisplayDate = (d) => {
    if (!d) return '';
    let dt;
    if (d instanceof Date) dt = d;
    else dt = parseDateString(d);
    return dt.toLocaleDateString('de-DE');
  };

  const isDateInSelection = (date) => {
    if (!selectionStart) return false;
    const start = selectionStart;
    const end = selectionEnd || selectionStart;
    const d = date instanceof Date ? date : new Date(date);
    return new Date(formatDate(start)) <= new Date(formatDate(d)) && new Date(formatDate(d)) <= new Date(formatDate(end));
  };

  const handleMonthCellClick = (date) => {
    // clear week selection
    setWeekSelectionStart(null);
    setWeekSelectionEnd(null);

    if (!selectionStart) {
      setSelectionStart(date);
      setSelectionEnd(null);
      return;
    }
    if (selectionStart && !selectionEnd) {
      // set end
      const s = selectionStart;
      if (new Date(formatDate(date)) < new Date(formatDate(s))) {
        setSelectionEnd(s);
        setSelectionStart(date);
      } else {
        setSelectionEnd(date);
      }
      return;
    }
    // if both set, start new selection
    setSelectionStart(date);
    setSelectionEnd(null);
  };

  const handleWeekCellClick = (day, hour) => {
    // clear month selection
    setSelectionStart(null);
    setSelectionEnd(null);

    // hour === null => all-day cell
    if (!weekSelectionStart) {
      setWeekSelectionStart({ date: day, hour: hour });
      setWeekSelectionEnd(null);
      return;
    }
    if (weekSelectionStart && !weekSelectionEnd) {
      const s = weekSelectionStart;
      const sTime = new Date(formatDate(s.date));
      sTime.setHours(s.hour || 0, 0, 0, 0);
      const dTime = new Date(formatDate(day));
      dTime.setHours(hour || 0, 0, 0, 0);
      if (dTime < sTime) {
        setWeekSelectionEnd(s);
        setWeekSelectionStart({ date: day, hour: hour });
      } else {
        setWeekSelectionEnd({ date: day, hour: hour });
      }
      return;
    }
    setWeekSelectionStart({ date: day, hour: hour });
    setWeekSelectionEnd(null);
  };

  const isWeekCellSelected = (day, hour) => {
    if (!weekSelectionStart) return false;
    const s = weekSelectionStart;
    const e = weekSelectionEnd || weekSelectionStart;
    const sDateTime = new Date(formatDate(s.date)); sDateTime.setHours(s.hour || 0, 0, 0, 0);
    const eDateTime = new Date(formatDate(e.date)); eDateTime.setHours(e.hour || 0, 0, 0, 0);
    const dDateTime = new Date(formatDate(day)); dDateTime.setHours(hour || 0, 0, 0, 0);
    return sDateTime <= dDateTime && dDateTime <= eDateTime;
  };
  
  // Datumsbereich berechnen
  const dateRange = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    if (view === 'month') {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { start: formatDate(start), end: formatDate(end) };
    } else if (view === 'week') {
      const weekDays = getWeekDays(currentDate);
      return { start: formatDate(weekDays[0]), end: formatDate(weekDays[6]) };
    } else {
      // Liste: 3 Monate
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 3, 0);
      return { start: formatDate(start), end: formatDate(end) };
    }
  }, [currentDate, view]);
  
  // Daten laden
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('start_date', dateRange.start);
      params.append('end_date', dateRange.end);
      if (selectedTypes.length > 0) {
        params.append('event_type', selectedTypes.join(','));
      }
      if (selectedUser) {
        params.append('user_id', selectedUser);
      }
      
      const response = await api.get(`/calendar/events/aggregated/?${params.toString()}`);
      setEvents(response.data);
      setError(null);
    } catch (err) {
      console.error('Fehler beim Laden der Termine:', err);
      setError('Fehler beim Laden der Termine');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedTypes, selectedUser]);
  
  const fetchEventTypes = async () => {
    try {
      const response = await api.get('/calendar/events/event_types/');
      setEventTypes(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Termintypen:', err);
    }
  };
  
  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/');
      setUsers(response.data.results || response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Benutzer:', err);
    }
  };
  
  const fetchStatistics = useCallback(async () => {
    if (!showStatistics) return;
    try {
      const params = new URLSearchParams();
      params.append('start_date', dateRange.start);
      params.append('end_date', dateRange.end);
      if (selectedTypes.length > 0) {
        params.append('event_type', selectedTypes.join(','));
      }
      if (selectedUser) {
        params.append('user_id', selectedUser);
      }
      
      const response = await api.get(`/calendar/events/statistics/?${params.toString()}`);
      setStatistics(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Statistik:', err);
    }
  }, [dateRange, selectedTypes, selectedUser, showStatistics]);
  
  useEffect(() => {
    fetchEventTypes();
    fetchUsers();
  }, []);
  
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);
  
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);
  
  // Navigation
  const navigate = (direction) => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // Event Handling
  const handleSaveEvent = async (eventData) => {
    try {
      if (selectedEvent?.id && typeof selectedEvent.id === 'number') {
        // Bei Update: Prüfe ob update_series Flag gesetzt ist
        const url = eventData.update_series 
          ? `/calendar/events/${selectedEvent.id}/?update_series=true`
          : `/calendar/events/${selectedEvent.id}/`;
        
        // Entferne update_series aus den Daten
        const { update_series, ...dataToSend } = eventData;
        await api.put(url, dataToSend);
      } else {
        await api.post('/calendar/events/', eventData);
      }
      setModalOpen(false);
      setSelectedEvent(null);
      fetchEvents();
      if (showStatistics) fetchStatistics();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert('Fehler beim Speichern des Termins');
    }
  };
  
  const handleEventClick = (event) => {
    if (!event.is_system_generated && typeof event.id === 'number') {
      setSelectedEvent(event);
      setModalOpen(true);
    }
  };
  
  const handleDeleteEvent = async (eventId, event = null) => {
    // Prüfe ob es sich um einen Serientermin handelt
    const isRecurring = event && ((event.recurrence_type && event.recurrence_type !== 'none') || event.parent_event);
    
    let deleteSeries = false;
    if (isRecurring) {
      const result = window.confirm(
        'Dies ist ein Serientermin. Möchten Sie:\n\n' +
        'OK: Nur diesen Termin löschen\n' +
        'Abbrechen: Gesamte Serie löschen'
      );
      deleteSeries = !result; // OK = nur dieser Termin, Abbrechen = gesamte Serie
    } else {
      if (!window.confirm('Termin wirklich löschen?')) return;
    }
    
    try {
      const url = deleteSeries 
        ? `/calendar/events/${eventId}/?delete_series=true`
        : `/calendar/events/${eventId}/`;
      await api.delete(url);
      fetchEvents();
      if (showStatistics) fetchStatistics();
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
    }
  };
  
  // Filter Toggle
  const toggleTypeFilter = (type) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };
  
  // Events nach Datum gruppieren (mit expandierten mehrtägigen Terminen)
  const eventsByDate = useMemo(() => {
    const map = {};
    const expandedEvents = expandMultiDayEvents(events);
    expandedEvents.forEach(event => {
      const dateKey = event.display_date;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    });
    return map;
  }, [events]);
  
  // Titel für Navigation
  const navigationTitle = useMemo(() => {
    if (view === 'month') {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (view === 'week') {
      const weekDays = getWeekDays(currentDate);
      const start = weekDays[0];
      const end = weekDays[6];
      return `${start.getDate()}.${start.getMonth() + 1}. - ${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
    } else {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  }, [currentDate, view]);
  
  // Render Monatsansicht
  const renderMonthView = () => {
    const days = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
    const today = formatDate(new Date());
    
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {/* Wochentage Header */}
        <div className="grid grid-cols-7 bg-white dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
          {WEEKDAYS.map(day => (
            <div key={day} className="p-2 text-center text-sm font-semibold text-black dark:text-gray-100">
              {day}
            </div>
          ))}
        </div>
        
        {/* Kalender Grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dateKey = formatDate(day.date);
            const dayEvents = eventsByDate[dateKey] || [];
            const isToday = dateKey === today;
            
            return (
              <div
                key={index}
                onClick={() => handleMonthCellClick(day.date)}
                className={`min-h-[100px] border-b border-r border-gray-300 dark:border-gray-700 p-1 ${
                  isDateInSelection(day.date) ? 'bg-blue-100 dark:bg-blue-900/20' : (day.isCurrentMonth ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-200 dark:bg-gray-900')
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isToday 
                    ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' 
                    : day.isCurrentMonth 
                      ? 'text-gray-900 dark:text-gray-100' 
                      : 'text-gray-500 dark:text-gray-600'
                }`}>
                  {day.date.getDate()}
                </div>
                
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      onClick={() => handleEventClick(event)}
                      className={`text-xs p-1 rounded truncate ${
                        event.is_system_generated ? 'cursor-default' : 'cursor-pointer hover:opacity-80'
                      }`}
                      style={{ backgroundColor: event.color + '20', borderLeft: `3px solid ${event.color}` }}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                      +{dayEvents.length - 3} weitere
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Render Wochenansicht
  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const today = formatDate(new Date());
    
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {/* Header mit Tagen */}
        <div className="grid grid-cols-8 border-b border-gray-300 dark:border-gray-700">
          <div className="p-2 border-r border-gray-300 dark:border-gray-700"></div>
          {weekDays.map((day, index) => {
            const dateKey = formatDate(day);
            const isToday = dateKey === today;
            return (
              <div key={index} className={`p-2 text-center border-r border-gray-300 dark:border-gray-700 ${
                isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}>
                <div className="text-sm font-semibold text-black dark:text-gray-100">{WEEKDAYS[index]}</div>
                <div className={`text-lg font-semibold ${
                  isToday ? 'text-blue-600' : 'text-black dark:text-gray-100'
                }`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Ganztägige Termine - Fixe Zeile */}
        <div className="grid grid-cols-8 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="p-2 text-xs font-semibold text-gray-900 dark:text-gray-100 text-right pr-2 border-r border-gray-300 dark:border-gray-700">
            Ganztägig
          </div>
              {weekDays.map((day, dayIndex) => {
            const dateKey = formatDate(day);
            const allDayEvents = (eventsByDate[dateKey] || []).filter(event => event.is_all_day);
            
            return (
              <div
                key={dayIndex}
                onClick={() => handleWeekCellClick(day, null)}
                className={`min-h-[60px] border-r border-gray-300 dark:border-gray-700 p-1 bg-gray-100 dark:bg-gray-800 space-y-1 cursor-pointer ${isWeekCellSelected(day,null) ? 'bg-blue-100 dark:bg-blue-900/20 ring-2 ring-blue-400 dark:ring-blue-700' : ''}`}
              >
                {allDayEvents.map((event, eventIndex) => (
                  <div
                    key={eventIndex}
                    onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                    className={`text-xs p-1 rounded truncate ${
                      event.is_system_generated ? 'cursor-default' : 'cursor-pointer hover:opacity-80'
                    }`}
                    style={{ backgroundColor: event.color + '20', borderLeft: `3px solid ${event.color}` }}
                    title={`${event.title}${event.is_multi_day ? ` (${event.is_first_day ? 'Start' : event.is_last_day ? 'Ende' : 'Fortsetzung'})` : ''}`}
                  >
                    {event.title}
                    {event.is_multi_day && event.is_first_day && ' →'}
                    {event.is_multi_day && !event.is_first_day && !event.is_last_day && ' ↔'}
                    {event.is_multi_day && event.is_last_day && ' ←'}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        
        {/* Stunden Grid */}
        <div className="overflow-y-auto max-h-[600px]">
              {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-gray-300 dark:border-gray-700">
              <div className="p-1 text-xs font-medium text-gray-900 dark:text-gray-100 text-right pr-2 border-r border-gray-300 dark:border-gray-700">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {weekDays.map((day, dayIndex) => {
                const dateKey = formatDate(day);
                const dayEvents = (eventsByDate[dateKey] || []).filter(event => {
                  if (event.is_all_day) return false; // Ganztägige werden oben angezeigt
                  if (event.start_time) {
                    const eventHour = parseInt(event.start_time.split(':')[0]);
                    return eventHour === hour;
                  }
                  return false;
                });
                
                return (
                  <div
                    key={dayIndex}
                    onClick={() => handleWeekCellClick(day, hour)}
                    className={`min-h-[40px] border-r border-gray-300 dark:border-gray-700 p-1 bg-gray-100 dark:bg-gray-800 cursor-pointer ${isWeekCellSelected(day,hour) ? 'bg-blue-100 dark:bg-blue-900/20 ring-2 ring-blue-400 dark:ring-blue-700' : ''}`}
                  >
                    {dayEvents.map((event, eventIndex) => (
                      <div
                        key={eventIndex}
                        onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                        className={`text-xs p-1 rounded truncate ${
                          event.is_system_generated ? 'cursor-default' : 'cursor-pointer hover:opacity-80'
                        }`}
                        style={{ backgroundColor: event.color + '20', borderLeft: `2px solid ${event.color}` }}
                        title={event.title}
                      >
                        {event.start_time && !event.is_all_day && (
                          <span className="font-medium">{event.start_time.slice(0, 5)} </span>
                        )}
                        {event.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Render Listenansicht
  const renderListView = () => {
    const sortedEvents = [...events].sort((a, b) => {
      const dateCompare = a.start_date.localeCompare(b.start_date);
      if (dateCompare !== 0) return dateCompare;
      if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
      return 0;
    });
    
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-black dark:text-gray-100 uppercase">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-black dark:text-gray-100 uppercase">Zeit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-black dark:text-gray-100 uppercase">Titel</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-black dark:text-gray-100 uppercase">Typ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-black dark:text-gray-100 uppercase">Person</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-black dark:text-gray-100 uppercase">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300 dark:divide-gray-700 bg-gray-50 dark:bg-gray-800">
              {sortedEvents.map((event, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {parseDateString(event.start_date).toLocaleDateString('de-DE')}
                    {event.end_date && event.end_date !== event.start_date && (
                      <span> - {parseDateString(event.end_date).toLocaleDateString('de-DE')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {event.is_all_day ? 'Ganztägig' : (
                      event.start_time ? `${event.start_time.slice(0, 5)}${event.end_time ? ` - ${event.end_time.slice(0, 5)}` : ''}` : '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: event.color }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {event.event_type_display}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {event.assigned_to_name || event.created_by_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {!event.is_system_generated && typeof event.id === 'number' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEventClick(event)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event.id, event)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Löschen
                        </button>
                      </div>
                    )}
                    {event.is_system_generated && (
                      <span className="text-gray-400 text-xs">Systemtermin</span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedEvents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Keine Termine gefunden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-black dark:text-white flex items-center">
          <CalendarDaysIcon className="h-8 w-8 mr-2 text-blue-600" />
          Firmenkalender
        </h1>
        
        <div className="flex items-center gap-2">
          {/* Neuer Termin */}
          <button
            onClick={() => {
              // Wenn eine Auswahl existiert, benutze sie, sonst öffne leeres Modal
              if (selectionStart) {
                const start = selectionStart;
                const end = selectionEnd || selectionStart;
                setSelectedEvent(handleCreateOnDate(start, { endDate: end }));
              } else if (weekSelectionStart) {
                const s = weekSelectionStart;
                const e = weekSelectionEnd || weekSelectionStart;
                const startStr = `${String(s.hour).padStart(2,'0')}:00`;
                const endStr = `${String(e.hour+1).padStart(2,'0')}:00`;
                setSelectedEvent(handleCreateOnDate(s.date, { endDate: e.date, time: startStr, timeEnd: endStr }));
              } else {
                setSelectedEvent(null);
              }
              setModalOpen(true);
              setSelectionStart(null); setSelectionEnd(null);
              setWeekSelectionStart(null); setWeekSelectionEnd(null);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-1" />
            Neuer Termin
          </button>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg flex items-center ${
              showFilters || selectedTypes.length > 0 || selectedUser
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <FunnelIcon className="h-5 w-5 mr-1" />
            Filter
            {(selectedTypes.length > 0 || selectedUser) && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                {selectedTypes.length + (selectedUser ? 1 : 0)}
              </span>
            )}
          </button>
          
          {/* Statistik Toggle */}
          <button
            onClick={() => setShowStatistics(!showStatistics)}
            className={`px-3 py-2 rounded-lg flex items-center ${
              showStatistics
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <ChartBarIcon className="h-5 w-5 mr-1" />
            Statistik
          </button>
        </div>
      </div>
      
      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap gap-4">
            {/* Termintyp Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Termintypen
              </label>
              <div className="flex flex-wrap gap-2">
                {eventTypes.map(type => (
                  <button
                    key={type.value}
                    onClick={() => toggleTypeFilter(type.value)}
                    className={`px-2 py-1 text-xs rounded flex items-center ${
                      selectedTypes.includes(type.value)
                        ? 'ring-2 ring-blue-500'
                        : ''
                    }`}
                    style={{ 
                      backgroundColor: type.color + '20', 
                      color: type.color,
                      borderLeft: `3px solid ${type.color}`
                    }}
                  >
                    {selectedTypes.includes(type.value) && (
                      <CheckIcon className="h-3 w-3 mr-1" />
                    )}
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* User Filter */}
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Benutzer
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">-- Alle Benutzer --</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.username})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Filter zurücksetzen */}
            {(selectedTypes.length > 0 || selectedUser) && (
              <div className="flex items-end">
                <button
                  onClick={() => { setSelectedTypes([]); setSelectedUser(''); }}
                  className="px-3 py-2 text-sm text-red-600 hover:text-red-800"
                >
                  Filter zurücksetzen
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Statistik Panel */}
      {showStatistics && <StatisticsPanel statistics={statistics} eventTypes={eventTypes} />}
      
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <ChevronLeftIcon className="h-5 w-5 dark:text-gray-400" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-300"
          >
            Heute
          </button>
          <button
            onClick={() => navigate(1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <ChevronRightIcon className="h-5 w-5 dark:text-gray-400" />
          </button>
          <h2 className="text-lg font-semibold ml-2 text-black dark:text-white">{navigationTitle}</h2>
        </div>
        
        {/* View Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 text-sm rounded ${
              view === 'month' 
                ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' 
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            Monat
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1 text-sm rounded ${
              view === 'week' 
                ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' 
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            Woche
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1 text-sm rounded flex items-center ${
              view === 'list' 
                ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' 
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            <ListBulletIcon className="h-4 w-4 mr-1" />
            Liste
          </button>
        </div>
      </div>

      {/* Auswahl-Status & Aktionen */}
      <div className="mt-4 mb-4">
        {(selectionStart || weekSelectionStart) && (
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {selectionStart && (
                <>Ausgewählt: {formatDisplayDate(selectionStart)}{selectionEnd && ` — ${formatDisplayDate(selectionEnd)}`}</>
              )}
              {weekSelectionStart && (
                <>Ausgewählt: {formatDisplayDate(weekSelectionStart.date)} {String(weekSelectionStart.hour).padStart(2,'0')}:00{weekSelectionEnd && ` — ${formatDisplayDate(weekSelectionEnd.date)} ${String(weekSelectionEnd.hour).padStart(2,'0')}:00`}</>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectionStart) {
                    const start = selectionStart;
                    const end = selectionEnd || selectionStart;
                    setSelectedEvent(handleCreateOnDate(start, { endDate: end }));
                  } else if (weekSelectionStart) {
                    const s = weekSelectionStart;
                    const e = weekSelectionEnd || weekSelectionStart;
                    const startStr = `${String(s.hour).padStart(2,'0')}:00`;
                    const endStr = `${String(e.hour+1).padStart(2,'0')}:00`;
                    setSelectedEvent(handleCreateOnDate(s.date, { endDate: e.date, time: startStr, timeEnd: endStr }));
                  }
                  setModalOpen(true);
                  setSelectionStart(null); setSelectionEnd(null);
                  setWeekSelectionStart(null); setWeekSelectionEnd(null);
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded-md"
              >
                + Neuer Termin für Auswahl
              </button>
              <button onClick={() => { setSelectionStart(null); setSelectionEnd(null); setWeekSelectionStart(null); setWeekSelectionEnd(null); }} className="px-2 py-1 border rounded-md text-sm">Auswahl löschen</button>
            </div>
          </div>
        )}
      </div>

      {/* Loading/Error */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      {/* Kalenderansicht */}
      {!loading && !error && (
        <>
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'list' && renderListView()}
        </>
      )}
      
      {/* Event Modal */}
      <EventModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedEvent(null); }}
        event={selectedEvent}
        onSave={handleSaveEvent}
        eventTypes={eventTypes}
        users={users}
      />
    </div>
  );
};

export default CompanyCalendar;
