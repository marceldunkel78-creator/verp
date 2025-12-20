import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, EyeIcon, PencilIcon, TrashIcon, DocumentArrowDownIcon, DocumentIcon } from '@heroicons/react/24/outline';

const Quotations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, draft, active, expired, ordered
  
  const canWrite = user?.is_staff || user?.is_superuser;
  
  useEffect(() => {
    fetchQuotations();
  }, [filter]);
  
  const fetchQuotations = async () => {
    try {
      setLoading(true);
      let url = '/sales/quotations/';
      
      // Filter anwenden
      if (filter !== 'all') {
        const statusMap = {
          draft: 'DRAFT',
          active: 'ACTIVE',
          expired: 'EXPIRED',
          ordered: 'ORDERED'
        };
        url += `?status=${statusMap[filter]}`;
      }
      
      const response = await api.get(url);
      const data = response.data;
      
      // Stelle sicher, dass quotations immer ein Array ist
      let quotationsData = [];
      if (Array.isArray(data)) {
        quotationsData = data;
      } else if (data && Array.isArray(data.results)) {
        quotationsData = data.results;
      } else if (data && typeof data === 'object') {
        quotationsData = [];
        console.warn('Unerwartetes Datenformat:', data);
      }
      
      setQuotations(quotationsData);
    } catch (error) {
      console.error('Fehler beim Laden der Angebote:', error);
      alert('Fehler beim Laden der Angebote');
      setQuotations([]); // Setze leeres Array im Fehlerfall
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (id) => {
    if (window.confirm('Möchten Sie dieses Angebot wirklich löschen?')) {
      try {
        await api.delete(`/sales/quotations/${id}/`);
        fetchQuotations();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen des Angebots');
      }
    }
  };
  
  const handleDownloadPDF = async (quotationId, quotationNumber) => {
    try {
      const response = await api.get(`/sales/quotations/${quotationId}/download_pdf/`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Angebot_${quotationNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fehler beim PDF-Download:', error);
      alert('Fehler beim Herunterladen des PDFs');
    }
  };
  
  const handleViewPDF = async (quotationId) => {
    try {
      const response = await api.get(`/sales/quotations/${quotationId}/download_pdf/`, {
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
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusDisplay}
      </span>
    );
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Lade Angebote...</div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <nav className="text-sm text-gray-500 mb-2">
            <Link to="/sales" className="hover:text-gray-700">Sales & Order Management</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Angebote</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">Angebote</h1>
          <p className="text-sm text-gray-600">Kundenangebote verwalten und generieren</p>
        </div>
        {canWrite && (
          <button
            onClick={() => navigate('/sales/quotations/new')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neues Angebot
          </button>
        )}
      </div>
      
      {/* Filter Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: 'Alle' },
            { key: 'draft', label: 'In Arbeit' },
            { key: 'active', label: 'Aktiv' },
            { key: 'expired', label: 'Abgelaufen' },
            { key: 'ordered', label: 'Bestellt' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`${
                filter === tab.key
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Tabelle */}
      <div className="bg-white shadow overflow-x-auto rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Angebotsnr.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kunde
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Datum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gültig bis
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Referenz
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Positionen
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gesamtsumme
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotations.map((quotation) => (
              <tr key={quotation.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                  {quotation.quotation_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="font-medium">{quotation.customer_name}</div>
                  <div className="text-gray-500 text-xs">{quotation.customer_number}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(quotation.date).toLocaleDateString('de-DE')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(quotation.valid_until).toLocaleDateString('de-DE')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {quotation.reference || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {quotation.items_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  € {quotation.total_amount?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(quotation.status, quotation.status_display)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleViewPDF(quotation.id)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                    title="PDF anzeigen"
                  >
                    <DocumentIcon className="h-5 w-5 inline" />
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(quotation.id, quotation.quotation_number)}
                    className="text-green-600 hover:text-green-900 mr-3"
                    title="PDF herunterladen"
                  >
                    <DocumentArrowDownIcon className="h-5 w-5 inline" />
                  </button>
                  <Link
                    to={`/sales/quotations/${quotation.id}`}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                    title="Details anzeigen"
                  >
                    <EyeIcon className="h-5 w-5 inline" />
                  </Link>
                  {canWrite && (
                    <>
                      <button
                        onClick={() => navigate(`/sales/quotations/${quotation.id}/edit`)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="Bearbeiten"
                      >
                        <PencilIcon className="h-5 w-5 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(quotation.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Löschen"
                      >
                        <TrashIcon className="h-5 w-5 inline" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {quotations.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow mt-4">
          <p className="text-gray-500">Keine Angebote gefunden</p>
        </div>
      )}
    </div>
  );
};

export default Quotations;
