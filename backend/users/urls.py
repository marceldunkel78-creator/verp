from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, EmployeeViewSet, TimeEntryViewSet, VacationRequestViewSet,
    TravelExpenseReportViewSet, TravelExpenseDayViewSet, TravelExpenseItemViewSet, TravelPerDiemRateViewSet,
    MessageViewSet, ReminderViewSet, NotificationViewSet
)

router = DefaultRouter()
# Register employees first so the 'employees' prefix is matched before the empty-user-detail route
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'time-entries', TimeEntryViewSet, basename='time-entry')
router.register(r'vacation-requests', VacationRequestViewSet, basename='vacation-request')
# Nachrichten und Erinnerungen
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'reminders', ReminderViewSet, basename='reminder')
router.register(r'notifications', NotificationViewSet, basename='notification')
# Reisekosten
router.register(r'travel-expenses', TravelExpenseReportViewSet, basename='travel-expense')
router.register(r'travel-expense-days', TravelExpenseDayViewSet, basename='travel-expense-day')
router.register(r'travel-expense-items', TravelExpenseItemViewSet, basename='travel-expense-item')
router.register(r'travel-per-diem-rates', TravelPerDiemRateViewSet, basename='travel-per-diem-rate')
# Register UserViewSet at the root of this include so endpoints are /api/users/ and /api/users/me/
router.register(r'', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
]
