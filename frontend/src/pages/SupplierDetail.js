import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const SupplierDetail = () => {
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSupplier = useCallback(async () => {
    try {
      const response = await api.get(`/suppliers/suppliers/${id}/`);
      setSupplier(response.data);
    } catch (error) {
      console.error('Fehler beim Laden des Lieferanten:', error);
      console.error('Error details:', error.response?.data);
      console.error('Status code:', error.response?.status);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSupplier();
  }, [fetchSupplier]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Lieferant nicht gefunden</p>
        <Link to="/suppliers" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const getContactTypeLabel = (type) => {
    const labels = {
      service: 'Service',
      sales: 'Vertrieb',
      orders: 'Bestellungen',
      order_processing: 'Auftragsabwicklung',
    };
    return labels[type] || type;
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/suppliers"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zur Übersicht
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{supplier.company_name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hauptinformationen */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Lieferanteninformationen
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Firmenname</dt>
                  <dd className="mt-1 text-sm text-gray-900">{supplier.company_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        supplier.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {supplier.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </dd>
                </div>
                {supplier.email && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">E-Mail</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:text-blue-800">
                        {supplier.email}
                      </a>
                    </dd>
                  </div>
                )}
                {supplier.phone && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Telefon</dt>
                    <dd className="mt-1 text-sm text-gray-900">{supplier.phone}</dd>
                  </div>
                )}
                {(supplier.street || supplier.city || supplier.address) && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Adresse</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {supplier.street && (
                        <div>{supplier.street} {supplier.house_number}</div>
                      )}
                      {supplier.address_supplement && (
                        <div>{supplier.address_supplement}</div>
                      )}
                      {supplier.postal_code && supplier.city && (
                        <div>{supplier.postal_code} {supplier.city}</div>
                      )}
                      {supplier.state && (
                        <div>{supplier.state}</div>
                      )}
                      {supplier.country && supplier.country !== 'DE' && (
                        <div>{supplier.country}</div>
                      )}
                      {supplier.address && !supplier.street && (
                        <div className="whitespace-pre-line">{supplier.address}</div>
                      )}
                    </dd>
                  </div>
                )}
                {supplier.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Notizen</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                      {supplier.notes}
                    </dd>
                  </div>
                )}
                {supplier.customer_number && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Unsere Kundennummer</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono">
                      {supplier.customer_number}
                    </dd>
                  </div>
                )}
                {supplier.payment_term_detail && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Zahlungsbedingung</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <span className="font-medium">{supplier.payment_term_detail.name}</span>
                      <br />
                      <span className="text-gray-600">{supplier.payment_term_detail.formatted_terms}</span>
                    </dd>
                  </div>
                )}
                {supplier.delivery_term_detail && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Lieferbedingung (Incoterm)</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {supplier.delivery_term_detail.incoterm_display}
                      {supplier.delivery_term_detail.description && (
                        <div className="text-xs text-gray-600 mt-1">{supplier.delivery_term_detail.description}</div>
                      )}
                    </dd>
                  </div>
                )}
                {supplier.delivery_instruction_detail && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Lieferanweisung</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <div className="font-medium mb-1">{supplier.delivery_instruction_detail.name}</div>
                      <div className="text-xs text-gray-600 whitespace-pre-line bg-gray-50 p-2 rounded">
                        {supplier.delivery_instruction_detail.instruction_text}
                      </div>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Erstellt am</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(supplier.created_at).toLocaleDateString('de-DE')}
                  </dd>
                </div>
                {supplier.created_by_name && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Erstellt von</dt>
                    <dd className="mt-1 text-sm text-gray-900">{supplier.created_by_name}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* Sidebar mit Statistiken */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow overflow-hidden rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Statistiken</h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Kontakte</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">
                    {supplier.contacts?.length || 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Verknüpfte Produkte</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">
                    {supplier.supplier_products?.length || 0}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Kontakte */}
        {supplier.contacts && supplier.contacts.length > 0 && (
          <div className="lg:col-span-3">
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Kontakte</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {supplier.contacts.map((contact) => (
                    <div key={contact.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getContactTypeLabel(contact.contact_type)}
                        </span>
                      </div>
                      {contact.contact_person && (
                        <h4 className="font-medium text-gray-900">{contact.contact_person}</h4>
                      )}
                      {contact.contact_function && (
                        <p className="text-sm text-gray-500 mb-2">{contact.contact_function}</p>
                      )}
                      {contact.email && (
                        <p className="text-sm text-gray-700">
                          <a href={`mailto:${contact.email}`} className="text-blue-600 hover:text-blue-800">
                            {contact.email}
                          </a>
                        </p>
                      )}
                      {contact.phone && (
                        <p className="text-sm text-gray-700">{contact.phone}</p>
                      )}
                      {(contact.street || contact.city || contact.address) && (
                        <div className="text-sm text-gray-700 mt-2">
                          {contact.street && (
                            <div>{contact.street} {contact.house_number}</div>
                          )}
                          {contact.address_supplement && (
                            <div>{contact.address_supplement}</div>
                          )}
                          {contact.postal_code && contact.city && (
                            <div>{contact.postal_code} {contact.city}</div>
                          )}
                          {contact.state && (
                            <div>{contact.state}</div>
                          )}
                          {contact.country && contact.country !== 'DE' && (
                            <div>{contact.country}</div>
                          )}
                          {contact.address && !contact.street && (
                            <div className="whitespace-pre-line">{contact.address}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warengruppen */}
        {supplier.product_groups && supplier.product_groups.length > 0 && (
          <div className="lg:col-span-3">
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Warengruppen</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rabatt
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Beschreibung
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {supplier.product_groups.map((group) => (
                      <tr key={group.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {group.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {group.discount_percent}%
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {group.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              group.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {group.is_active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Verknüpfte Produkte */}
        {supplier.supplier_products && supplier.supplier_products.length > 0 && (
          <div className="lg:col-span-3">
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Verknüpfte Produkte
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produktname
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Artikelnummer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lieferanten-Art.-Nr.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Einkaufspreis
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lieferzeit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {supplier.supplier_products.map((sp) => (
                      <tr key={sp.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {sp.product_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sp.product_article_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sp.supplier_article_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sp.purchase_price ? `${sp.purchase_price} ${sp.currency}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sp.delivery_time_days ? `${sp.delivery_time_days} Tage` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierDetail;
