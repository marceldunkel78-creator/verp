"""
Zentrale Upload-Pfad-Funktionen für VERP.

Alle Medien werden in der MEDIA_ROOT gespeichert mit folgender Struktur:
- /customer_orders/Jahr/Auftragsnummer/
- /orders/Jahr/Bestellnummer/
- /quotations/Jahr/Angebotsnummer/
- /Systems/Systemnummer/
- /projects/Projektnummer/
- /HR/Mitarbeiternummer/
- /Trading Goods/VS-Artikelnummer/
- /M&S/VS-Artikelnummer/
- /Service/Serviceticketnummer/
- /Manufacturing/Produktnummer/
- /VisiView/Lizenznummer/ oder /VisiView/Ticketnummer/
- /company/ (Firmenlogos etc.)
"""

import re
import os
from datetime import datetime


def _sanitize_path_component(name):
    """
    Bereinigt einen Pfadbestandteil von ungültigen Zeichen.
    Behält Bindestriche, Unterstriche, Punkte und alphanumerische Zeichen.
    """
    if not name:
        return ''
    # Replace slashes and backslashes with underscore
    name = name.replace('/', '_').replace('\\', '_')
    # Replace spaces with underscore
    name = name.replace(' ', '_')
    # Remove characters that are not alphanumeric, underscore, dot or hyphen
    return re.sub(r'[^A-Za-z0-9_.-]', '_', name)


def _get_year_from_instance(instance):
    """Extrahiert das Jahr aus dem Instanz-Datum oder verwendet aktuelles Jahr."""
    # Try common date fields
    for field in ['order_date', 'quotation_date', 'created_at', 'date']:
        date_val = getattr(instance, field, None)
        if date_val:
            if hasattr(date_val, 'year'):
                return str(date_val.year)
    return str(datetime.now().year)


def customer_order_upload_path(instance, filename):
    """
    Upload-Pfad: /customer_orders/Jahr/Auftragsnummer/filename
    """
    year = _get_year_from_instance(instance)
    order_number = _sanitize_path_component(getattr(instance, 'order_number', ''))
    safe_filename = _sanitize_path_component(filename)
    
    if order_number:
        return f"customer_orders/{year}/{order_number}/{safe_filename}"
    return f"customer_orders/{year}/unknown/{safe_filename}"


def order_upload_path(instance, filename):
    """
    Upload-Pfad: /orders/Jahr/Bestellnummer/filename
    """
    year = _get_year_from_instance(instance)
    order_number = _sanitize_path_component(getattr(instance, 'order_number', ''))
    safe_filename = _sanitize_path_component(filename)
    
    if order_number:
        return f"orders/{year}/{order_number}/{safe_filename}"
    return f"orders/{year}/unknown/{safe_filename}"


def quotation_upload_path(instance, filename):
    """
    Upload-Pfad: /quotations/Jahr/Angebotsnummer/filename
    """
    year = _get_year_from_instance(instance)
    quotation_number = _sanitize_path_component(getattr(instance, 'quotation_number', ''))
    safe_filename = _sanitize_path_component(filename)
    
    if quotation_number:
        return f"quotations/{year}/{quotation_number}/{safe_filename}"
    return f"quotations/{year}/unknown/{safe_filename}"


def system_upload_path(instance, filename):
    """
    Upload-Pfad: /Systems/Systemnummer/filename
    """
    system_number = _sanitize_path_component(getattr(instance, 'system_number', ''))
    safe_filename = _sanitize_path_component(filename)
    
    if system_number:
        return f"Systems/{system_number}/{safe_filename}"
    return f"Systems/unknown/{safe_filename}"


def project_upload_path(instance, filename):
    """
    Upload-Pfad: /projects/Projektnummer/filename
    """
    project_number = _sanitize_path_component(getattr(instance, 'project_number', ''))
    safe_filename = _sanitize_path_component(filename)
    
    if project_number:
        return f"projects/{project_number}/{safe_filename}"
    return f"projects/unknown/{safe_filename}"


def hr_upload_path(instance, filename):
    """
    Upload-Pfad: /HR/Mitarbeiternummer/filename
    """
    employee_number = _sanitize_path_component(
        getattr(instance, 'employee_number', '') or 
        getattr(instance, 'personnel_number', '')
    )
    safe_filename = _sanitize_path_component(filename)
    
    if employee_number:
        return f"HR/{employee_number}/{safe_filename}"
    return f"HR/unknown/{safe_filename}"


def trading_goods_upload_path(instance, filename):
    """
    Upload-Pfad: /Trading Goods/VS-Artikelnummer/filename
    """
    article_number = _sanitize_path_component(
        getattr(instance, 'vs_article_number', '') or 
        getattr(instance, 'article_number', '')
    )
    safe_filename = _sanitize_path_component(filename)
    
    if article_number:
        return f"Trading Goods/{article_number}/{safe_filename}"
    return f"Trading Goods/unknown/{safe_filename}"


def ms_upload_path(instance, filename):
    """
    Upload-Pfad: /M&S/VS-Artikelnummer/filename
    (Material & Supplies)
    """
    article_number = _sanitize_path_component(
        getattr(instance, 'vs_article_number', '') or 
        getattr(instance, 'article_number', '')
    )
    safe_filename = _sanitize_path_component(filename)
    
    if article_number:
        return f"M&S/{article_number}/{safe_filename}"
    return f"M&S/unknown/{safe_filename}"


def service_upload_path(instance, filename):
    """
    Upload-Pfad: /Service/Serviceticketnummer/filename
    """
    ticket_number = _sanitize_path_component(
        getattr(instance, 'ticket_number', '') or 
        getattr(instance, 'service_number', '')
    )
    safe_filename = _sanitize_path_component(filename)
    
    if ticket_number:
        return f"Service/{ticket_number}/{safe_filename}"
    return f"Service/unknown/{safe_filename}"


def manufacturing_upload_path(instance, filename):
    """
    Upload-Pfad: /Manufacturing/Produktnummer/filename
    """
    product_number = _sanitize_path_component(
        getattr(instance, 'product_number', '') or 
        getattr(instance, 'manufacturing_number', '')
    )
    safe_filename = _sanitize_path_component(filename)
    
    if product_number:
        return f"Manufacturing/{product_number}/{safe_filename}"
    return f"Manufacturing/unknown/{safe_filename}"


def visiview_license_upload_path(instance, filename):
    """
    Upload-Pfad: /VisiView/Lizenznummer/filename
    """
    license_number = _sanitize_path_component(getattr(instance, 'license_number', ''))
    safe_filename = _sanitize_path_component(filename)
    
    if license_number:
        return f"VisiView/{license_number}/{safe_filename}"
    return f"VisiView/unknown/{safe_filename}"


def visiview_ticket_upload_path(instance, filename):
    """
    Upload-Pfad: /VisiView/Ticketnummer/filename
    """
    ticket_number = _sanitize_path_component(getattr(instance, 'ticket_number', ''))
    safe_filename = _sanitize_path_component(filename)
    
    if ticket_number:
        return f"VisiView/{ticket_number}/{safe_filename}"
    return f"VisiView/unknown/{safe_filename}"


def company_upload_path(instance, filename):
    """
    Upload-Pfad: /company/filename
    (Firmenlogos, Header, etc.)
    """
    safe_filename = _sanitize_path_component(filename)
    return f"company/{safe_filename}"
