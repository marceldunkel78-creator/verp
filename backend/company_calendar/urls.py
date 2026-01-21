from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CalendarEventViewSet, EventReminderViewSet

router = DefaultRouter()
router.register(r'events', CalendarEventViewSet, basename='calendar-event')
router.register(r'reminders', EventReminderViewSet, basename='event-reminder')

urlpatterns = [
    path('', include(router.urls)),
]
