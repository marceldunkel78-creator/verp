import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import FileUpload from '../components/FileUpload';
import {
  ArrowLeftIcon, ArrowPathIcon, CheckIcon, PlusIcon, PaperAirplaneIcon,
  ChatBubbleLeftEllipsisIcon, ClockIcon
} from '@heroicons/react/24/outline';

const DevelopmentTicketEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === 'new';
  const [ticket, setTicket] = useState({ title: '', description: '', category: '', status: 'new', priority: 'normal', start_date: '', end_date: '', project: searchParams.get('project') || '', assigned_to: '' });
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const fixedProjectId = isNew ? searchParams.get('project') || '' : '';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [newTimeEntry, setNewTimeEntry] = useState({ date: '', time: '', employee: '', hours_spent: '', description: '' });
  const [addingTimeEntry, setAddingTimeEntry] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [projectRes, userRes] = await Promise.all([api.get('/development/projects/?page_size=500'), api.get('/users/lookup/')]);
        setProjects(projectRes.data.results || projectRes.data);
        setUsers(userRes.data.results || userRes.data);
        if (!isNew) {
          const response = await api.get(`/development/tickets/${id}/`);
          setTicket({ ...response.data, project: response.data.project || '', assigned_to: response.data.assigned_to || '', start_date: response.data.start_date || '', end_date: response.data.end_date || '' });
        }
      } catch (error) {
        console.error('Fehler beim Laden des Tickets:', error);
      } finally { setLoading(false); }
    };
    load();
  }, [id, isNew]);

  const refreshTicket = async () => {
    if (!id || id === 'new') return;
    const response = await api.get(`/development/tickets/${id}/`);
    setTicket(current => ({ ...current, ...response.data }));
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    try {
      await api.post(`/development/tickets/${id}/add_comment/`, { comment: newComment });
      setNewComment('');
      await refreshTicket();
    } catch (error) {
      alert('Kommentar konnte nicht gespeichert werden: ' + (error.response?.data?.error || error.message));
    } finally { setAddingComment(false); }
  };

  const handleAddTimeEntry = async () => {
    if (!newTimeEntry.hours_spent || !newTimeEntry.description.trim()) {
      alert('Bitte Stunden und Beschreibung eingeben.');
      return;
    }
    setAddingTimeEntry(true);
    try {
      await api.post(`/development/tickets/${id}/add_time_entry/`, newTimeEntry);
      setNewTimeEntry({ date: '', time: '', employee: '', hours_spent: '', description: '' });
      await refreshTicket();
    } catch (error) {
      alert('Zeiteintrag konnte nicht gespeichert werden: ' + (error.response?.data?.error || error.message));
    } finally { setAddingTimeEntry(false); }
  };

  const handleDeleteTimeEntry = async (entryId) => {
    if (!window.confirm('Zeiteintrag wirklich löschen?')) return;
    try {
      await api.delete(`/development/tickets/${id}/delete_time_entry/${entryId}/`);
      await refreshTicket();
    } catch (error) {
      alert('Zeiteintrag konnte nicht gelöscht werden: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatDateTime = value => value ? new Date(value).toLocaleString('de-DE') : '';
  const formatDateOnly = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('de-DE') : '';

  const setField = (name, value) => setTicket(current => {
    const next = { ...current, [name]: value };
    if (name === 'start_date' && value && current.status === 'new') next.status = 'in_progress';
    if (name === 'end_date' && value) next.status = 'closed';
    return next;
  });

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...ticket, project: ticket.project || null, assigned_to: ticket.assigned_to || null, start_date: ticket.start_date || null, end_date: ticket.end_date || null };
      if (isNew) {
        const response = await api.post('/development/tickets/', payload);
        navigate(`/development/tickets/${response.data.id}`, { replace: true });
      } else {
        await api.patch(`/development/tickets/${id}/`, payload);
        const response = await api.get(`/development/tickets/${id}/`);
        setTicket({ ...response.data, project: response.data.project || '', assigned_to: response.data.assigned_to || '', start_date: response.data.start_date || '', end_date: response.data.end_date || '' });
      }
    } catch (error) {
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || JSON.stringify(error.response?.data || error.message)));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-center"><ArrowPathIcon className="mx-auto h-7 w-7 animate-spin text-purple-600" /></div>;
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3"><button type="button" onClick={() => navigate(-1)} aria-label="Zurück" className="rounded-md p-2 text-gray-500 hover:bg-gray-100"><ArrowLeftIcon className="h-5 w-5" /></button><div><h1 className="text-2xl font-bold text-gray-900">{isNew ? 'Neues Entwicklungsticket' : ticket.ticket_number}</h1><p className="text-sm text-gray-500">Entwicklungsticket</p></div></div>
        <button onClick={handleSave} disabled={saving || !ticket.title.trim()} className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50">{saving ? <ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" /> : <CheckIcon className="mr-2 h-5 w-5" />}Speichern</button>
      </div>
      {!isNew && (
        <nav className="mb-4 flex gap-6 border-b border-gray-200">
          {[['details', 'Details'], ['files', 'Dateien'], ['comments', 'Kommentare'], ['time', 'Zeiterfassung']].map(([tab, label]) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`border-b-2 px-1 py-3 text-sm font-medium ${activeTab === tab ? 'border-purple-500 text-purple-700' : 'border-transparent text-gray-500 hover:border-gray-300'}`}>{label}{tab === 'comments' && ticket.comments?.length > 0 ? ` (${ticket.comments.length})` : ''}</button>
          ))}
        </nav>
      )}
      { (activeTab === 'details' || isNew) && <form onSubmit={handleSave} className="space-y-6 rounded-lg bg-white p-6 shadow">
        <div><label className="mb-1 block text-sm font-medium text-gray-700">Titel *</label><input required value={ticket.title} onChange={e => setField('title', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm" /></div>
        <div><label className="mb-1 block text-sm font-medium text-gray-700">Beschreibung</label><textarea rows="5" value={ticket.description} onChange={e => setField('description', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm" /></div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">Kategorie<select value={ticket.category || ''} onChange={e => setField('category', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"><option value="">-- Auswählen --</option><option value="optics">Optik</option><option value="electronics">Elektronik</option><option value="mechanics">Mechanik</option></select></label>
          <label className="block text-sm font-medium text-gray-700">Status<select value={ticket.status} onChange={e => setField('status', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"><option value="new">Neu</option><option value="in_progress">Bearbeitung</option><option value="closed">Geschlossen</option></select></label>
          <label className="block text-sm font-medium text-gray-700">Priorität<select value={ticket.priority} onChange={e => setField('priority', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"><option value="low">Niedrig</option><option value="normal">Normal</option><option value="high">Hoch</option><option value="urgent">Dringend</option></select></label>
          <label className="block text-sm font-medium text-gray-700">Entwicklungsprojekt<select value={ticket.project || ''} onChange={e => setField('project', e.target.value)} disabled={Boolean(fixedProjectId)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100"><option value="">-- Kein Projekt --</option>{projects.map(project => <option key={project.id} value={project.id}>{project.project_number} – {project.name}</option>)}</select></label>
          <label className="block text-sm font-medium text-gray-700">Zuständig<select value={ticket.assigned_to || ''} onChange={e => setField('assigned_to', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"><option value="">-- Nicht zugewiesen --</option>{users.map(user => <option key={user.id} value={user.id}>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}</option>)}</select></label>
          <label className="block text-sm font-medium text-gray-700">Bearbeitungsbeginn<input type="date" value={ticket.start_date || ''} onChange={e => setField('start_date', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Abgabe<input type="date" value={ticket.end_date || ''} onChange={e => setField('end_date', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></label>
        </div>
      </form> }
      {!isNew && activeTab === 'files' && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Dateien</h2>
          <FileUpload
            attachments={ticket.attachments || []}
            ticketId={ticket.id}
            ticketType="development"
            onUploadSuccess={attachment => setTicket(current => ({ ...current, attachments: [...(current.attachments || []), attachment] }))}
            onDeleteSuccess={attachmentId => setTicket(current => ({ ...current, attachments: current.attachments.filter(item => item.id !== attachmentId) }))}
          />
        </div>
      )}
      {!isNew && activeTab === 'comments' && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 flex items-center text-lg font-medium text-gray-900"><ChatBubbleLeftEllipsisIcon className="mr-2 h-5 w-5" />Kommentare ({ticket.comments?.length || 0})</h2>
          <textarea rows="3" value={newComment} onChange={event => setNewComment(event.target.value)} placeholder="Neuen Kommentar hinzufügen..." className="block w-full rounded-md border-gray-300 shadow-sm" />
          <div className="mt-2 flex justify-end"><button type="button" onClick={handleAddComment} disabled={addingComment || !newComment.trim()} className="inline-flex items-center rounded-md bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-50"><PaperAirplaneIcon className="mr-2 h-4 w-4" />{addingComment ? 'Speichern…' : 'Kommentar hinzufügen'}</button></div>
          <div className="mt-6 space-y-4">
            {ticket.comments?.length ? ticket.comments.map(comment => <div key={comment.id} className="border-l-4 border-purple-200 py-2 pl-4"><div className="mb-1 flex justify-between text-sm"><span className="font-medium text-gray-900">{comment.created_by_name || 'Unbekannt'}</span><span className="text-gray-500">{formatDateTime(comment.created_at)}</span></div><p className="whitespace-pre-wrap text-sm text-gray-700">{comment.comment}</p></div>) : <p className="py-4 text-center text-sm text-gray-500">Keine Kommentare vorhanden</p>}
          </div>
        </div>
      )}
      {!isNew && activeTab === 'time' && (
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center text-lg font-medium text-gray-900"><ClockIcon className="mr-2 h-5 w-5" />Zeiterfassung</h2><strong className="text-purple-700">Gesamt: {Number(ticket.total_hours_spent || 0).toFixed(2)} h</strong></div>
          {!ticket.project && <p className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-800">Bitte verknüpfen Sie das Ticket mit einem Entwicklungsprojekt, damit die Stunden dem Projekt zugeordnet werden können.</p>}
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Neuer Zeiteintrag</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <label className="text-xs text-gray-600">Datum<input type="date" value={newTimeEntry.date} onChange={e => setNewTimeEntry(current => ({ ...current, date: e.target.value }))} className="mt-1 block w-full rounded border-gray-300 text-sm" /></label>
              <label className="text-xs text-gray-600">Uhrzeit<input type="time" value={newTimeEntry.time} onChange={e => setNewTimeEntry(current => ({ ...current, time: e.target.value }))} className="mt-1 block w-full rounded border-gray-300 text-sm" /></label>
              <label className="text-xs text-gray-600">Mitarbeiter<select value={newTimeEntry.employee} onChange={e => setNewTimeEntry(current => ({ ...current, employee: e.target.value }))} className="mt-1 block w-full rounded border-gray-300 text-sm"><option value="">Zuständiger / aktueller Benutzer</option>{users.map(user => <option key={user.id} value={user.id}>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}</option>)}</select></label>
              <label className="text-xs text-gray-600">Stunden<input type="number" min="0.25" step="0.25" value={newTimeEntry.hours_spent} onChange={e => setNewTimeEntry(current => ({ ...current, hours_spent: e.target.value }))} className="mt-1 block w-full rounded border-gray-300 text-sm" /></label>
              <button type="button" disabled={addingTimeEntry || !ticket.project} onClick={handleAddTimeEntry} className="mt-5 inline-flex h-10 items-center justify-center rounded bg-purple-600 px-3 text-sm text-white disabled:opacity-50"><PlusIcon className="mr-1 h-4 w-4" />{addingTimeEntry ? 'Speichern…' : 'Hinzufügen'}</button>
            </div>
            <label className="mt-3 block text-xs text-gray-600">Beschreibung<textarea rows="2" value={newTimeEntry.description} onChange={e => setNewTimeEntry(current => ({ ...current, description: e.target.value }))} className="mt-1 block w-full rounded border-gray-300 text-sm" /></label>
          </div>
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{['Datum', 'Uhrzeit', 'Mitarbeiter', 'Stunden', 'Beschreibung', ''].map((label, index) => <th key={index} className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-200">{ticket.time_entries?.length ? ticket.time_entries.map(entry => <tr key={entry.id}><td className="px-3 py-3 text-sm">{formatDateOnly(entry.date)}</td><td className="px-3 py-3 text-sm">{entry.time?.slice(0, 5)}</td><td className="px-3 py-3 text-sm">{entry.employee_name || '-'}</td><td className="px-3 py-3 text-right text-sm">{Number(entry.hours_spent).toFixed(2)} h</td><td className="px-3 py-3 text-sm">{entry.description}</td><td className="px-3 py-3 text-right"><button type="button" onClick={() => handleDeleteTimeEntry(entry.id)} className="text-red-600 hover:text-red-800">Löschen</button></td></tr>) : <tr><td colSpan="6" className="py-8 text-center text-sm text-gray-500">Keine Zeiteinträge vorhanden</td></tr>}</tbody></table></div>
        </div>
      )}
    </div>
  );
};
export default DevelopmentTicketEdit;
