import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function CustomerLoanEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const isNew = id === 'new' || (location && location.pathname && location.pathname.endsWith('/new'));

    const canWrite = user?.is_superuser || user?.can_write_inventory || user?.can_write_inventory_customer_loans;

    const [activeTab, setActiveTab] = useState('basic');
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [inventorySearch, setInventorySearch] = useState('');
    const [inventoryResults, setInventoryResults] = useState([]);
    const [showInventoryDropdown, setShowInventoryDropdown] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [pdfLanguage, setPdfLanguage] = useState('de');
    const [leihungSearch, setLeihungSearch] = useState('');
    const [leihungResults, setLeihungResults] = useState([]);
    const [showLeihungDropdown, setShowLeihungDropdown] = useState(false);
    const [selectedLeihung, setSelectedLeihung] = useState(null);

    const [loan, setLoan] = useState({
        customer: '',
        status: 'offen',
        loan_date: new Date().toISOString().split('T')[0],
        return_deadline: '',
        delivery_address_name: '',
        delivery_address_street: '',
        delivery_address_house_number: '',
        delivery_address_postal_code: '',
        delivery_address_city: '',
        delivery_address_country: 'Deutschland',
        standard_clause: 'Schäden und Verlust an der Leihware gehen zu Ihren Lasten. Verlängerung der Leihung nur nach Absprache.',
        notes: '',
        items: [],
        responsible_employee: '',
        pdf_url: null,
    });

    const [newItem, setNewItem] = useState({
        product_name: '',
        article_number: '',
        quantity: 1,
        unit: 'Stück',
        serial_number: '',
        notes: ''
    });

    useEffect(() => {
        loadEmployees();
        if (id && id !== 'new') {
            loadLoan();
        }
    }, [id, location?.pathname]);

    const loadLoan = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/customer-loans/customer-loans/${id}/`);
            setLoan(response.data);
            if (response.data.customer_name) {
                setCustomerSearch(response.data.customer_name);
            }
        } catch (error) {
            console.error('Error loading customer loan:', error);
        }
        setLoading(false);
    };

    const loadEmployees = async () => {
        try {
            const response = await api.get('/users/employees/?is_active=true&page_size=500');
            const data = response.data && (response.data.results || response.data);
            setEmployees(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    };

    // Customer search
    useEffect(() => {
        if (customerSearch.length >= 2) {
            const timer = setTimeout(async () => {
                try {
                    const response = await api.get(`/customers/customers/?search=${encodeURIComponent(customerSearch)}&page_size=20`);
                    const data = response.data && (response.data.results || response.data);
                    setFilteredCustomers(Array.isArray(data) ? data : []);
                    setShowCustomerDropdown(true);
                } catch (error) {
                    console.error('Error searching customers:', error);
                }
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setFilteredCustomers([]);
            setShowCustomerDropdown(false);
        }
    }, [customerSearch]);

    // Inventory search
    useEffect(() => {
        if (inventorySearch.length >= 2) {
            const timer = setTimeout(async () => {
                try {
                    const response = await api.get(`/inventory/inventory-items/?search=${encodeURIComponent(inventorySearch)}&status=FREI&page_size=20`);
                    const data = response.data && (response.data.results || response.data);
                    setInventoryResults(Array.isArray(data) ? data : []);
                    setShowInventoryDropdown(true);
                } catch (error) {
                    console.error('Error searching inventory:', error);
                }
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setInventoryResults([]);
            setShowInventoryDropdown(false);
        }
    }, [inventorySearch]);

    // Leihung (procurement loan) search
    useEffect(() => {
        if (leihungSearch.length >= 2) {
            const timer = setTimeout(async () => {
                try {
                    const response = await api.get(`/customer-loans/customer-loans/procurement_loans/?search=${encodeURIComponent(leihungSearch)}`);
                    const data = Array.isArray(response.data) ? response.data : [];
                    setLeihungResults(data);
                    setShowLeihungDropdown(true);
                } catch (error) {
                    console.error('Error searching procurement loans:', error);
                }
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setLeihungResults([]);
            setShowLeihungDropdown(false);
            setSelectedLeihung(null);
        }
    }, [leihungSearch]);

    const selectLeihung = (leihung) => {
        setSelectedLeihung(leihung);
        setShowLeihungDropdown(false);
        setLeihungSearch(leihung.loan_number + ' - ' + leihung.supplier_name);
    };

    const importLeihungItems = () => {
        if (!selectedLeihung || !selectedLeihung.items.length) return;
        const newItems = selectedLeihung.items.map((item, idx) => ({
            product_name: item.product_name,
            article_number: item.article_number || '',
            quantity: item.quantity,
            unit: item.unit,
            serial_number: item.serial_number || '',
            notes: item.notes || '',
            position: loan.items.length + idx + 1,
        }));
        setLoan(prev => ({
            ...prev,
            items: [...prev.items, ...newItems]
        }));
        setSelectedLeihung(null);
        setLeihungSearch('');
        showSuccess(`${newItems.length} Position(en) aus ${selectedLeihung.loan_number} übernommen`);
    };

    const selectCustomer = async (customer) => {
        setCustomerSearch(customer.full_name || `${customer.title || ''} ${customer.first_name} ${customer.last_name}`.trim());
        setShowCustomerDropdown(false);
        setLoan(prev => ({
            ...prev,
            customer: customer.id,
            delivery_address_name: customer.full_name || `${customer.title || ''} ${customer.first_name} ${customer.last_name}`.trim(),
        }));
        // Fetch detail to get address
        try {
            const response = await api.get(`/customers/customers/${customer.id}/`);
            const detail = response.data;
            const addr = detail.addresses && detail.addresses.length > 0
                ? detail.addresses.find(a => a.is_active) || detail.addresses[0]
                : null;
            if (addr) {
                setLoan(prev => ({
                    ...prev,
                    delivery_address_street: addr.street || '',
                    delivery_address_house_number: addr.house_number || '',
                    delivery_address_postal_code: addr.postal_code || '',
                    delivery_address_city: addr.city || '',
                    delivery_address_country: addr.country || 'Deutschland',
                }));
            }
        } catch (error) {
            console.error('Error fetching customer detail:', error);
        }
    };

    const addItemFromInventory = (invItem) => {
        const newLoanItem = {
            product_name: invItem.name,
            article_number: invItem.article_number || invItem.visitron_part_number || '',
            quantity: 1,
            unit: invItem.unit || 'Stück',
            serial_number: invItem.serial_number || '',
            notes: '',
            inventory_item: invItem.id,
        };
        setLoan(prev => ({
            ...prev,
            items: [...prev.items, { ...newLoanItem, position: prev.items.length + 1 }]
        }));
        setInventorySearch('');
        setShowInventoryDropdown(false);
    };

    const addManualItem = () => {
        if (!newItem.product_name) return;
        setLoan(prev => ({
            ...prev,
            items: [...prev.items, { ...newItem, position: prev.items.length + 1 }]
        }));
        setNewItem({
            product_name: '',
            article_number: '',
            quantity: 1,
            unit: 'Stück',
            serial_number: '',
            notes: ''
        });
    };

    const removeItem = (index) => {
        setLoan(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i + 1 }))
        }));
    };

    const updateItem = (index, field, value) => {
        setLoan(prev => ({
            ...prev,
            items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
        }));
    };

    const handleSave = async () => {
        if (!loan.customer) {
            alert('Bitte wählen Sie einen Kunden aus.');
            return;
        }
        if (!loan.loan_date) {
            alert('Bitte geben Sie ein Verleihdatum an.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                customer: loan.customer,
                status: loan.status,
                loan_date: loan.loan_date,
                return_deadline: loan.return_deadline || null,
                delivery_address_name: loan.delivery_address_name,
                delivery_address_street: loan.delivery_address_street,
                delivery_address_house_number: loan.delivery_address_house_number,
                delivery_address_postal_code: loan.delivery_address_postal_code,
                delivery_address_city: loan.delivery_address_city,
                delivery_address_country: loan.delivery_address_country,
                standard_clause: loan.standard_clause,
                notes: loan.notes,
                responsible_employee: loan.responsible_employee || null,
                items: loan.items.map((item, idx) => ({
                    ...(item.id ? { id: item.id } : {}),
                    position: idx + 1,
                    product_name: item.product_name,
                    article_number: item.article_number || '',
                    quantity: item.quantity,
                    unit: item.unit,
                    serial_number: item.serial_number || '',
                    notes: item.notes || '',
                    inventory_item: item.inventory_item || null,
                    is_returned: item.is_returned || false,
                    is_returned_complete: item.is_returned_complete || false,
                    is_returned_intact: item.is_returned_intact || false,
                    is_purchased: item.is_purchased || false,
                    return_date: item.return_date || null,
                    return_notes: item.return_notes || '',
                }))
            };

            let response;
            if (isNew) {
                response = await api.post('/customer-loans/customer-loans/', payload);
                navigate(`/inventory/customer-loans/${response.data.id}`, { replace: true });
            } else {
                response = await api.put(`/customer-loans/customer-loans/${id}/`, payload);
                setLoan(response.data);
            }
            showSuccess('Verleihung gespeichert');
        } catch (error) {
            console.error('Error saving:', error);
            alert('Fehler beim Speichern: ' + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
        }
        setSaving(false);
    };

    const handleGeneratePdf = async () => {
        setGeneratingPdf(true);
        try {
            const response = await api.post(`/customer-loans/customer-loans/${id}/generate_pdf/`, {
                language: pdfLanguage
            });
            setLoan(response.data);
            showSuccess('Leihlieferschein erstellt');
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Fehler bei PDF-Erstellung');
        }
        setGeneratingPdf(false);
    };

    const handleUpdateItemReturn = async (itemId, updates) => {
        try {
            await api.post(`/customer-loans/customer-loans/${id}/update_item_return/`, {
                item_id: itemId,
                ...updates
            });
            await loadLoan();
            showSuccess('Rückgabe aktualisiert');
        } catch (error) {
            console.error('Error updating item return:', error);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Verleihung wirklich löschen?')) return;
        try {
            await api.delete(`/customer-loans/customer-loans/${id}/`);
            navigate('/inventory/customer-loans');
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Fehler beim Löschen');
        }
    };

    const showSuccess = (msg) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const tabs = [
        { id: 'basic', label: 'Grunddaten' },
        { id: 'items', label: `Positionen (${loan.items?.length || 0})` },
        { id: 'returns', label: 'Rückgabe / Kauf' },
        { id: 'pdf', label: 'Leihlieferschein' },
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800">
                        {isNew ? 'Neue Verleihung' : `Verleihung ${loan.loan_number || ''}`}
                    </h1>
                    {!isNew && loan.status && (
                        <span className={`mt-1 inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            loan.status === 'offen' ? 'bg-yellow-100 text-yellow-800' :
                            loan.status === 'verliehen' ? 'bg-blue-100 text-blue-800' :
                            loan.status === 'teilrueckgabe' ? 'bg-orange-100 text-orange-800' :
                            'bg-green-100 text-green-800'
                        }`}>
                            {loan.status_display || loan.status}
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/inventory/customer-loans')}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Zurück
                    </button>
                    {canWrite && !isNew && (
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                        >
                            Löschen
                        </button>
                    )}
                    {canWrite && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? 'Speichern...' : 'Speichern'}
                        </button>
                    )}
                </div>
            </div>

            {/* Success message */}
            {successMessage && (
                <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg">
                    {successMessage}
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex gap-4">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab: Basic Data */}
            {activeTab === 'basic' && (
                <div className="bg-white rounded-lg shadow p-6 space-y-6">
                    {/* Customer selection */}
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kunde *</label>
                        <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => { setCustomerSearch(e.target.value); if (e.target.value === '') setLoan(prev => ({ ...prev, customer: '' })); }}
                            placeholder="Kunde suchen..."
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            disabled={!canWrite}
                        />
                        {showCustomerDropdown && filteredCustomers.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {filteredCustomers.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => selectCustomer(c)}
                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
                                    >
                                        <div className="font-medium">{c.full_name || `${c.title || ''} ${c.first_name} ${c.last_name}`.trim()}</div>
                                        <div className="text-xs text-gray-500">
                                            {[c.customer_number, c.primary_address_city, c.primary_address_country].filter(Boolean).join(', ')}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={loan.status}
                                onChange={(e) => setLoan(prev => ({ ...prev, status: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-lg"
                                disabled={!canWrite}
                            >
                                <option value="offen">Offen</option>
                                <option value="verliehen">Verliehen</option>
                                <option value="teilrueckgabe">Teilrückgabe</option>
                                <option value="abgeschlossen">Abgeschlossen</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Verleihdatum *</label>
                            <input
                                type="date"
                                value={loan.loan_date}
                                onChange={(e) => setLoan(prev => ({ ...prev, loan_date: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-lg"
                                disabled={!canWrite}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rückgabefrist</label>
                            <input
                                type="date"
                                value={loan.return_deadline || ''}
                                onChange={(e) => setLoan(prev => ({ ...prev, return_deadline: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-lg"
                                disabled={!canWrite}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Zuständiger Mitarbeiter</label>
                        <select
                            value={loan.responsible_employee || ''}
                            onChange={(e) => setLoan(prev => ({ ...prev, responsible_employee: e.target.value || null }))}
                            className="w-full px-3 py-2 border rounded-lg"
                            disabled={!canWrite}
                        >
                            <option value="">-- Nicht zugewiesen --</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.full_name || `${emp.first_name} ${emp.last_name}`}</option>
                            ))}
                        </select>
                    </div>

                    {/* Delivery Address */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-3">Lieferadresse</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Empfänger</label>
                                <input
                                    type="text"
                                    value={loan.delivery_address_name}
                                    onChange={(e) => setLoan(prev => ({ ...prev, delivery_address_name: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    disabled={!canWrite}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                                <input
                                    type="text"
                                    value={loan.delivery_address_street}
                                    onChange={(e) => setLoan(prev => ({ ...prev, delivery_address_street: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    disabled={!canWrite}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hausnummer</label>
                                <input
                                    type="text"
                                    value={loan.delivery_address_house_number}
                                    onChange={(e) => setLoan(prev => ({ ...prev, delivery_address_house_number: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    disabled={!canWrite}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                                <input
                                    type="text"
                                    value={loan.delivery_address_postal_code}
                                    onChange={(e) => setLoan(prev => ({ ...prev, delivery_address_postal_code: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    disabled={!canWrite}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                                <input
                                    type="text"
                                    value={loan.delivery_address_city}
                                    onChange={(e) => setLoan(prev => ({ ...prev, delivery_address_city: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    disabled={!canWrite}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
                                <input
                                    type="text"
                                    value={loan.delivery_address_country}
                                    onChange={(e) => setLoan(prev => ({ ...prev, delivery_address_country: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    disabled={!canWrite}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Standard Clause */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Standardklausel (für Leihlieferschein)</label>
                        <textarea
                            value={loan.standard_clause}
                            onChange={(e) => setLoan(prev => ({ ...prev, standard_clause: e.target.value }))}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                            disabled={!canWrite}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                        <textarea
                            value={loan.notes}
                            onChange={(e) => setLoan(prev => ({ ...prev, notes: e.target.value }))}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                            disabled={!canWrite}
                        />
                    </div>
                </div>
            )}

            {/* Tab: Items */}
            {activeTab === 'items' && (
                <div className="bg-white rounded-lg shadow p-6 space-y-6">
                    {/* Inventory search */}
                    {canWrite && (
                        <div>
                            <h3 className="text-lg font-medium text-gray-800 mb-3">Artikel aus Warenlager hinzufügen</h3>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={inventorySearch}
                                    onChange={(e) => setInventorySearch(e.target.value)}
                                    placeholder="Lagerartikel suchen (Name, Artikelnr., Seriennr.)..."
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                {showInventoryDropdown && inventoryResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {inventoryResults.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => addItemFromInventory(item)}
                                                className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
                                            >
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {item.inventory_number} | Art.-Nr.: {item.article_number || '-'} | S/N: {item.serial_number || '-'} | Status: {item.status}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Manual item add */}
                    {canWrite && (
                        <div>
                            <h3 className="text-lg font-medium text-gray-800 mb-3">Positionen aus Leihung (Procurement) übernehmen</h3>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={leihungSearch}
                                    onChange={(e) => { setLeihungSearch(e.target.value); setSelectedLeihung(null); }}
                                    placeholder="Leihung suchen (Leihnummer, Lieferant)..."
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                {showLeihungDropdown && leihungResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {leihungResults.map(l => (
                                            <button
                                                key={l.id}
                                                onClick={() => selectLeihung(l)}
                                                className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
                                            >
                                                <div className="font-medium">{l.loan_number} - {l.supplier_name}</div>
                                                <div className="text-xs text-gray-500">
                                                    Status: {l.status} | {l.items.length} Position(en)
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedLeihung && (
                                <div className="mt-3 border rounded-lg p-3 bg-gray-50">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-medium text-sm">{selectedLeihung.loan_number} - {selectedLeihung.supplier_name} ({selectedLeihung.items.length} Positionen)</span>
                                        <button
                                            onClick={importLeihungItems}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                        >
                                            Alle Positionen übernehmen
                                        </button>
                                    </div>
                                    <div className="text-xs text-gray-500 space-y-1">
                                        {selectedLeihung.items.map((item, i) => (
                                            <div key={i}>{item.position}. {item.product_name} {item.article_number ? `(${item.article_number})` : ''} - {item.quantity} {item.unit}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Manual item add */}
                    {canWrite && (
                        <div>
                            <h3 className="text-lg font-medium text-gray-800 mb-3">Manuell hinzufügen</h3>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                                <div className="md:col-span-2">
                                    <label className="block text-xs text-gray-500">Produktname *</label>
                                    <input
                                        type="text"
                                        value={newItem.product_name}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, product_name: e.target.value }))}
                                        className="w-full px-2 py-1.5 border rounded text-sm"
                                        placeholder="Produktname"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500">Art.-Nr.</label>
                                    <input
                                        type="text"
                                        value={newItem.article_number}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, article_number: e.target.value }))}
                                        className="w-full px-2 py-1.5 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500">Menge</label>
                                    <input
                                        type="number"
                                        value={newItem.quantity}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                                        className="w-full px-2 py-1.5 border rounded text-sm"
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500">S/N</label>
                                    <input
                                        type="text"
                                        value={newItem.serial_number}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, serial_number: e.target.value }))}
                                        className="w-full px-2 py-1.5 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <button
                                        onClick={addManualItem}
                                        disabled={!newItem.product_name}
                                        className="w-full px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                                    >
                                        Hinzufügen
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Items list */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-3">Positionen</h3>
                        {loan.items.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">Keine Positionen vorhanden</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Pos.</th>
                                            <th className="px-3 py-2 text-left">Produktname</th>
                                            <th className="px-3 py-2 text-left">Art.-Nr.</th>
                                            <th className="px-3 py-2 text-right">Menge</th>
                                            <th className="px-3 py-2 text-left">Einheit</th>
                                            <th className="px-3 py-2 text-left">S/N</th>
                                            <th className="px-3 py-2 text-left">Notizen</th>
                                            {canWrite && <th className="px-3 py-2"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {loan.items.map((item, index) => (
                                            <tr key={item.id || index} className="hover:bg-gray-50">
                                                <td className="px-3 py-2">{index + 1}</td>
                                                <td className="px-3 py-2">
                                                    {canWrite ? (
                                                        <input
                                                            type="text"
                                                            value={item.product_name}
                                                            onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                                                            className="w-full px-2 py-1 border rounded text-sm"
                                                        />
                                                    ) : item.product_name}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {canWrite ? (
                                                        <input
                                                            type="text"
                                                            value={item.article_number || ''}
                                                            onChange={(e) => updateItem(index, 'article_number', e.target.value)}
                                                            className="w-full px-2 py-1 border rounded text-sm"
                                                        />
                                                    ) : (item.article_number || '-')}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {canWrite ? (
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                                                            className="w-20 px-2 py-1 border rounded text-sm text-right"
                                                            min="1"
                                                        />
                                                    ) : item.quantity}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {canWrite ? (
                                                        <input
                                                            type="text"
                                                            value={item.unit}
                                                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                            className="w-20 px-2 py-1 border rounded text-sm"
                                                        />
                                                    ) : item.unit}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {canWrite ? (
                                                        <input
                                                            type="text"
                                                            value={item.serial_number || ''}
                                                            onChange={(e) => updateItem(index, 'serial_number', e.target.value)}
                                                            className="w-full px-2 py-1 border rounded text-sm"
                                                        />
                                                    ) : (item.serial_number || '-')}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {canWrite ? (
                                                        <input
                                                            type="text"
                                                            value={item.notes || ''}
                                                            onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                                            className="w-full px-2 py-1 border rounded text-sm"
                                                        />
                                                    ) : (item.notes || '-')}
                                                </td>
                                                {canWrite && (
                                                    <td className="px-3 py-2">
                                                        <button
                                                            onClick={() => removeItem(index)}
                                                            className="text-red-500 hover:text-red-700"
                                                            title="Entfernen"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab: Returns */}
            {activeTab === 'returns' && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">Rückgabe & Kauf pro Position</h3>
                    {loan.items.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">Keine Positionen vorhanden</div>
                    ) : (
                        <div className="space-y-4">
                            {loan.items.map((item, index) => (
                                <div key={item.id || index} className={`border rounded-lg p-4 ${
                                    item.is_returned ? 'bg-green-50 border-green-200' :
                                    item.is_purchased ? 'bg-blue-50 border-blue-200' :
                                    'bg-white border-gray-200'
                                }`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <span className="font-medium">Pos. {index + 1}: {item.product_name}</span>
                                            {item.serial_number && <span className="ml-2 text-sm text-gray-500">S/N: {item.serial_number}</span>}
                                            <span className="ml-2 text-sm text-gray-500">Menge: {item.quantity} {item.unit}</span>
                                        </div>
                                        {item.is_returned && <span className="px-2 py-1 bg-green-200 text-green-800 text-xs rounded-full">Zurückgegeben</span>}
                                        {item.is_purchased && <span className="px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded-full">Gekauft</span>}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={item.is_returned || false}
                                                onChange={(e) => {
                                                    if (!isNew && item.id) {
                                                        handleUpdateItemReturn(item.id, { is_returned: e.target.checked });
                                                    } else {
                                                        updateItem(index, 'is_returned', e.target.checked);
                                                    }
                                                }}
                                                className="rounded border-gray-300"
                                                disabled={!canWrite}
                                            />
                                            Zurückgegeben
                                        </label>

                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={item.is_returned_complete || false}
                                                onChange={(e) => {
                                                    if (!isNew && item.id) {
                                                        handleUpdateItemReturn(item.id, { is_returned_complete: e.target.checked });
                                                    } else {
                                                        updateItem(index, 'is_returned_complete', e.target.checked);
                                                    }
                                                }}
                                                className="rounded border-gray-300"
                                                disabled={!canWrite}
                                            />
                                            Vollständig
                                        </label>

                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={item.is_returned_intact || false}
                                                onChange={(e) => {
                                                    if (!isNew && item.id) {
                                                        handleUpdateItemReturn(item.id, { is_returned_intact: e.target.checked });
                                                    } else {
                                                        updateItem(index, 'is_returned_intact', e.target.checked);
                                                    }
                                                }}
                                                className="rounded border-gray-300"
                                                disabled={!canWrite}
                                            />
                                            Intakt
                                        </label>

                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={item.is_purchased || false}
                                                onChange={(e) => {
                                                    if (!isNew && item.id) {
                                                        handleUpdateItemReturn(item.id, { is_purchased: e.target.checked });
                                                    } else {
                                                        updateItem(index, 'is_purchased', e.target.checked);
                                                    }
                                                }}
                                                className="rounded border-gray-300"
                                                disabled={!canWrite}
                                            />
                                            Vom Kunden gekauft
                                        </label>

                                        <div>
                                            <input
                                                type="date"
                                                value={item.return_date || ''}
                                                onChange={(e) => {
                                                    if (!isNew && item.id) {
                                                        handleUpdateItemReturn(item.id, { return_date: e.target.value || null });
                                                    } else {
                                                        updateItem(index, 'return_date', e.target.value);
                                                    }
                                                }}
                                                className="w-full px-2 py-1 border rounded text-sm"
                                                disabled={!canWrite}
                                                placeholder="Rückgabedatum"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        <input
                                            type="text"
                                            value={item.return_notes || ''}
                                            onChange={(e) => {
                                                if (!isNew && item.id) {
                                                    // debounce for notes - save on blur
                                                    updateItem(index, 'return_notes', e.target.value);
                                                } else {
                                                    updateItem(index, 'return_notes', e.target.value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                if (!isNew && item.id) {
                                                    handleUpdateItemReturn(item.id, { return_notes: e.target.value });
                                                }
                                            }}
                                            placeholder="Rückgabe-Notizen..."
                                            className="w-full px-2 py-1 border rounded text-sm"
                                            disabled={!canWrite}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab: PDF */}
            {activeTab === 'pdf' && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">Leihlieferschein (PDF)</h3>

                    {isNew ? (
                        <div className="text-center py-8 text-gray-400">
                            Bitte speichern Sie die Verleihung zuerst, um einen Leihlieferschein zu erstellen.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sprache / Language</label>
                                    <select
                                        value={pdfLanguage}
                                        onChange={(e) => setPdfLanguage(e.target.value)}
                                        className="px-3 py-2 border rounded-lg"
                                    >
                                        <option value="de">Deutsch</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>
                                {canWrite && (
                                    <button
                                        onClick={handleGeneratePdf}
                                        disabled={generatingPdf}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {generatingPdf ? 'Erstelle PDF...' : loan.pdf_url ? 'PDF neu erstellen' : 'Leihlieferschein erstellen'}
                                    </button>
                                )}
                                {loan.pdf_url && (
                                    <a
                                        href={loan.pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        PDF herunterladen
                                    </a>
                                )}
                            </div>

                            {loan.pdf_url && (
                                <div className="border rounded-lg overflow-hidden" style={{ height: '700px' }}>
                                    <iframe
                                        src={loan.pdf_url}
                                        title="Leihlieferschein"
                                        className="w-full h-full"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default CustomerLoanEdit;
