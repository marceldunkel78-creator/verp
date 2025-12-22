from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, EmployeeViewSet, TimeEntryViewSet, VacationRequestViewSet

router = DefaultRouter()
# Register employees first so the 'employees' prefix is matched before the empty-user-detail route
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'time-entries', TimeEntryViewSet, basename='time-entry')
router.register(r'vacation-requests', VacationRequestViewSet, basename='vacation-request')
# Register UserViewSet at the root of this include so endpoints are /api/users/ and /api/users/me/
router.register(r'', UserViewSet, basename='user')
# router.register(r'time-entries', TimeEntryViewSet, basename='time-entry')
# router.register(r'vacation-requests', VacationRequestViewSet, basename='vacation-request')
# router.register(r'messages', MessageViewSet, basename='message')
# router.register(r'reminders', ReminderViewSet, basename='reminder')

urlpatterns = [
    path('', include(router.urls)),
]
