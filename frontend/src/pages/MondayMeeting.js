import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  PlusIcon,
  CheckIcon,
  TrashIcon,
  ArrowPathIcon,
  TruckIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const MondayMeeting = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Data states
  const [todos, setTodos] = useState([]);
  const [newCustomerOrders, setNewCustomerOrders] = useState([]);
  const [upcomingDeliveries, setUpcomingDeliveries] = useState([]);
  const [incomingOrders, setIncomingOrders] = useState([]);
  
  // Period info
  const [lastWeekPeriod, setLastWeekPeriod] = useState(null);
  const [thisWeekPeriod, setThisWeekPeriod] = useState(null);
  
  // New todo input
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);
  
  // Active section
  const [activeSection, setActiveSection] = useState('orders');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [todosRes, newOrdersRes, upcomingRes, incomingRes] = await Promise.all([
        api.get('/meetings/monday-todos/'),
        api.get('/meetings/monday-data/new_customer_orders/'),
        api.get('/meetings/monday-data/upcoming_deliveries/'),
        api.get('/meetings/monday-data/incoming_orders/')
      ]);
      
      setTodos(todosRes.data.results || todosRes.data || []);
      setNewCustomerOrders(newOrdersRes.data.orders || []);
      setLastWeekPeriod(newOrdersRes.data.period);
      setUpcomingDeliveries(upcomingRes.data.orders || []);
      setIncomingOrders(incomingRes.data.orders || []);
      setThisWeekPeriod(incomingRes.data.period);
      
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
      const res = await api.post('/meetings/monday-todos/', {
        title: newTodoTitle.trim()
      });
      setTodos([res.data, ...todos]);
      setNewTodoTitle('');
    } catch (err) {
      console.error('Fehler beim Hinzufügen:', err);
      setError('Fehler beim Hinzufügen des Todos');
    } finally {
      setAddingTodo(false);
    }
  };

  const handleToggleTodo = async (todo) => {
    try {
      const res = await api.patch(`/meetings/monday-todos/${todo.id}/`, {
        is_completed: !todo.is_completed
      });
      setTodos(todos.map(t => t.id === todo.id ? res.data : t));
    } catch (err) {
      console.error('Fehler beim Aktualisieren:', err);
    }
  };

  const handleDeleteTodo = async (id) => {
    try {
      await api.delete(`/meetings/monday-todos/${id}/`);
      setTodos(todos.filter(t => t.id !== id));
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
    }
  };

  const handleSaveMeeting = async () => {
    const completedCount = todos.filter(t => t.is_completed).length;
    if (completedCount === 0) {
      return;
    }
    
    if (!window.confirm(`${completedCount} erledigte Todo(s) werden beim Speichern gelöscht. Fortfahren?`)) {
      return;
    }
    
    try {
      setSaving(true);
      const res = await api.post('/meetings/monday-todos/save_meeting/');
      setTodos(res.data.todos || []);
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError('Fehler beim Speichern des Meetings');
    } finally {
      setSaving(false);
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

  const getDeliveryUrgency = (daysUntil) => {
    if (daysUntil < 0) return 'text-red-600 bg-red-50';
    if (daysUntil <= 3) return 'text-orange-600 bg-orange-50';
    if (daysUntil <= 7) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
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
            <h1 className="text-2xl font-bold text-gray-900">Montagsmeeting</h1>
            <p className="text-gray-500">Wöchentliche Auftragsübersicht</p>
          </div>
        </div>
        <button
          onClick={handleSaveMeeting}
          disabled={saving || todos.filter(t => t.is_completed).length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <ArrowPathIcon className="h-5 w-5 animate-spin" />
          ) : (
            <CheckIcon className="h-5 w-5" />
          )}
          Meeting speichern
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveSection('orders')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeSection === 'orders'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShoppingCartIcon className="h-5 w-5" />
              Neue Aufträge
              <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                {newCustomerOrders.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveSection('deliveries')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeSection === 'deliveries'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5" />
              Anstehende Lieferungen
              <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                {upcomingDeliveries.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveSection('incoming')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeSection === 'incoming'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <TruckIcon className="h-5 w-5" />
              Wareneingang
              <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                {incomingOrders.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveSection('todos')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeSection === 'todos'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5" />
              Todos
              <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                {todos.filter(t => !t.is_completed).length}
              </span>
            </div>
          </button>
        </nav>
      </div>

      {/* Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2">
          {/* Neue Aufträge */}
          {activeSection === 'orders' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ShoppingCartIcon className="h-5 w-5 text-blue-600" />
                  Neue Kundenaufträge
                  {lastWeekPeriod && (
                    <span className="text-sm font-normal text-gray-500">
                      (Bestätigung {formatDate(lastWeekPeriod.start)} - {formatDate(lastWeekPeriod.end)})
                    </span>
                  )}
                </h2>
              </div>
              <div className="overflow-x-auto">
                {newCustomerOrders.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Keine neuen Aufträge in der Vorwoche
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Auftrag</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bestätigt</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Liefertermin</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {newCustomerOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link
                              to={`/sales/order-processing/${order.id}`}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {order.order_number || `#${order.id}`}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/sales/customers/${order.customer_id}`}
                              className="text-gray-900 hover:text-blue-600"
                            >
                              {order.customer_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(order.confirmation_date)}</td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(order.delivery_date)}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                              {order.status_display}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Anstehende Lieferungen */}
          {activeSection === 'deliveries' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CalendarDaysIcon className="h-5 w-5 text-green-600" />
                  Anstehende Lieferungen
                </h2>
              </div>
              <div className="overflow-x-auto">
                {upcomingDeliveries.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Keine anstehenden Lieferungen
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Auftrag</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Liefertermin</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tage</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {upcomingDeliveries.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link
                              to={`/sales/order-processing/${order.id}`}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {order.order_number || `#${order.id}`}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/sales/customers/${order.customer_id}`}
                              className="text-gray-900 hover:text-blue-600"
                            >
                              {order.customer_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(order.delivery_date)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${getDeliveryUrgency(order.days_until_delivery)}`}>
                              {order.days_until_delivery < 0 
                                ? `${Math.abs(order.days_until_delivery)} Tage überfällig`
                                : order.days_until_delivery === 0
                                  ? 'Heute'
                                  : `${order.days_until_delivery} Tage`
                              }
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                              {order.status_display}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Wareneingang */}
          {activeSection === 'incoming' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <TruckIcon className="h-5 w-5 text-orange-600" />
                  Erwarteter Wareneingang
                  {thisWeekPeriod && (
                    <span className="text-sm font-normal text-gray-500">
                      ({formatDate(thisWeekPeriod.start)} - {formatDate(thisWeekPeriod.end)})
                    </span>
                  )}
                </h2>
              </div>
              <div className="overflow-x-auto">
                {incomingOrders.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Keine Lieferungen diese Woche erwartet
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bestellung</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lieferant</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Liefertermin</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {incomingOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link
                              to={`/procurement/orders/${order.id}`}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {order.order_number || `#${order.id}`}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/procurement/suppliers/${order.supplier_id}`}
                              className="text-gray-900 hover:text-blue-600"
                            >
                              {order.supplier_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(order.delivery_date)}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
                              {order.status_display}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Todos (Main View when selected) */}
          {activeSection === 'todos' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-5 w-5 text-purple-600" />
                  Todo-Liste
                </h2>
              </div>
              
              {/* Add Todo */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                    placeholder="Neues Todo hinzufügen..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddTodo}
                    disabled={addingTodo || !newTodoTitle.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {addingTodo ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <PlusIcon className="h-5 w-5" />
                    )}
                    Hinzufügen
                  </button>
                </div>
              </div>
              
              {/* Todo List */}
              <div className="divide-y divide-gray-200">
                {todos.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Keine Todos vorhanden
                  </div>
                ) : (
                  todos.map((todo) => (
                    <div
                      key={todo.id}
                      className={`p-4 flex items-center gap-4 ${todo.is_completed ? 'bg-gray-50' : ''}`}
                    >
                      <button
                        onClick={() => handleToggleTodo(todo)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          todo.is_completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-blue-500'
                        }`}
                      >
                        {todo.is_completed && <CheckIcon className="h-4 w-4" />}
                      </button>
                      <div className="flex-1">
                        <p className={`${todo.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {todo.title}
                        </p>
                        {todo.description && (
                          <p className="text-sm text-gray-500 mt-1">{todo.description}</p>
                        )}
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
              
              {todos.filter(t => t.is_completed).length > 0 && (
                <div className="p-4 bg-yellow-50 border-t border-yellow-200">
                  <p className="text-sm text-yellow-700">
                    <strong>{todos.filter(t => t.is_completed).length} erledigte Todo(s)</strong> werden beim Speichern des Meetings gelöscht.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - Compact Todo List (always visible except on todos tab) */}
        {activeSection !== 'todos' && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow sticky top-4">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-5 w-5 text-purple-600" />
                  Todos
                  <span className="ml-auto px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                    {todos.filter(t => !t.is_completed).length} offen
                  </span>
                </h3>
              </div>
              
              {/* Quick Add */}
              <div className="p-3 border-b border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                    placeholder="Neues Todo..."
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddTodo}
                    disabled={addingTodo || !newTodoTitle.trim()}
                    className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    <PlusIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Compact Todo List */}
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                {todos.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    Keine Todos
                  </div>
                ) : (
                  todos.slice(0, 10).map((todo) => (
                    <div
                      key={todo.id}
                      className={`p-2 flex items-center gap-2 ${todo.is_completed ? 'bg-gray-50' : ''}`}
                    >
                      <button
                        onClick={() => handleToggleTodo(todo)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          todo.is_completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-blue-500'
                        }`}
                      >
                        {todo.is_completed && <CheckIcon className="h-3 w-3" />}
                      </button>
                      <span className={`text-sm truncate ${todo.is_completed ? 'line-through text-gray-400' : ''}`}>
                        {todo.title}
                      </span>
                    </div>
                  ))
                )}
              </div>
              
              {todos.length > 10 && (
                <div className="p-2 border-t border-gray-200">
                  <button
                    onClick={() => setActiveSection('todos')}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-700"
                  >
                    Alle {todos.length} Todos anzeigen
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MondayMeeting;
