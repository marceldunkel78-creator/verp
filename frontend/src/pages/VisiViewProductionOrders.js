import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

const VisiViewProductionOrders = () => {
  const navigate = useNavigate();
  const [productionOrders, setProductionOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    processing_type: '',
    search: ''
  });

  useEffect(() => {
    fetchProductionOrders();
  }, [filters]);

  const fetchProductionOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.processing_type) params.append('processing_type', filters.processing_type);
      if (filters.search) params.append('search', filters.search);

      const response = await api.get(`/visiview/production-orders/?${params.toString()}`);
      setProductionOrders(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching production orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'DRAFT': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Entwurf' },
      'IN_PROGRESS': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Bearbeitung' },
      'COMPLETED': { bg: 'bg-green-100', text: 'text-green-800', label: 'Abgeschlossen' },
      'CANCELLED': { bg: 'bg-red-100', text: 'text-red-800', label: 'Storniert' }
    };
    const badge = badges[status] || badges.DRAFT;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getProcessingTypeBadge = (type) => {
    const badges = {
      'NEW_LICENSE': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Neue Lizenz' },
      'EXTEND_LICENSE': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Lizenz erweitern' },
      'MAINTENANCE_CREDIT': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Maintenance-Gutschrift' }
    };
    const badge = badges[type] || badges.NEW_LICENSE;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">VisiView Fertigungsaufträge</h1>
        <button
          onClick={() => navigate('/visiview/production-orders/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Neuer Fertigungsauftrag
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Alle</option>
              <option value="DRAFT">Entwurf</option>
              <option value="IN_PROGRESS">In Bearbeitung</option>
              <option value="COMPLETED">Abgeschlossen</option>
              <option value="CANCELLED">Storniert</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bearbeitungstyp
            </label>
            <select
              value={filters.processing_type}
              onChange={(e) => setFilters({ ...filters, processing_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Alle</option>
              <option value="NEW_LICENSE">Neue Lizenz</option>
              <option value="EXTEND_LICENSE">Lizenz erweitern</option>
              <option value="MAINTENANCE_CREDIT">Maintenance-Gutschrift</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Suche
            </label>
            <div className="relative">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Auftragsnummer, Kunde..."
                className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Auftragsnummer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kunde
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kundenauftrag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Typ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Positionen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Erstellt am
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Abgeschlossen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {productionOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    Keine Fertigungsaufträge gefunden
                  </td>
                </tr>
              ) : (
                productionOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/visiview/production-orders/${order.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                      {order.order_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.customer_order_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getProcessingTypeBadge(order.processing_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.items_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.completed_at ? new Date(order.completed_at).toLocaleDateString('de-DE') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default VisiViewProductionOrders;
