"""
Utility functions for managing file deletions and media trash
"""
import os
import shutil
from pathlib import Path
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from core.models import MediaTrash, DeletionLog


def get_media_trash_path():
    """Get or create the media trash directory"""
    trash_path = Path(settings.MEDIA_ROOT) / '.trash'
    trash_path.mkdir(exist_ok=True)
    return trash_path


def move_file_to_trash(file_path, related_object, deleted_by, reason=''):
    """
    Move a file to the trash directory
    
    Args:
        file_path: Path object or string path to the file
        related_object: The Django model instance this file belongs to
        deleted_by: User who deleted the file
        reason: Optional reason for deletion
    
    Returns:
        MediaTrash instance or None if file doesn't exist
    """
    if isinstance(file_path, str):
        file_path = Path(file_path)
    
    # Check if file exists
    if not file_path.exists():
        return None
    
    # Get media root
    media_root = Path(settings.MEDIA_ROOT)
    
    # Calculate relative path from MEDIA_ROOT
    try:
        relative_path = file_path.relative_to(media_root)
    except ValueError:
        # File is not in MEDIA_ROOT
        relative_path = file_path.name
    
    # Create trash destination
    trash_root = get_media_trash_path()
    trash_file_path = trash_root / relative_path
    
    # Ensure parent directory exists
    trash_file_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Handle duplicate filenames in trash
    counter = 1
    original_trash_path = trash_file_path
    while trash_file_path.exists():
        stem = original_trash_path.stem
        suffix = original_trash_path.suffix
        trash_file_path = original_trash_path.parent / f"{stem}_{counter}{suffix}"
        counter += 1
    
    # Move file to trash
    try:
        shutil.move(str(file_path), str(trash_file_path))
    except Exception as e:
        print(f"Error moving file to trash: {e}")
        return None
    
    # Get file size
    file_size = trash_file_path.stat().st_size if trash_file_path.exists() else 0
    
    # Get content type
    content_type = ContentType.objects.get_for_model(related_object)
    
    # Get object description
    object_description = str(related_object)
    
    # Create MediaTrash entry
    media_trash = MediaTrash.objects.create(
        original_path=str(relative_path),
        trash_path=str(trash_file_path.relative_to(trash_root)),
        filename=file_path.name,
        file_size=file_size,
        content_type=content_type,
        object_id=related_object.pk,
        object_description=object_description,
        deleted_by=deleted_by,
        deletion_reason=reason
    )
    
    return media_trash


def move_directory_to_trash(directory_path, related_object, deleted_by, reason=''):
    """
    Move an entire directory to trash
    
    Args:
        directory_path: Path to directory
        related_object: The Django model instance this directory belongs to
        deleted_by: User who deleted
        reason: Optional reason
    
    Returns:
        List of MediaTrash instances
    """
    if isinstance(directory_path, str):
        directory_path = Path(directory_path)
    
    if not directory_path.exists() or not directory_path.is_dir():
        return []
    
    moved_files = []
    
    # Iterate over all files in directory recursively
    for file_path in directory_path.rglob('*'):
        if file_path.is_file():
            media_trash = move_file_to_trash(file_path, related_object, deleted_by, reason)
            if media_trash:
                moved_files.append(media_trash)
    
    # Remove empty directory
    try:
        shutil.rmtree(directory_path)
    except:
        pass
    
    return moved_files


def restore_file_from_trash(media_trash_id):
    """
    Restore a file from trash to its original location
    
    Args:
        media_trash_id: ID of MediaTrash instance
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        media_trash = MediaTrash.objects.get(id=media_trash_id)
        
        if not media_trash.can_restore:
            return False
        
        trash_root = get_media_trash_path()
        trash_file = trash_root / media_trash.trash_path
        
        if not trash_file.exists():
            return False
        
        # Reconstruct original path
        media_root = Path(settings.MEDIA_ROOT)
        original_file = media_root / media_trash.original_path
        
        # Ensure parent directory exists
        original_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Move file back
        shutil.move(str(trash_file), str(original_file))
        
        # Delete MediaTrash entry
        media_trash.delete()
        
        return True
    
    except Exception as e:
        print(f"Error restoring file: {e}")
        return False


def permanently_delete_trash_item(media_trash_id):
    """
    Permanently delete a file from trash
    
    Args:
        media_trash_id: ID of MediaTrash instance
    
    Returns:
        bool: True if successful
    """
    try:
        media_trash = MediaTrash.objects.get(id=media_trash_id)
        
        trash_root = get_media_trash_path()
        trash_file = trash_root / media_trash.trash_path
        
        # Delete physical file
        if trash_file.exists():
            trash_file.unlink()
        
        # Delete database entry
        media_trash.delete()
        
        return True
    
    except Exception as e:
        print(f"Error permanently deleting trash item: {e}")
        return False


def empty_trash(older_than_days=None):
    """
    Empty the entire trash or items older than specified days
    
    Args:
        older_than_days: Optional number of days. Items older than this will be deleted
    
    Returns:
        int: Number of items deleted
    """
    from django.utils import timezone
    from datetime import timedelta
    
    queryset = MediaTrash.objects.all()
    
    if older_than_days:
        cutoff_date = timezone.now() - timedelta(days=older_than_days)
        queryset = queryset.filter(deleted_at__lt=cutoff_date)
    
    count = 0
    for media_trash in queryset:
        if permanently_delete_trash_item(media_trash.id):
            count += 1
    
    return count


def log_deletion(entity_type, entity_id, entity_description, action, deleted_by, 
                 reason='', was_forced=False, media_count=0):
    """
    Log a deletion action
    
    Args:
        entity_type: Type of entity (quotation, customer_order, etc.)
        entity_id: ID of the entity
        entity_description: Human-readable description
        action: deleted, cancelled, or force_deleted
        deleted_by: User who performed the action
        reason: Optional reason
        was_forced: Whether force delete was used
        media_count: Number of media files moved to trash
    
    Returns:
        DeletionLog instance
    """
    return DeletionLog.objects.create(
        entity_type=entity_type,
        entity_id=entity_id,
        entity_description=entity_description,
        action=action,
        deleted_by=deleted_by,
        reason=reason,
        was_forced=was_forced,
        media_count=media_count
    )
