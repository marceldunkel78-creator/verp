# MEDIA_ROOT / Media Storage Deployment Guide

This document explains how to configure and deploy VERP's MEDIA storage for production environments. The goal is to store uploaded media (attachments, manuals, signatures, PDFs, images) under a central `MEDIA_ROOT` that mirrors the frontend/module hierarchy (Sales, Procurement, Service, VisiView, HR, MyVERP, company).

## Key Principles
- Keep media under one `MEDIA_ROOT` that is accessible by the Django application process and any other services that need to read/write files.
- Use a path that is mounted from a dedicated file server or network share in production (NFS, CIFS/SMB, or managed object storage).
- Set secure permissions for the media folder and backups.
- Keep the folder structure consistent: e.g. `Sales/Marketing/<category>/<id>/`, `Procurement/Trading Goods/<article>/manuals/`, `HR/<employee_id>/signatures/`, `Service/Service-tickets/<ticket_number>/`.

## Examples

### Windows (UNC path)
Set `MEDIA_ROOT` in `backend/.env`:

MEDIA_ROOT=\\\\fileserver\\verp_media

Notes:
- Use double backslashes or a single UNC path value in the `.env` file. Example in PowerShell when setting environment variables is `setx MEDIA_ROOT "\\fileserver\verp_media"`.
- Ensure the service account running Django (or Docker container) has read/write access to the UNC share.

### Linux (mount path)
Set `MEDIA_ROOT` in `backend/.env`:

MEDIA_ROOT=/mnt/verp_media

Mount the file server (NFS/CIFS) on the host and ensure the container or process uses the mounted path. For NFS:

```bash
# On the host
sudo mkdir -p /mnt/verp_media
sudo mount -t nfs fileserver:/exports/verp_media /mnt/verp_media
# Add to /etc/fstab for persistence
```

### Docker Compose / Containerized Deployment
Mount the host path as a volume into the backend container and set `MEDIA_ROOT` inside the `.env` file or environment variables.

Example `docker-compose.yml` snippet:

```yaml
services:
  backend:
    volumes:
      - /mnt/verp_media:/app/media
    environment:
      - MEDIA_ROOT=/app/media
```

If using Docker on Windows with a UNC path, map the UNC to a drive letter on the Docker host or ensure the Docker engine can access the UNC share.

## Permissions & Security
- Use a dedicated service account for file access; avoid using root or unnecessary privileged accounts.
- Files should be writable by the Django process and readable by any services that need to access them (e.g., file-serving Nginx or backup jobs).
- For SELinux-enabled systems, ensure the correct SELinux context is set (e.g., `chcon -R -t httpd_sys_rw_content_t /mnt/verp_media` for Apache/Nginx writable directories).

## Backups
- Regularly back up the `MEDIA_ROOT` folder with a solution that preserves permissions, timestamps, and file contents (rsync, snapshot, object-store lifecycle).
- Use incremental backups for large datasets.

## Migration notes (moving existing media)
1. Stop writes to the application (maintenance mode).
2. Copy files from the old media location to the new one preserving ownership and permissions:

```bash
rsync -a --progress /old/media/path/ /mnt/verp_media/
```

3. Update `MEDIA_ROOT` in `backend/.env` and restart services.
4. Verify media accessible via the Django admin/pages.

## Verification / Quick Tests
1. Upload a test file via the web UI (e.g., create a Marketing item and upload a file), then verify the file appears under `<MEDIA_ROOT>/Sales/Marketing/...`.
2. Try downloading the file from the UI.
3. Check file metadata (size, content-type) in the Django admin.

### Curl-based quick upload test (requires authentication cookie/token)
Example (replace `TOKEN` and `ITEM_ID` accordingly):

```bash
curl -X POST "http://localhost:8000/api/sales/marketing-items/<ITEM_ID>/upload_attachment/" \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@/path/to/testfile.pdf"
```

## Notes for object storage (S3 etc.)
- If you prefer object storage (S3/MinIO), use `django-storages` and configure a storage backend that replaces default `FileSystemStorage`.
- In that case, `MEDIA_ROOT` is typically not used; instead configure `DEFAULT_FILE_STORAGE` to your S3 backend and set a bucket/prefix that mirrors the desired folder structure.

## Rollout checklist
- [ ] Decide on fileserver type (NFS/CIFS/Object storage)
- [ ] Create the directory or bucket and give access rights to the Django service account
- [ ] Set `MEDIA_ROOT` in `backend/.env` to the mounted path or configure S3 backend
- [ ] Copy existing media to new location preserving perms
- [ ] Restart backend services and verify uploads/downloads
- [ ] Configure backups and monitoring

---

If you want, I can add an automated verification script to run after deployment (uploads a small file and checks the path). Want me to add that script too?