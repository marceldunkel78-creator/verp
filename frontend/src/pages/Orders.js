import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  PlusIcon, ShoppingCartIcon, CheckCircleIcon, 
  TruckIcon, BanknotesIcon, ClockIcon,
  EyeIcon, PencilIcon, TrashIcon, ArrowUturnLeftIcon,
  DocumentTextIcon, BuildingOfficeIcon, CalendarIcon,
  ChevronLeftIcon, ChevronRightIcon, CurrencyEuroIcon
} from '@heroicons/react/24/outline';

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    year: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (hasSearched) {
      fetchOrders();
    }
  }, [currentPage]);

  const fetchOrders = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        page_size: 9
      });
      
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.year) params.append('year', filters.year);
      
      const response = await api.get(`/orders/orders/?${params.toString()}`);
      const data = response.data.results || response.data;
      setOrders(Array.isArray(data) ? data : []);
      
      if (response.data.count) {
        setTotalPages(Math.ceil(response.data.count / 9));
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bestellungen:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchOrders();
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

  // Generiere Jahre für Dropdown
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

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
          onClick={() => navigate('/procurement/orders/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Neue Bestellung
        </button>
      </div>

      {/* Filter/Search */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Bestellnummer, Lieferant..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleSearch}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Suchen
          </button>
        </div>
      </div>

      {/* Empty State - Before Search */}
      {!hasSearched && orders.length === 0 && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <ShoppingCartIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Bestellungen durchsuchen</h3>
          <p className="text-gray-500">
            Verwenden Sie die Filter oben, um Bestellungen zu suchen.
          </p>
        </div>
      )}

      {/* Empty State - No Results */}
      {hasSearched && orders.length === 0 && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <ShoppingCartIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Bestellungen gefunden</h3>
          <p className="text-gray-500">
            Versuchen Sie, Ihre Suchkriterien anzupassen.
          </p>
        </div>
      )}

      {/* Orders Grid */}
      {orders.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                onClick={() => navigate(`/procurement/orders/${order.id}`)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-5 w-5 text-blue-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900 font-mono">
                      {order.order_number}
                    </h3>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status_display}
                  </span>
                </div>

                {/* Supplier */}
                <div className="mb-3">
                  <div className="flex items-center text-sm text-gray-600 mb-1">
                    <BuildingOfficeIcon className="h-4 w-4 mr-2" />
                    <span className="font-medium">{order.supplier_name}</span>
                  </div>
                  <div className="text-xs text-gray-500 ml-6">
                    Nr. {order.supplier_number}
                  </div>
                </div>

                {/* Dates */}
                <div className="mb-4 space-y-1">
                  <div className="flex items-center text-sm text-gray-600">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <span>
                      {order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE') : 'Kein Datum'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 ml-6">
                    Erstellt: {new Date(order.created_at).toLocaleDateString('de-DE')}
                  </div>
                </div>

                {/* Items Count & Total */}
                <div className="border-t pt-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Positionen:</span>
                    <span className="font-medium text-gray-900">{order.items_count}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-600">Summe:</span>
                    <span className="font-bold text-gray-900 flex items-center">
                      {order.total_amount ? order.total_amount.toFixed(2) : '0.00'}
                      <CurrencyEuroIcon className="h-4 w-4 ml-1" />
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 border-t pt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/procurement/orders/${order.id}`);
                    }}
                    className="text-blue-600 hover:text-blue-900 p-1"
                    title="Details"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/procurement/orders/${order.id}/edit`);
                    }}
                    className="text-green-600 hover:text-green-900 p-1"
                    title="Bearbeiten"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  {order.status === 'storniert' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRevertCancellation(order);
                      }}
                      className="text-yellow-600 hover:text-yellow-900 p-1"
                      title="Stornierung rückgängig machen"
                    >
                      <ArrowUturnLeftIcon className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(order);
                      }}
                      className="text-red-600 hover:text-red-900 p-1"
                      title={canDelete(order) ? 'Löschen' : 'Stornieren'}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white shadow rounded-lg p-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-5 w-5 mr-1" />
                Zurück
              </button>
              <span className="text-sm text-gray-700">
                Seite {currentPage} von {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Weiter
                <ChevronRightIcon className="h-5 w-5 ml-1" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Orders;
