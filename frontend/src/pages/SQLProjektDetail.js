import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlusIcon, TrashIcon, DocumentIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const SQLProjektDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projekt, setProjekt] = useState(null);
  const [lookups, setLookups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [editData, setEditData] = useState({});
  const [neueAktion, setNeueAktion] = useState('');
  const [addingAction, setAddingAction] = useState(false);

  // Extra data state
  const [extra, setExtra] = useState(null);
  const [extraEdit, setExtraEdit] = useState({ projekt_name: '', notes: '', is_active: true });
  const [uploading, setUploading] = useState(false);

  const canWrite = user?.is_superuser || user?.can_write_sales_sql_projekte;

  const fetchExtra = useCallback(async () => {
    try {
      const res = await api.get(`/sql-projekte/projekte/${id}/extra/`);
      setExtra(res.data);
      if (res.data.exists) {
        setExtraEdit({ projekt_name: res.data.projekt_name || '', notes: res.data.notes || '', is_active: res.data.is_active !== false });
      }
    } catch { /* ignore */ }
  }, [id]);

  const fetchProjekt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projektRes, lookupsRes] = await Promise.all([
        api.get(`/sql-projekte/projekte/${id}/`),
        api.get('/sql-projekte/lookups/'),
      ]);
      setProjekt(projektRes.data);
      setLookups(lookupsRes.data);
      setEditData(buildEditData(projektRes.data));
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Laden des Projekts');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProjekt();
    fetchExtra();
  }, [fetchProjekt, fetchExtra]);

  const buildEditData = (p) => ({
    system_gruppe_id: p.system_gruppe_id || '',
    produkt_untergruppe: p.produkt_untergruppe || '',
    verkaeufer_id: p.verkaeufer_id || '',
    prioritaet_id: p.prioritaet_id || '',
    lead_source_id: p.lead_source_id || '',
    infomaterial_id: p.infomaterial_id || '',
    infomaterial_text: p.infomaterial_text || '',
    infomaterial_schicken: p.infomaterial_schicken || false,
    mailing_id: p.mailing_id || '',
    aktions_status_id: p.aktions_status_id || '',
    auftragswahrscheinlichkeit: p.auftragswahrscheinlichkeit || '',
    auftragssumme: p.auftragssumme || '',
    naechste_aktion: p.naechste_aktion ? p.naechste_aktion.substring(0, 10) : '',
    erstkontakt: p.erstkontakt ? p.erstkontakt.substring(0, 10) : '',
    mittelzuteilungsdatum: p.mittelzuteilungsdatum ? p.mittelzuteilungsdatum.substring(0, 10) : '',
    auftragsdatum: p.auftragsdatum ? p.auftragsdatum.substring(0, 10) : '',
    interessen_beschreibung: p.interessen_beschreibung || '',
    lost_order_beschreibung: p.lost_order_beschreibung || '',
    marker: p.marker || false,
    angebot: p.angebot || false,
    demo: p.demo || false,
    anruf: p.anruf || false,
    lead_source_text: p.lead_source_text || '',
  });

  const handleChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      // Send only changed fields
      const payload = {};
      for (const [key, val] of Object.entries(editData)) {
        const origVal = projekt[key];
        const strOrig = origVal === null || origVal === undefined ? '' : String(origVal);
        const strNew = val === null || val === undefined ? '' : String(val);
        if (strNew !== strOrig) {
          payload[key] = val === '' ? null : val;
        }
      }

      if (Object.keys(payload).length === 0) {
        setSaveMessage({ type: 'info', text: 'Keine Änderungen vorhanden.' });
        setSaving(false);
        return;
      }

      await api.put(`/sql-projekte/projekte/${id}/update/`, payload);
      setSaveMessage({ type: 'success', text: 'Gespeichert!' });
      // Reload
      const res = await api.get(`/sql-projekte/projekte/${id}/`);
      setProjekt(res.data);
      setEditData(buildEditData(res.data));
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.response?.data?.error || 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleAddAction = async () => {
    if (!neueAktion.trim()) return;
    setAddingAction(true);
    try {
      const res = await api.post(`/sql-projekte/projekte/${id}/action/`, {
        kommentar: neueAktion.trim()
      });
      // Update local state
      setProjekt(prev => ({
        ...prev,
        aktionsbeschreibung: res.data.aktionsbeschreibung,
        aktionsdatum: res.data.aktionsdatum,
        naechste_aktion: res.data.naechste_aktion,
      }));
      setEditData(prev => ({
        ...prev,
        naechste_aktion: res.data.naechste_aktion ? res.data.naechste_aktion.substring(0, 10) : '',
      }));
      setNeueAktion('');
      setSaveMessage({ type: 'success', text: 'Aktion hinzugefügt!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.response?.data?.error || 'Fehler beim Hinzufügen' });
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setAddingAction(false);
    }
  };

  const handleSaveExtra = async () => {
    try {
      await api.put(`/sql-projekte/projekte/${id}/extra/`, extraEdit);
      fetchExtra();
      setSaveMessage({ type: 'success', text: 'Zusatzinfos gespeichert!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.response?.data?.error || 'Fehler beim Speichern der Zusatzinfos' });
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleUploadDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      await api.post(`/sql-projekte/projekte/${id}/documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchExtra();
      setSaveMessage({ type: 'success', text: 'Dokument hochgeladen!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.response?.data?.error || 'Upload fehlgeschlagen' });
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Dokument wirklich löschen?')) return;
    try {
      await api.delete(`/sql-projekte/projekte/${id}/documents/?doc_id=${docId}`);
      fetchExtra();
    } catch { /* ignore */ }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('de-DE');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val) => {
    if (!val || val === '0') return '-';
    try {
      const num = parseFloat(val);
      return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    } catch {
      return val;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          Lade Projekt...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeftIcon className="h-4 w-4" /> Zurück
        </button>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!projekt) return null;

  const kundenDisplay = projekt.adresse?.firma || projekt.adresse?.name || `Adr. ${projekt.adressen_id}`;
  const isOverdue = projekt.naechste_aktion && new Date(projekt.naechste_aktion) < new Date();

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Zurück zur Liste
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              SQL-Projekt #{projekt.id}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {kundenDisplay} {projekt.adresse?.ort ? `• ${projekt.adresse.ort}` : ''}
            </p>
          </div>
          {canWrite && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          )}
        </div>
        {saveMessage && (
          <div className={`mt-3 p-3 rounded-md text-sm ${
            saveMessage.type === 'success' ? 'bg-green-50 text-green-700' :
            saveMessage.type === 'error' ? 'bg-red-50 text-red-700' :
            'bg-blue-50 text-blue-700'
          }`}>
            {saveMessage.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Kundenadresse */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Kundenadresse</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">AdressenID:</span>
                <span className="ml-2 font-medium">{projekt.adressen_id || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">Firma:</span>
                <span className="ml-2">{projekt.adresse?.firma || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">Name:</span>
                <span className="ml-2">{projekt.adresse?.name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">Ort:</span>
                <span className="ml-2">{projekt.adresse?.ort || '-'} {projekt.adresse?.plz || ''}</span>
              </div>
              {projekt.adresse?.strasse && (
                <div>
                  <span className="text-gray-500">Straße:</span>
                  <span className="ml-2">{projekt.adresse.strasse}</span>
                </div>
              )}
              {projekt.adresse?.land && (
                <div>
                  <span className="text-gray-500">Land:</span>
                  <span className="ml-2">{projekt.adresse.land}</span>
                </div>
              )}
              {projekt.adresse?.telefon && (
                <div>
                  <span className="text-gray-500">Telefon:</span>
                  <span className="ml-2">{projekt.adresse.telefon}</span>
                </div>
              )}
              {projekt.adresse?.email && (
                <div>
                  <span className="text-gray-500">Email:</span>
                  <span className="ml-2">{projekt.adresse.email}</span>
                </div>
              )}
              {projekt.verp_customer && (
                <div className="col-span-2">
                  <span className="text-gray-500">VERP-Kunde:</span>
                  <Link
                    to={`/sales/customers/${projekt.verp_customer.customer_id}`}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    {projekt.verp_customer.customer_number} - {projekt.verp_customer.customer_name}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Aktionsbeschreibung */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Aktionsbeschreibung</h2>
            {canWrite && (
              <div className="mb-4 p-3 bg-gray-50 rounded-md border">
                <label className="block text-sm font-medium text-gray-700 mb-1">Neue Aktion hinzufügen</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={neueAktion}
                    onChange={(e) => setNeueAktion(e.target.value)}
                    placeholder="Kommentar zur neuen Aktion..."
                    className="flex-1 rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
                  />
                  <button
                    onClick={handleAddAction}
                    disabled={addingAction || !neueAktion.trim()}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                    {addingAction ? 'Speichern...' : 'Hinzufügen'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Format: Datum/Uhrzeit/Benutzername: Kommentar wird automatisch vorangestellt. Nächste Aktion wird auf +7 Tage gesetzt.
                </p>
              </div>
            )}
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-md max-h-[400px] overflow-y-auto border">
              {projekt.aktionsbeschreibung || 'Keine Aktionen vorhanden.'}
            </pre>
            <div className="mt-3 flex gap-4 text-sm text-gray-500">
              <span>
                <span className="font-medium">Aktionsdatum:</span> {formatDate(projekt.aktionsdatum)}
              </span>
              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                <span className="font-medium">Nächste Aktion:</span> {formatDate(projekt.naechste_aktion)}
              </span>
              {projekt.aktions_status && (
                <span>
                  <span className="font-medium">Status:</span> {projekt.aktions_status}
                </span>
              )}
            </div>
          </div>

          {/* Interessen-Beschreibung */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Interessen-Beschreibung</h2>
            {canWrite ? (
              <textarea
                value={editData.interessen_beschreibung}
                onChange={(e) => handleChange('interessen_beschreibung', e.target.value)}
                rows={6}
                className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono"
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-md border">
                {projekt.interessen_beschreibung || '-'}
              </pre>
            )}
          </div>

          {/* Lost Order Beschreibung */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Lost Order Beschreibung</h2>
            {canWrite ? (
              <textarea
                value={editData.lost_order_beschreibung}
                onChange={(e) => handleChange('lost_order_beschreibung', e.target.value)}
                rows={4}
                className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono"
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-md border">
                {projekt.lost_order_beschreibung || '-'}
              </pre>
            )}
          </div>

          {/* VERP Zusatzinfos */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">VERP Zusatzinfos</h2>
            <div className="space-y-4">
              {/* Projektname */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projektname</label>
                {canWrite ? (
                  <input
                    type="text"
                    value={extraEdit.projekt_name}
                    onChange={(e) => setExtraEdit(prev => ({ ...prev, projekt_name: e.target.value }))}
                    placeholder="z.B. Konfokalmikroskop für Zellbiologie..."
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{extra?.projekt_name || '-'}</p>
                )}
              </div>

              {/* Notizen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                {canWrite ? (
                  <textarea
                    value={extraEdit.notes}
                    onChange={(e) => setExtraEdit(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{extra?.notes || '-'}</p>
                )}
              </div>

              {/* Aktiv */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={extraEdit.is_active}
                  onChange={(e) => canWrite && setExtraEdit(prev => ({ ...prev, is_active: e.target.checked }))}
                  disabled={!canWrite}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Aktiv</label>
              </div>

              {/* VERP-Auftrag Link */}
              {extra?.verp_order_number && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VERP-Auftrag</label>
                  <Link to={`/procurement/orders/${extra.verp_order_id}`} className="text-blue-600 hover:underline text-sm">
                    {extra.verp_order_number}
                  </Link>
                </div>
              )}

              {/* Verknüpfte SQL-Angebote */}
              {extra?.angebot_links?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verknüpfte SQL-Angebote</label>
                  <div className="flex flex-wrap gap-2">
                    {extra.angebot_links.map(a => (
                      <Link
                        key={a.id}
                        to={`/sales/sql-angebote/${a.sql_angebot_nummer}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded hover:bg-orange-100"
                      >
                        <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                        Angebot #{a.sql_angebot_nummer}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Dokumente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dokumente</label>
                {extra?.documents?.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {extra.documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline truncate"
                        >
                          <DocumentIcon className="h-4 w-4 flex-shrink-0" />
                          {doc.name}
                        </a>
                        {canWrite && (
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-400 hover:text-red-600 ml-2"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {canWrite && (
                  <label className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                    <PlusIcon className="h-4 w-4 text-gray-500" />
                    {uploading ? 'Lade hoch...' : 'Dokument hochladen'}
                    <input type="file" className="hidden" onChange={handleUploadDocument} disabled={uploading} />
                  </label>
                )}
              </div>

              {canWrite && (
                <button
                  onClick={handleSaveExtra}
                  className="inline-flex items-center px-3 py-1.5 bg-green-600 border border-transparent rounded text-sm font-medium text-white hover:bg-green-700"
                >
                  Zusatzinfos speichern
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Edit Fields */}
        <div className="space-y-6">
          {/* Klassifikation */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Klassifikation</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Systemgruppe</label>
                {canWrite ? (
                  <select
                    value={editData.system_gruppe_id}
                    onChange={(e) => handleChange('system_gruppe_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">- keine -</option>
                    {(lookups.system_gruppen || []).map(sg => (
                      <option key={sg.id} value={sg.id}>{sg.text}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{projekt.system_gruppe || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Untergruppe</label>
                {canWrite ? (
                  <input
                    type="text"
                    value={editData.produkt_untergruppe}
                    onChange={(e) => handleChange('produkt_untergruppe', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{projekt.produkt_untergruppe || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Einstufung</label>
                {canWrite ? (
                  <select
                    value={editData.prioritaet_id}
                    onChange={(e) => handleChange('prioritaet_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">- keine -</option>
                    {(lookups.prioritaeten || []).map(p => (
                      <option key={p.id} value={p.id}>{p.text}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{projekt.prioritaet || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source</label>
                {canWrite ? (
                  <select
                    value={editData.lead_source_id}
                    onChange={(e) => handleChange('lead_source_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">- keine -</option>
                    {(lookups.lead_source || []).map(ls => (
                      <option key={ls.id} value={ls.id}>{ls.text}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{projekt.lead_source || '-'} {projekt.lead_source_text ? `(${projekt.lead_source_text})` : ''}</p>
                )}
              </div>
              {canWrite && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source Text</label>
                  <input
                    type="text"
                    value={editData.lead_source_text}
                    onChange={(e) => handleChange('lead_source_text', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aktions-Status</label>
                {canWrite ? (
                  <select
                    value={editData.aktions_status_id}
                    onChange={(e) => handleChange('aktions_status_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">- keine -</option>
                    {(lookups.aktions_status || []).map(as => (
                      <option key={as.id} value={as.id}>{as.text}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{projekt.aktions_status || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Verkäufer & Auftragsinfos */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Verkäufer & Auftrag</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verkäufer</label>
                {canWrite ? (
                  <select
                    value={editData.verkaeufer_id}
                    onChange={(e) => handleChange('verkaeufer_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">- keiner -</option>
                    {(lookups.verkaeufer || []).map(v => (
                      <option key={v.id} value={v.id}>{v.text}{v.kuerzel ? ` (${v.kuerzel})` : ''}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{projekt.verkaeufer || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auftragssumme (€)</label>
                {canWrite ? (
                  <input
                    type="number"
                    step="0.01"
                    value={editData.auftragssumme}
                    onChange={(e) => handleChange('auftragssumme', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{formatCurrency(projekt.auftragssumme)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auftragswahrscheinlichkeit (%)</label>
                {canWrite ? (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editData.auftragswahrscheinlichkeit}
                    onChange={(e) => handleChange('auftragswahrscheinlichkeit', e.target.value ? parseInt(e.target.value) : null)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{projekt.auftragswahrscheinlichkeit || '-'}%</p>
                )}
              </div>
            </div>
          </div>

          {/* Datum-Felder */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Termine</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Erstellt</label>
                <p className="text-sm text-gray-900">{formatDate(projekt.datum)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Erstkontakt</label>
                {canWrite ? (
                  <input
                    type="date"
                    value={editData.erstkontakt}
                    onChange={(e) => handleChange('erstkontakt', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{formatDate(projekt.erstkontakt)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mittelzuteilung</label>
                {canWrite ? (
                  <input
                    type="date"
                    value={editData.mittelzuteilungsdatum}
                    onChange={(e) => handleChange('mittelzuteilungsdatum', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{formatDate(projekt.mittelzuteilungsdatum)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auftragsdatum</label>
                {canWrite ? (
                  <input
                    type="date"
                    value={editData.auftragsdatum}
                    onChange={(e) => handleChange('auftragsdatum', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{formatDate(projekt.auftragsdatum)}</p>
                )}
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                  Nächste Aktion {isOverdue && '(überfällig!)'}
                </label>
                {canWrite ? (
                  <input
                    type="date"
                    value={editData.naechste_aktion}
                    onChange={(e) => handleChange('naechste_aktion', e.target.value)}
                    className={`block w-full rounded-md border py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                ) : (
                  <p className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                    {formatDate(projekt.naechste_aktion)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Letzte Änderung</label>
                <p className="text-sm text-gray-500">{formatDate(projekt.last_modified)}</p>
              </div>
            </div>
          </div>

          {/* Infomaterial & Mailing */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Infomaterial & Mailing</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Infomaterial</label>
                {canWrite ? (
                  <select
                    value={editData.infomaterial_id}
                    onChange={(e) => handleChange('infomaterial_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">- keines -</option>
                    {(lookups.infomaterial || []).map(im => (
                      <option key={im.id} value={im.id}>{im.text}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{projekt.infomaterial || '-'}</p>
                )}
              </div>
              {canWrite && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editData.infomaterial_schicken}
                    onChange={(e) => handleChange('infomaterial_schicken', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="text-sm text-gray-700">Infomaterial schicken</label>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mailing</label>
                {canWrite ? (
                  <select
                    value={editData.mailing_id}
                    onChange={(e) => handleChange('mailing_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">- keines -</option>
                    {(lookups.mailing || []).map(m => (
                      <option key={m.id} value={m.id}>{m.text}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{projekt.mailing || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Flags */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Flags</h2>
            <div className="space-y-2">
              {[
                { key: 'marker', label: 'Marker' },
                { key: 'angebot', label: 'Angebot' },
                { key: 'demo', label: 'Demo' },
                { key: 'anruf', label: 'Anruf' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  {canWrite ? (
                    <input
                      type="checkbox"
                      checked={editData[key]}
                      onChange={(e) => handleChange(key, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  ) : (
                    <span className={`inline-block w-4 h-4 rounded ${projekt[key] ? 'bg-green-500' : 'bg-gray-300'}`} />
                  )}
                  <label className="text-sm text-gray-700">{label}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SQLProjektDetail;
