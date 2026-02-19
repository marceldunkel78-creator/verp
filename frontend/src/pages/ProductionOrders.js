import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SortableHeader from '../components/SortableHeader';
import {
  ClipboardDocumentListIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

const STATUS_CONFIG = {
  created: { label: 'Erstellt', color: 'bg-gray-100 text-gray-800', icon: ClipboardDocumentListIcon },
  in_progress: { label: 'In Bearbeitung', color: 'bg-blue-100 text-blue-800', icon: PlayIcon },
  completed: { label: 'Abgeschlossen', color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
  cancelled: { label: 'Storniert', color: 'bg-red-100 text-red-800', icon: XCircleIcon }
};

const ProductionOrders = () => {
  const navigate = useNavigate();
  
  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // VSHardware create modal
  const [vsList, setVsList] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrderData, setNewOrderData] = useState({ vs_hardware: '', quantity: 1, notes: '' });

  // Sorting
  const [sortBy, setSortBy] = useState('-created_at');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchOrders();
    setCurrentPage(1);
  }, [ordersFilter, sortBy]);

  useEffect(() => {
    fetchOrders();
  }, [currentPage]);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', '10');
      params.append('ordering', sortBy);
      if (ordersFilter !== 'all') params.append('status', ordersFilter);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await api.get(`/manufacturing/production-orders/?${params.toString()}`);
      setOrders(response.data.results || response.data);
      if (response.data.count !== undefined) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 10));
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchVSHardware = async () => {
    try {
      const res = await api.get('/manufacturing/vs-hardware/?is_active=true&page_size=100');
      // API may return paginated results
      const data = res.data.results || res.data;
      setVsList(data);
    } catch (error) {
      console.error('Error fetching VSHardware:', error);
    }
  };

  const handleCreateOrder = async () => {
    if (!newOrderData.vs_hardware) {
      alert('Bitte VS-Hardware auswählen');
      return;
    }
    if (!newOrderData.quantity || newOrderData.quantity < 1) {
      alert('Bitte Menge >= 1 angeben');
      return;
    }

    try {
      await api.post('/manufacturing/production-orders/', newOrderData);
      alert('Fertigungsauftrag erstellt');
      setShowCreateModal(false);
      setNewOrderData({ vs_hardware: '', quantity: 1, notes: '' });
      fetchOrders();
    } catch (error) {
      console.error('Error creating production order:', error);
      alert('Fehler beim Erstellen: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('de-DE');
  };

  const isOverdue = (order) => {
    if (!order.estimated_completion_date || order.status === 'completed' || order.status === 'cancelled') {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const estimatedDate = new Date(order.estimated_completion_date);
    estimatedDate.setHours(0, 0, 0, 0);
    return estimatedDate < today;
  };

  const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: ClockIcon };
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-4 w-4" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fertigungsaufträge</h1>
          <p className="text-gray-500 text-sm">Übersicht aller Fertigungsaufträge</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); fetchVSHardware(); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5" />
          Neuer Fertigungsauftrag
        </button>
      </div>



      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowCreateModal(false)} />
          <div className="bg-white rounded-lg shadow-lg z-10 w-full max-w-md p-6">
            <h3 className="text-lg font-medium mb-4">Neuer Fertigungsauftrag</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">VS-Hardware</label>
                <select
                  value={newOrderData.vs_hardware}
                  onChange={(e) => setNewOrderData({ ...newOrderData, vs_hardware: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Auswählen...</option>
                  {vsList.map(v => (
                    <option key={v.id} value={v.id}>{v.part_number} - {v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Menge</label>
                <input
                  type="number"
                  min="1"
                  value={newOrderData.quantity}
                  onChange={(e) => setNewOrderData({ ...newOrderData, quantity: parseInt(e.target.value || '1') })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Notizen (optional)</label>
                <textarea
                  value={newOrderData.notes}
                  onChange={(e) => setNewOrderData({ ...newOrderData, notes: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
                >Abbrechen</button>
                <button
                  onClick={handleCreateOrder}
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                >Erstellen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders List */}
      (
        <div className="bg-white rounded-lg shadow">
          {/* Search & Filter */}
          <div className="p-4 border-b">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
                  placeholder="Suche nach Auftragsnummer, Artikel..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <select
                value={ordersFilter}
                onChange={(e) => setOrdersFilter(e.target.value)}
                className="border rounded-lg px-4 py-2"
              >
                <option value="all">Alle Status</option>
                <option value="created">Erstellt</option>
                <option value="in_progress">In Bearbeitung</option>
                <option value="completed">Abgeschlossen</option>
                <option value="cancelled">Storniert</option>
              </select>
              <button
                onClick={() => { setCurrentPage(1); fetchOrders(); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Suchen
              </button>
            </div>
          </div>

          {/* Orders Table */}
          {ordersLoading ? (
            <div className="p-8 text-center text-gray-500">Laden...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <ClipboardDocumentListIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Keine Aufträge gefunden</p>
            </div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader field="order_number" label="FA-Nr." sortBy={sortBy} setSortBy={setSortBy} />
                  <SortableHeader field="vs_hardware__name" label="VS-Hardware" sortBy={sortBy} setSortBy={setSortBy} />
                  <SortableHeader field="quantity" label="Menge" sortBy={sortBy} setSortBy={setSortBy} align="center" />
                  <SortableHeader field="customer_order__order_number" label="Kundenauftrag" sortBy={sortBy} setSortBy={setSortBy} />
                  <SortableHeader field="status" label="Status" sortBy={sortBy} setSortBy={setSortBy} align="center" />
                  <SortableHeader field="planned_start" label="Geplant" sortBy={sortBy} setSortBy={setSortBy} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map(order => (
                  <tr 
                    key={order.id} 
                    className={`cursor-pointer ${
                      isOverdue(order) 
                        ? 'bg-red-50 hover:bg-red-100' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => navigate(`/manufacturing/production-orders/${order.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-blue-600 font-medium">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm text-gray-500">{order.vs_hardware_part_number}</div>
                      <div>{order.vs_hardware_name}</div>
                    </td>
                    <td className="px-4 py-3 text-center">{order.quantity}</td>
                    <td className="px-4 py-3">
                      {order.customer_order_number ? (
                        <div>
                          <span className="font-mono text-sm">{order.customer_order_number}</span>
                          {order.customer_name && (
                            <div className="text-xs text-gray-500">{order.customer_name}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {order.planned_start && (
                        <div>{formatDate(order.planned_start)} - {formatDate(order.planned_end)}</div>
                      )}
                      {order.actual_start && (
                        <div className="text-xs text-gray-500">
                          Tatsächlich: {formatDate(order.actual_start)}
                          {order.actual_end && ` - ${formatDate(order.actual_end)}`}
                        </div>
                      )}
                      {isOverdue(order) && (
                        <div className="flex items-center gap-1 text-xs text-red-700 font-medium mt-1">
                          <ExclamationTriangleIcon className="h-4 w-4" />
                          Avisiert: {formatDate(order.estimated_completion_date)}
                        </div>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
              <div className="text-sm text-gray-700">
                Zeige {(currentPage - 1) * 10 + 1} bis {Math.min(currentPage * 10, totalCount)} von {totalCount} Aufträgen
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <span className="px-4 py-1 text-sm">
                  Seite {currentPage} von {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
};

export default ProductionOrders;
