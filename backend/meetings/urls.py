from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MondayMeetingTodoViewSet, SalesMeetingTodoViewSet, VisiViewMeetingTodoViewSet,
    MondayMeetingDataViewSet, VisiViewMeetingDataViewSet
)

router = DefaultRouter()
router.register(r'monday-todos', MondayMeetingTodoViewSet, basename='monday-meeting-todo')
router.register(r'sales-todos', SalesMeetingTodoViewSet, basename='sales-meeting-todo')
router.register(r'visiview-todos', VisiViewMeetingTodoViewSet, basename='visiview-meeting-todo')
router.register(r'monday-data', MondayMeetingDataViewSet, basename='monday-meeting-data')
router.register(r'visiview-data', VisiViewMeetingDataViewSet, basename='visiview-meeting-data')

urlpatterns = [
    path('', include(router.urls)),
]
