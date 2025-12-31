import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TicketIcon
} from '@heroicons/react/24/outline';

// Status mapping
const STATUS_LABELS = {
  'new': { label: 'Neu', color: 'bg-blue-100 text-blue-800' },
  'assigned': { label: 'Zugewiesen', color: 'bg-yellow-100 text-yellow-800' },
  'waiting_customer': { label: 'Warten Kunde', color: 'bg-orange-100 text-orange-800' },
  'waiting_thirdparty': { label: 'Warten Third-Party', color: 'bg-purple-100 text-purple-800' },
  'no_solution': { label: 'Keine Lösung', color: 'bg-red-100 text-red-800' },
  'resolved': { label: 'Gelöst', color: 'bg-green-100 text-green-800' }
};

const BILLING_LABELS = {
  'invoice': { label: 'Rechnung', color: 'bg-gray-100 text-gray-800' },
  'warranty': { label: 'Garantie', color: 'bg-green-100 text-green-800' },
  'maintenance': { label: 'Maintenance', color: 'bg-blue-100 text-blue-800' }
};

const ServiceTickets = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('open'); // 'all', 'open', 'closed'
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', '15');
      if (searchTerm) params.append('search', searchTerm);
      
      // Filter für offene/geschlossene Tickets
      if (statusFilter === 'open') {
        params.append('is_open', 'true');
      } else if (statusFilter === 'closed') {
        params.append('is_open', 'false');
      }
      
      const response = await api.get(`/service/tickets/?${params.toString()}`);
      setTickets(response.data.results || response.data);
      if (response.data.count !== undefined) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 15));
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTickets();
  };

  const handleNewTicket = () => {
    navigate('/service/tickets/new');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusInfo = STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getBillingBadge = (billing) => {
    if (!billing) return <span className="text-gray-400 text-sm">-</span>;
    const billingInfo = BILLING_LABELS[billing] || { label: billing, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${billingInfo.color}`}>
        {billingInfo.label}
      </span>
    );
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <TicketIcon className="h-8 w-8 mr-3 text-blue-600" />
            Service-Tickets
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Serviceanfragen von Kunden und Dealern verwalten
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={handleNewTicket}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neues Ticket
          </button>
        </div>
      </div>

      {/* Filter und Suche */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suche nach Ticket-Nr., Thema..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </form>
        
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="block rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="open">Offene Tickets</option>
            <option value="closed">Geschlossene Tickets</option>
            <option value="all">Alle Tickets</option>
          </select>
          
          <button
            onClick={fetchTickets}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabelle */}
      <div className="mt-6 bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ticket-Nr.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thema
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kunde/Dealer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Abrechnung
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Zugewiesen an
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Zuletzt aktualisiert
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center">
                  <div className="flex justify-center">
                    <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">
                  Keine Tickets gefunden
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => navigate(`/service/tickets/${ticket.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {ticket.ticket_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {ticket.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ticket.customer_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(ticket.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getBillingBadge(ticket.billing)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ticket.assigned_to_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(ticket.updated_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Zeige {((currentPage - 1) * 15) + 1} - {Math.min(currentPage * 15, totalCount)} von {totalCount} Tickets
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-700">
              Seite {currentPage} von {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceTickets;
