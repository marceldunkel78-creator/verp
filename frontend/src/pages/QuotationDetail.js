import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';/* eslint-disable react-hooks/exhaustive-deps */import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeftIcon, 
  PencilIcon, 
  TrashIcon, 
  DocumentArrowDownIcon,
  DocumentIcon 
} from '@heroicons/react/24/outline';

const QuotationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);

  const canWrite = user?.is_staff || user?.is_superuser;

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const fetchQuotation = async () => {
    try {
      const response = await api.get(`/sales/quotations/${id}/`);
      setQuotation(response.data);
    } catch (error) {
      console.error('Fehler beim Laden des Angebots:', error);
      alert('Fehler beim Laden des Angebots');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Möchten Sie dieses Angebot wirklich löschen?')) {
      try {
        await api.delete(`/sales/quotations/${id}/`);
        alert('Angebot gelöscht');
        navigate('/sales/quotations');
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen des Angebots');
      }
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/sales/quotations/${id}/download_pdf/`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Angebot_${quotation.quotation_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fehler beim PDF-Download:', error);
      alert('Fehler beim Herunterladen des PDFs');
    }
  };

  const handleViewPDF = async () => {
    try {
      const response = await api.get(`/sales/quotations/${id}/download_pdf/`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Fehler beim PDF-Anzeigen:', error);
      alert('Fehler beim Anzeigen des PDFs');
    }
  };

  const getStatusBadge = (status, statusDisplay) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-red-100 text-red-800',
      ORDERED: 'bg-blue-100 text-blue-800'
    };
    
    return (
      <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusDisplay}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Lade Angebot...</div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Angebot nicht gefunden</p>
        <Link to="/sales/quotations" className="text-green-600 hover:text-green-700 mt-4 inline-block">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/sales/quotations"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zur Übersicht
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Angebot {quotation.quotation_number}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Erstellt am {new Date(quotation.created_at).toLocaleDateString('de-DE')}
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleViewPDF}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <DocumentIcon className="h-5 w-5 mr-2" />
              PDF anzeigen
            </button>
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              PDF herunterladen
            </button>
            {canWrite && (
              <>
                <button
                  onClick={() => navigate(`/sales/quotations/${id}/edit`)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <PencilIcon className="h-5 w-5 mr-2" />
                  Bearbeiten
                </button>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  <TrashIcon className="h-5 w-5 mr-2" />
                  Löschen
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Angebotsinformationen */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Angebotsinformationen</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Angebotsnummer</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{quotation.quotation_number}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">{getStatusBadge(quotation.status, quotation.status_display)}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Kunde</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <div className="font-medium">{quotation.customer_name}</div>
                <div className="text-gray-500">{quotation.customer_number}</div>
              </dd>
            </div>
            
            {quotation.created_by_name && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Ersteller</dt>
                <dd className="mt-1 text-sm text-gray-900">{quotation.created_by_name}</dd>
              </div>
            )}
            
            {quotation.commission_user_name && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Provisionsempfänger</dt>
                <dd className="mt-1 text-sm text-gray-900">{quotation.commission_user_name}</dd>
              </div>
            )}
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Sprache</dt>
              <dd className="mt-1 text-sm text-gray-900">{quotation.language_display}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Angebotsdatum</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(quotation.date).toLocaleDateString('de-DE')}
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Gültig bis</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(quotation.valid_until).toLocaleDateString('de-DE')}
              </dd>
            </div>
            
            {quotation.reference && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Referenz</dt>
                <dd className="mt-1 text-sm text-gray-900">{quotation.reference}</dd>
              </div>
            )}
            
            {quotation.delivery_time_weeks > 0 && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Lieferzeit</dt>
                <dd className="mt-1 text-sm text-gray-900">{quotation.delivery_time_weeks} Wochen</dd>
              </div>
            )}
            
            {quotation.project_reference && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Projekt-Referenz (intern)</dt>
                <dd className="mt-1 text-sm text-gray-900">{quotation.project_reference}</dd>
              </div>
            )}
            
            {quotation.system_reference && (
              <div>
                <dt className="text-sm font-medium text-gray-500">System-Referenz (intern)</dt>
                <dd className="mt-1 text-sm text-gray-900">{quotation.system_reference}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Empfängeradresse */}
      {(quotation.recipient_company || quotation.recipient_name || quotation.recipient_street) && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Empfängeradresse</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="text-sm text-gray-900">
              {quotation.recipient_company && <div className="font-medium">{quotation.recipient_company}</div>}
              {quotation.recipient_name && <div>{quotation.recipient_name}</div>}
              {quotation.recipient_street && <div>{quotation.recipient_street}</div>}
              {(quotation.recipient_postal_code || quotation.recipient_city) && (
                <div>{quotation.recipient_postal_code} {quotation.recipient_city}</div>
              )}
              {quotation.recipient_country && quotation.recipient_country !== 'DE' && (
                <div>{quotation.recipient_country}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Konditionen */}
      {(quotation.payment_term_display || quotation.delivery_term_display) && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Konditionen</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              {quotation.payment_term_display && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Zahlungsbedingung</dt>
                  <dd className="mt-1 text-sm text-gray-900">{quotation.payment_term_display}</dd>
                </div>
              )}
              
              {quotation.delivery_term_display && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Lieferbedingung</dt>
                  <dd className="mt-1 text-sm text-gray-900">{quotation.delivery_term_display}</dd>
                </div>
              )}
            </dl>
            
            {!quotation.show_terms_conditions && (
              <div className="mt-4 text-sm text-gray-500">
                AGB-Hinweis wird nicht im Angebot angezeigt
              </div>
            )}
          </div>
        </div>
      )}

      {/* Angebotspositionen */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Angebotspositionen</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pos.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artikel-Nr.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artikel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beschreibung</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Menge</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Einzelpreis</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rabatt</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MwSt</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gesamt</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quotation.items && quotation.items.length > 0 ? (
                quotation.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.is_group_header || !item.group_id ? item.position : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {item.item_article_number || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">
                        {item.item_name}
                      </div>
                      <div className="text-xs text-gray-500">{item.item_type}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="max-w-xs truncate">{item.item_description}</div>
                      <div className="text-xs text-gray-400">{item.description_type === 'SHORT' ? 'Kurzbeschreibung' : 'Langbeschreibung'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {parseFloat(item.quantity).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {(item.is_group_header && !item.uses_system_price) || (!item.is_group_header && (!item.group_id || quotation.show_group_item_prices)) ? 
                        `€ ${parseFloat(item.unit_price).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                        '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {(item.is_group_header && !item.uses_system_price) || (!item.is_group_header && (!item.group_id || quotation.show_group_item_prices)) ? 
                        `${parseFloat(item.discount_percent).toFixed(1)}%` : 
                        '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {(item.is_group_header && !item.uses_system_price) || (!item.is_group_header && (!item.group_id || quotation.show_group_item_prices)) ? 
                        `€ ${parseFloat(item.tax_amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                        '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {(item.is_group_header && !item.uses_system_price) || (!item.is_group_header && (!item.group_id || quotation.show_group_item_prices)) ? 
                        `€ ${parseFloat(item.total).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                        '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-4 text-center text-sm text-gray-500">
                    Keine Positionen vorhanden
                  </td>
                </tr>
              )}
            </tbody>
            {quotation.items && quotation.items.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-right text-sm font-medium text-gray-700">
                    Nettosumme:
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    € {parseFloat(quotation.total_net).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-right text-sm font-medium text-gray-700">
                    MwSt:
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    € {parseFloat(quotation.total_tax).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-right text-base font-bold text-gray-900">
                    Gesamtsumme:
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-gray-900 text-right">
                    € {parseFloat(quotation.total_gross).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Notizen */}
      {quotation.notes && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Zusätzliche Informationen</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-2">Interne Notizen</dt>
              <dd className="text-sm text-gray-900 whitespace-pre-wrap">{quotation.notes}</dd>
            </div>
          </div>
        </div>
      )}

      {/* Metadaten */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Metadaten</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Erstellt am</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(quotation.created_at).toLocaleString('de-DE')}
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Zuletzt aktualisiert</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(quotation.updated_at).toLocaleString('de-DE')}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default QuotationDetail;
