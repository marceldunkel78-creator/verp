import React, { useState } from 'react';
import { Upload, File, X, Download, Eye, Image as ImageIcon } from 'lucide-react';
import api from '../services/api';

/**
 * Reusable File Upload Component for Tickets
 * 
 * Props:
 * - attachments: Array of attachment objects from ticket
 * - ticketId: ID of the ticket
 * - ticketType: 'service', 'troubleshooting', 'visiview', 'sales-ticket', 'marketing', or 'development'
 * - onUploadSuccess: Callback when file is uploaded
 * - onDeleteSuccess: Callback when file is deleted
 */
const FileUpload = ({ attachments = [], ticketId, ticketType, onUploadSuccess, onDeleteSuccess, allowPrimary = false, onSetPrimary }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // API endpoint basierend auf Ticket-Typ
  const getEndpoint = () => {
    const typeMap = {
      service: 'service/tickets',
      troubleshooting: 'service/troubleshooting',
      visiview: 'visiview/tickets',
      'sales-ticket': 'sales/sales-tickets',
      marketing: 'sales/marketing-items',
      development: 'development/projects'
    };
    return typeMap[ticketType] || 'service/tickets';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    if (!ticketId) {
      alert('Bitte speichern Sie das Ticket zuerst, bevor Sie Dateien hochladen.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = getEndpoint();
      const response = await api.post(`/${endpoint}/${ticketId}/upload_attachment/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }
    } catch (error) {
      console.error('Fehler beim Hochladen:', error);
      alert('Fehler beim Hochladen der Datei: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm('Möchten Sie diese Datei wirklich löschen?')) {
      return;
    }

    const endpoint = getEndpoint();
    const base = `/${endpoint}/${ticketId}`;

    try {
      console.debug('Attempting to delete attachment (hyphen) at', `${base}/delete-attachment/${attachmentId}/`);
      await api.delete(`${base}/delete-attachment/${attachmentId}/`);
    } catch (error) {
      // If the backend expects underscore naming, try that as a fallback
      if (error.response?.status === 404) {
        try {
          console.debug('Fallback delete (underscore) at', `${base}/delete_attachment/${attachmentId}/`);
          await api.delete(`${base}/delete_attachment/${attachmentId}/`);
        } catch (err2) {
          console.error('Fehler beim Löschen (Fallback):', err2);
          alert('Fehler beim Löschen der Datei: ' + (err2.response?.data?.error || err2.message));
          return;
        }
      } else {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen der Datei: ' + (error.response?.data?.error || error.message));
        return;
      }
    }

    if (onDeleteSuccess) {
      onDeleteSuccess(attachmentId);
    }
  };

  const handleDownload = async (attachmentId, filename) => {
    const endpoint = getEndpoint();
    const base = `/${endpoint}/${ticketId}`;

    try {
      // try hyphen variant first
      console.debug('Attempting download (hyphen) at', `${base}/download-attachment/${attachmentId}/`);
      let response = await api.get(`${base}/download-attachment/${attachmentId}/`, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      if (error.response?.status === 404) {
        try {
          console.debug('Fallback download (underscore) at', `${base}/download_attachment/${attachmentId}/`);
          const response = await api.get(`${base}/download_attachment/${attachmentId}/`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch (err2) {
          console.error('Fehler beim Download (Fallback):', err2);
          alert('Fehler beim Download der Datei');
        }
      } else {
        console.error('Fehler beim Download:', error);
        alert('Fehler beim Download der Datei');
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const renderImagePreview = (attachment) => {
    return (
      <div className="relative group">
        <img
          src={attachment.file_url}
          alt={attachment.filename}
          className="w-32 h-32 object-cover rounded border cursor-pointer hover:opacity-80 transition"
          onClick={() => setPreviewImage(attachment.file_url)}
        />
        {allowPrimary && attachment.is_primary && (
          <div className="absolute bottom-1 left-1 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded shadow">
            Hauptfoto
          </div>
        )}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(attachment.id);
            }}
            className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
            title="Löschen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {allowPrimary && !attachment.is_primary && (
          <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onSetPrimary) onSetPrimary(attachment.id);
              }}
              className="p-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              title="Als Hauptfoto setzen"
            >
              ★
            </button>
          </div>
        )}
        <div className="mt-1 text-xs text-gray-600 truncate w-32" title={attachment.filename}>
          {attachment.filename}
        </div>
        <div className="text-xs text-gray-500">{formatFileSize(attachment.file_size)}</div>
      </div>
    );
  };

  const renderFileItem = (attachment) => {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate" title={attachment.filename}>
              {attachment.filename}
            </div>
            <div className="text-xs text-gray-500">
              {formatFileSize(attachment.file_size)} • {new Date(attachment.uploaded_at).toLocaleDateString('de-DE')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownload(attachment.id, attachment.filename)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
            title="Herunterladen"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(attachment.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
            title="Löschen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Separiere Bilder und andere Dateien
  const images = attachments.filter(att => att.is_image);
  const files = attachments.filter(att => !att.is_image);

  return (
    <div className="space-y-4">
      {/* Upload Bereich */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading || !ticketId}
        />
        <label
          htmlFor="file-upload"
          className={`cursor-pointer ${!ticketId || uploading ? 'cursor-not-allowed' : ''}`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          {uploading ? (
            <p className="text-gray-600">Wird hochgeladen...</p>
          ) : !ticketId ? (
            <p className="text-gray-600">Speichern Sie das Ticket zuerst</p>
          ) : (
            <>
              <p className="text-gray-600 mb-2">
                Ziehen Sie Dateien hierher oder <span className="text-blue-600">klicken Sie zum Auswählen</span>
              </p>
              <p className="text-sm text-gray-500">Alle Dateitypen werden unterstützt</p>
            </>
          )}
        </label>
      </div>

      {/* Bilder Grid */}
      {images.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Bilder ({images.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map(attachment => (
              <div key={attachment.id}>{renderImagePreview(attachment)}</div>
            ))}
          </div>
        </div>
      )}

      {/* Dateien Liste */}
      {files.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <File className="w-4 h-4" />
            Dateien ({files.length})
          </h4>
          <div className="space-y-2">
            {files.map(attachment => (
              <div key={attachment.id}>{renderFileItem(attachment)}</div>
            ))}
          </div>
        </div>
      )}

      {/* Bild-Vorschau Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Vorschau"
              className="max-w-full max-h-[90vh] rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
