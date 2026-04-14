from django.urls import path
from .views import AngeboteListView, AngebotDetailView, MitarbeiterListView, AngeboteTestConnectionView

urlpatterns = [
    path('angebote/', AngeboteListView.as_view(), name='sql-angebote-list'),
    path('angebote/<int:angebot_id>/', AngebotDetailView.as_view(), name='sql-angebot-detail'),
    path('mitarbeiter/', MitarbeiterListView.as_view(), name='sql-angebote-mitarbeiter'),
    path('test-connection/', AngeboteTestConnectionView.as_view(), name='sql-angebote-test'),
]
