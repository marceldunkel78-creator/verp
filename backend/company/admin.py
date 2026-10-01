from django.contrib import admin
from django.utils.html import format_html
from .models import CompanySettings


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'city', 'managing_director', 'logo_status']
    
    fieldsets = (
        ('Firmeninformationen', {
            'fields': ('company_name',)
        }),
        ('Adresse', {
            'fields': ('street', 'house_number', 'postal_code', 'city', 'country')
        }),
        ('Kontaktdaten', {
            'fields': ('phone', 'fax', 'email', 'website')
        }),
        ('Bankverbindung', {
            'fields': ('bank_name', 'iban', 'bic')
        }),
        ('Rechtliche Informationen', {
            'fields': ('managing_director', 'commercial_register', 'register_court', 'tax_number', 'vat_id')
        }),
        ('Geschäftsjahr Einstellungen', {
            'fields': ('fiscal_year_start_month', 'fiscal_year_start_day')
        }),
        ('RMA-Kalkulation', {
            'fields': ('default_hourly_rate', 'default_admin_fee'),
            'description': 'Standard-Stundensatz und Verwaltungskostenpauschale, die automatisch in der RMA-Kalkulation übernommen werden.'
        }),
        ('Dokumente', {
            'fields': ('logo_status', 'document_header', 'tagline', 'tagline_english'),
            'description': (
                '<p><strong>Firmenlogo:</strong> optional. Wird keines '
                'hochgeladen, verwendet der PDF-Briefkopf automatisch das '
                'Standard-Logo, das exakt aus der Vorlage '
                'Q-373Du-0826.pdf geschnitten wurde.</p>'
                '<p><strong>Briefkopf-Unterzeile:</strong> die Zeile rechts '
                'unter dem Logo. Die deutsche Fassung erscheint auf '
                'deutschen Dokumenten, die englische auf englischen.</p>'
            )
        }),
    )
    
    @admin.display(description='Logo')
    def logo_status(self, obj):
        """
        Zeigt das aktuelle Logo und einen Knopf zum Entfernen.

        Ohne diesen Knopf laesst sich ein einmal hochgeladenes Logo nur
        ueber die Datenbank wieder loswerden - der Admin bietet fuer
        Bildfelder keinen Loesch-Link an.
        """
        if not obj.document_header:
            return format_html(
                '<span style="color:#666">Standard-Logo (aus Vorlage)'
                '</span>'
            )
        return format_html(
            '{} <a href="?{}" class="button" style="color:#ba2121;'
            'padding:2px 8px;border:1px solid #ba2121;border-radius:4px;'
            'text-decoration:none">Logo entfernen</a>',
            obj.document_header,
            f'delete_document_header=1&id={obj.pk}',
        )
    
    def response_change(self, request, obj):
        """
        Entfernt das Logo, wenn der Knopf geklickt wurde.
        """
        if request.GET.get('delete_document_header'):
            obj.document_header.delete(save=False)
            obj.save(update_fields=['document_header'])
            self.message_user(
                request,
                'Logo entfernt. Die Bestelldokumente verwenden jetzt '
                'wieder das Standard-Logo aus der Vorlage.',
                level='messages.SUCCESS',
            )
            return None
        return super().response_change(request, obj)
    
    def has_add_permission(self, request):
        # Nur eine Instanz erlauben
        return not CompanySettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Löschen verhindern
        return False
