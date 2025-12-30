"""
PDF Generator für Reisekostenabrechnungen

Professionelles DIN A4 Layout mit:
- Header auf jeder Seite
- Reisekostenaufstellung mit Tagen und Kosten
- Unterschriftsfeld und Bankverbindung
- Belege als Anhang (wenn verfügbar)
"""
from io import BytesIO
from decimal import Decimal
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, 
    Image, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.lib.utils import ImageReader
from company.models import CompanySettings
from django.conf import settings
from django.utils import timezone
from PyPDF2 import PdfMerger, PdfReader
from PIL import Image as PILImage
import os
import io


def get_company_settings():
    """Lädt die Firmeneinstellungen"""
    try:
        return CompanySettings.objects.first()
    except Exception:
        return None


def generate_travel_expense_pdf(report):
    """
    Generiert ein PDF für eine Reisekostenabrechnung.
    
    Args:
        report: TravelExpenseReport Instanz
        
    Returns:
        BytesIO: PDF-Daten als BytesIO-Objekt
    """
    buffer = BytesIO()
    
    # Seiteneinstellungen
    page_width, page_height = A4
    margin_left = 2.5 * cm
    margin_right = 2 * cm
    margin_top = 2 * cm
    margin_bottom = 2.5 * cm
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=margin_left,
        rightMargin=margin_right,
        topMargin=margin_top,
        bottomMargin=margin_bottom
    )
    
    # Styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=20,
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'Heading',
        parent=styles['Heading2'],
        fontSize=12,
        spaceBefore=15,
        spaceAfter=10
    )
    
    normal_style = ParagraphStyle(
        'Normal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6
    )
    
    small_style = ParagraphStyle(
        'Small',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey
    )
    
    # Inhaltselemente
    elements = []
    
    # Firmen-Header
    company = get_company_settings()
    if company and company.document_header:
        try:
            header_path = company.document_header.path
            if os.path.exists(header_path):
                img = Image(header_path, width=17*cm, height=3*cm)
                img.hAlign = 'CENTER'
                elements.append(img)
                elements.append(Spacer(1, 0.5*cm))
        except Exception:
            pass
    
    # Mitarbeiter-Daten
    user = report.user
    employee = getattr(user, 'employee', None)
    employee_name = f"{employee.first_name} {employee.last_name}" if employee else user.get_full_name()
    employee_id = employee.employee_id if employee else "-"
    
    # Titel
    elements.append(Paragraph(
        f"Reisekostenabrechnung",
        title_style
    ))
    elements.append(Paragraph(
        f"KW {report.calendar_week}/{report.year}",
        ParagraphStyle('Subtitle', parent=styles['Heading2'], alignment=TA_CENTER, fontSize=14)
    ))
    elements.append(Spacer(1, 0.5*cm))
    
    # Mitarbeiter-Info Box
    info_data = [
        ['Mitarbeiter:', employee_name],
        ['Mitarbeiter-ID:', employee_id],
        ['Zeitraum:', f"{report.start_date.strftime('%d.%m.%Y')} - {report.end_date.strftime('%d.%m.%Y')}"],
        ['Status:', report.get_status_display()],
    ]
    
    info_table = Table(info_data, colWidths=[4*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # Reisekostenaufstellung
    elements.append(Paragraph("Reisekostenaufstellung", heading_style))
    
    # Tabelle: Datum | Ort | Reisezeit | Pauschale | Ausgaben | Gesamt
    table_data = [['Datum', 'Ort / Land', 'Reisezeit', 'Pauschale', 'Ausgaben', 'Tagesgesamt']]
    
    total_per_diem = Decimal('0.00')
    total_expenses = Decimal('0.00')
    
    for day in report.days.all().order_by('date'):
        date_str = day.date.strftime('%d.%m.%Y')
        location_str = f"{day.location or '-'}\n({day.country})"
        travel_time = f"{day.travel_hours or 0} h"
        per_diem = Decimal(str(day.per_diem_applied or 0))
        
        expenses_sum = sum(Decimal(str(exp.amount)) for exp in day.expenses.all())
        day_total = per_diem + expenses_sum
        
        total_per_diem += per_diem
        total_expenses += expenses_sum
        
        table_data.append([
            date_str,
            Paragraph(location_str, ParagraphStyle('Cell', fontSize=9)),
            travel_time,
            f"{per_diem:.2f} €",
            f"{expenses_sum:.2f} €",
            f"{day_total:.2f} €"
        ])
    
    # Summenzeile
    grand_total = total_per_diem + total_expenses
    table_data.append([
        '', '', '',
        Paragraph(f"<b>{total_per_diem:.2f} €</b>", ParagraphStyle('Bold', fontSize=10)),
        Paragraph(f"<b>{total_expenses:.2f} €</b>", ParagraphStyle('Bold', fontSize=10)),
        Paragraph(f"<b>{grand_total:.2f} €</b>", ParagraphStyle('Bold', fontSize=10))
    ])
    
    col_widths = [2.5*cm, 4*cm, 2*cm, 2.5*cm, 2.5*cm, 2.5*cm]
    days_table = Table(table_data, colWidths=col_widths)
    days_table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e0e0e0')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        # Daten
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        # Gitter
        ('GRID', (0, 0), (-1, -2), 0.5, colors.grey),
        # Summenzeile
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
        ('FONTNAME', (3, -1), (-1, -1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    elements.append(days_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # Einzelne Ausgaben auflisten (wenn vorhanden)
    has_expenses = any(day.expenses.exists() for day in report.days.all())
    if has_expenses:
        elements.append(Paragraph("Einzelne Ausgaben", heading_style))
        
        expense_data = [['Datum', 'Art', 'Beschreibung', 'Betrag', 'Beleg']]
        for day in report.days.all().order_by('date'):
            for exp in day.expenses.all():
                receipt_text = "✓" if exp.receipt else "-"
                expense_data.append([
                    day.date.strftime('%d.%m.%Y'),
                    exp.get_expense_type_display(),
                    Paragraph(exp.description[:50] + ('...' if len(exp.description) > 50 else ''), 
                              ParagraphStyle('Cell', fontSize=8)),
                    f"{exp.amount:.2f} €",
                    receipt_text
                ])
        
        exp_col_widths = [2.5*cm, 2.5*cm, 7*cm, 2.5*cm, 1.5*cm]
        exp_table = Table(expense_data, colWidths=exp_col_widths)
        exp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f0f0f0')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('ALIGN', (4, 0), (4, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(exp_table)
        elements.append(Spacer(1, 0.5*cm))
    
    # Gesamtsumme Box
    summary_data = [[
        Paragraph('<b>Gesamtbetrag der Reisekostenabrechnung:</b>', 
                  ParagraphStyle('SummaryLabel', fontSize=11)),
        Paragraph(f'<b>{grand_total:.2f} €</b>', 
                  ParagraphStyle('SummaryValue', fontSize=14, alignment=TA_RIGHT))
    ]]
    summary_table = Table(summary_data, colWidths=[12*cm, 4*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#e8f4e8')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#4CAF50')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 1*cm))
    
    # Bankverbindung
    if employee and employee.bank_iban:
        bank_text = f"Die Reisekosten sollen auf folgendes Konto überwiesen werden:"
        elements.append(Paragraph(bank_text, normal_style))
        
        bank_details = []
        if employee.bank_account_holder:
            bank_details.append(f"Kontoinhaber: {employee.bank_account_holder}")
        bank_details.append(f"IBAN: {employee.bank_iban}")
        if employee.bank_bic:
            bank_details.append(f"BIC: {employee.bank_bic}")
        if employee.bank_name:
            bank_details.append(f"Bank: {employee.bank_name}")
        
        for detail in bank_details:
            elements.append(Paragraph(detail, ParagraphStyle('BankDetail', fontSize=10, leftIndent=20)))
        
        elements.append(Spacer(1, 0.5*cm))
    else:
        elements.append(Paragraph(
            "<i>Hinweis: Keine Bankverbindung hinterlegt. Bitte in den Mitarbeiterdaten ergänzen.</i>",
            ParagraphStyle('Warning', fontSize=9, textColor=colors.red)
        ))
        elements.append(Spacer(1, 0.5*cm))
    
    # Unterschriftsbereich
    elements.append(Spacer(1, 1*cm))
    
    creation_date = timezone.now().strftime('%d.%m.%Y')
    sig_data = [
        [f"Datum: {creation_date}", '', 'Unterschrift:'],
        ['', '', ''],
        ['_' * 25, '', '_' * 40],
    ]
    sig_table = Table(sig_data, colWidths=[5*cm, 4*cm, 7*cm])
    sig_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (2, 0), (2, -1), 'LEFT'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(sig_table)
    
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph(
        "Ich versichere, dass die obigen Angaben vollständig und richtig sind.",
        ParagraphStyle('Disclaimer', fontSize=9, textColor=colors.grey)
    ))
    
    # PDF generieren
    doc.build(elements)
    buffer.seek(0)
    
    return buffer


def merge_receipts_into_pdf(report, main_pdf_buffer):
    """
    Fügt die Belege (Bilder/PDFs) als Anhang zum Haupt-PDF hinzu.
    
    Args:
        report: TravelExpenseReport Instanz
        main_pdf_buffer: BytesIO mit dem Haupt-PDF
        
    Returns:
        BytesIO: Kombiniertes PDF mit Belegen als Anhang
    """
    merger = PdfMerger()
    
    # Haupt-PDF hinzufügen
    main_pdf_buffer.seek(0)
    merger.append(main_pdf_buffer)
    
    # Belege sammeln
    receipts = []
    for day in report.days.all():
        for expense in day.expenses.all():
            if expense.receipt:
                try:
                    receipt_path = expense.receipt.path
                    if os.path.exists(receipt_path):
                        receipts.append({
                            'path': receipt_path,
                            'expense': expense,
                            'day': day
                        })
                except Exception:
                    continue
    
    # Belege als separate Seiten hinzufügen
    for receipt_info in receipts:
        receipt_path = receipt_info['path']
        file_ext = os.path.splitext(receipt_path)[1].lower()
        
        try:
            if file_ext == '.pdf':
                # PDF direkt anhängen
                merger.append(receipt_path)
            elif file_ext in ['.jpg', '.jpeg', '.png']:
                # Bild in PDF konvertieren
                img_pdf = image_to_pdf(receipt_path, receipt_info)
                if img_pdf:
                    merger.append(img_pdf)
        except Exception as e:
            print(f"Fehler beim Hinzufügen des Belegs {receipt_path}: {e}")
            continue
    
    # Kombiniertes PDF erstellen
    output = BytesIO()
    merger.write(output)
    merger.close()
    output.seek(0)
    
    return output


def image_to_pdf(image_path, receipt_info):
    """
    Konvertiert ein Bild in eine PDF-Seite mit Beschriftung.
    
    Args:
        image_path: Pfad zum Bild
        receipt_info: Dict mit expense und day Informationen
        
    Returns:
        BytesIO: PDF-Seite mit dem Bild
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Image, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    
    buffer = BytesIO()
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.5*cm,
        rightMargin=1.5*cm,
        topMargin=1.5*cm,
        bottomMargin=1.5*cm
    )
    
    styles = getSampleStyleSheet()
    elements = []
    
    # Beschriftung
    expense = receipt_info['expense']
    day = receipt_info['day']
    
    header_text = f"Beleg: {expense.get_expense_type_display()} - {expense.description}"
    date_text = f"Datum: {day.date.strftime('%d.%m.%Y')} | Betrag: {expense.amount:.2f} €"
    
    elements.append(Paragraph(header_text, styles['Heading3']))
    elements.append(Paragraph(date_text, styles['Normal']))
    elements.append(Spacer(1, 0.5*cm))
    
    # Bild einfügen (skaliert auf Seitenbreite)
    try:
        page_width, page_height = A4
        max_width = page_width - 3*cm
        max_height = page_height - 6*cm
        
        # Bildgröße ermitteln
        with PILImage.open(image_path) as img:
            img_width, img_height = img.size
        
        # Skalierung berechnen
        scale_w = max_width / img_width
        scale_h = max_height / img_height
        scale = min(scale_w, scale_h, 1.0)  # Nicht größer als Original
        
        display_width = img_width * scale
        display_height = img_height * scale
        
        img = Image(image_path, width=display_width, height=display_height)
        elements.append(img)
        
        doc.build(elements)
        buffer.seek(0)
        return buffer
        
    except Exception as e:
        print(f"Fehler beim Konvertieren des Bildes {image_path}: {e}")
        return None


def generate_complete_travel_expense_pdf(report):
    """
    Generiert das vollständige Reisekosten-PDF mit Belegen.
    
    Args:
        report: TravelExpenseReport Instanz
        
    Returns:
        BytesIO: Vollständiges PDF mit Belegen
    """
    # Haupt-PDF generieren
    main_pdf = generate_travel_expense_pdf(report)
    
    # Prüfen ob Belege vorhanden
    has_receipts = any(
        expense.receipt 
        for day in report.days.all() 
        for expense in day.expenses.all()
    )
    
    if has_receipts:
        # Mit Belegen zusammenführen
        return merge_receipts_into_pdf(report, main_pdf)
    else:
        # Nur Haupt-PDF zurückgeben
        return main_pdf
