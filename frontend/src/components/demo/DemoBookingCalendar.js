import React, { useState, useMemo } from 'react';
import CustomerSearch from '../CustomerSearch';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const toKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

// Prüft Überlappung einer Buchung mit einer Liste anderer Buchungen
const overlapsWith = (booking, all) =>
  all.some(
    (b) =>
      b.id !== booking.id &&
      !b.is_cancelled &&
      !(parseKey(b.end_date) < parseKey(booking.start_date) ||
        parseKey(b.start_date) > parseKey(booking.end_date))
  );

// ---------------------------------------------------------------------------
// Buchungs-Modal
// ---------------------------------------------------------------------------

const BookingModal = ({ booking, onSave, onClose, onDelete }) => {
  const [form, setForm] = useState(() => ({
    title: '',
    customer: null,
    customer_display: null,
    start_date: toKey(new Date()),
    end_date: toKey(new Date()),
    notes: '',
    is_cancelled: false,
  }));

  React.useEffect(() => {
    if (booking) {
      setForm({
        title: booking.title || '',
        customer: booking.customer || null,
        customer_display: booking.customer_display || null,
        start_date: booking.start_date || toKey(new Date()),
        end_date: booking.end_date || booking.start_date || toKey(new Date()),
        notes: booking.notes || '',
        is_cancelled: booking.is_cancelled || false,
      });
    }
  }, [booking]);

  const handleSave = () => {
    if (!form.title.trim()) {
      alert('Bitte einen Zweck/Titel eingeben.');
      return;
    }
    if (parseKey(form.end_date) < parseKey(form.start_date)) {
      alert('Das Enddatum liegt vor dem Beginn.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {booking?.id ? 'Buchung bearbeiten' : 'Neue Buchung'}
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zweck/Titel *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="z.B. Kundendemo, Schulung, Messkampagne"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beginn *</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ende *</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kunde (optional)</label>
              <CustomerSearch
                value={form.customer}
                onChange={(id, data) => {
                  const display = data ? (data.company || `${data.first_name} ${data.last_name}`) : null;
                  setForm({ ...form, customer: id, customer_display: display });
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            {booking?.created_by_name && (
              <p className="text-xs text-gray-400">
                Angelegt von {booking.created_by_name}
                {booking.created_at && ` am ${new Date(booking.created_at).toLocaleString('de-DE')}`}
              </p>
            )}
            {booking?.id && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_cancelled}
                  onChange={(e) => setForm({ ...form, is_cancelled: e.target.checked })}
                />
                Storniert
              </label>
            )}
          </div>

          <div className="flex items-center justify-between mt-5">
            <div>
              {booking?.id && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  Löschen
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Belegungskalender (Monatsansicht + Listenansicht)
// ---------------------------------------------------------------------------

const DemoBookingCalendar = ({ bookings, onSaveBooking, onDeleteBooking, readOnly = false }) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState('month'); // 'month' | 'list'
  const [editing, setEditing] = useState(null); // booking object or {} for new
  const [warning, setWarning] = useState(null);

  const activeBookings = useMemo(
    () => bookings.filter((b) => !b.is_cancelled),
    [bookings]
  );

  // Kalender-Raster (6 Wochen x 7 Tage)
  const grid = useMemo(() => {
    const now = new Date();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Montag = 0
    const start = addDays(first, -startOffset);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      days.push({
        date: d,
        key: toKey(d),
        inMonth: d.getMonth() === month,
        isToday: toKey(d) === toKey(now),
      });
    }
    return days;
  }, [year, month]);

  const bookingsForDay = (key) => {
    const d = parseKey(key);
    return activeBookings.filter(
      (b) => parseKey(b.start_date) <= d && parseKey(b.end_date) >= d
    );
  };

  const handleNew = (dateKey) => {
    setWarning(null);
    setEditing({
      start_date: dateKey || toKey(new Date()),
      end_date: dateKey || toKey(new Date()),
    });
  };

  const handleEdit = (booking) => {
    setWarning(null);
    setEditing(booking);
  };

  const handleSave = async (form) => {
    // Überlappungs-Warnung (keine harte Sperre)
    const testBooking = { ...form, id: editing?.id };
    if (overlapsWith(testBooking, activeBookings)) {
      setWarning('Hinweis: Diese Buchung überschneidet sich mit einer bestehenden Belegung.');
    }
    await onSaveBooking(form, editing?.id);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (window.confirm('Buchung wirklich löschen?')) {
      await onDeleteBooking(editing.id);
      setEditing(null);
    }
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [bookings]
  );

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded" title="Vorheriger Monat">
            ‹
          </button>
          <span className="text-sm font-semibold text-gray-900 w-40 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded" title="Nächster Monat">
            ›
          </button>
          <button
            type="button"
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="ml-2 text-xs px-2 py-1 border rounded hover:bg-gray-50"
          >
            Heute
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setView('month')}
              className={`px-3 py-1.5 ${view === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              Monat
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`px-3 py-1.5 ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              Liste
            </button>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => handleNew()}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Buchung
            </button>
          )}
        </div>
      </div>

      {warning && (
        <div className="px-4 py-2 bg-amber-50 text-amber-800 text-sm border-b">{warning}</div>
      )}

      {view === 'month' ? (
        <div className="p-2">
          {/* Wochentage */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">
                {d}
              </div>
            ))}
          </div>
          {/* Tage */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded overflow-hidden">
            {grid.map((day) => {
              const dayBookings = bookingsForDay(day.key);
              return (
                <div
                  key={day.key}
                  className={`min-h-[84px] bg-white p-1 ${!day.inMonth ? 'bg-gray-50' : ''} ${
                    day.isToday ? 'ring-2 ring-inset ring-blue-400' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs ${
                        day.inMonth ? 'text-gray-700' : 'text-gray-300'
                      } ${day.isToday ? 'font-bold text-blue-600' : ''}`}
                    >
                      {day.date.getDate()}
                    </span>
                    {!readOnly && day.inMonth && (
                      <button
                        type="button"
                        onClick={() => handleNew(day.key)}
                        className="text-gray-300 hover:text-blue-600 text-xs leading-none"
                        title="Buchung an diesem Tag"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {dayBookings.slice(0, 3).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleEdit(b)}
                        className={`block w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate ${
                          b.customer
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                        title={`${b.title}${b.customer_display ? ` – ${b.customer_display}` : ''}${b.created_by_name ? ` (angelegt von ${b.created_by_name})` : ''}`}
                      >
                        {b.title}
                      </button>
                    ))}
                    {dayBookings.length > 3 && (
                      <span className="text-[9px] text-gray-400 px-1">
                        +{dayBookings.length - 3} weitere
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Listenansicht */
        <div className="p-4">
          {sortedBookings.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Noch keine Buchungen vorhanden.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2 pr-2">Zeitraum</th>
                  <th className="py-2 pr-2">Zweck/Titel</th>
                  <th className="py-2 pr-2">Kunde</th>
                  <th className="py-2 pr-2">Angelegt von</th>
                  <th className="py-2 pr-2">Status</th>
                  {!readOnly && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {sortedBookings.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-b last:border-0 hover:bg-gray-50 ${b.is_cancelled ? 'opacity-50' : ''}`}
                  >
                    <td className="py-2 pr-2 whitespace-nowrap font-mono text-xs">
                      {b.start_date} – {b.end_date}
                    </td>
                    <td className="py-2 pr-2">{b.title}</td>
                    <td className="py-2 pr-2">{b.customer_display || '–'}</td>
                    <td className="py-2 pr-2 text-xs text-gray-500">
                      {b.created_by_name || b.reserved_by_name || '–'}
                    </td>
                    <td className="py-2 pr-2">
                      {b.is_cancelled ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Storniert</span>
                      ) : overlapsWith(b, activeBookings) ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">Überschneidung</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Bestätigt</span>
                      )}
                    </td>
                    {!readOnly && (
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleEdit(b)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Bearbeiten
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editing && (
        <BookingModal
          booking={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          onDelete={editing.id ? handleDelete : null}
        />
      )}
    </div>
  );
};

export default DemoBookingCalendar;