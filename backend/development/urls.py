from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DevelopmentProjectViewSet, DevelopmentProjectMaterialItemViewSet, DevelopmentTicketViewSet

router = DefaultRouter()
router.register(r'projects', DevelopmentProjectViewSet, basename='development-projects')
router.register(r'tickets', DevelopmentTicketViewSet, basename='development-tickets')
router.register(r'material-items', DevelopmentProjectMaterialItemViewSet, basename='development-material-items')

urlpatterns = [
    path('', include(router.urls)),
]
