import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
/* eslint-disable react-hooks/exhaustive-deps */
import api from '../services/api';
import { 
  ArrowLeftIcon, ShoppingCartIcon, CheckCircleIcon, TruckIcon, 
  BanknotesIcon, ClockIcon, XCircleIcon, PencilIcon, TrashIcon, DocumentTextIcon
} from '@heroicons/react/24/outline';

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/orders/orders/${id}/`);
      setOrder(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Bestellung:', error);
      alert('Fehler beim Laden der Bestellung');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleEdit = async () => {
    if (['angelegt', 'bestellt', 'geliefert'].includes(order.status)) {
      navigate(`/procurement/orders/${id}/edit`);
    } else {
      // Status is not "angelegt" - ask if user wants to cancel order
      const shouldCancel = window.confirm(
        'Diese Bestellung kann nicht mehr bearbeitet werden, da sie bereits den Status "' + 
        order.status_display + '" hat.\n\n' +
        'Möchten Sie die Bestellung stornieren?'
      );

      if (shouldCancel) {
        const shouldCopy = window.confirm(
          'Möchten Sie eine Kopie dieser Bestellung mit einer neuen Bestellnummer anlegen?\n\n' +
          'Die Kopie wird den Status "Angelegt" haben und kann bearbeitet werden.'
        );

        if (shouldCopy) {
          await createCopy();
        } else {
          // Just cancel the order
          await cancelOrder();
        }
      }
    }
  };

  const cancelOrder = async () => {
    try {
      await api.patch(`/orders/orders/${id}/`, { 
        status: 'storniert',
        notes: (order.notes || '') + '\n\n[Storniert am ' + new Date().toLocaleString('de-DE') + ']'
      });
      alert('Bestellung wurde storniert');
      fetchOrder();
    } catch (error) {
      console.error('Fehler beim Stornieren:', error);
      alert('Fehler beim Stornieren der Bestellung: ' + (error.response?.data?.detail || error.message));
    }
  };

  const createCopy = async () => {
    try {
      // Create a new order with same data but status = 'angelegt'
      const newOrderData = {
        supplier: order.supplier,
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: order.delivery_date,
        payment_date: null,
        payment_term: order.payment_term,
        delivery_term: order.delivery_term,
        delivery_instruction: order.delivery_instruction,
        offer_reference: order.offer_reference || '',
        custom_text: order.custom_text || '',
        notes: (order.notes || '') + '\n\n[Kopie von Bestellung ' + order.order_number + ']',
        items: order.items.map(item => ({
          customer_order_number: item.customer_order_number || '',
          article_number: item.article_number,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          list_price: item.list_price,
          discount_percent: item.discount_percent,
          final_price: item.final_price,
          currency: item.currency,
          position: item.position,
          trading_product: item.trading_product,
          asset: item.asset,
          material_supply: item.material_supply
        }))
      };

      const response = await api.post('/orders/orders/', newOrderData);
      
      // Cancel the original order
      await api.patch(`/orders/orders/${id}/`, { 
        status: 'storniert',
        notes: (order.notes || '') + '\n\n[Storniert und kopiert als ' + response.data.order_number + ' am ' + new Date().toLocaleString('de-DE') + ']'
      });

      alert('Neue Bestellung ' + response.data.order_number + ' wurde erstellt. Die alte Bestellung wurde storniert.');
      navigate(`/procurement/orders/${response.data.id}/edit`);
    } catch (error) {
      console.error('Fehler beim Erstellen der Kopie:', error);
      alert('Fehler beim Erstellen der Kopie: ' + (error.response?.data?.detail || error.message));
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleDelete = async () => {
    if (!window.confirm('Möchten Sie diese Bestellung wirklich löschen?')) {
      return;
    }

    try {
      await api.delete(`/orders/orders/${id}/`);
      alert('Bestellung wurde gelöscht');
      navigate('/procurement/orders');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen der Bestellung: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'angelegt':
        return <ClockIcon className="h-6 w-6 text-gray-500" />;
      case 'bestellt':
        return <ShoppingCartIcon className="h-6 w-6 text-blue-500" />;
      case 'bestaetigt':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'geliefert':
        return <TruckIcon className="h-6 w-6 text-purple-500" />;
      case 'bezahlt':
        return <BanknotesIcon className="h-6 w-6 text-emerald-500" />;
      case 'zahlung_on_hold':
        return <BanknotesIcon className="h-6 w-6 text-orange-500" />;
      case 'storniert':
        return <XCircleIcon className="h-6 w-6 text-red-500" />;
      default:
        return <ClockIcon className="h-6 w-6 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'angelegt':
        return 'bg-gray-100 text-gray-800';
      case 'bestellt':
        return 'bg-blue-100 text-blue-800';
      case 'bestaetigt':
        return 'bg-green-100 text-green-800';
      case 'geliefert':
        return 'bg-purple-100 text-purple-800';
      case 'bezahlt':
        return 'bg-emerald-100 text-emerald-800';
      case 'zahlung_on_hold':
        return 'bg-orange-100 text-orange-800';
      case 'storniert':
        return 'bg-red-100 text-red-800';
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

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-600">Bestellung nicht gefunden</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zur Übersicht
        </button>
        
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Bestellung {order.order_number}
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEdit}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                {['angelegt', 'bestellt', 'geliefert'].includes(order.status) ? 'Bearbeiten' : 'Bearbeiten/Kopie'}
              </button>
              {order.status === 'storniert' && (
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Löschen
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center space-x-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
              {getStatusIcon(order.status)}
              <span className="ml-2">{order.status_display}</span>
            </span>
            <div className="ml-4 inline-flex items-center px-3 py-1 rounded bg-gray-50 border border-gray-100 text-sm">
              <div className="text-xs text-gray-500 mr-2">Gesamt:</div>
              <div className="text-sm font-medium">€ {order.total_amount ? parseFloat(order.total_amount).toFixed(2) : '0.00'}</div>
            </div>
            {order.confirmed_total && (
              <div className="ml-2 inline-flex items-center px-3 py-1 rounded bg-green-50 border border-green-100 text-sm text-green-800">
                Bestätigt: <strong className="ml-2">€ {parseFloat(order.confirmed_total).toFixed(2)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Information */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bestellinformationen</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600">Lieferant</label>
            <div className="mt-1 text-sm text-gray-900">{order.supplier_name || 'N/A'}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600">Bestelldatum</label>
            <div className="mt-1 text-sm text-gray-900">
              {order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE') : 'N/A'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600">Auftragsbestätigung</label>
            <div className="mt-1 text-sm text-gray-900">
              {order.confirmation_date ? new Date(order.confirmation_date).toLocaleDateString('de-DE') : 'N/A'}
            </div>
          </div>

          {order.expected_delivery_date && (
            <div>
              <label className="block text-sm font-medium text-gray-600">Voraussichtliches Lieferdatum</label>
              <div className="mt-1 text-sm text-gray-900">
                {new Date(order.expected_delivery_date).toLocaleDateString('de-DE')}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600">Lieferdatum</label>
            <div className="mt-1 text-sm text-gray-900">
              {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('de-DE') : 'N/A'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600">Zahlungsdatum</label>
            <div className="mt-1 text-sm text-gray-900">
              {order.payment_date ? new Date(order.payment_date).toLocaleDateString('de-DE') : 'N/A'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600">Erstellt von</label>
            <div className="mt-1 text-sm text-gray-900">{order.created_by_name || 'N/A'}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600">Erstellt am</label>
            <div className="mt-1 text-sm text-gray-900">
              {order.created_at ? new Date(order.created_at).toLocaleString('de-DE') : 'N/A'}
            </div>
          </div>

          {order.payment_term && (
            <div>
              <label className="block text-sm font-medium text-gray-600">Zahlungsbedingungen</label>
              <div className="mt-1 text-sm text-gray-900">{order.payment_term_display || order.payment_term}</div>
            </div>
          )}

          {order.delivery_term && (
            <div>
              <label className="block text-sm font-medium text-gray-600">Lieferbedingungen</label>
              <div className="mt-1 text-sm text-gray-900">{order.delivery_term_display || order.delivery_term}</div>
            </div>
          )}

          {order.delivery_instruction && (
            <div>
              <label className="block text-sm font-medium text-gray-600">Lieferanweisungen</label>
              <div className="mt-1 text-sm text-gray-900">{order.delivery_instruction_display || order.delivery_instruction}</div>
            </div>
          )}

          {order.offer_reference && (
            <div>
              <label className="block text-sm font-medium text-gray-600">Angebotsreferenz</label>
              <div className="mt-1 text-sm text-gray-900 font-mono">{order.offer_reference}</div>
            </div>
          )}

          {order.custom_text && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600">Benutzerdefinierter Text</label>
              <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                {order.custom_text}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Linked documents */}
      {(order.order_document || order.offer_document || order.supplier_confirmation_document) && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DocumentTextIcon className="h-5 w-5 mr-2 text-blue-600" />
            Verknüpfte Dokumente
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ['Bestelldokument', order.order_document],
              ['Weiteres Bestelldokument', order.offer_document],
              ['Auftragsbestätigung', order.supplier_confirmation_document]
            ].filter(([, url]) => url).map(([label, url]) => {
              const fileName = url.split('/').pop();
              return (
                <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800">{label}</div>
                    <div className="truncate text-xs text-gray-500" title={fileName}>{fileName}</div>
                  </div>
                  <div className="flex shrink-0 gap-3 text-sm">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">Öffnen</a>
                    <a href={url} download className="text-blue-600 hover:text-blue-800">Download</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Supplier Details */}
      {order.supplier_details && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Lieferantendetails</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600">Adresse</label>
              <div className="mt-1 text-sm text-gray-900">
                {order.supplier_details.street} {order.supplier_details.house_number}<br />
                {order.supplier_details.postal_code} {order.supplier_details.city}<br />
                {order.supplier_details.country}
              </div>
            </div>

            {order.supplier_details.customer_number && (
              <div>
                <label className="block text-sm font-medium text-gray-600">Unsere Kundennummer</label>
                <div className="mt-1 text-sm text-gray-900 font-mono">
                  {order.supplier_details.customer_number}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Items */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bestellpositionen</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kundenauftrag</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artikel-Nr.</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bezeichnung</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Menge</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Einheit</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listenpreis</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rabatt</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpreis</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gesamt</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {order.items && order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{item.position}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{item.customer_order_number || '-'}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{item.article_number}</td>
                  <td className="px-3 py-3 text-sm text-gray-900">{item.name}</td>
                  <td className="px-3 py-3 text-sm text-gray-500">
                    <div className="mb-1 max-w-xs">{item.description}</div>
                    {item.management_info && (
                      <div className="text-xs text-gray-500 mt-1">
                        {item.management_info.warefunktion ? <div>Warenfunktion: {item.management_info.warefunktion}</div> : null}
                        {item.management_info.auftrag ? <div>Auftrag: {item.management_info.auftrag}</div> : null}
                        {item.management_info.projekt ? <div>Projekt: {item.management_info.projekt}</div> : null}
                        {item.management_info.system ? <div>System: {item.management_info.system}</div> : null}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{item.unit}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {parseFloat(item.list_price).toFixed(2)} €
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {parseFloat(item.discount_percent).toFixed(2)} %
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {parseFloat(item.final_price).toFixed(2)} €
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {(parseFloat(item.final_price) * parseFloat(item.quantity)).toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan="9" className="px-3 py-3 text-right text-sm font-medium text-gray-900">
                  Gesamtsumme:
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                  {order.total_amount ? parseFloat(order.total_amount).toFixed(2) : '0.00'} €
                </td>
              </tr>
              {order.confirmed_total && (
                <tr>
                  <td colSpan="9" className="px-3 py-3 text-right text-sm font-medium text-green-700">
                    Bestätigter Bestellpreis:
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-green-800">
                    {parseFloat(order.confirmed_total).toFixed(2)} €
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notizen</h2>
          <div className="text-sm text-gray-900 whitespace-pre-wrap">{order.notes}</div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
