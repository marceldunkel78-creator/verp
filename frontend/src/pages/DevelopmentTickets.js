import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SortableHeader from '../components/SortableHeader';
import { ArrowPathIcon, PlusIcon, TicketIcon } from '@heroicons/react/24/outline';

const STATUS = { new: 'Neu', in_progress: 'Bearbeitung', closed: 'Geschlossen' };
const PRIORITY = { low: 'Niedrig', normal: 'Normal', high: 'Hoch', urgent: 'Dringend' };
const CATEGORY = { optics: 'Optik', electronics: 'Elektronik' };

export default function DevelopmentTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('-updated_at');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      if (sortBy) params.set('ordering', sortBy);
      const response = await api.get(`/development/tickets/?${params.toString()}`);
      setTickets(response.data.results || response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Entwicklungstickets:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, sortBy]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center text-2xl font-bold text-gray-900"><TicketIcon className="mr-3 h-8 w-8 text-purple-600" />Entwicklungstickets</h1>
          <p className="mt-1 text-sm text-gray-500">Interne Entwicklungsaufgaben verwalten</p>
        </div>
        <button onClick={() => navigate('/development/tickets/new')} className="mt-4 inline-flex items-center rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 sm:mt-0"><PlusIcon className="mr-2 h-5 w-5" />Neues Ticket</button>
      </div>
      <div className="mt-6 flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ticket, Titel oder Projekt suchen" className="min-w-0 flex-1 rounded-md border-gray-300 shadow-sm" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-md border-gray-300 shadow-sm">
          <option value="">Alle Status</option><option value="new">Neu</option><option value="in_progress">Bearbeitung</option><option value="closed">Geschlossen</option>
        </select>
        <button onClick={fetchTickets} aria-label="Aktualisieren" className="rounded-md border border-gray-300 px-3 text-gray-600"><ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="ticket_number" label="Ticket-Nr." sortBy={sortBy} setSortBy={setSortBy} />
              <SortableHeader field="title" label="Titel" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableHeader field="category" label="Kategorie" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableHeader field="status" label="Status" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableHeader field="priority" label="Priorität" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableHeader field="project__project_number" label="Projekt" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableHeader field="assigned_to__last_name" label="Zuständig" sortBy={sortBy} setSortBy={setSortBy} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? <tr><td colSpan="7" className="py-10 text-center"><ArrowPathIcon className="mx-auto h-7 w-7 animate-spin text-purple-600" /></td></tr> : tickets.length ? tickets.map(ticket => (
              <tr key={ticket.id} onClick={() => navigate(`/development/tickets/${ticket.id}`)} className="cursor-pointer hover:bg-gray-50">
                <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-purple-700">{ticket.ticket_number}</td><td className="px-5 py-4 text-sm text-gray-900">{ticket.title}</td><td className="px-5 py-4 text-sm text-gray-600">{CATEGORY[ticket.category] || '-'}</td><td className="px-5 py-4 text-sm text-gray-600">{STATUS[ticket.status] || ticket.status}</td><td className="px-5 py-4 text-sm text-gray-600">{PRIORITY[ticket.priority] || ticket.priority}</td><td className="px-5 py-4 text-sm text-gray-600">{ticket.project_number ? `${ticket.project_number} – ${ticket.project_name}` : '-'}</td><td className="px-5 py-4 text-sm text-gray-600">{ticket.assigned_to_name || '-'}</td>
              </tr>
            )) : <tr><td colSpan="7" className="py-10 text-center text-sm text-gray-500">Keine Entwicklungstickets gefunden</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
