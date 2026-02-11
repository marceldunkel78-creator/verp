import React, { useState } from 'react';
import { Upload, File, X, Eye } from 'lucide-react';

/**
 * Reusable File Upload Component for Order Documents
 * 
 * Props:
 * - currentFile: String URL or File object of currently uploaded file
 * - onFileSelect: Callback when file is selected (receives File object or null)
 * - label: Label for the upload area
 * - accept: File types to accept (default: .pdf,.doc,.docx)
 * - disabled: Whether upload is disabled
 * - required: Whether field is required
 */
const OrderFileUpload = ({ 
  currentFile = null, 
  onFileSelect, 
  label = "Dokument hochladen",
  accept = ".pdf,.doc,.docx",
  disabled = false,
  required = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
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

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  const handleFileChange = (file) => {
    // Validate file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const acceptedExtensions = accept.split(',').map(ext => ext.trim().replace('.', ''));
    
    if (!acceptedExtensions.includes(fileExtension)) {
      alert(`Nur folgende Dateitypen sind erlaubt: ${accept}`);
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      alert('Die Datei ist zu groß. Maximal 10MB sind erlaubt.');
      return;
    }

    setSelectedFile(file);
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (onFileSelect) {
      onFileSelect(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileName = () => {
    if (selectedFile) {
      return selectedFile.name;
    }
    if (currentFile && typeof currentFile === 'string') {
      return currentFile.split('/').pop();
    }
    if (currentFile && currentFile.name) {
      return currentFile.name;
    }
    return null;
  };

  const getFileUrl = () => {
    if (currentFile && typeof currentFile === 'string') {
      return currentFile;
    }
    return null;
  };

  const hasFile = selectedFile || currentFile;
  const fileName = getFileName();
  const fileUrl = getFileUrl();

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Display existing or newly selected file */}
      {hasFile && fileName && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <File className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-blue-900 truncate" title={fileName}>
                {fileName}
              </div>
              {selectedFile && (
                <div className="text-xs text-blue-700">
                  {formatFileSize(selectedFile.size)} • Neu hochgeladen
                </div>
              )}
              {!selectedFile && currentFile && typeof currentFile === 'string' && (
                <div className="text-xs text-blue-700">
                  Aktuell gespeichert
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-blue-600 hover:bg-blue-100 rounded transition"
                title="Öffnen"
              >
                <Eye className="w-4 h-4" />
              </a>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-2 text-red-600 hover:bg-red-100 rounded transition"
                title="Entfernen"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload area */}
      {!selectedFile && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id={`file-upload-${label}`}
            className="hidden"
            onChange={handleFileInputChange}
            disabled={disabled}
            accept={accept}
          />
          <label
            htmlFor={`file-upload-${label}`}
            className={`${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            {disabled ? (
              <p className="text-sm text-gray-500">Upload deaktiviert</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-1">
                  Ziehen Sie eine Datei hierher oder <span className="text-blue-600">klicken Sie zum Auswählen</span>
                </p>
                <p className="text-xs text-gray-500">
                  Erlaubt: {accept} (max. 10MB)
                </p>
              </>
            )}
          </label>
        </div>
      )}
    </div>
  );
};

export default OrderFileUpload;
