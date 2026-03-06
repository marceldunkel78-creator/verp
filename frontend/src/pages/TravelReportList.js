import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SortableHeader from '../components/SortableHeader';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MapPinIcon,
  CalendarIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

const TravelReportList = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // all, travel, service
  const [filterUser, setFilterUser] = useState(''); // created_by user id
  const [users, setUsers] = useState([]);
  const [sortBy, setSortBy] = useState('-date');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [filterType, filterUser, sortBy]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/?is_active=true');
      setUsers(response.data.results || response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Benutzer:', error);
    }
  };

  const fetchReports = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') {
        params.append('report_type', filterType);
      }
      if (filterUser) {
        params.append('created_by', filterUser);
      }
      if (sortBy) {
        params.append('ordering', sortBy);
      }
      const response = await api.get(`/service/travel-reports/?${params.toString()}`);
      setReports(response.data.results || response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Reiseberichte:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Reisebericht wirklich löschen?')) {
      try {
        await api.delete(`/service/travel-reports/${id}/`);
        fetchReports();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen des Reiseberichts');
      }
    }
  };

  const viewPdf = async (reportId) => {
    try {
      const response = await api.get(`/service/travel-reports/${reportId}/serve_pdf/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (error) {
      console.error('Fehler beim Laden des PDFs:', error);
      alert('Fehler beim Laden des PDFs');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Reiseberichte</h1>
          <p className="mt-2 text-sm text-gray-700">
            Übersicht aller Reise- und Serviceberichte
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => navigate('/sales/travel-reports/new')}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neuer Bericht
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-6 flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filterType === 'all'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Alle
        </button>
        <button
          onClick={() => setFilterType('travel')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filterType === 'travel'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Reiseberichte
        </button>
        <button
          onClick={() => setFilterType('service')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filterType === 'service'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Serviceberichte
        </button>
        <div className="ml-4">
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Alle Benutzer</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name || user.username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <SortableHeader field="report_type" label="Typ" sortBy={sortBy} setSortBy={setSortBy} className="py-3.5 pl-4 pr-3 sm:pl-6" />
                    <SortableHeader field="date" label="Datum" sortBy={sortBy} setSortBy={setSortBy} className="px-3 py-3.5" />
                    <SortableHeader field="location" label="Ort" sortBy={sortBy} setSortBy={setSortBy} className="px-3 py-3.5" />
                    <SortableHeader field="customer__company_name" label="Kunde" sortBy={sortBy} setSortBy={setSortBy} className="px-3 py-3.5" />
                    <SortableHeader field="linked_system__system_name" label="System" sortBy={sortBy} setSortBy={setSortBy} className="px-3 py-3.5" />
                    <SortableHeader field="created_by__first_name" label="Erstellt von" sortBy={sortBy} setSortBy={setSortBy} className="px-3 py-3.5" />
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Fotos
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      PDF
                    </th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Aktionen</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-3 py-8 text-center text-sm text-gray-500">
                        Keine Berichte gefunden
                      </td>
                    </tr>
                  ) : (
                    reports.map((report) => (
                      <tr 
                        key={report.id}
                        onClick={() => navigate(`/sales/travel-reports/${report.id}`)}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            report.report_type === 'travel'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {report.report_type_display}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <CalendarIcon className="h-4 w-4 mr-1 text-gray-400" />
                            {formatDate(report.date)}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          <div className="flex items-center">
                            <MapPinIcon className="h-4 w-4 mr-1 text-gray-400" />
                            {report.location}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {report.customer_name || '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {report.system_name || '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {report.created_by_name || '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {report.photo_count > 0 ? (
                            <span className="flex items-center text-blue-600">
                              <DocumentTextIcon className="h-4 w-4 mr-1" />
                              {report.photo_count}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {report.has_pdf ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewPdf(report.id);
                              }}
                              className="text-green-600 hover:text-green-800"
                              title="PDF anzeigen"
                            >
                              <DocumentArrowDownIcon className="h-5 w-5" />
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/sales/travel-reports/${report.id}`);
                            }}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(report.id);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TravelReportList;
