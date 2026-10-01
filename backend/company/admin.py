from django.contrib import admin, messages
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.html import format_html

from .models import CompanySettings


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'city', 'managing_director', 'logo_status']

    # logo_status ist eine Methode, KEIN Modellfeld. Steht es in den
    # fieldsets, bricht die ganze Aendern-Seite mit
    #   FieldError: Unknown field(s) (logo_status)
    # ab und der Knopf ist nie zu sehen. readonly_fields ist der
    # richtige Ort fuer Anzeige-Methoden im Formular.
    readonly_fields = ['logo_status']

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
            'fields': ('managing_director', 'commercial_register', 'register_court',
                       'tax_number', 'vat_id')
        }),
        ('Geschäftsjahr Einstellungen', {
            'fields': ('fiscal_year_start_month', 'fiscal_year_start_day')
        }),
        ('RMA-Kalkulation', {
            'fields': ('default_hourly_rate', 'default_admin_fee'),
            'description': 'Standard-Stundensatz und Verwaltungskostenpauschale, '
                           'die automatisch in der RMA-Kalkulation übernommen wird.'
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

    def get_urls(self):
        """
        Eigene View fuer den Loesch-Knopf.

        Ein Link mit ?delete_document_header=1 auf dieselbe Seite
        reicht nicht aus: response_change() laeuft nur beim SPEICHERN,
        ein blosser Seitenaufruf kommt dort nie vor. Deshalb eine eigene
        View - und weil die per GET ausgeloest wuerde, verlangt sie
        zusaetzlich ein POST. Sonst wuerde schon ein versehentliches
        Kopieren des Adressfelds in einen Tab das Logo loeschen.
        """
        return [
            path(
                'logo/clear/<path:object_id>/',
                self.admin_site.admin_view(self.clear_logo_view),
                name='company_clear_logo',
            ),
        ] + super().get_urls()

    def clear_logo_view(self, request, object_id):
        obj = self.get_object(request, object_id)

        if request.method != 'POST':
            # GET: nur eine Bestaetigungsseite zeigen.
            context = {
                **self.admin_site.each_context(request),
                'title': 'Logo entfernen',
                'object': obj,
                'opts': self.model._meta,
                'original': obj,
                'logo_url': obj.document_header.url if obj.document_header else None,
            }
            return TemplateResponse(request, 'admin/company/clearlogo.html', context)

        datei = obj.document_header.name if obj.document_header else None

        # Wichtig: FieldFile.delete(save=True) setzt das Feld auf '' UND
        # loescht die Datei von der Platte. Mit save=False - wie in der
        # ersten Fassung - wird nur das Feld geleert, die Datei bleibt
        # unter MEDIA_ROOT/company/ liegen.
        if obj.document_header:
            obj.document_header.delete(save=True)
        obj.refresh_from_db()

        if datei:
            self.message_user(
                request,
                'Logo entfernt - die Datei wurde auch vom Server gelöscht. '
                'Die Bestelldokumente verwenden jetzt wieder das '
                'Standard-Logo aus der Vorlage.',
                level=messages.SUCCESS,
            )
        else:
            self.message_user(
                request,
                'Es war kein Logo hinterlegt.',
                level=messages.WARNING,
            )

        return redirect(reverse(
            'admin:company_companysettings_change', args=[obj.pk]))

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
                '<span style="color:#666">Standard-Logo (aus Vorlage)</span>'
            )
        url = reverse('admin:company_clear_logo', args=[obj.pk])
        return format_html(
            '{} <a href="{}" class="button" style="color:#ba2121;'
            'padding:3px 10px;border:1px solid #ba2121;border-radius:4px;'
            'text-decoration:none;margin-left:8px;white-space:nowrap">'
            'Logo entfernen</a>',
            obj.document_header, url,
        )

    def has_add_permission(self, request):
        # Nur eine Instanz erlauben
        return not CompanySettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        # Die Firmeneinstellungen selbst duerfen nicht geloescht werden -
        # das Logo darueber aber schon.
        return False
