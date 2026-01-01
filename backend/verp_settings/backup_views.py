"""
Backup & Restore Views
Ermöglicht Export und Import der gesamten Datenbank als JSON
"""
import json
import tempfile
from datetime import datetime
from decimal import Decimal, InvalidOperation
from django.http import HttpResponse, JsonResponse
from django.core import serializers
from django.core.management import call_command
from django.apps import apps
from django.db import transaction, models
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from io import StringIO


def convert_field_value(field, value):
    """
    Konvertiert einen Wert in den richtigen Typ für ein Django-Feld
    """
    if value is None:
        return None
    
    # DecimalField
    if isinstance(field, models.DecimalField):
        if isinstance(value, str):
            try:
                return Decimal(value)
            except (InvalidOperation, ValueError):
                return Decimal('0')
        return Decimal(str(value))
    
    # FloatField
    if isinstance(field, models.FloatField):
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0
    
    # IntegerField
    if isinstance(field, (models.IntegerField, models.BigIntegerField, models.SmallIntegerField, models.PositiveIntegerField)):
        try:
            return int(value)
        except (ValueError, TypeError):
            return 0
    
    # BooleanField
    if isinstance(field, models.BooleanField):
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes')
        return bool(value)
    
    # ForeignKey - ID als Integer
    if isinstance(field, models.ForeignKey):
        if value:
            try:
                return int(value)
            except (ValueError, TypeError):
                return None
        return None
    
    # Alle anderen Felder unverändert
    return value


class DatabaseBackupView(APIView):
    """
    Exportiert die gesamte Datenbank als JSON-Datei
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """
        GET: Exportiert alle Datenbanktabellen als JSON
        """
        try:
            # Alle App-Labels sammeln (nur unsere eigenen Apps)
            our_apps = [
                'company',
                'customers', 
                'dealers',
                'inventory',
                'loans',
                'manufacturing',
                'orders',
                'pricelists',
                'projects',
                'service',
                'suppliers',
                'systems',
                'users',
                'verp_settings',
                'visiview',
                'customer_orders',
            ]
            
            # Daten sammeln
            all_data = {}
            model_counts = {}
            
            for app_label in our_apps:
                try:
                    app_config = apps.get_app_config(app_label)
                    models = app_config.get_models()
                    
                    for model in models:
                        model_name = f"{app_label}.{model.__name__}"
                        try:
                            queryset = model.objects.all()
                            count = queryset.count()
                            
                            if count > 0:
                                # Serialisiere die Daten
                                data = serializers.serialize('json', queryset)
                                all_data[model_name] = json.loads(data)
                                model_counts[model_name] = count
                        except Exception as e:
                            # Einige Modelle könnten Probleme verursachen
                            print(f"Fehler bei {model_name}: {e}")
                            continue
                            
                except LookupError:
                    # App nicht gefunden
                    continue
            
            # Export-Datei erstellen
            export_data = {
                'meta': {
                    'exported_at': datetime.now().isoformat(),
                    'exported_by': request.user.username,
                    'version': '1.0',
                    'model_counts': model_counts,
                    'total_records': sum(model_counts.values())
                },
                'data': all_data
            }
            
            # Als JSON-Datei zurückgeben
            response = HttpResponse(
                json.dumps(export_data, indent=2, ensure_ascii=False),
                content_type='application/json'
            )
            filename = f"verp_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            return response
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DatabaseRestoreView(APIView):
    """
    Importiert Daten aus einer JSON-Backup-Datei
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """
        POST: Importiert Daten aus einer hochgeladenen JSON-Datei
        """
        if 'file' not in request.FILES:
            return Response(
                {'error': 'Keine Datei hochgeladen'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = request.FILES['file']
        
        # Optionen aus dem Request
        clear_existing = request.data.get('clear_existing', 'false').lower() == 'true'
        
        try:
            # Datei lesen
            content = uploaded_file.read().decode('utf-8')
            backup_data = json.loads(content)
            
            # Validierung
            if 'data' not in backup_data:
                return Response(
                    {'error': 'Ungültiges Backup-Format: "data" Feld fehlt'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            results = {
                'created': 0,
                'updated': 0,
                'errors': [],
                'models_processed': []
            }
            
            # Import durchführen
            with transaction.atomic():
                for model_name, records in backup_data['data'].items():
                    try:
                        app_label, model_class_name = model_name.split('.')
                        model = apps.get_model(app_label, model_class_name)
                        
                        # Liste aller Feldnamen im aktuellen Modell
                        model_field_names = {f.name for f in model._meta.fields}
                        # Mapping von Feldname zu Feld-Objekt
                        model_fields_dict = {f.name: f for f in model._meta.fields}
                        
                        if clear_existing:
                            # Bestehende Daten löschen
                            deleted_count = model.objects.all().delete()[0]
                            if deleted_count > 0:
                                results['models_processed'].append(
                                    f"{model_name}: {deleted_count} gelöscht"
                                )
                        
                        # Daten importieren
                        created_count = 0
                        updated_count = 0
                        error_count = 0
                        
                        for record in records:
                            try:
                                # Manuelles Parsing statt Django Deserializer
                                pk = record.get('pk')
                                fields_data = record.get('fields', {})
                                
                                # Nur Felder verwenden, die im aktuellen Modell existieren
                                cleaned_fields = {}
                                for field_name, field_value in fields_data.items():
                                    if field_name in model_field_names:
                                        # Typ-Konvertierung durchführen
                                        field_obj = model_fields_dict[field_name]
                                        converted_value = convert_field_value(field_obj, field_value)
                                        cleaned_fields[field_name] = converted_value
                                
                                # Prüfen ob Objekt existiert
                                if pk and model.objects.filter(pk=pk).exists():
                                    # Update
                                    obj = model.objects.get(pk=pk)
                                    for field_name, field_value in cleaned_fields.items():
                                        try:
                                            setattr(obj, field_name, field_value)
                                        except Exception:
                                            pass  # Ignoriere Fehler beim Setzen
                                    try:
                                        obj.save()
                                        updated_count += 1
                                    except Exception as save_error:
                                        error_count += 1
                                        results['errors'].append(f"{model_name} (pk={pk}, update): {str(save_error)}")
                                else:
                                    # Create
                                    try:
                                        if pk:
                                            cleaned_fields['id'] = pk
                                        obj = model(**cleaned_fields)
                                        obj.save()
                                        created_count += 1
                                    except Exception as create_error:
                                        error_count += 1
                                        results['errors'].append(f"{model_name} (pk={pk}, create): {str(create_error)}")
                                        
                            except Exception as e:
                                error_count += 1
                                results['errors'].append(f"{model_name} (record parse error): {str(e)}")
                        
                        results['created'] += created_count
                        results['updated'] += updated_count
                        
                        if created_count > 0 or updated_count > 0 or error_count > 0:
                            status_msg = f"{model_name}: {created_count} erstellt, {updated_count} aktualisiert"
                            if error_count > 0:
                                status_msg += f", {error_count} Fehler"
                            results['models_processed'].append(status_msg)
                            
                    except Exception as e:
                        results['errors'].append(f"{model_name}: {str(e)}")
            
            return Response({
                'success': True,
                'message': f"Import abgeschlossen: {results['created']} erstellt, {results['updated']} aktualisiert",
                'details': results
            })
            
        except json.JSONDecodeError as e:
            return Response(
                {'error': f'Ungültige JSON-Datei: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DatabaseStatsView(APIView):
    """
    Gibt Statistiken über die Datenbank zurück
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        GET: Statistiken über alle Modelle
        """
        our_apps = [
            'company',
            'customers', 
            'dealers',
            'inventory',
            'loans',
            'manufacturing',
            'orders',
            'pricelists',
            'projects',
            'service',
            'suppliers',
            'systems',
            'users',
            'verp_settings',
            'visiview',
            'customer_orders',
        ]
        
        stats = {}
        total = 0
        
        for app_label in our_apps:
            try:
                app_config = apps.get_app_config(app_label)
                models = app_config.get_models()
                app_stats = {}
                
                for model in models:
                    try:
                        count = model.objects.count()
                        if count > 0:
                            app_stats[model.__name__] = count
                            total += count
                    except Exception:
                        continue
                
                if app_stats:
                    stats[app_label] = app_stats
                    
            except LookupError:
                continue
        
        return Response({
            'apps': stats,
            'total_records': total
        })
