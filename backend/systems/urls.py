from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SystemViewSet,
    SystemComponentViewSet,
    SystemPhotoViewSet,
    ModelOrganismOptionViewSet,
    ResearchFieldOptionViewSet
)

router = DefaultRouter()
router.register(r'systems', SystemViewSet, basename='system')
router.register(r'components', SystemComponentViewSet, basename='system-component')
router.register(r'photos', SystemPhotoViewSet, basename='system-photo')
router.register(r'model-organisms', ModelOrganismOptionViewSet, basename='model-organism')
router.register(r'research-fields', ResearchFieldOptionViewSet, basename='research-field')

urlpatterns = [
    path('', include(router.urls)),
]
