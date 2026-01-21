import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  PlusIcon,
  CheckIcon,
  TrashIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  TicketIcon,
  BugAntIcon,
  LightBulbIcon,
  EyeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const VisiViewMeeting = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data states
  const [todos, setTodos] = useState([]);
  const [worklistTickets, setWorklistTickets] = useState([]);
  
  // New todo input
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Active tab
  const [activeTab, setActiveTab] = useState('worklist');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [todosRes, worklistRes] = await Promise.all([
        api.get('/meetings/visiview-todos/'),
        api.get('/meetings/visiview-data/worklist_tickets/')
      ]);
      
      setTodos(todosRes.data.results || todosRes.data || []);
      setWorklistTickets(worklistRes.data.tickets || []);
    } catch (err) {
      console.error('Fehler beim Laden der Daten:', err);
      setError('Fehler beim Laden der Meeting-Daten');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) return;
    
    try {
      setAddingTodo(true);
      const res = await api.post('/meetings/visiview-todos/', {
        title: newTodoTitle.trim(),
        description: newTodoDescription.trim()
      });
      setTodos([res.data, ...todos]);
      setNewTodoTitle('');
      setNewTodoDescription('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Fehler beim Hinzufügen:', err);
      setError('Fehler beim Hinzufügen des Todos');
    } finally {
      setAddingTodo(false);
    }
  };

  const handleToggleTodo = async (todo) => {
    try {
      const res = await api.patch(`/meetings/visiview-todos/${todo.id}/`, {
        is_completed: !todo.is_completed
      });
      setTodos(todos.map(t => t.id === todo.id ? res.data : t));
    } catch (err) {
      console.error('Fehler beim Aktualisieren:', err);
    }
  };

  const handleDeleteTodo = async (id) => {
    if (!window.confirm('Todo wirklich löschen?')) return;
    
    try {
      await api.delete(`/meetings/visiview-todos/${id}/`);
      setTodos(todos.filter(t => t.id !== id));
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'immediate': return 'bg-red-100 text-red-700';
      case 'urgent': return 'bg-orange-100 text-orange-700';
      case 'high': return 'bg-yellow-100 text-yellow-700';
      case 'normal': return 'bg-blue-100 text-blue-700';
      case 'low': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-700';
      case 'assigned': return 'bg-purple-100 text-purple-700';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700';
      case 'testing': return 'bg-orange-100 text-orange-700';
      case 'tested': return 'bg-cyan-100 text-cyan-700';
      case 'resolved': return 'bg-green-100 text-green-700';
      case 'closed': return 'bg-gray-100 text-gray-600';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // Separate todos
  const openTodos = todos.filter(t => !t.is_completed);
  const completedTodos = todos.filter(t => t.is_completed);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/meetings"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">VisiView-Meeting</h1>
            <p className="text-gray-500">VisiView Tickets und Entwicklungsaufgaben</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Neues Todo
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Add Todo Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Neues Todo hinzufügen</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
              <input
                type="text"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                placeholder="Todo-Titel..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
              <textarea
                value={newTodoDescription}
                onChange={(e) => setNewTodoDescription(e.target.value)}
                placeholder="Optionale Beschreibung..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewTodoTitle('');
                  setNewTodoDescription('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddTodo}
                disabled={addingTodo || !newTodoTitle.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {addingTodo && <ArrowPathIcon className="h-5 w-5 animate-spin" />}
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('worklist')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'worklist'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <TicketIcon className="h-5 w-5" />
              Worklist Tickets
              <span className="ml-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                {worklistTickets.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'todos'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5" />
              Todos
              <span className="ml-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                {openTodos.length}
              </span>
            </div>
          </button>
        </nav>
      </div>

      {/* Worklist Tickets */}
      {activeTab === 'worklist' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <EyeIcon className="h-5 w-5 text-purple-600" />
              VisiView Worklist Tickets
              <span className="text-sm font-normal text-gray-500 ml-2">
                (Tickets mit aktivierter Worklist-Option)
              </span>
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            {worklistTickets.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <TicketIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p>Keine Tickets in der Worklist</p>
                <p className="text-sm mt-2">
                  Tickets können unter VisiView → Tickets → Details mit der "Worklist" Checkbox hinzugefügt werden.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titel</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priorität</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zugewiesen</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {worklistTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/visiview/tickets/${ticket.id}`}
                          className="text-purple-600 hover:underline font-medium flex items-center gap-1"
                        >
                          #{ticket.ticket_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1">
                          {ticket.tracker === 'bug' ? (
                            <BugAntIcon className="h-4 w-4 text-red-500" />
                          ) : (
                            <LightBulbIcon className="h-4 w-4 text-yellow-500" />
                          )}
                          {ticket.tracker_display}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="max-w-md truncate block" title={ticket.title}>
                          {ticket.title}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(ticket.status)}`}>
                          {ticket.status_display}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority_display}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {ticket.assigned_to_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {ticket.target_version || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${ticket.percent_done}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{ticket.percent_done}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Todos */}
      {activeTab === 'todos' && (
        <div className="space-y-6">
          {/* Open Todos */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ClipboardDocumentListIcon className="h-5 w-5 text-purple-600" />
                Offene Aufgaben
                <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                  {openTodos.length}
                </span>
              </h2>
            </div>
            
            <div className="divide-y divide-gray-200">
              {openTodos.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Keine offenen Aufgaben
                </div>
              ) : (
                openTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="p-4 flex items-start gap-4 hover:bg-gray-50"
                  >
                    <button
                      onClick={() => handleToggleTodo(todo)}
                      className="w-6 h-6 mt-1 rounded-full border-2 border-gray-300 hover:border-purple-500 flex items-center justify-center transition-colors flex-shrink-0"
                    >
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-medium">{todo.title}</p>
                      {todo.description && (
                        <p className="text-sm text-gray-500 mt-1">{todo.description}</p>
                      )}
                      {todo.visiview_ticket_display && (
                        <p className="text-sm text-purple-600 mt-1">
                          Verknüpft: {todo.visiview_ticket_display}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Erstellt am {formatDate(todo.created_at)}
                        {todo.created_by_name && ` von ${todo.created_by_name}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Completed Todos */}
          {completedTodos.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ClockIcon className="h-5 w-5 text-gray-400" />
                  Erledigte Aufgaben
                  <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                    {completedTodos.length}
                  </span>
                </h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {completedTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="p-4 flex items-start gap-4 bg-gray-50"
                  >
                    <button
                      onClick={() => handleToggleTodo(todo)}
                      className="w-6 h-6 mt-1 rounded-full bg-purple-500 border-2 border-purple-500 text-white flex items-center justify-center flex-shrink-0"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-400 line-through">{todo.title}</p>
                      {todo.description && (
                        <p className="text-sm text-gray-400 mt-1 line-through">{todo.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Erledigt am {formatDateTime(todo.completed_at)}
                        {todo.completed_by_name && ` von ${todo.completed_by_name}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VisiViewMeeting;
