from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth import get_user_model
from .serializers import (
    UserSerializer, UserCreateSerializer, 
    UserUpdateSerializer, ChangePasswordSerializer, EmployeeSerializer
)
from .serializers import TimeEntrySerializer, VacationRequestSerializer
from .models import Employee
from .models import TimeEntry, VacationRequest
from .serializers import TimeEntrySerializer

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Benutzerverwaltung
    """
    queryset = User.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer
    
    def get_permissions(self):
        """
        Nur Admins können Benutzer erstellen, ändern oder löschen
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """
        Gibt den aktuell eingeloggten Benutzer zurück
        """
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """
        Ermöglicht Benutzern ihr eigenes Passwort zu ändern
        """
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['old_password']):
                return Response(
                    {'old_password': 'Falsches Passwort.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({'message': 'Passwort erfolgreich geändert.'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmployeeViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Mitarbeiterverwaltung (HR-Daten)
    """
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filter für eigene Daten oder alle, je nach Rolle
        """
        user = self.request.user
        if user.is_staff or user.can_write_hr:
            return Employee.objects.all()
        # Für normale User: nur eigene Daten (me endpoint sollte geben)
        return Employee.objects.none()
    
    def check_permissions(self, request):
        """
        Zusätzliche Berechtigungsprüfung für HR
        """
        super().check_permissions(request)
        user = request.user
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if not (user.is_staff or user.can_write_hr):
                raise PermissionDenied("Keine Schreibberechtigung für HR.")
        elif self.action in ['list', 'retrieve']:
            if not (user.is_staff or user.can_read_hr):
                raise PermissionDenied("Keine Leseberechtigung für HR.")

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Gibt die Employee-Details für den aktuellen Benutzer zurück (falls vorhanden)."""
        emp = getattr(request.user, 'employee', None)
        from rest_framework import status
        if not emp:
            return Response({}, status=status.HTTP_200_OK)
        serializer = self.get_serializer(emp)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TimeEntryViewSet(viewsets.ModelViewSet):
    """ViewSet für Zeiteinträge"""
    queryset = TimeEntry.objects.all()
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Allow admins to filter by user or employee via query params
        if user.is_staff:
            uid = self.request.query_params.get('user')
            emp_param = self.request.query_params.get('employee') or self.request.query_params.get('employee_id')
            if uid:
                return TimeEntry.objects.filter(user__id=uid)
            if emp_param:
                # accept either employee PK or employee.employee_id string
                from django.core.exceptions import ValidationError
                try:
                    # try PK
                    emp = Employee.objects.filter(id=int(emp_param)).first()
                except Exception:
                    emp = None
                if not emp:
                    emp = Employee.objects.filter(employee_id=emp_param).first()
                if emp:
                    users = User.objects.filter(employee=emp)
                    if not users.exists():
                        # try matching by work_email / personal_email
                        emails = [e for e in [emp.work_email, emp.personal_email] if e]
                        if emails:
                            users = User.objects.filter(email__in=emails)
                    if not users.exists():
                        # try matching by name
                        users = User.objects.filter(first_name=emp.first_name, last_name=emp.last_name)
                    if users.exists():
                        return TimeEntry.objects.filter(user__in=users)
                    # fallback: try returning time entries by user email even if no User object matched
                    emails = [e for e in [emp.work_email, emp.personal_email] if e]
                    if emails:
                        return TimeEntry.objects.filter(user__email__in=emails)
                    return TimeEntry.objects.none()
                return TimeEntry.objects.none()
            return TimeEntry.objects.all()
        return TimeEntry.objects.filter(user=user)

    def perform_create(self, serializer):
        # setze den angemeldeten Benutzer als owner
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def weekly_report(self, request):
        """Berechnet die gearbeiteten Stunden dieser Woche und vergleicht mit der Soll-Arbeitszeit bis heute."""
        user = request.user
        # allow admins to request report for a specific user or employee
        if request.user.is_staff:
            uid = request.query_params.get('user')
            emp_param = request.query_params.get('employee') or request.query_params.get('employee_id')
            if uid:
                try:
                    user = User.objects.get(id=uid)
                except User.DoesNotExist:
                    return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            elif emp_param:
                # try to resolve employee by PK or employee_id
                emp = None
                try:
                    emp = Employee.objects.filter(id=int(emp_param)).first()
                except Exception:
                    emp = None
                if not emp:
                    emp = Employee.objects.filter(employee_id=emp_param).first()
                if emp:
                    user = User.objects.filter(employee=emp).first()
                    if not user:
                        # try matching by email
                        emails = [e for e in [emp.work_email, emp.personal_email] if e]
                        if emails:
                            user = User.objects.filter(email__in=emails).first()
                    if not user:
                        # try matching by name
                        user = User.objects.filter(first_name=emp.first_name, last_name=emp.last_name).first()
                else:
                    # if no matching employee, return empty report
                    return Response({
                        'week_start': None,
                        'week_end': None,
                        'actual_hours': 0.0,
                        'expected_hours_to_date': 0.0,
                        'weekly_target': 0.0,
                        'work_days': [],
                        'difference': 0.0,
                    })
        from datetime import date, timedelta
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        entries = TimeEntry.objects.filter(user=user, date__range=(week_start, week_end), date__lte=today)
        actual_seconds = 0
        for e in entries:
            dur = e.duration
            actual_seconds += dur.total_seconds()
        actual_hours = round(actual_seconds / 3600, 2)

        # employee work settings
        employee = getattr(user, 'employee', None)
        if employee:
            weekly_target = float(employee.weekly_work_hours or 40.0)
            work_days = list(employee.work_days or ['mon','tue','wed','thu','fri'])
        else:
            weekly_target = 40.0
            work_days = ['mon','tue','wed','thu','fri']

        # map weekday codes to indices: mon=0..sun=6
        mapping = {'mon':0,'tue':1,'wed':2,'thu':3,'fri':4,'sat':5,'sun':6}
        indices = [mapping.get(d, None) for d in work_days]
        indices = [i for i in indices if i is not None]
        total_work_days = len(indices) if indices else 5

        # count workdays in this week up to today
        workdays_up_to_today = sum(1 for i in indices if i <= today.weekday())

        daily_target = weekly_target / total_work_days if total_work_days else 0
        expected_hours_to_date = round(daily_target * workdays_up_to_today, 2)

        return Response({
            'week_start': week_start.isoformat(),
            'week_end': week_end.isoformat(),
            'actual_hours': actual_hours,
            'expected_hours_to_date': expected_hours_to_date,
            'weekly_target': weekly_target,
            'work_days': work_days,
            'difference': round(actual_hours - expected_hours_to_date, 2)
        })

    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        """Berechnet gearbeitete Stunden im Monat bis heute und vergleicht mit Soll-Arbeitszeit bis heute."""
        user = request.user
        # allow admins to request report for a specific user or employee
        if request.user.is_staff:
            uid = request.query_params.get('user')
            emp_param = request.query_params.get('employee') or request.query_params.get('employee_id')
            if uid:
                try:
                    user = User.objects.get(id=uid)
                except User.DoesNotExist:
                    return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            elif emp_param:
                emp = None
                try:
                    emp = Employee.objects.filter(id=int(emp_param)).first()
                except Exception:
                    emp = None
                if not emp:
                    emp = Employee.objects.filter(employee_id=emp_param).first()
                if emp:
                    user = User.objects.filter(employee=emp).first()
                    if not user:
                        emails = [e for e in [emp.work_email, emp.personal_email] if e]
                        if emails:
                            user = User.objects.filter(email__in=emails).first()
                    if not user:
                        user = User.objects.filter(first_name=emp.first_name, last_name=emp.last_name).first()
                else:
                    return Response({
                        'month_start': None,
                        'month_end': None,
                        'actual_hours': 0.0,
                        'expected_hours_to_date': 0.0,
                        'weekly_target': 0.0,
                        'work_days': [],
                        'difference': 0.0,
                        'workdays_count_to_date': 0
                    })
        from datetime import date, timedelta
        import calendar
        today = date.today()
        month_start = date(today.year, today.month, 1)

        entries = TimeEntry.objects.filter(user=user, date__range=(month_start, today))
        actual_seconds = 0
        for e in entries:
            dur = e.duration
            actual_seconds += dur.total_seconds()
        actual_hours = round(actual_seconds / 3600, 2)

        employee = getattr(user, 'employee', None)
        if employee:
            weekly_target = float(employee.weekly_work_hours or 40.0)
            work_days = list(employee.work_days or ['mon','tue','wed','thu','fri'])
        else:
            weekly_target = 40.0
            work_days = ['mon','tue','wed','thu','fri']

        mapping = {'mon':0,'tue':1,'wed':2,'thu':3,'fri':4,'sat':5,'sun':6}
        indices = [mapping.get(d, None) for d in work_days]
        indices = [i for i in indices if i is not None]
        total_work_days = len(indices) if indices else 5
        daily_target = weekly_target / total_work_days if total_work_days else 0

        # count workdays in month from month_start up to today
        workdays_in_month_to_date = 0
        cur = month_start
        while cur <= today:
            if cur.weekday() in indices:
                workdays_in_month_to_date += 1
            cur += timedelta(days=1)

        expected_month_to_date = round(daily_target * workdays_in_month_to_date, 2)

        return Response({
            'month_start': month_start.isoformat(),
            'month_end': today.isoformat(),
            'actual_hours': actual_hours,
            'expected_hours_to_date': expected_month_to_date,
            'weekly_target': weekly_target,
            'work_days': work_days,
            'difference': round(actual_hours - expected_month_to_date, 2),
            'workdays_count_to_date': workdays_in_month_to_date
        })


class VacationRequestViewSet(viewsets.ModelViewSet):
    """ViewSet für Urlaubsanträge"""
    queryset = VacationRequest.objects.all()
    serializer_class = VacationRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        status_param = self.request.query_params.get('status')
        if user.is_staff or user.can_read_hr:
            # admins/HR can see all or filter by user or employee
            uid = self.request.query_params.get('user')
            emp_param = self.request.query_params.get('employee') or self.request.query_params.get('employee_id')
            qs = VacationRequest.objects.all()
            if uid:
                qs = VacationRequest.objects.filter(user__id=uid)
            elif emp_param:
                # try to resolve employee by PK or employee_id
                emp = None
                try:
                    emp = Employee.objects.filter(id=int(emp_param)).first()
                except Exception:
                    emp = None
                if not emp:
                    emp = Employee.objects.filter(employee_id=emp_param).first()
                if emp:
                    users = User.objects.filter(employee=emp)
                    if not users.exists():
                        emails = [e for e in [emp.work_email, emp.personal_email] if e]
                        if emails:
                            users = User.objects.filter(email__in=emails)
                    if not users.exists():
                        users = User.objects.filter(first_name=emp.first_name, last_name=emp.last_name)
                    if users.exists():
                        qs = VacationRequest.objects.filter(user__in=users)
                    else:
                        emails = [e for e in [emp.work_email, emp.personal_email] if e]
                        if emails:
                            qs = VacationRequest.objects.filter(user__email__in=emails)
                        else:
                            qs = VacationRequest.objects.none()
            # apply status filter if provided
            if status_param:
                qs = qs.filter(status=status_param)
            return qs
        # regular users only see own requests
        qs = VacationRequest.objects.filter(user=user)
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def perform_create(self, serializer):
        # set the requesting user as owner
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # ensure that only HR/admin can change approval status
        instance = serializer.instance
        prev_status = instance.status
        new_status = serializer.validated_data.get('status', prev_status)
        user = self.request.user
        if new_status in ['approved', 'rejected', 'cancelled'] and not (user.is_staff or user.can_write_hr):
            raise PermissionDenied("Keine Berechtigung zum Genehmigen/Ablehnen bzw. Stornieren von Urlaubsanträgen.")

        # if approving, validate that employee has enough balance
        from decimal import Decimal
        if new_status == 'approved':
            try:
                emp = getattr(instance.user, 'employee', None)
                days = Decimal(str(serializer.validated_data.get('days_requested', instance.days_requested or 0)))
                if emp:
                    bal = Decimal(str(emp.vacation_balance or 0))
                    if bal - days < Decimal('0'):
                        from rest_framework.exceptions import ValidationError
                        raise ValidationError({'days_requested': 'Nicht genügend Urlaubstage verfügbar.'})
            except ValidationError:
                raise
            except Exception:
                # if we can't validate, allow the update to proceed and handle during approve
                pass

        # perform the update
        serializer.save()
        updated = serializer.instance
        from django.utils import timezone
        # status transitioned
        if prev_status != updated.status:
            # approval: deduct days from employee vacation_balance
            if updated.status == 'approved':
                updated.approved_by = self.request.user
                updated.approved_at = timezone.now()
                updated.save()
                try:
                    emp = getattr(updated.user, 'employee', None)
                    if emp:
                        days = Decimal(str(updated.days_requested or 0))
                        bal = Decimal(str(emp.vacation_balance or 0))
                        emp.vacation_balance = bal - days
                        emp.save()
                except Exception:
                    # swallow errors to avoid blocking the update
                    pass
            # cancellation: when an approved request is cancelled, restore days and set cancelled metadata
            elif prev_status == 'approved' and updated.status == 'cancelled':
                try:
                    emp = getattr(updated.user, 'employee', None)
                    if emp:
                        days = Decimal(str(updated.days_requested or 0))
                        bal = Decimal(str(emp.vacation_balance or 0))
                        emp.vacation_balance = bal + days
                        emp.save()
                except Exception:
                    pass
            # if it was approved before and is now changed away from approved (e.g., rejected), restore days
            elif prev_status == 'approved' and updated.status != 'approved':
                try:
                    emp = getattr(updated.user, 'employee', None)
                    if emp:
                        days = Decimal(str(updated.days_requested or 0))
                        bal = Decimal(str(emp.vacation_balance or 0))
                        emp.vacation_balance = bal + days
                        emp.save()
                except Exception:
                    pass

    def perform_destroy(self, instance):
        # if an approved request is deleted, restore vacation days
        from decimal import Decimal
        try:
            if instance.status == 'approved':
                emp = getattr(instance.user, 'employee', None)
                if emp:
                    days = Decimal(str(instance.days_requested or 0))
                    bal = Decimal(str(emp.vacation_balance or 0))
                    emp.vacation_balance = bal + days
                    emp.save()
        except Exception:
            pass
        instance.delete()


# Neue ViewSets temporär deaktiviert
