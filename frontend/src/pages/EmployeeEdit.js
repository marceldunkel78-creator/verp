import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  UserIcon, 
  BanknotesIcon, 
  ClockIcon, 
  CalendarIcon,
  HeartIcon,
  CurrencyEuroIcon,
  TruckIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

const EmployeeEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('basisinfos');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    address: '',
    personal_email: '',
    work_email: '',
    phone: '',
    employment_start_date: '',
    employment_end_date: '',
    contract_type: 'vollzeit',
    job_title: '',
    department: '',
    working_time_percentage: 100,
    weekly_work_hours: 40.00,
    work_days: ['mon','tue','wed','thu','fri'],
    annual_vacation_days: 30,
    employment_status: 'aktiv',
    closing_greeting: 'Mit freundlichen Grüßen',
    bank_account_holder: '',
    bank_iban: '',
    bank_bic: '',
    bank_name: ''
  });
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);

  // Tab-spezifische State
  const [timeEntries, setTimeEntries] = useState([]);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [vacationRequests, setVacationRequests] = useState([]);
  const [yearBalance, setYearBalance] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (id) {
      fetchEmployee();
    }
  }, [id]);

  useEffect(() => {
    if (employee && activeTab === 'zeiterfassung') {
      fetchTimeEntries();
    }
  }, [activeTab, employee]);

  useEffect(() => {
    if (employee && activeTab === 'urlaub') {
      fetchVacationData();
    }
  }, [activeTab, employee, selectedYear]);

  const fetchEmployee = async () => {
    try {
      const response = await api.get(`/users/employees/${id}/`);
      setEmployee(response.data);
      setFormData({
        employee_id: response.data.employee_id || '',
        first_name: response.data.first_name || '',
        last_name: response.data.last_name || '',
        date_of_birth: response.data.date_of_birth || '',
        address: response.data.address || '',
        personal_email: response.data.personal_email || '',
        work_email: response.data.work_email || '',
        phone: response.data.phone || '',
        employment_start_date: response.data.employment_start_date || '',
        employment_end_date: response.data.employment_end_date || '',
        contract_type: response.data.contract_type || 'vollzeit',
        job_title: response.data.job_title || '',
        department: response.data.department || '',
        working_time_percentage: parseFloat(response.data.working_time_percentage) || 100,
        weekly_work_hours: response.data.weekly_work_hours ? parseFloat(response.data.weekly_work_hours) : 40.00,
        annual_vacation_days: response.data.annual_vacation_days || 30,
        work_days: Array.isArray(response.data.work_days) ? response.data.work_days : ['mon','tue','wed','thu','fri'],
        employment_status: response.data.employment_status || 'aktiv',
        closing_greeting: response.data.closing_greeting || 'Mit freundlichen Grüßen',
        bank_account_holder: response.data.bank_account_holder || '',
        bank_iban: response.data.bank_iban || '',
        bank_bic: response.data.bank_bic || '',
        bank_name: response.data.bank_name || ''
      });
      setSignaturePreview(response.data.signature_image_url || null);
    } catch (error) {
      console.error('Fehler beim Laden des Mitarbeiters:', error);
      alert('Fehler beim Laden der Mitarbeiterdaten');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeEntries = async () => {
    try {
      const res = await api.get(`/users/time-entries/?employee=${id}`);
      const data = res.data.results || res.data;
      setTimeEntries(Array.isArray(data) ? data : []);
      
      try {
        const r = await api.get(`/users/time-entries/monthly_report/?employee=${id}`);
        setMonthlyReport(r.data);
      } catch (err) {
        console.warn('Monatsbericht nicht verfügbar', err);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Zeiteinträge:', error);
    }
  };

  const fetchVacationData = async () => {
    try {
      const res = await api.get(`/users/vacation-requests/?employee=${id}&year=${selectedYear}`);
      const data = res.data.results || res.data;
      setVacationRequests(Array.isArray(data) ? data : []);
      
      const balRes = await api.get(`/users/vacation-year-balances/for_employee/?employee=${id}&year=${selectedYear}`);
      setYearBalance(balRes.data);
      
      const adjRes = await api.get(`/users/vacation-adjustments/?employee=${id}&year=${selectedYear}`);
      setAdjustments(adjRes.data.results || adjRes.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Urlaubsdaten:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const submitData = { ...formData };
      if (!submitData.employment_end_date) {
        delete submitData.employment_end_date;
      }
      delete submitData.employee_id;
      
      if (signatureFile) {
        const submitFormData = new FormData();
        Object.keys(submitData).forEach(key => {
          if (key === 'work_days') {
            submitFormData.append(key, JSON.stringify(submitData[key]));
          } else if (submitData[key] !== null && submitData[key] !== undefined && submitData[key] !== '') {
            submitFormData.append(key, submitData[key]);
          }
        });
        submitFormData.append('signature_image', signatureFile);
        
        await api.put(`/users/employees/${id}/`, submitFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.put(`/users/employees/${id}/`, submitData);
      }
      
      alert('Mitarbeiter erfolgreich aktualisiert');
      fetchEmployee();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'basisinfos', name: 'Basisinfos', icon: UserIcon },
    { id: 'svkv', name: 'SV/KV', icon: HeartIcon },
    { id: 'zeiterfassung', name: 'Zeiterfassung', icon: ClockIcon },
    { id: 'urlaub', name: 'Urlaub', icon: CalendarIcon },
    { id: 'krankheit', name: 'Krankheit', icon: HeartIcon },
    { id: 'provision', name: 'Provision', icon: CurrencyEuroIcon },
    { id: 'reisekosten', name: 'Reisekosten', icon: TruckIcon }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Mitarbeiter nicht gefunden</p>
          <button
            onClick={() => navigate('/hr/employees')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Zurück zur Liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/hr/employees')}
          className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zur Mitarbeiterliste
        </button>
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {employee.employee_id} • {employee.job_title}
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
              employee.employment_status === 'aktiv' ? 'bg-green-100 text-green-800' :
              employee.employment_status === 'inaktiv' ? 'bg-gray-100 text-gray-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {employee.employment_status}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className={`-ml-0.5 mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg p-6">
        {activeTab === 'basisinfos' && (
          <BasisinfosTab 
            formData={formData}
            setFormData={setFormData}
            signatureFile={signatureFile}
            setSignatureFile={setSignatureFile}
            signaturePreview={signaturePreview}
            setSignaturePreview={setSignaturePreview}
            handleSave={handleSave}
            saving={saving}
          />
        )}

        {activeTab === 'svkv' && (
          <SVKVTab 
            formData={formData}
            setFormData={setFormData}
            handleSave={handleSave}
            saving={saving}
          />
        )}

        {activeTab === 'zeiterfassung' && (
          <ZeiterfassungTab 
            employeeId={id}
            timeEntries={timeEntries}
            monthlyReport={monthlyReport}
            fetchTimeEntries={fetchTimeEntries}
          />
        )}

        {activeTab === 'urlaub' && (
          <UrlaubTab 
            employeeId={id}
            employee={employee}
            vacationRequests={vacationRequests}
            yearBalance={yearBalance}
            adjustments={adjustments}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            fetchVacationData={fetchVacationData}
            fetchEmployee={fetchEmployee}
          />
        )}

        {activeTab === 'krankheit' && (
          <KrankheitTab employeeId={id} />
        )}

        {activeTab === 'provision' && (
          <ProvisionTab employeeId={id} />
        )}

        {activeTab === 'reisekosten' && (
          <ReisekostenTab employeeId={id} />
        )}
      </div>
    </div>
  );
};

// ==================== Basisinfos Tab ====================
const BasisinfosTab = ({ formData, setFormData, signatureFile, setSignatureFile, signaturePreview, setSignaturePreview, handleSave, saving }) => {
  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Persönliche Daten</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Mitarbeiter-ID</label>
            <input
              type="text"
              disabled
              value={formData.employee_id}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 cursor-not-allowed sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Vorname *</label>
            <input
              type="text"
              required
              value={formData.first_name}
              onChange={(e) => setFormData({...formData, first_name: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nachname *</label>
            <input
              type="text"
              required
              value={formData.last_name}
              onChange={(e) => setFormData({...formData, last_name: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Geburtsdatum *</label>
            <input
              type="date"
              required
              value={formData.date_of_birth}
              onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Kontaktdaten</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Adresse</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefon</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Private E-Mail</label>
            <input
              type="email"
              value={formData.personal_email}
              onChange={(e) => setFormData({...formData, personal_email: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Dienstliche E-Mail</label>
            <input
              type="email"
              value={formData.work_email}
              onChange={(e) => setFormData({...formData, work_email: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Beschäftigungsdaten</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Eintrittsdatum *</label>
            <input
              type="date"
              required
              value={formData.employment_start_date}
              onChange={(e) => setFormData({...formData, employment_start_date: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Austrittsdatum</label>
            <input
              type="date"
              value={formData.employment_end_date}
              onChange={(e) => setFormData({...formData, employment_end_date: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Vertragsart *</label>
            <select
              value={formData.contract_type}
              onChange={(e) => setFormData({...formData, contract_type: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="unbefristet">Unbefristet</option>
              <option value="befristet">Befristet</option>
              <option value="teilzeit">Teilzeit</option>
              <option value="vollzeit">Vollzeit</option>
              <option value="ausbildung">Ausbildung</option>
              <option value="minijob">Minijob</option>
              <option value="praktikum">Praktikum</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Stellenbezeichnung *</label>
            <input
              type="text"
              required
              value={formData.job_title}
              onChange={(e) => setFormData({...formData, job_title: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Abteilung</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({...formData, department: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Beschäftigungsumfang (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.working_time_percentage}
              onChange={(e) => setFormData({...formData, working_time_percentage: parseFloat(e.target.value)})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Wochenarbeitszeit (h)</label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={formData.weekly_work_hours}
              onChange={(e) => setFormData({...formData, weekly_work_hours: parseFloat(e.target.value)})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Jahresurlaubstage</label>
            <input
              type="number"
              min="0"
              step="1"
              value={formData.annual_vacation_days}
              onChange={(e) => setFormData({...formData, annual_vacation_days: parseInt(e.target.value)})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={formData.employment_status}
              onChange={(e) => setFormData({...formData, employment_status: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="aktiv">Aktiv</option>
              <option value="inaktiv">Inaktiv</option>
              <option value="urlaub">Urlaub</option>
              <option value="krank">Krank</option>
              <option value="aufkündigung">Aufkündigung</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Arbeitstage</label>
          <div className="grid grid-cols-7 gap-2">
            {[
              { key: 'mon', label: 'Mo' },
              { key: 'tue', label: 'Di' },
              { key: 'wed', label: 'Mi' },
              { key: 'thu', label: 'Do' },
              { key: 'fri', label: 'Fr' },
              { key: 'sat', label: 'Sa' },
              { key: 'sun', label: 'So' },
            ].map(d => (
              <label key={d.key} className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={formData.work_days.includes(d.key)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData(prev => {
                      const next = new Set(prev.work_days || []);
                      if (checked) next.add(d.key); else next.delete(d.key);
                      return { ...prev, work_days: Array.from(next) };
                    });
                  }}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">{d.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Bankverbindung</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Kontoinhaber</label>
            <input
              type="text"
              value={formData.bank_account_holder}
              onChange={(e) => setFormData({...formData, bank_account_holder: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">IBAN</label>
            <input
              type="text"
              value={formData.bank_iban}
              onChange={(e) => setFormData({...formData, bank_iban: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">BIC</label>
            <input
              type="text"
              value={formData.bank_bic}
              onChange={(e) => setFormData({...formData, bank_bic: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bankname</label>
            <input
              type="text"
              value={formData.bank_name}
              onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Unterschrift für Dokumente</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Grußformel</label>
            <input
              type="text"
              value={formData.closing_greeting}
              onChange={(e) => setFormData({...formData, closing_greeting: e.target.value})}
              placeholder="Mit freundlichen Grüßen"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Unterschrift (Bild)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setSignatureFile(file);
                  setSignaturePreview(URL.createObjectURL(file));
                }
              }}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {signaturePreview && (
              <div className="mt-2">
                <img 
                  src={signaturePreview} 
                  alt="Unterschrift Vorschau" 
                  className="h-12 border rounded"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {saving ? 'Speichert...' : 'Änderungen speichern'}
        </button>
      </div>
    </form>
  );
};

// ==================== SV/KV Tab (Placeholder) ====================
const SVKVTab = ({ formData, setFormData, handleSave, saving }) => {
  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <p className="text-sm text-yellow-800">
          <strong>Coming Soon:</strong> Sozialversicherungs- und Krankenversicherungsinformationen werden hier angezeigt und können bearbeitet werden.
        </p>
      </div>
      
      <div className="text-center py-12 text-gray-400">
        <HeartIcon className="mx-auto h-12 w-12 mb-4" />
        <p>Dieser Bereich befindet sich in Entwicklung</p>
      </div>
    </div>
  );
};

// ==================== Zeiterfassung Tab ====================
const ZeiterfassungTab = ({ employeeId, timeEntries, monthlyReport, fetchTimeEntries }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Monatliche Zeitauswertung</h3>
        {monthlyReport && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Gearbeitet</p>
              <p className="text-2xl font-semibold">{monthlyReport.actual_hours}h</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500">Erwartet bis heute</p>
              <p className="text-2xl font-semibold">{monthlyReport.expected_hours_to_date}h</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-500">Differenz</p>
              <p className="text-2xl font-semibold">{monthlyReport.difference}h</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Zeiteinträge</h3>
        {timeEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ClockIcon className="mx-auto h-12 w-12 mb-4" />
            <p>Keine Zeiteinträge vorhanden</p>
          </div>
        ) : (
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-md">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Datum</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Startzeit</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Endzeit</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Pause</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Dauer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {timeEntries.map(entry => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{entry.start_time}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{entry.end_time}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{entry.break_time}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{entry.duration_display || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== Urlaub Tab ====================
const UrlaubTab = ({ employeeId, employee, vacationRequests, yearBalance, adjustments, selectedYear, setSelectedYear, fetchVacationData, fetchEmployee }) => {
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ days: '', reason: '' });
  const [showYearCloseModal, setShowYearCloseModal] = useState(false);

  const yearOptions = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  const approveRequest = async (id) => {
    try {
      await api.patch(`/users/vacation-requests/${id}/`, { status: 'approved' });
      fetchVacationData();
      fetchEmployee();
    } catch (error) {
      alert('Fehler beim Genehmigen: ' + (error.response?.data?.detail || error.message));
    }
  };

  const rejectRequest = async (id) => {
    try {
      await api.patch(`/users/vacation-requests/${id}/`, { status: 'rejected' });
      fetchVacationData();
    } catch (error) {
      alert('Fehler beim Ablehnen: ' + (error.response?.data?.detail || error.message));
    }
  };

  const cancelRequest = async (id) => {
    if (!window.confirm('Urlaub wirklich stornieren?')) return;
    try {
      await api.patch(`/users/vacation-requests/${id}/`, { status: 'cancelled' });
      fetchVacationData();
      fetchEmployee();
    } catch (error) {
      alert('Fehler beim Stornieren: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleManualAdjustment = async (e) => {
    e.preventDefault();
    if (!yearBalance?.id) {
      alert('Kein Jahresurlaubskonto gefunden.');
      return;
    }
    try {
      await api.post(`/users/vacation-year-balances/${yearBalance.id}/adjust/`, {
        days: parseFloat(adjustForm.days),
        reason: adjustForm.reason
      });
      setShowAdjustModal(false);
      setAdjustForm({ days: '', reason: '' });
      fetchVacationData();
      fetchEmployee();
    } catch (error) {
      alert('Fehler: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleYearClose = async () => {
    if (!yearBalance?.id) {
      alert('Kein Jahresurlaubskonto gefunden.');
      return;
    }
    if (!window.confirm(`Jahr ${selectedYear} wirklich abschließen? Der Resturlaub wird ins nächste Jahr übertragen.`)) return;
    try {
      const res = await api.post(`/users/vacation-year-balances/${yearBalance.id}/close_year/`);
      alert(res.data.message);
      setShowYearCloseModal(false);
      fetchVacationData();
      fetchEmployee();
    } catch (error) {
      alert('Fehler: ' + (error.response?.data?.error || error.response?.data?.detail || error.message));
    }
  };

  const pending = vacationRequests.filter(r => r.status === 'pending');
  const approved = vacationRequests.filter(r => r.status === 'approved');
  const rejectedCancelled = vacationRequests.filter(r => r.status === 'cancelled' || r.status === 'rejected');

  return (
    <div className="space-y-6">
      {/* Header with Year Selector */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jahr</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {yearBalance && (
          <div className="flex gap-2">
            <button 
              onClick={() => setShowAdjustModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Manuelle Anpassung
            </button>
            {!yearBalance.is_closed && selectedYear < new Date().getFullYear() && (
              <button 
                onClick={() => setShowYearCloseModal(true)}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
              >
                Jahr abschließen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Balance Overview */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Urlaubsübersicht {selectedYear}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Jahresanspruch</p>
            <p className="text-2xl font-semibold">{yearBalance?.entitlement !== undefined ? `${parseFloat(yearBalance.entitlement).toFixed(1)}` : '-'}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-500">Übertrag</p>
            <p className="text-2xl font-semibold text-blue-700">{yearBalance?.carryover !== undefined ? `${parseFloat(yearBalance.carryover).toFixed(1)}` : '-'}</p>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg">
            <p className="text-sm text-gray-500">Anpassungen</p>
            <p className="text-2xl font-semibold text-indigo-700">{yearBalance?.manual_adjustment !== undefined ? `${parseFloat(yearBalance.manual_adjustment).toFixed(1)}` : '-'}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-500">Genommen</p>
            <p className="text-2xl font-semibold text-orange-700">{yearBalance?.taken !== undefined ? `${parseFloat(yearBalance.taken).toFixed(1)}` : '-'}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-500">Aktuelles Guthaben</p>
            <p className="text-2xl font-semibold text-green-700">{employee?.vacation_balance !== undefined ? `${parseFloat(employee.vacation_balance).toFixed(1)}` : '-'}</p>
            {yearBalance?.is_closed && <span className="text-xs text-purple-600">Jahr abgeschlossen</span>}
          </div>
        </div>
      </div>

      {/* Two columns: Requests left, Changelog right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vacation Requests */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Urlaubsanträge {selectedYear}</h3>
          
          {/* Pending */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-yellow-700 uppercase mb-2">Ausstehend ({pending.length})</h4>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-500">Keine ausstehenden Anträge.</p>
            ) : (
              <ul className="space-y-2">
                {pending.map(req => (
                  <li key={req.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{new Date(req.start_date).toLocaleDateString()} – {new Date(req.end_date).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">{req.days_requested} Tage • {req.reason || 'Kein Grund angegeben'}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => approveRequest(req.id)} className="px-2 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700">Genehmigen</button>
                        <button onClick={() => rejectRequest(req.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700">Ablehnen</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Approved */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-green-700 uppercase mb-2">Genehmigt ({approved.length})</h4>
            {approved.length === 0 ? (
              <p className="text-sm text-gray-500">Keine genehmigten Anträge.</p>
            ) : (
              <ul className="space-y-2">
                {approved.map(req => (
                  <li key={req.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{new Date(req.start_date).toLocaleDateString()} – {new Date(req.end_date).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">{req.days_requested} Tage</p>
                      </div>
                      <button onClick={() => cancelRequest(req.id)} className="px-2 py-1 text-xs bg-yellow-600 text-white rounded-md hover:bg-yellow-700">Stornieren</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Rejected/Cancelled */}
          {rejectedCancelled.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Storniert/Abgelehnt ({rejectedCancelled.length})</h4>
              <ul className="space-y-2">
                {rejectedCancelled.map(req => (
                  <li key={req.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-500">{new Date(req.start_date).toLocaleDateString()} – {new Date(req.end_date).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-400">{req.days_requested} Tage • {req.status === 'cancelled' ? 'Storniert' : 'Abgelehnt'}</p>
                      </div>
                      <button 
                        onClick={async () => {
                          if (!window.confirm('Diesen Eintrag wirklich löschen?')) return;
                          try {
                            await api.delete(`/users/vacation-requests/${req.id}/`);
                            fetchVacationData();
                          } catch (err) {
                            alert('Fehler beim Löschen: ' + (err.response?.data?.detail || err.message));
                          }
                        }} 
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Löschen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Changelog */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Änderungsprotokoll {selectedYear}</h3>
          {adjustments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>Keine Änderungen vorhanden</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {adjustments.map((adj) => (
                <li key={adj.id} className="p-3 bg-white border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{adj.adjustment_type_display}</p>
                      <p className="text-xs text-gray-500">{adj.reason}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(adj.created_at).toLocaleDateString()} {new Date(adj.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {adj.created_by_name && ` • ${adj.created_by_name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${parseFloat(adj.days) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(adj.days) >= 0 ? '+' : ''}{parseFloat(adj.days).toFixed(1)}
                      </span>
                      <p className="text-xs text-gray-500">
                        {parseFloat(adj.balance_before).toFixed(1)} → {parseFloat(adj.balance_after).toFixed(1)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Manual Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-medium mb-4">Manuelle Urlaubsanpassung</h3>
            <form onSubmit={handleManualAdjustment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tage (+/-)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={adjustForm.days}
                  onChange={(e) => setAdjustForm({...adjustForm, days: e.target.value})}
                  placeholder="z.B. 2 oder -1.5"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Begründung</label>
                <textarea
                  required
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({...adjustForm, reason: e.target.value})}
                  placeholder="Grund für die Anpassung"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="px-3 py-2 text-gray-700 bg-gray-100 rounded-md">Abbrechen</button>
                <button type="submit" className="px-3 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">Anpassung speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Year Close Modal */}
      {showYearCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-medium mb-4">Jahresabschluss {selectedYear}</h3>
            <div className="bg-purple-50 p-3 rounded mb-4">
              <p className="text-sm">
                <strong>Aktueller Resturlaub:</strong> {yearBalance?.balance !== undefined ? `${parseFloat(yearBalance.balance).toFixed(1)}` : '-'} Tage
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Diese Tage werden als Übertrag ins Jahr {selectedYear + 1} übernommen.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowYearCloseModal(false)} className="px-3 py-2 text-gray-700 bg-gray-100 rounded-md">Abbrechen</button>
              <button onClick={handleYearClose} className="px-3 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700">Jahr abschließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== Krankheit Tab (Placeholder) ====================
const KrankheitTab = ({ employeeId }) => {
  return (
    <div className="text-center py-12 text-gray-400">
      <HeartIcon className="mx-auto h-12 w-12 mb-4" />
      <p className="text-lg font-medium mb-2">Krankheitszeiten</p>
      <p>Dieser Bereich befindet sich in Entwicklung</p>
    </div>
  );
};

// ==================== Provision Tab (Placeholder) ====================
const ProvisionTab = ({ employeeId }) => {
  return (
    <div className="text-center py-12 text-gray-400">
      <CurrencyEuroIcon className="mx-auto h-12 w-12 mb-4" />
      <p className="text-lg font-medium mb-2">Provisionen</p>
      <p>Dieser Bereich befindet sich in Entwicklung</p>
    </div>
  );
};

// ==================== Reisekosten Tab (Placeholder) ====================
const ReisekostenTab = ({ employeeId }) => {
  return (
    <div className="text-center py-12 text-gray-400">
      <TruckIcon className="mx-auto h-12 w-12 mb-4" />
      <p className="text-lg font-medium mb-2">Reisekosten</p>
      <p>Dieser Bereich befindet sich in Entwicklung</p>
    </div>
  );
};

export default EmployeeEdit;
