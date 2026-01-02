"""
Import script for VisiView Macros from Python_Macro_Snippets folder.
Imports .py files from the folder structure into the VisiViewMacro model.

Usage:
    python manage.py shell < import_visiview_macros.py
    or
    python import_visiview_macros.py

Imports from: Datenvorlagen/Python_Macro_Snippets/
"""

import os
import sys
import re
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from visiview.models import VisiViewMacro
from django.contrib.auth import get_user_model

User = get_user_model()

# Base path to macro snippets
BASE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'Datenvorlagen', 'Python_Macro_Snippets'
)


def parse_macro_header(content):
    """
    Parse the macro header to extract metadata.
    Returns a dict with: title, purpose, usage, author, date
    """
    metadata = {
        'title': '',
        'purpose': '',
        'usage': '',
        'author': '',
        'date': '',
        'visiview_version': ''
    }
    
    lines = content.split('\n')
    current_field = None
    current_value = []
    
    for line in lines:
        # Check if we've passed the header
        if not line.startswith('#') and line.strip():
            break
        
        # Remove comment marker
        clean_line = line.lstrip('#').strip()
        
        # Check for field markers
        if 'Macro Name:' in line or 'macroName' in clean_line:
            if current_field and current_value:
                metadata[current_field] = '\n'.join(current_value).strip()
            current_field = 'title'
            current_value = []
            # Try to get value on same line
            if ':' in clean_line:
                value = clean_line.split(':', 1)[1].strip()
                if value and value != 'macroName':
                    current_value.append(value)
        elif 'Purpose:' in line:
            if current_field and current_value:
                metadata[current_field] = '\n'.join(current_value).strip()
            current_field = 'purpose'
            current_value = []
        elif 'Description:' in line and 'Usage' not in line:
            if current_field and current_value:
                metadata[current_field] = '\n'.join(current_value).strip()
            current_field = 'purpose'
            current_value = []
        elif 'Usage:' in line:
            if current_field and current_value:
                metadata[current_field] = '\n'.join(current_value).strip()
            current_field = 'usage'
            current_value = []
        elif 'Author:' in line:
            if current_field and current_value:
                metadata[current_field] = '\n'.join(current_value).strip()
            current_field = 'author'
            current_value = []
            # Try to get value on same line
            if ':' in clean_line:
                value = clean_line.split(':', 1)[1].strip()
                if value:
                    current_value.append(value)
        elif 'Date:' in line:
            if current_field and current_value:
                metadata[current_field] = '\n'.join(current_value).strip()
            current_field = 'date'
            current_value = []
        elif 'VisiView Version:' in line:
            if current_field and current_value:
                metadata[current_field] = '\n'.join(current_value).strip()
            current_field = 'visiview_version'
            current_value = []
            if ':' in clean_line:
                value = clean_line.split(':', 1)[1].strip()
                if value:
                    current_value.append(value)
        elif current_field and clean_line:
            # Continue collecting multi-line value
            current_value.append(clean_line)
    
    # Save last field
    if current_field and current_value:
        metadata[current_field] = '\n'.join(current_value).strip()
    
    return metadata


def get_keywords_from_category(category):
    """Generate keywords based on category name."""
    keywords = []
    category_lower = category.lower()
    
    keyword_map = {
        'focus': ['Focus', 'Z-Position', 'Piezo'],
        'stage': ['Stage', 'Position', 'Movement'],
        'acquisition': ['Acquisition', 'Acquire', 'Capture'],
        'processing': ['Processing', 'Image Processing', 'Filter'],
        'frap': ['FRAP', 'Photobleaching', 'Recovery'],
        'tirf': ['TIRF', 'Total Internal Reflection'],
        'overlay': ['Overlay', 'Alignment'],
        'tracking': ['Tracking', 'Particle'],
        'batch': ['Batch', 'Automation'],
        'file': ['File', 'IO', 'Storage'],
        'window': ['Window', 'UI'],
        'device': ['Device', 'Hardware'],
        'startup': ['Startup', 'Initialization'],
        'measure': ['Measure', 'Measurement', 'Analysis'],
        'region': ['Region', 'ROI'],
        'ratio': ['Ratio', 'Ratiometric'],
        'z-stack': ['Z-Stack', '3D', 'Volume'],
        'time': ['Time Lapse', 'Time Series'],
        'microscope': ['Microscope', 'Hardware'],
        'conversion': ['Conversion', 'Format'],
        'training': ['Training', 'Example', 'Tutorial'],
    }
    
    for key, kws in keyword_map.items():
        if key in category_lower:
            keywords.extend(kws)
    
    if not keywords:
        # Use category name as keyword
        keywords.append(category)
    
    return ', '.join(keywords[:5])  # Limit to 5 keywords


def import_macros(dry_run=False):
    """
    Import all Python macros from the folder structure.
    """
    if not os.path.exists(BASE_PATH):
        print(f"ERROR: Base path does not exist: {BASE_PATH}")
        return
    
    print(f"Importing macros from: {BASE_PATH}")
    print("-" * 60)
    
    imported = 0
    skipped = 0
    errors = 0
    
    # Walk through all directories
    for root, dirs, files in os.walk(BASE_PATH):
        # Skip hidden directories and special folders
        dirs[:] = [d for d in dirs if not d.startswith('.') and not d.startswith('~')]
        
        for filename in files:
            if not filename.endswith('.py'):
                continue
            
            filepath = os.path.join(root, filename)
            relative_path = os.path.relpath(filepath, BASE_PATH)
            
            # Get category from folder structure
            path_parts = relative_path.split(os.sep)
            category = path_parts[0] if len(path_parts) > 1 else 'Uncategorized'
            
            # Skip template folder
            if category == '_Vorlage':
                continue
            
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Parse header for metadata
                metadata = parse_macro_header(content)
                
                # Generate title from filename if not in header
                title = metadata.get('title') or filename.replace('.py', '').replace('_', ' ')
                
                # Check if macro already exists (by original filename)
                existing = VisiViewMacro.objects.filter(original_filename=filename).first()
                if existing:
                    print(f"  SKIP (exists): {filename}")
                    skipped += 1
                    continue
                
                # Create the macro
                if dry_run:
                    print(f"  WOULD CREATE: {title} ({category})")
                else:
                    macro = VisiViewMacro.objects.create(
                        title=title,
                        author=metadata.get('author', ''),
                        visiview_version=metadata.get('visiview_version', ''),
                        purpose=metadata.get('purpose', ''),
                        usage=metadata.get('usage', ''),
                        code=content,
                        category=category,
                        keywords=get_keywords_from_category(category),
                        status='new',
                        original_filename=filename,
                        changelog=f"Importiert aus {relative_path}"
                    )
                    print(f"  CREATED: {macro.macro_id} - {title} ({category})")
                
                imported += 1
                
            except Exception as e:
                print(f"  ERROR: {filename} - {str(e)}")
                errors += 1
    
    print("-" * 60)
    print(f"Import complete: {imported} imported, {skipped} skipped, {errors} errors")
    
    return imported, skipped, errors


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Import VisiView Macros')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be imported without creating')
    args = parser.parse_args()
    
    import_macros(dry_run=args.dry_run)
