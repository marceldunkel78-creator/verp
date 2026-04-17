from django.urls import path
from .views import (
    ProjekteListView,
    ProjektDetailView,
    ProjektUpdateView,
    ProjektActionView,
    ProjektCreateView,
    SQLProjektExtraView,
    SQLProjektDocumentView,
    LookupTablesView,
    ProjekteTestConnectionView,
    SQLForecastView,
)

urlpatterns = [
    path('projekte/', ProjekteListView.as_view(), name='sql-projekte-list'),
    path('projekte/create/', ProjektCreateView.as_view(), name='sql-projekt-create'),
    path('projekte/<int:projekt_id>/', ProjektDetailView.as_view(), name='sql-projekt-detail'),
    path('projekte/<int:projekt_id>/update/', ProjektUpdateView.as_view(), name='sql-projekt-update'),
    path('projekte/<int:projekt_id>/action/', ProjektActionView.as_view(), name='sql-projekt-action'),
    path('projekte/<int:projekt_id>/extra/', SQLProjektExtraView.as_view(), name='sql-projekt-extra'),
    path('projekte/<int:projekt_id>/documents/', SQLProjektDocumentView.as_view(), name='sql-projekt-documents'),
    path('lookups/', LookupTablesView.as_view(), name='sql-projekte-lookups'),
    path('test-connection/', ProjekteTestConnectionView.as_view(), name='sql-projekte-test'),
    path('forecast/', SQLForecastView.as_view(), name='sql-projekte-forecast'),
]
