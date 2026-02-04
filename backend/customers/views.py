from rest_framework import viewsets, filters
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Exists, OuterRef
from django.http import HttpResponse
import csv
from .models import Customer, CustomerAddress, CustomerPhone, CustomerEmail, CustomerSystem, ContactHistory
from .serializers import (
    CustomerListSerializer, CustomerDetailSerializer,
    CustomerCreateUpdateSerializer, CustomerAddressSerializer,
    CustomerPhoneSerializer, CustomerEmailSerializer, ContactHistorySerializer
)


class CustomerPagination(PageNumberPagination):
    page_size = 9
    page_size_query_param = 'page_size'
    max_page_size = 10000


class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Kunden
    """
    queryset = Customer.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'language', 'is_reference', 'advertising_status', 'responsible_user']
    # Use only valid model fields. Include related fields for broader search (emails, phones, addresses).
    search_fields = [
        'customer_number', 'first_name', 'last_name', 'title',
        'emails__email', 'phones__phone_number', 'addresses__city'
    ]
    ordering_fields = ['customer_number', 'last_name', 'first_name', 'created_at']
    ordering = ['last_name', 'first_name']
    pagination_class = CustomerPagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Suche nach Stadt (unterstützt mehrere Städte durch Komma getrennt)
        city = self.request.query_params.get('city', None)
        if city:
            cities = [c.strip() for c in city.split(',') if c.strip()]
            if len(cities) == 1:
                queryset = queryset.filter(addresses__city__icontains=cities[0]).distinct()
            elif len(cities) > 1:
                city_query = Q()
                for c in cities:
                    city_query |= Q(addresses__city__icontains=c)
                queryset = queryset.filter(city_query).distinct()
        
        # Suche nach Land
        country = self.request.query_params.get('country', None)
        if country:
            queryset = queryset.filter(addresses__country=country).distinct()
        
        # Filter: Hat E-Mail
        has_email = self.request.query_params.get('has_email', None)
        if has_email is not None:
            if has_email.lower() == 'true':
                queryset = queryset.filter(
                    Exists(CustomerEmail.objects.filter(customer=OuterRef('pk')))
                )
            elif has_email.lower() == 'false':
                queryset = queryset.exclude(
                    Exists(CustomerEmail.objects.filter(customer=OuterRef('pk')))
                )
        
        # Filter: Hat Telefon
        has_phone = self.request.query_params.get('has_phone', None)
        if has_phone is not None:
            if has_phone.lower() == 'true':
                queryset = queryset.filter(
                    Exists(CustomerPhone.objects.filter(customer=OuterRef('pk')))
                )
            elif has_phone.lower() == 'false':
                queryset = queryset.exclude(
                    Exists(CustomerPhone.objects.filter(customer=OuterRef('pk')))
                )
        
        # Filter: Hat Adresse
        has_address = self.request.query_params.get('has_address', None)
        if has_address is not None:
            if has_address.lower() == 'true':
                queryset = queryset.filter(
                    Exists(CustomerAddress.objects.filter(customer=OuterRef('pk')))
                )
            elif has_address.lower() == 'false':
                queryset = queryset.exclude(
                    Exists(CustomerAddress.objects.filter(customer=OuterRef('pk')))
                )
        
        # Filter: Newsletter-Zustimmung (über E-Mail)
        has_newsletter = self.request.query_params.get('has_newsletter', None)
        if has_newsletter is not None:
            if has_newsletter.lower() == 'true':
                queryset = queryset.filter(
                    Exists(CustomerEmail.objects.filter(customer=OuterRef('pk'), newsletter_consent=True))
                )
            elif has_newsletter.lower() == 'false':
                queryset = queryset.exclude(
                    Exists(CustomerEmail.objects.filter(customer=OuterRef('pk'), newsletter_consent=True))
                )
        
        # Filter: Hat verknüpftes System
        has_system = self.request.query_params.get('has_system', None)
        if has_system is not None:
            from systems.models import System
            if has_system.lower() == 'true':
                queryset = queryset.filter(
                    Exists(System.objects.filter(customer=OuterRef('pk')))
                )
            elif has_system.lower() == 'false':
                queryset = queryset.exclude(
                    Exists(System.objects.filter(customer=OuterRef('pk')))
                )
        
        # Filter: Kein zuständiger Mitarbeiter
        no_responsible_user = self.request.query_params.get('no_responsible_user', None)
        if no_responsible_user is not None and no_responsible_user.lower() == 'true':
            queryset = queryset.filter(responsible_user__isnull=True)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return CustomerCreateUpdateSerializer
        return CustomerDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def systems(self, request, pk=None):
        """Hole alle Systeme eines Kunden"""
        customer = self.get_object()
        # system_records is the related_name from systems.System model
        if hasattr(customer, 'system_records'):
            systems = customer.system_records.all()
        else:
            systems = []
        data = [
            {
                'id': sys.id,
                'system_number': sys.system_number,
                'system_name': sys.system_name,
                'status': sys.status,
                'location': sys.location,
                'installation_date': sys.installation_date,
            }
            for sys in systems
        ]
        return Response(data)

    @action(detail=True, methods=['get'])
    def projects(self, request, pk=None):
        """Hole alle Projekte eines Kunden"""
        customer = self.get_object()
        if hasattr(customer, 'projects'):
            projects = customer.projects.all()
        else:
            projects = []
        data = [
            {
                'id': proj.id,
                'project_number': getattr(proj, 'project_number', None),
                'name': getattr(proj, 'name', ''),
                'status': getattr(proj, 'status', ''),
                'start_date': getattr(proj, 'start_date', None),
                'end_date': getattr(proj, 'end_date', None),
            }
            for proj in projects
        ]
        return Response(data)

    @action(detail=True, methods=['get'])
    def tickets(self, request, pk=None):
        """Hole alle offenen Service-Tickets eines Kunden"""
        customer = self.get_object()
        if hasattr(customer, 'service_tickets'):
            tickets = customer.service_tickets.exclude(status__in=['resolved', 'no_solution'])
        else:
            tickets = []
        data = [
            {
                'id': t.id,
                'ticket_number': t.ticket_number,
                'title': t.title,
                'status': t.status,
                'status_display': t.get_status_display(),
                'created_at': t.created_at,
            }
            for t in tickets
        ]
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """
        Exportiert Kunden als CSV-Datei.
        Verwendet die gleichen Filter wie die Liste.
        """
        # Hole gefilterte Queryset
        queryset = self.filter_queryset(self.get_queryset())
        
        # Welche Felder exportieren (kann über fields Parameter gesteuert werden)
        requested_fields = request.query_params.get('fields', None)
        if requested_fields:
            export_fields = [f.strip() for f in requested_fields.split(',')]
        else:
            # Standard-Felder
            export_fields = [
                'customer_number', 'salutation', 'title', 'first_name', 'last_name',
                'language', 'advertising_status', 'is_reference', 'is_active',
                'primary_email', 'primary_phone',
                'primary_address_street', 'primary_address_postal_code', 
                'primary_address_city', 'primary_address_country',
                'primary_address_university', 'primary_address_institute',
                'responsible_user'
            ]
        
        # CSV-Response erstellen
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="kunden_export.csv"'
        # UTF-8 BOM für Excel
        response.write('\ufeff')
        
        writer = csv.writer(response, delimiter=';')
        
        # Header-Zeile
        header_mapping = {
            'customer_number': 'Kundennummer',
            'salutation': 'Anrede',
            'title': 'Titel',
            'first_name': 'Vorname',
            'last_name': 'Nachname',
            'language': 'Sprache',
            'advertising_status': 'Werbestatus',
            'is_reference': 'Referenzkunde',
            'is_active': 'Aktiv',
            'primary_email': 'E-Mail',
            'all_emails': 'Alle E-Mails',
            'primary_phone': 'Telefon',
            'all_phones': 'Alle Telefonnummern',
            'primary_address_street': 'Straße',
            'primary_address_postal_code': 'PLZ',
            'primary_address_city': 'Stadt',
            'primary_address_country': 'Land',
            'primary_address_university': 'Universität/Firma',
            'primary_address_institute': 'Institut',
            'all_addresses': 'Alle Adressen',
            'responsible_user': 'Zuständiger Mitarbeiter',
            'description': 'Beschreibung',
            'notes': 'Notizen',
            'created_at': 'Erstellt am',
        }
        writer.writerow([header_mapping.get(f, f) for f in export_fields])
        
        # Daten schreiben
        for customer in queryset.prefetch_related('emails', 'phones', 'addresses'):
            row = []
            for field in export_fields:
                if field == 'customer_number':
                    row.append(customer.customer_number or '')
                elif field == 'salutation':
                    row.append(customer.salutation or '')
                elif field == 'title':
                    row.append(customer.title or '')
                elif field == 'first_name':
                    row.append(customer.first_name or '')
                elif field == 'last_name':
                    row.append(customer.last_name or '')
                elif field == 'language':
                    row.append(customer.get_language_display() if customer.language else '')
                elif field == 'advertising_status':
                    row.append(customer.get_advertising_status_display() if customer.advertising_status else '')
                elif field == 'is_reference':
                    row.append('Ja' if customer.is_reference else 'Nein')
                elif field == 'is_active':
                    row.append('Ja' if customer.is_active else 'Nein')
                elif field == 'primary_email':
                    primary = customer.emails.filter(is_primary=True).first()
                    if not primary:
                        primary = customer.emails.first()
                    row.append(primary.email if primary else '')
                elif field == 'all_emails':
                    emails = [e.email for e in customer.emails.all()]
                    row.append(', '.join(emails))
                elif field == 'primary_phone':
                    primary = customer.phones.filter(is_primary=True).first()
                    if not primary:
                        primary = customer.phones.first()
                    row.append(primary.phone_number if primary else '')
                elif field == 'all_phones':
                    phones = [p.phone_number for p in customer.phones.all()]
                    row.append(', '.join(phones))
                elif field == 'primary_address_street':
                    addr = customer.addresses.filter(is_active=True).first()
                    if addr:
                        street = f"{addr.street} {addr.house_number}".strip()
                        row.append(street)
                    else:
                        row.append('')
                elif field == 'primary_address_postal_code':
                    addr = customer.addresses.filter(is_active=True).first()
                    row.append(addr.postal_code if addr else '')
                elif field == 'primary_address_city':
                    addr = customer.addresses.filter(is_active=True).first()
                    row.append(addr.city if addr else '')
                elif field == 'primary_address_country':
                    addr = customer.addresses.filter(is_active=True).first()
                    row.append(addr.country if addr else '')
                elif field == 'primary_address_university':
                    addr = customer.addresses.filter(is_active=True).first()
                    row.append(addr.university if addr else '')
                elif field == 'primary_address_institute':
                    addr = customer.addresses.filter(is_active=True).first()
                    row.append(addr.institute if addr else '')
                elif field == 'all_addresses':
                    addrs = []
                    for addr in customer.addresses.all():
                        parts = [addr.street, addr.house_number, addr.postal_code, addr.city, addr.country]
                        addrs.append(' '.join(p for p in parts if p))
                    row.append(' | '.join(addrs))
                elif field == 'responsible_user':
                    row.append(customer.responsible_user.get_full_name() if customer.responsible_user else '')
                elif field == 'description':
                    row.append(customer.description or '')
                elif field == 'notes':
                    row.append(customer.notes or '')
                elif field == 'created_at':
                    row.append(customer.created_at.strftime('%d.%m.%Y') if customer.created_at else '')
                else:
                    row.append('')
            writer.writerow(row)
        
        return response


class CustomerAddressViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Kundenadressen
    """
    queryset = CustomerAddress.objects.all()
    serializer_class = CustomerAddressSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['customer', 'address_type', 'is_active', 'country']
    search_fields = ['university', 'institute', 'department', 'city', 'street']


class CustomerPhoneViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Telefonnummern
    """
    queryset = CustomerPhone.objects.all()
    serializer_class = CustomerPhoneSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['customer', 'phone_type', 'is_primary']


class CustomerEmailViewSet(viewsets.ModelViewSet):
    """
    ViewSet für E-Mail-Adressen
    """
    queryset = CustomerEmail.objects.all()
    serializer_class = CustomerEmailSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['customer', 'is_primary', 'newsletter_consent', 'marketing_consent']


class ContactHistoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Kontakthistorie.
    Kann nach customer oder system gefiltert werden.
    Bei einem System werden alle Einträge zurückgegeben, die entweder:
    - direkt mit diesem System verknüpft sind, ODER
    - mit dem Kunden des Systems verknüpft sind (aber keinem anderen System)
    """
    queryset = ContactHistory.objects.all()
    serializer_class = ContactHistorySerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    # Hinweis: 'system' wird manuell in get_queryset gefiltert (systems.System ID -> CustomerSystem)
    filterset_fields = ['customer', 'contact_type']
    ordering_fields = ['contact_date', 'created_at']
    ordering = ['-contact_date', '-created_at']
    
    def get_queryset(self):
        queryset = super().get_queryset().select_related('customer', 'system', 'created_by')
        
        # Spezielle Filterlogik für System-Ansicht
        system_id = self.request.query_params.get('system', None)
        customer_id = self.request.query_params.get('customer', None)
        
        if system_id:
            # Bei System: Zeige alle Einträge die:
            # 1. direkt mit diesem System verknüpft sind, ODER
            # 2. mit dem Kunden des Systems verknüpft sind (system ist null)
            from .models import CustomerSystem
            from systems.models import System
            
            customer_system = None
            customer_for_filter = None
            
            # Zuerst versuchen, systems.System zu finden (das ist der normale Fall)
            try:
                systems_system = System.objects.get(id=system_id)
                customer_for_filter = systems_system.customer_id
                # Suche das entsprechende CustomerSystem für die Filterung
                customer_system = CustomerSystem.objects.filter(
                    system_number=systems_system.system_number
                ).first()
            except System.DoesNotExist:
                # Fallback: Vielleicht ist es eine CustomerSystem ID
                try:
                    customer_system = CustomerSystem.objects.get(id=system_id)
                    customer_for_filter = customer_system.customer_id
                except CustomerSystem.DoesNotExist:
                    return queryset.none()
            
            # Filter: Einträge mit diesem CustomerSystem ODER Kunden-Einträge ohne System
            if customer_system:
                queryset = queryset.filter(
                    Q(system=customer_system) |
                    Q(customer_id=customer_for_filter, system__isnull=True)
                )
            elif customer_for_filter:
                # Kein CustomerSystem gefunden, zeige nur Kunden-Einträge ohne System
                queryset = queryset.filter(
                    customer_id=customer_for_filter, system__isnull=True
                )
            else:
                return queryset.none()
        elif customer_id:
            # Bei Kunde: Zeige alle Einträge des Kunden
            queryset = queryset.filter(customer_id=customer_id)
        
        return queryset
    
    def perform_create(self, serializer):
        # Automatisch den aktuellen Benutzer als Ersteller setzen
        serializer.save(created_by=self.request.user)
