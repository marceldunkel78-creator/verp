# File Upload Implementation for Tickets

## Overview
Implemented comprehensive file upload functionality for all three ticket types in the VERP system:
- Service Tickets
- Troubleshooting Tickets
- VisiView Tickets

## Features
- ✅ Drag & Drop file upload
- ✅ Multi-file support
- ✅ Image preview for JPG, PNG, GIF, BMP, WebP
- ✅ Full-size image preview modal
- ✅ File download functionality
- ✅ File deletion with confirmation
- ✅ Organized folder structure per ticket type
- ✅ File metadata (size, content type, upload date)

## Folder Structure
Files are automatically organized in the following structure:
```
/VERP-Media/
  ├── Service/
  │   └── Service-tickets/
  │       └── {ticket_number}/
  │           ├── file1.pdf
  │           ├── image1.jpg
  │           └── ...
  ├── Service/
  │   └── Troubleshooting/
  │       └── {ticket_number}/
  │           ├── file1.pdf
  │           ├── screenshot1.png
  │           └── ...
  └── VisiView/
      └── VisiView-Tickets/
          └── {ticket_number}/
              ├── file1.pdf
              ├── diagram1.jpg
              └── ...
```

## Backend Implementation

### Models Created
1. **ServiceTicketAttachment** (`service/models.py`)
   - Fields: `ticket`, `file`, `filename`, `file_size`, `content_type`, `uploaded_by`, `uploaded_at`
   - Property: `is_image` - Auto-detects image files
   - Related name: `ticket_attachments`

2. **TroubleshootingAttachment** (`service/models.py`)
   - Same structure as ServiceTicketAttachment
   - Related name: `attachments`

3. **VisiViewTicketAttachment** (`visiview/models.py`)
   - Same structure as ServiceTicketAttachment
   - Related name: `attachments`

### Upload Path Functions
Created in `core/upload_paths.py`:
- `service_ticket_attachment_path()` - Returns: `Service/Service-tickets/{ticket_number}/{sanitized_filename}`
- `troubleshooting_attachment_path()` - Returns: `Service/Troubleshooting/{ticket_number}/{sanitized_filename}`
- `visiview_ticket_attachment_path()` - Returns: `VisiView/VisiView-Tickets/{ticket_number}/{sanitized_filename}`

### Serializers
Added attachment serializers with:
- File URL generation (absolute URL)
- Uploaded by user name
- File size and content type
- Is_image flag for frontend conditional rendering

### API Endpoints
Added to each ticket ViewSet:
1. **`POST /{tickets}/{id}/upload_attachment/`**
   - Accepts: multipart/form-data with 'file' field
   - Returns: Created attachment object with metadata

2. **`GET /{tickets}/{id}/download_attachment/{attachment_id}/`**
   - Returns: File as download with correct filename

3. **`DELETE /{tickets}/{id}/delete_attachment/{attachment_id}/`**
   - Deletes file from storage and database
   - Returns: 204 No Content

### Migrations
- `service/migrations/0007_*` - Creates ServiceTicketAttachment and TroubleshootingAttachment tables
- `visiview/migrations/0007_*` - Renames VisiViewTicket.attachments to attachment_notes (TextField), creates VisiViewTicketAttachment table

### Admin Registration
All three attachment models registered in Django admin with:
- List display: ticket, filename, file_size, is_image, uploaded_by, uploaded_at
- List filters: uploaded_at, content_type
- Search fields: ticket number, filename

## Frontend Implementation

### Reusable Component
**`frontend/src/components/FileUpload.js`**
- Universal component for all ticket types
- Props:
  - `attachments` - Array of attachment objects
  - `ticketId` - Current ticket ID
  - `ticketType` - 'service', 'troubleshooting', or 'visiview'
  - `onUploadSuccess` - Callback after successful upload
  - `onDeleteSuccess` - Callback after successful deletion

Features:
- Drag & drop zone with visual feedback
- Automatic type detection (image vs. file)
- Separate display sections for images and files
- Image grid with thumbnails (32x32 responsive grid)
- File list with size and date
- Download buttons for all files
- Delete buttons with confirmation
- Full-screen image preview modal
- File size formatting (Bytes, KB, MB, GB)

### Integration in Pages
Updated three ticket edit pages:
1. **ServiceTicketEdit.js** - Added FileUpload component with `ticketType="service"`
2. **TroubleshootingEdit.js** - Added FileUpload component with `ticketType="troubleshooting"`
3. **VisiViewTicketEdit.js** - Added FileUpload component with `ticketType="visiview"`

All integrated in the left column between main form and comments section.

## Usage

### For Users
1. Open any existing ticket (Service, Troubleshooting, or VisiView)
2. Scroll to the "Dateien" (Files) section
3. Either:
   - Drag and drop files into the upload zone, or
   - Click the upload zone to select files
4. Files automatically upload and appear in the appropriate section:
   - Images display as thumbnails in a grid
   - Other files display in a list with download icon
5. To view an image full-size, click on the thumbnail
6. To download any file, click the download icon
7. To delete a file, click the X icon (requires confirmation)

### For Developers
To use the FileUpload component in other contexts:
```javascript
import FileUpload from '../components/FileUpload';

<FileUpload
  attachments={ticket.attachments || []}
  ticketId={ticket.id}
  ticketType="service" // or 'troubleshooting' or 'visiview'
  onUploadSuccess={(newAttachment) => {
    // Update your state with newAttachment
  }}
  onDeleteSuccess={(attachmentId) => {
    // Remove attachment from your state
  }}
/>
```

## Security Considerations
- Authentication required for all endpoints (IsAuthenticated permission)
- File deletion requires ticket ownership (checked via ticket access)
- Files stored outside web root with controlled access
- Sanitized filenames prevent directory traversal
- Content-Type validated on upload

## Testing Checklist
- [ ] Upload single file to Service Ticket
- [ ] Upload multiple files to Troubleshooting Ticket
- [ ] Upload images to VisiView Ticket and verify preview
- [ ] Download files from all ticket types
- [ ] Delete files and verify removal from storage
- [ ] Verify folder structure creation
- [ ] Test drag & drop functionality
- [ ] Test image preview modal
- [ ] Verify file size display accuracy
- [ ] Test with various file types (PDF, DOCX, JPG, PNG, etc.)

## Future Enhancements
- [ ] File type restrictions (if needed)
- [ ] Maximum file size limits
- [ ] Bulk file upload
- [ ] Zip file download of all attachments
- [ ] Inline PDF preview
- [ ] File versioning
- [ ] Attachment comments/notes

## Files Modified
### Backend
- `backend/core/upload_paths.py` - Added 3 upload path functions
- `backend/service/models.py` - Added ServiceTicketAttachment, TroubleshootingAttachment, fixed TicketChangeLog
- `backend/service/serializers.py` - Added attachment serializers, updated ticket detail serializers
- `backend/service/views.py` - Added upload/download/delete endpoints to ServiceTicketViewSet, TroubleshootingViewSet
- `backend/service/admin.py` - Registered attachment models
- `backend/visiview/models.py` - Renamed attachments field, added VisiViewTicketAttachment
- `backend/visiview/serializers.py` - Added VisiViewTicketAttachmentSerializer, updated ticket detail serializer
- `backend/visiview/views.py` - Added upload/download/delete endpoints to VisiViewTicketViewSet
- `backend/visiview/admin.py` - Registered VisiViewTicketAttachment

### Frontend
- `frontend/src/components/FileUpload.js` - New reusable component
- `frontend/src/pages/ServiceTicketEdit.js` - Integrated FileUpload
- `frontend/src/pages/TroubleshootingEdit.js` - Integrated FileUpload
- `frontend/src/pages/VisiViewTicketEdit.js` - Integrated FileUpload, replaced old attachments display

## Database Migrations Applied
```bash
python manage.py makemigrations
# Created:
# - service/migrations/0007_alter_ticketchangelog_field_name_and_more.py
# - visiview/migrations/0007_remove_visiviewticket_attachments_and_more.py

python manage.py migrate
# Applied successfully
```
