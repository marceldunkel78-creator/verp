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
  ClockIcon
} from '@heroicons/react/24/outline';

const SalesMeeting = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data states
  const [todos, setTodos] = useState([]);
  
  // New todo input
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Filter
  const [showCompleted, setShowCompleted] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/meetings/sales-todos/', {
        params: { show_completed: showCompleted }
      });
      setTodos(res.data.results || res.data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Daten:', err);
      setError('Fehler beim Laden der Meeting-Daten');
    } finally {
      setLoading(false);
    }
  }, [showCompleted]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) return;
    
    try {
      setAddingTodo(true);
      const res = await api.post('/meetings/sales-todos/', {
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
      const res = await api.patch(`/meetings/sales-todos/${todo.id}/`, {
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
      await api.delete(`/meetings/sales-todos/${id}/`);
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

  // Separate todos into open and completed
  const openTodos = todos.filter(t => !t.is_completed);
  const completedTodos = todos.filter(t => t.is_completed);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-green-600" />
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
            <h1 className="text-2xl font-bold text-gray-900">Vertriebsmeeting</h1>
            <p className="text-gray-500">Vertriebsaufgaben und History</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
              <textarea
                value={newTodoDescription}
                onChange={(e) => setNewTodoDescription(e.target.value)}
                placeholder="Optionale Beschreibung..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {addingTodo && <ArrowPathIcon className="h-5 w-5 animate-spin" />}
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Todos */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-5 w-5 text-green-600" />
            Offene Aufgaben
            <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
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
                  className="w-6 h-6 mt-1 rounded-full border-2 border-gray-300 hover:border-green-500 flex items-center justify-center transition-colors flex-shrink-0"
                >
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium">{todo.title}</p>
                  {todo.description && (
                    <p className="text-sm text-gray-500 mt-1">{todo.description}</p>
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

      {/* Completed Todos (History) */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-400" />
            History (Erledigte Aufgaben)
            <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {completedTodos.length}
            </span>
          </h2>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Erledigte anzeigen
          </label>
        </div>
        
        {showCompleted && (
          <div className="divide-y divide-gray-200">
            {completedTodos.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Keine erledigten Aufgaben
              </div>
            ) : (
              completedTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="p-4 flex items-start gap-4 bg-gray-50"
                >
                  <button
                    onClick={() => handleToggleTodo(todo)}
                    className="w-6 h-6 mt-1 rounded-full bg-green-500 border-2 border-green-500 text-white flex items-center justify-center flex-shrink-0"
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
                    title="Löschen"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesMeeting;
