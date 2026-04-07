import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function CustomerLoans() {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();

    const canWrite = user?.is_superuser || user?.can_write_inventory || user?.can_write_inventory_customer_loans;

    useEffect(() => {
        loadLoans();
    }, [search, statusFilter]);

    const loadLoans = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);

            const response = await api.get(`/customer-loans/customer-loans/?${params.toString()}`);
            setLoans(response.data.results || response.data);
        } catch (error) {
            console.error('Error loading customer loans:', error);
        }
        setLoading(false);
    };

    const getStatusBadge = (status) => {
        const badges = {
            'offen': 'bg-yellow-100 text-yellow-800',
            'verliehen': 'bg-blue-100 text-blue-800',
            'teilrueckgabe': 'bg-orange-100 text-orange-800',
            'abgeschlossen': 'bg-green-100 text-green-800'
        };
        const labels = {
            'offen': 'Offen',
            'verliehen': 'Verliehen',
            'teilrueckgabe': 'Teilrückgabe',
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800">Verleihungen</h1>
                    <p className="text-gray-500">Verwaltung von Leihwaren an Kunden</p>
                </div>
                {canWrite && (
                    <Link
                        to="/inventory/customer-loans/new"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Neue Verleihung
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex gap-4 flex-wrap">
                    <input
                        type="text"
                        placeholder="Suchen (Nummer, Kunde, Artikel...)"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-48 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Alle Status</option>
                        <option value="offen">Offen</option>
                        <option value="verliehen">Verliehen</option>
                        <option value="teilrueckgabe">Teilrückgabe</option>
                        <option value="abgeschlossen">Abgeschlossen</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Verleihnummer</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Kunde</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Verleihdatum</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rückgabefrist</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Positionen</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Zuständig</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                </td>
                            </tr>
                        ) : loans.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                    Keine Verleihungen gefunden
                                </td>
                            </tr>
                        ) : (
                            loans.map((loan) => (
                                <tr
                                    key={loan.id}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => navigate(`/inventory/customer-loans/${loan.id}`)}
                                >
                                    <td className="px-6 py-4 font-medium text-blue-600">
                                        {loan.loan_number}
                                    </td>
                                    <td className="px-6 py-4">{loan.customer_name}</td>
                                    <td className="px-6 py-4">{getStatusBadge(loan.status)}</td>
                                    <td className="px-6 py-4 text-gray-500">{formatDate(loan.loan_date)}</td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {formatDate(loan.return_deadline)}
                                        {isOverdue(loan.return_deadline, loan.status) && (
                                            <span className="ml-2 text-xs text-red-600 font-semibold">Überfällig</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">{loan.items_count}</td>
                                    <td className="px-6 py-4 text-gray-500">{loan.responsible_employee_display || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default CustomerLoans;
