import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../utils/api';

function LoanEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    // Detect 'new' route either via param (/:id with 'new') or explicit /new path
    const isNew = id === 'new' || (location && location.pathname && location.pathname.endsWith('/new'));
    
    const [activeTab, setActiveTab] = useState('basic');
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [employees, setEmployees] = useState([]);
    
    const [loan, setLoan] = useState({
        supplier: '',
        status: 'angefragt',
        request_date: new Date().toISOString().split('T')[0],
        return_deadline: '',
        return_address_name: '',
        return_address_street: '',
        return_address_house_number: '',
        return_address_postal_code: '',
        return_address_city: '',
        return_address_country: 'Deutschland',
        supplier_reference: '',
        notes: '',
        items: [],
        receipt: null,
        returns: [],
        responsible_employee: '',
        observers: []
    });
    
    const [newItem, setNewItem] = useState({
        product_name: '',
        supplier_article_number: '',
        quantity: 1,
        unit: 'Stk',
        serial_number: '',
        notes: ''
    });
    
    // Return form state
    const [returnForm, setReturnForm] = useState({
        return_date: new Date().toISOString().split('T')[0],
        shipping_carrier: '',
        tracking_number: '',
        notes: '',
        items: []
    });
    const [updatingReceipt, setUpdatingReceipt] = useState({});

    useEffect(() => {
        loadSuppliers();
        loadEmployees();
        // Only load loan when a valid id is present and it's not the 'new' route
        if (id && id !== 'new') {
            loadLoan();
        }
    }, [id, location?.pathname]);

    const loadSuppliers = async () => {
        try {
            // use the suppliers list endpoint (paginated) and normalize to array
            const response = await api.get('/suppliers/suppliers/?is_active=true&page_size=500');
            const data = response.data && (response.data.results || response.data);
            setSuppliers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
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

    const loadLoan = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/loans/loans/${id}/`);
            setLoan(response.data);
            
            // Initialize return form items
            if (response.data.items) {
                setReturnForm(prev => ({
                    ...prev,
                    items: response.data.items.map(item => ({
                        loan_item_id: item.id,
                        product_name: item.product_name,
                        quantity_available: item.quantity,
                        quantity_returned: 0,
                        selected: false,
                        condition_notes: ''
                    }))
                }));
            }
        } catch (error) {
            console.error('Error loading loan:', error);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // prepare payload: ensure numeric quantities and don't send empty date strings
            const payload = { ...loan };
            if (!payload.return_deadline) {
                // remove empty string so backend treats it as omitted/null
                delete payload.return_deadline;
            }
            // normalize and sanitize items: ensure numeric quantities and remove nested/read-only fields
            if (Array.isArray(payload.items)) {
                payload.items = payload.items.map(it => {
                    const sanitized = {
                        id: it.id,
                        position: it.position || undefined,
                        product_name: it.product_name,
                        supplier_article_number: it.supplier_article_number,
                        quantity: it.quantity === '' || it.quantity === null ? 0 : parseFloat(it.quantity),
                        unit: it.unit,
                        serial_number: it.serial_number,
                        notes: it.notes
                    };
                    // remove undefined keys
                    Object.keys(sanitized).forEach(k => sanitized[k] === undefined && delete sanitized[k]);
                    return sanitized;
                });
            }

            if (isNew) {
                const response = await api.post('/loans/loans/', payload);
                navigate(`/procurement/loans/${response.data.id}`);
            } else {
                const response = await api.put(`/loans/loans/${id}/`, payload);
                // Use the response directly instead of reloading - it now contains full data with receipts
                setLoan(response.data);
                // Update return form items if needed
                if (response.data.items) {
                    setReturnForm(prev => ({
                        ...prev,
                        items: response.data.items.map(item => ({
                            loan_item_id: item.id,
                            product_name: item.product_name,
                            quantity_available: item.quantity,
                            quantity_returned: 0,
                            selected: false,
                            condition_notes: ''
                        }))
                    }));
                }
            }
        } catch (error) {
            console.error('Error saving loan:', error);
            alert('Fehler beim Speichern');
        }
        setSaving(false);
    };

    const handleAddItem = () => {
        if (!newItem.product_name) {
            alert('Bitte Produktname angeben');
            return;
        }
        setLoan(prev => ({
            ...prev,
            items: [...prev.items, { ...newItem, position: prev.items.length + 1 }]
        }));
        setNewItem({
            product_name: '',
            supplier_article_number: '',
            quantity: 1,
            unit: 'Stk',
            serial_number: '',
            notes: ''
        });
    };

    const handleRemoveItem = (index) => {
        setLoan(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleSupplierChange = (supplierId) => {
        const supplier = Array.isArray(suppliers) ? suppliers.find(s => s.id === parseInt(supplierId)) : null;
        setLoan(prev => ({
            ...prev,
            supplier: supplierId,
            return_address_name: supplier?.company_name || '',
            return_address_street: supplier?.street || '',
            return_address_house_number: supplier?.house_number || '',
            return_address_postal_code: supplier?.postal_code || '',
            return_address_city: supplier?.city || '',
            return_address_country: supplier?.country || 'Deutschland'
        }));
    };

    // Receipt functions
    const handleCreateReceipt = async () => {
        try {
            await api.post(`/loans/loans/${id}/create_receipt/`, {
                receipt_date: new Date().toISOString().split('T')[0],
                notes: ''
            });
            loadLoan();
        } catch (error) {
            console.error('Error creating receipt:', error);
            alert('Fehler beim Erstellen des Wareneingangs');
        }
    };

    const handleUpdateItemReceipt = async (itemId, isComplete, isIntact, notes) => {
        // Optimistic local update
        setLoan(prev => {
            const items = (prev.items || []).map(it => {
                if (it.id === itemId) {
                    const newReceipt = {
                        ...(it.receipt || {}),
                        is_complete: isComplete,
                        is_intact: isIntact,
                        notes: notes
                    };
                    return { ...it, receipt: newReceipt };
                }
                return it;
            });
            return { ...prev, items };
        });

        // mark updating
        setUpdatingReceipt(prev => ({ ...prev, [itemId]: true }));

        try {
            const resp = await api.post(`/loans/loans/${id}/update_item_receipt/`, {
                item_id: itemId,
                is_complete: isComplete,
                is_intact: isIntact,
                notes: notes
            });

            // update item receipt from response (authoritative)
            const updated = resp.data;
            setLoan(prev => {
                const items = (prev.items || []).map(it => {
                    if (it.id === updated.loan_item) {
                        return { ...it, receipt: updated };
                    }
                    return it;
                });
                return { ...prev, items };
            });
        } catch (error) {
            console.error('Error updating item receipt:', error);
            // revert by reloading loan data
            loadLoan();
        } finally {
            setUpdatingReceipt(prev => {
                const copy = { ...prev };
                delete copy[itemId];
                return copy;
            });
        }
    };

    const handleUploadPhoto = async (itemId, file) => {
        try {
            const formData = new FormData();
            formData.append('item_id', itemId);
            formData.append('photo', file);
            formData.append('description', '');
            
            await api.post(`/loans/loans/${id}/upload_photo/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            loadLoan();
        } catch (error) {
            console.error('Error uploading photo:', error);
        }
    };

    const handleUploadReceiptDocument = async (documentType, file) => {
        try {
            const formData = new FormData();
            formData.append('document_type', documentType);
            formData.append('file', file);
            
            await api.post(`/loans/loans/${id}/upload_receipt_document/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            loadLoan();
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Fehler beim Hochladen des Dokuments');
        }
    };

    // Return functions
    const handleCreateReturn = async () => {
        const selectedItems = returnForm.items.filter(item => item.selected && item.quantity_returned > 0);
        
        if (selectedItems.length === 0) {
            alert('Bitte mindestens eine Position zur Rücksendung auswählen');
            return;
        }
        
        try {
            await api.post(`/loans/loans/${id}/create_return/`, {
                return_date: returnForm.return_date,
                shipping_carrier: returnForm.shipping_carrier,
                tracking_number: returnForm.tracking_number,
                notes: returnForm.notes,
                items: selectedItems.map(item => ({
                    loan_item_id: item.loan_item_id,
                    quantity_returned: item.quantity_returned,
                    condition_notes: item.condition_notes
                }))
            });
            loadLoan();
            setReturnForm(prev => ({
                ...prev,
                shipping_carrier: '',
                tracking_number: '',
                notes: ''
            }));
        } catch (error) {
            console.error('Error creating return:', error);
            alert('Fehler beim Erstellen der Rücksendung');
        }
    };

    const handleDownloadPdf = async (returnId) => {
        try {
            const response = await api.get(`/loans/loan-returns/${returnId}/download_pdf/`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Ruecklieferschein.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading PDF:', error);
        }
    };

    const tabs = [
        { id: 'basic', label: 'Basisinfos', icon: '📋' },
        { id: 'receipt', label: 'Wareneingang', icon: '📦', disabled: isNew },
        { id: 'return', label: 'Rücksendung', icon: '↩️', disabled: isNew || loan.status === 'angefragt' }
    ];

    if (loading) {
        return (
            <div className="p-6 flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800">
                        {isNew ? 'Neue Leihung' : `Leihung ${loan.loan_number}`}
                    </h1>
                    {!isNew && (
                        <p className="text-gray-500">
                            {(Array.isArray(suppliers) && suppliers.find(s => s.id === loan.supplier)?.company_name) || 'Lieferant'}
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/procurement/loans')}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                        Zurück
                    </button>
                    {!isNew && (
                        <button
                            onClick={async () => {
                                if (!window.confirm('Leihung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
                                try {
                                    await api.delete(`/loans/loans/${id}/`);
                                    navigate('/procurement/loans');
                                } catch (err) {
                                    console.error('Error deleting loan:', err);
                                    alert('Fehler beim Löschen der Leihung');
                                }
                            }}
                            className="px-4 py-2 border rounded-lg hover:bg-red-50 text-red-600"
                        >
                            Löschen
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                        {saving ? 'Speichern...' : 'Speichern'}
                    </button>
                </div>
            </div>

            {/* Status Badge */}
            {!isNew && (
                <div className="mb-6">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        loan.status === 'angefragt' ? 'bg-yellow-100 text-yellow-800' :
                        loan.status === 'entliehen' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                    }`}>
                        {loan.status === 'angefragt' ? 'Angefragt' :
                         loan.status === 'entliehen' ? 'Entliehen' : 'Abgeschlossen'}
                    </span>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow">
                <div className="border-b">
                    <nav className="flex">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                                disabled={tab.disabled}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-blue-600 text-blue-600'
                                        : tab.disabled
                                            ? 'border-transparent text-gray-300 cursor-not-allowed'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <span className="mr-2">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {/* Tab 1: Basisinfos */}
                    {activeTab === 'basic' && (
                        <div className="space-y-6">
                            {/* Supplier & Dates */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Lieferant *
                                    </label>
                                    <select
                                        value={loan.supplier}
                                        onChange={(e) => handleSupplierChange(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">-- Lieferant wählen --</option>
                                        {Array.isArray(suppliers) && suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.company_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Anfragedatum
                                    </label>
                                    <input
                                        type="date"
                                        value={loan.request_date}
                                        onChange={(e) => setLoan(prev => ({ ...prev, request_date: e.target.value }))}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Rückgabefrist
                                    </label>
                                    <input
                                        type="date"
                                        value={loan.return_deadline}
                                        onChange={(e) => setLoan(prev => ({ ...prev, return_deadline: e.target.value }))}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Lieferanten-Referenz
                                    </label>
                                    <input
                                        type="text"
                                        value={loan.supplier_reference}
                                        onChange={(e) => setLoan(prev => ({ ...prev, supplier_reference: e.target.value }))}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="z.B. Bestellnummer des Lieferanten"
                                    />
                                </div>
                                {!isNew && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Status
                                        </label>
                                        <select
                                            value={loan.status}
                                            onChange={(e) => setLoan(prev => ({ ...prev, status: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="angefragt">Angefragt</option>
                                            <option value="entliehen">Entliehen</option>
                                            <option value="abgeschlossen">Abgeschlossen</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Zuständiger Mitarbeiter */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Zuständiger Mitarbeiter
                                    </label>
                                    <select
                                        value={loan.responsible_employee || ''}
                                        onChange={(e) => setLoan(prev => ({ ...prev, responsible_employee: e.target.value ? parseInt(e.target.value) : null }))}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- Mitarbeiter wählen --</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.first_name} {emp.last_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Return Address */}
                            <div>
                                <h3 className="text-lg font-medium text-gray-800 mb-3">Rücksendeadresse</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Name / Firma
                                        </label>
                                        <input
                                            type="text"
                                            value={loan.return_address_name}
                                            onChange={(e) => setLoan(prev => ({ ...prev, return_address_name: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Straße
                                        </label>
                                        <input
                                            type="text"
                                            value={loan.return_address_street}
                                            onChange={(e) => setLoan(prev => ({ ...prev, return_address_street: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Hausnummer
                                        </label>
                                        <input
                                            type="text"
                                            value={loan.return_address_house_number}
                                            onChange={(e) => setLoan(prev => ({ ...prev, return_address_house_number: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            PLZ
                                        </label>
                                        <input
                                            type="text"
                                            value={loan.return_address_postal_code}
                                            onChange={(e) => setLoan(prev => ({ ...prev, return_address_postal_code: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Stadt
                                        </label>
                                        <input
                                            type="text"
                                            value={loan.return_address_city}
                                            onChange={(e) => setLoan(prev => ({ ...prev, return_address_city: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Land
                                        </label>
                                        <input
                                            type="text"
                                            value={loan.return_address_country}
                                            onChange={(e) => setLoan(prev => ({ ...prev, return_address_country: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h3 className="text-lg font-medium text-gray-800 mb-3">Leihpositionen</h3>
                                
                                {/* Add Item Form */}
                                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                        <div className="md:col-span-2">
                                            <input
                                                type="text"
                                                placeholder="Produktname *"
                                                value={newItem.product_name}
                                                onChange={(e) => setNewItem(prev => ({ ...prev, product_name: e.target.value }))}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Art.-Nr."
                                                value={newItem.supplier_article_number}
                                                onChange={(e) => setNewItem(prev => ({ ...prev, supplier_article_number: e.target.value }))}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                placeholder="Menge"
                                                value={newItem.quantity}
                                                onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                min="1"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Seriennr."
                                                value={newItem.serial_number}
                                                onChange={(e) => setNewItem(prev => ({ ...prev, serial_number: e.target.value }))}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <button
                                                type="button"
                                                onClick={handleAddItem}
                                                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                                            >
                                                + Hinzufügen
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Items Table */}
                                {loan.items && loan.items.length > 0 && (
                                    <table className="w-full border rounded-lg overflow-hidden">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Pos.</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Art.-Nr.</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Produkt</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Menge</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">S/N</th>
                                                <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Aktion</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loan.items.map((item, idx) => (
                                                <tr key={item.id || idx} className="border-t">
                                                    <td className="px-4 py-2">{idx + 1}</td>
                                                    <td className="px-4 py-2">{item.supplier_article_number || '-'}</td>
                                                    <td className="px-4 py-2">{item.product_name}</td>
                                                    <td className="px-4 py-2">{item.quantity} {item.unit}</td>
                                                    <td className="px-4 py-2">{item.serial_number || '-'}</td>
                                                    <td className="px-4 py-2 text-right">
                                                        <button
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="text-red-600 hover:text-red-800"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Beobachter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Beobachter (werden bei Änderungen benachrichtigt)
                                </label>
                                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                                    {employees.map(emp => {
                                        const isSelected = Array.isArray(loan.observers) && loan.observers.includes(emp.id);
                                        return (
                                            <label key={emp.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        setLoan(prev => {
                                                            const currentObservers = Array.isArray(prev.observers) ? prev.observers : [];
                                                            if (e.target.checked) {
                                                                return { ...prev, observers: [...currentObservers, emp.id] };
                                                            } else {
                                                                return { ...prev, observers: currentObservers.filter(id => id !== emp.id) };
                                                            }
                                                        });
                                                    }}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">{emp.first_name} {emp.last_name}</span>
                                            </label>
                                        );
                                    })}
                                    {employees.length === 0 && (
                                        <p className="text-sm text-gray-500 italic">Keine Mitarbeiter verfügbar</p>
                                    )}
                                </div>
                                {Array.isArray(loan.observers) && loan.observers.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {loan.observers.length} Beobachter ausgewählt
                                    </p>
                                )}
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Bemerkungen
                                </label>
                                <textarea
                                    value={loan.notes}
                                    onChange={(e) => setLoan(prev => ({ ...prev, notes: e.target.value }))}
                                    rows={3}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Wareneingang */}
                    {activeTab === 'receipt' && (
                        <div className="space-y-6">
                            {!loan.receipt ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 mb-4">Wareneingang noch nicht erfasst</p>
                                    <button
                                        onClick={handleCreateReceipt}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                                    >
                                        📦 Wareneingang jetzt erfassen
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <p className="text-green-800">
                                            <strong>✓ Wareneingang erfasst:</strong> {new Date(loan.receipt.receipt_date).toLocaleDateString('de-DE')}
                                        </p>
                                    </div>

                                    {/* Document Uploads */}
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h3 className="text-lg font-medium text-gray-800 mb-4">Dokumente</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* Lieferschein */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Lieferschein
                                                </label>
                                                {loan.receipt?.delivery_note_url ? (
                                                    <div className="flex items-center gap-2">
                                                        <a 
                                                            href={loan.receipt.delivery_note_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline flex items-center gap-1"
                                                        >
                                                            📄 Lieferschein anzeigen
                                                        </a>
                                                        <label className="text-sm text-gray-500 hover:text-blue-600 cursor-pointer">
                                                            (ersetzen)
                                                            <input
                                                                type="file"
                                                                accept=".pdf,image/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    if (e.target.files[0]) {
                                                                        handleUploadReceiptDocument('delivery_note', e.target.files[0]);
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                ) : (
                                                    <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50">
                                                        <input
                                                            type="file"
                                                            accept=".pdf,image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                if (e.target.files[0]) {
                                                                    handleUploadReceiptDocument('delivery_note', e.target.files[0]);
                                                                }
                                                            }}
                                                        />
                                                        <span className="text-gray-500">📤 Lieferschein hochladen</span>
                                                    </label>
                                                )}
                                            </div>

                                            {/* Leihvereinbarung */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Leihvereinbarung
                                                </label>
                                                {loan.receipt?.loan_agreement_url ? (
                                                    <div className="flex items-center gap-2">
                                                        <a 
                                                            href={loan.receipt.loan_agreement_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline flex items-center gap-1"
                                                        >
                                                            📄 Leihvereinbarung anzeigen
                                                        </a>
                                                        <label className="text-sm text-gray-500 hover:text-blue-600 cursor-pointer">
                                                            (ersetzen)
                                                            <input
                                                                type="file"
                                                                accept=".pdf,image/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    if (e.target.files[0]) {
                                                                        handleUploadReceiptDocument('loan_agreement', e.target.files[0]);
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                ) : (
                                                    <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50">
                                                        <input
                                                            type="file"
                                                            accept=".pdf,image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                if (e.target.files[0]) {
                                                                    handleUploadReceiptDocument('loan_agreement', e.target.files[0]);
                                                                }
                                                            }}
                                                        />
                                                        <span className="text-gray-500">📤 Leihvereinbarung hochladen</span>
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-medium text-gray-800">Vollständigkeits- und Zustandsprüfung</h3>
                                    
                                    <div className="space-y-4">
                                        {loan.items.map((item, idx) => (
                                            <div key={item.id} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h4 className="font-medium">{idx + 1}. {item.product_name}</h4>
                                                        {item.supplier_article_number && (
                                                            <p className="text-sm text-gray-500">Art.-Nr.: {item.supplier_article_number}</p>
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-gray-500">{item.quantity} {item.unit}</span>
                                                </div>
                                                
                                                <div className="flex gap-6 mb-3">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.receipt?.is_complete || false}
                                                            onChange={(e) => handleUpdateItemReceipt(
                                                                item.id,
                                                                e.target.checked,
                                                                item.receipt?.is_intact || false,
                                                                item.receipt?.notes || ''
                                                            )}
                                                            disabled={!!updatingReceipt[item.id]}
                                                            aria-busy={!!updatingReceipt[item.id]}
                                                            className="h-4 w-4 text-blue-600 rounded"
                                                        />
                                                        <span className="text-sm">Vollständig</span>
                                                    </label>
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.receipt?.is_intact || false}
                                                            onChange={(e) => handleUpdateItemReceipt(
                                                                item.id,
                                                                item.receipt?.is_complete || false,
                                                                e.target.checked,
                                                                item.receipt?.notes || ''
                                                            )}
                                                            disabled={!!updatingReceipt[item.id]}
                                                            aria-busy={!!updatingReceipt[item.id]}
                                                            className="h-4 w-4 text-blue-600 rounded"
                                                        />
                                                        <span className="text-sm">Unbeschädigt</span>
                                                    </label>
                                                </div>

                                                {/* Photos */}
                                                <div className="border-t pt-3">
                                                    <p className="text-sm text-gray-600 mb-2">Fotos:</p>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {item.photos?.map(photo => (
                                                            <a 
                                                                key={photo.id} 
                                                                href={photo.photo_url || photo.photo} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="block"
                                                            >
                                                                <img 
                                                                    src={photo.photo_url || photo.photo} 
                                                                    alt="" 
                                                                    className="h-16 w-16 object-cover rounded border"
                                                                />
                                                            </a>
                                                        ))}
                                                        <label className="h-16 w-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-blue-500">
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    if (e.target.files[0]) {
                                                                        handleUploadPhoto(item.id, e.target.files[0]);
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-2xl text-gray-400">+</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Tab 3: Rücksendung */}
                    {activeTab === 'return' && (
                        <div className="space-y-6">
                            {/* Existing Returns */}
                            {loan.returns && loan.returns.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-medium text-gray-800 mb-3">Bisherige Rücksendungen</h3>
                                    <div className="space-y-3">
                                        {loan.returns.map(ret => (
                                            <div key={ret.id} className="border rounded-lg p-4 bg-gray-50">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-medium">{ret.return_number}</h4>
                                                        <p className="text-sm text-gray-500">
                                                            {new Date(ret.return_date).toLocaleDateString('de-DE')}
                                                            {ret.shipping_carrier && ` • ${ret.shipping_carrier}`}
                                                            {ret.tracking_number && ` • ${ret.tracking_number}`}
                                                        </p>
                                                        <p className="text-sm mt-1">
                                                            {ret.items?.length || 0} Position(en)
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDownloadPdf(ret.id)}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                                                    >
                                                        📄 PDF
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* New Return Form */}
                            {loan.status !== 'abgeschlossen' && (
                                <div>
                                    <h3 className="text-lg font-medium text-gray-800 mb-3">Neue Rücksendung erstellen</h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Rücksendedatum
                                            </label>
                                            <input
                                                type="date"
                                                value={returnForm.return_date}
                                                onChange={(e) => setReturnForm(prev => ({ ...prev, return_date: e.target.value }))}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Versanddienstleister
                                            </label>
                                            <input
                                                type="text"
                                                value={returnForm.shipping_carrier}
                                                onChange={(e) => setReturnForm(prev => ({ ...prev, shipping_carrier: e.target.value }))}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                placeholder="z.B. DHL, UPS..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Sendungsnummer
                                            </label>
                                            <input
                                                type="text"
                                                value={returnForm.tracking_number}
                                                onChange={(e) => setReturnForm(prev => ({ ...prev, tracking_number: e.target.value }))}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <h4 className="font-medium text-gray-700 mb-2">Positionen zur Rücksendung auswählen:</h4>
                                    <div className="space-y-2 mb-4">
                                        {returnForm.items.map((item, idx) => (
                                            <div key={item.loan_item_id} className="border rounded-lg p-3 flex items-center gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={item.selected}
                                                    onChange={(e) => {
                                                        const newItems = [...returnForm.items];
                                                        newItems[idx].selected = e.target.checked;
                                                        if (e.target.checked && newItems[idx].quantity_returned === 0) {
                                                            newItems[idx].quantity_returned = item.quantity_available;
                                                        }
                                                        setReturnForm(prev => ({ ...prev, items: newItems }));
                                                    }}
                                                    className="h-5 w-5 text-blue-600 rounded"
                                                />
                                                <div className="flex-1">
                                                    <p className="font-medium">{item.product_name}</p>
                                                    <p className="text-sm text-gray-500">
                                                        Verfügbar: {item.quantity_available}
                                                    </p>
                                                </div>
                                                {item.selected && (
                                                    <>
                                                        <div className="w-24">
                                                            <input
                                                                type="number"
                                                                value={item.quantity_returned}
                                                                onChange={(e) => {
                                                                    const newItems = [...returnForm.items];
                                                                    newItems[idx].quantity_returned = parseFloat(e.target.value) || 0;
                                                                    setReturnForm(prev => ({ ...prev, items: newItems }));
                                                                }}
                                                                min="0"
                                                                max={item.quantity_available}
                                                                className="w-full px-2 py-1 border rounded text-sm"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <input
                                                                type="text"
                                                                placeholder="Zustand/Bemerkung"
                                                                value={item.condition_notes}
                                                                onChange={(e) => {
                                                                    const newItems = [...returnForm.items];
                                                                    newItems[idx].condition_notes = e.target.value;
                                                                    setReturnForm(prev => ({ ...prev, items: newItems }));
                                                                }}
                                                                className="w-full px-2 py-1 border rounded text-sm"
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Bemerkungen
                                        </label>
                                        <textarea
                                            value={returnForm.notes}
                                            onChange={(e) => setReturnForm(prev => ({ ...prev, notes: e.target.value }))}
                                            rows={2}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <button
                                        onClick={handleCreateReturn}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
                                    >
                                        ↩️ Rücksendung erstellen & Rücklieferschein generieren
                                    </button>
                                </div>
                            )}

                            {loan.status === 'abgeschlossen' && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                                    <p className="text-green-800 font-medium">
                                        ✓ Diese Leihung ist vollständig abgeschlossen
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default LoanEdit;
