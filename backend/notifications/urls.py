from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NotificationTaskViewSet,
    NotificationTaskRecipientViewSet,
    NotificationViewSet
)

router = DefaultRouter()
router.register(r'tasks', NotificationTaskViewSet, basename='notification-task')
router.register(r'recipients', NotificationTaskRecipientViewSet, basename='notification-recipient')
router.register(r'', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
