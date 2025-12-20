import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  PlusIcon, ShoppingCartIcon, CheckCircleIcon, 
  TruckIcon, BanknotesIcon, ClockIcon,
  EyeIcon, PencilIcon, TrashIcon, ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';

const Orders = () => {  const navigate = useNavigate();  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    year: new Date().getFullYear().toString()
  });

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchOrders();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [filters]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = '/orders/orders/';
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.year) params.append('year', filters.year);
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await api.get(url);
      setOrders(response.data.results || response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Bestellungen:', error);
    } finally {
      setLoading(false);
    }
  };

  const canDelete = (order) => {
    if (order.status !== 'angelegt') return false;
    
    // Parse order number format: B-003-12/25
    const parts = order.order_number.split('-');
    if (parts.length < 3) return false;
    
    const orderNum = parseInt(parts[1]);
    const monthYear = parts[2]; // "12/25"
    const [month, year] = monthYear.split('/');
    const orderYear = 2000 + parseInt(year); // 25 -> 2025
    
    const currentYear = new Date().getFullYear();
    
    // Can only delete orders from current year
    if (orderYear !== currentYear) return false;
    
    // Check if there's a newer order (higher number) in the same year
    const hasNewerOrder = orders.some(o => {
      if (o.id === order.id) return false; // Skip selbst
      
      const oParts = o.order_number.split('-');
      if (oParts.length < 3) return false;
      
      const oNum = parseInt(oParts[1]);
      const oMonthYear = oParts[2];
      const [, oYear] = oMonthYear.split('/');
      const oOrderYear = 2000 + parseInt(oYear);
      
      return oOrderYear === currentYear && oNum > orderNum;
    });
    
    return !hasNewerOrder;
  };

  const handleDelete = async (order) => {
    if (canDelete(order)) {
      if (window.confirm(`Möchten Sie die Bestellung ${order.order_number} wirklich löschen?`)) {
        try {
          await api.delete(`/orders/orders/${order.id}/`);
          fetchOrders();
        } catch (error) {
          console.error('Fehler beim Löschen:', error);
          alert('Fehler beim Löschen der Bestellung');
        }
      }
    } else {
      if (window.confirm('Diese Bestellung kann nicht gelöscht werden.\n\nMöchten Sie die Bestellung stornieren?')) {
        const shouldCopy = window.confirm('Möchten Sie eine neue bearbeitbare Kopie dieser Bestellung anlegen?');
        
        try {
          if (shouldCopy) {
            // Create copy first
            const response = await api.get(`/orders/orders/${order.id}/`);
            const orderData = response.data;
            
            const newOrderData = {
              supplier: orderData.supplier,
              order_date: new Date().toISOString().split('T')[0],
              delivery_date: orderData.delivery_date || null,
              payment_date: null,
              status: 'angelegt',
              offer_reference: orderData.offer_reference || '',
              custom_text: orderData.custom_text || '',
              notes: (orderData.notes || '') + '\n\n[Kopie von Bestellung ' + orderData.order_number + ']',
              items: orderData.items.map(item => ({
                trading_product: item.trading_product,
                asset: item.asset,
                material_supply: item.material_supply,
                article_number: item.article_number,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                list_price: item.list_price,
                discount_percent: item.discount_percent,
                final_price: item.final_price,
                currency: item.currency,
                position: item.position
              }))
            };
            
            const createResponse = await api.post('/orders/orders/', newOrderData);
            
            // Cancel original order
            const timestamp = new Date().toLocaleString('de-DE');
            await api.patch(`/orders/orders/${order.id}/`, {
              status: 'storniert',
              notes: (orderData.notes || '') + `\n\n[Storniert am ${timestamp} - Kopie erstellt als ${createResponse.data.order_number}]`
            });
            
            fetchOrders();
            navigate(`/procurement/orders/${createResponse.data.id}/edit`);
          } else {
            // Just cancel
            const response = await api.get(`/orders/orders/${order.id}/`);
            const orderData = response.data;
            const timestamp = new Date().toLocaleString('de-DE');
            
            await api.patch(`/orders/orders/${order.id}/`, {
              status: 'storniert',
              notes: (orderData.notes || '') + `\n\n[Storniert am ${timestamp}]`
            });
            
            fetchOrders();
          }
        } catch (error) {
          console.error('Fehler:', error);
          console.error('Error details:', error.response?.data);
          alert('Fehler beim Verarbeiten der Bestellung: ' + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
        }
      }
    }
  };

  const handleRevertCancellation = async (order) => {
    if (window.confirm(`Möchten Sie die Stornierung von ${order.order_number} rückgängig machen?`)) {
      try {
        const response = await api.get(`/orders/orders/${order.id}/`);
        const orderData = response.data;
        
        await api.patch(`/orders/orders/${order.id}/`, {
          status: 'angelegt',
          notes: (orderData.notes || '') + `\n\n[Stornierung rückgängig gemacht am ${new Date().toLocaleString('de-DE')}]`
        });
        
        fetchOrders();
      } catch (error) {
        console.error('Fehler:', error);
        alert('Fehler beim Rückgängigmachen');
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'angelegt':
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
      case 'bestellt':
        return <ShoppingCartIcon className="h-5 w-5 text-blue-500" />;
      case 'bestaetigt':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'geliefert':
        return <TruckIcon className="h-5 w-5 text-purple-500" />;
      case 'bezahlt':
        return <BanknotesIcon className="h-5 w-5 text-emerald-500" />;
      case 'zahlung_on_hold':
        return <BanknotesIcon className="h-5 w-5 text-orange-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'storniert':
        return 'bg-red-500 text-white';
      case 'bezahlt':
        return 'bg-green-500 text-white';
      case 'angelegt':
        return 'bg-orange-100 text-orange-800';
      case 'bestellt':
        return 'bg-orange-100 text-orange-800';
      case 'bestaetigt':
        return 'bg-orange-100 text-orange-800';
      case 'geliefert':
        return 'bg-orange-100 text-orange-800';
      case 'zahlung_on_hold':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <ShoppingCartIcon className="h-8 w-8 mr-3 text-blue-600" />
            Bestellungen
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Verwaltung aller Bestellungen und Bestellpositionen
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/procurement/orders/new'}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Neue Bestellung
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filter</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Bestellnummer, Lieferant..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Status</option>
              <option value="angelegt">Angelegt</option>
              <option value="bestellt">Bestellt</option>
              <option value="bestaetigt">Bestätigt</option>
              <option value="geliefert">Geliefert</option>
              <option value="bezahlt">Bezahlt</option>
              <option value="zahlung_on_hold">Zahlung on hold</option>
              <option value="storniert">Storniert</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jahr</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Jahre</option>
              {[...Array(5)].map((_, i) => {
                const year = new Date().getFullYear() - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bestellnummer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lieferant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bestelldatum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Positionen
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Summe
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                  <ShoppingCartIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium">Keine Bestellungen gefunden</p>
                  <p className="mt-1">Erstellen Sie eine neue Bestellung, um zu beginnen.</p>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('de-DE')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{order.supplier_name}</div>
                    <div className="text-xs text-gray-500">Nr. {order.supplier_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      <span className="mr-1">{getStatusIcon(order.status)}</span>
                      {order.status_display}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.items_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.total_amount ? `${order.total_amount.toFixed(2)} €` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => navigate(`/procurement/orders/${order.id}`)}
                      className="text-blue-600 hover:text-blue-900 mr-2"
                      title="Details"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => navigate(`/procurement/orders/${order.id}/edit`)}
                      className="text-green-600 hover:text-green-900 mr-2"
                      title="Bearbeiten"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    {order.status === 'storniert' ? (
                      <button
                        onClick={() => handleRevertCancellation(order)}
                        className="text-yellow-600 hover:text-yellow-900"
                        title="Stornierung rückgängig machen"
                      >
                        <ArrowUturnLeftIcon className="h-5 w-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDelete(order)}
                        className="text-red-600 hover:text-red-900"
                        title={canDelete(order) ? 'Löschen' : 'Stornieren'}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Orders;
