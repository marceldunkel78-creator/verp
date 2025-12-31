import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

function Loans() {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        loadLoans();
    }, [search, statusFilter]);

    const loadLoans = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);
            
            const response = await api.get(`/loans/loans/?${params.toString()}`);
            // API may return paginated results: { count, next, previous, results }
            setLoans(response.data.results || response.data);
        } catch (error) {
            console.error('Error loading loans:', error);
        }
        setLoading(false);
    };

    const getStatusBadge = (status) => {
        const badges = {
            'angefragt': 'bg-yellow-100 text-yellow-800',
            'entliehen': 'bg-blue-100 text-blue-800',
            'abgeschlossen': 'bg-green-100 text-green-800'
        };
        const labels = {
            'angefragt': 'Angefragt',
            'entliehen': 'Entliehen',
            'abgeschlossen': 'Abgeschlossen'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
                {labels[status] || status}
            </span>
        );
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('de-DE');
    };

    const isOverdue = (deadline, status) => {
        if (status === 'abgeschlossen' || !deadline) return false;
        return new Date(deadline) < new Date();
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800">Leihungen</h1>
                    <p className="text-gray-500">Verwaltung von Leihgeräten und -materialien</p>
                </div>
                <Link
                    to="/procurement/loans/new"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Neue Leihung
                </Link>
            </div>

            {/* Filter */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Suchen (Nummer, Lieferant, Artikel...)"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="w-48">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Alle Status</option>
                            <option value="angefragt">Angefragt</option>
                            <option value="entliehen">Entliehen</option>
                            <option value="abgeschlossen">Abgeschlossen</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Leihnummer
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Lieferant
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Anfragedatum
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rückgabefrist
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Positionen
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Aktionen
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    </div>
                                </td>
                            </tr>
                        ) : loans.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                    Keine Leihungen gefunden
                                </td>
                            </tr>
                        ) : (
                            loans.map((loan) => (
                                <tr 
                                    key={loan.id} 
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => navigate(`/procurement/loans/${loan.id}`)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="font-medium text-blue-600">{loan.loan_number}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {loan.supplier_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(loan.status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                        {formatDate(loan.request_date)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={isOverdue(loan.return_deadline, loan.status) ? 'text-red-600 font-medium' : 'text-gray-500'}>
                                            {formatDate(loan.return_deadline)}
                                            {isOverdue(loan.return_deadline, loan.status) && (
                                                <span className="ml-2 text-xs">⚠️ Überfällig</span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                        {loan.items_count}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/procurement/loans/${loan.id}`);
                                            }}
                                            className="text-blue-600 hover:text-blue-900"
                                        >
                                            Bearbeiten
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Loans;
