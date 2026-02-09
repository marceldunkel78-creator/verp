from django.db import models
from django.contrib.auth import get_user_model
from customers.models import Customer
from core.upload_paths import system_upload_path

User = get_user_model()


def system_photo_upload_path(instance, filename):
    """Upload-Pfad: /Systems/Systemnummer/fotos/filename"""
    import re
    
    def _sanitize(name):
        if not name:
            return ''
        name = name.replace('/', '_').replace('\\', '_').replace(' ', '_')
        return re.sub(r'[^A-Za-z0-9_.-]', '_', name)
    
    system_number = _sanitize(instance.system.system_number) if instance.system else 'unknown'
    safe_filename = _sanitize(filename)
    
    return f"Systems/{system_number}/fotos/{safe_filename}"


class System(models.Model):
    """
    Kunden-Mikroskopsystem
    """
    system_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Systemnummer',
        help_text='Automatisch generiert im Format S-00001'
    )
    
    system_name = models.CharField(
        max_length=100,
        verbose_name='Systemname',
        help_text='Name des Systems (z.B. IAU-Sternname)'
    )
    
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='system_records',
        verbose_name='Kunde',
        null=True,
        blank=True
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Systembeschreibung'
    )
    
    # Status
    STATUS_CHOICES = [
        ('unbekannt', 'Unbekannt'),
        ('in_nutzung', 'In Nutzung'),
        ('in_wartung', 'In Wartung'),
        ('ausser_betrieb', 'Außer Betrieb'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='unbekannt',
        verbose_name='Status'
    )

    MODEL_ORGANISM_CHOICES = [
        ('Escherichia coli – Kolibakterium / Darmbakterium', 'Escherichia coli – Kolibakterium / Darmbakterium'),
        ('Saccharomyces cerevisiae – Backhefe / Bäckerhefe', 'Saccharomyces cerevisiae – Backhefe / Bäckerhefe'),
        ('Schizosaccharomyces pombe – Spalthefe', 'Schizosaccharomyces pombe – Spalthefe'),
        ('Bacillus subtilis – Heubazillus', 'Bacillus subtilis – Heubazillus'),
        ('Dictyostelium discoideum – Schleimpilz / Zellulärer Schleimpilz', 'Dictyostelium discoideum – Schleimpilz / Zellulärer Schleimpilz'),
        ('Arabidopsis thaliana – Ackerschmalwand / Thale-Kresse', 'Arabidopsis thaliana – Ackerschmalwand / Thale-Kresse'),
        ('Physcomitrella patens – Laubmoos / Knospiges Laubmoos', 'Physcomitrella patens – Laubmoos / Knospiges Laubmoos'),
        ('Marchantia polymorpha – Brunnenlebermoos / Gewöhnliches Lebermoos', 'Marchantia polymorpha – Brunnenlebermoos / Gewöhnliches Lebermoos'),
        ('Oryza sativa – Reis', 'Oryza sativa – Reis'),
        ('Zea mays – Mais', 'Zea mays – Mais'),
        ('Nicotiana benthamiana – Aufrechter Tabak', 'Nicotiana benthamiana – Aufrechter Tabak'),
        ('Medicago truncatula – Kleinfrüchtige Luzerne / Bartklee', 'Medicago truncatula – Kleinfrüchtige Luzerne / Bartklee'),
        ('Lotus japonicus – Japanischer Hornklee', 'Lotus japonicus – Japanischer Hornklee'),
        ('Setaria viridis – Grünes Borstengras', 'Setaria viridis – Grünes Borstengras'),
        ('Caenorhabditis elegans – Fadenwurm / Eleganter Fadenwurm', 'Caenorhabditis elegans – Fadenwurm / Eleganter Fadenwurm'),
        ('Drosophila melanogaster – Taufliege / Schwarze Fruchtfliege', 'Drosophila melanogaster – Taufliege / Schwarze Fruchtfliege'),
        ('Danio rerio – Zebrabärbling / Zebrafisch', 'Danio rerio – Zebrabärbling / Zebrafisch'),
        ('Mus musculus – Hausmaus / Labormaus', 'Mus musculus – Hausmaus / Labormaus'),
        ('Rattus norvegicus – Wanderratte / Laborratte', 'Rattus norvegicus – Wanderratte / Laborratte'),
        ('Xenopus laevis – Krallenfrosch / Afrikanischer Krallenfrosch', 'Xenopus laevis – Krallenfrosch / Afrikanischer Krallenfrosch'),
        ('Xenopus tropicalis – Westafrikanischer Krallenfrosch', 'Xenopus tropicalis – Westafrikanischer Krallenfrosch'),
        ('Gallus gallus – Haushuhn', 'Gallus gallus – Haushuhn'),
        ('Oryzias latipes – Medaka / Japanischer Reisfisch', 'Oryzias latipes – Medaka / Japanischer Reisfisch'),
        ('Strongylocentrotus purpuratus – Purpur-Seeigel', 'Strongylocentrotus purpuratus – Purpur-Seeigel'),
        ('Neurospora crassa – Brotschimmelpilz / Roter Brotschimmel', 'Neurospora crassa – Brotschimmelpilz / Roter Brotschimmel'),
        ('Chlamydomonas reinhardtii – Grünalge / Einzellige Grünalge', 'Chlamydomonas reinhardtii – Grünalge / Einzellige Grünalge'),
        ('Tetrahymena thermophila – Wimperntierchen', 'Tetrahymena thermophila – Wimperntierchen'),
        ('Hydra vulgaris – Süßwasserpolyp', 'Hydra vulgaris – Süßwasserpolyp'),
        ('Nematostella vectensis – Sternanemone', 'Nematostella vectensis – Sternanemone'),
        ('Apis mellifera – Honigbiene', 'Apis mellifera – Honigbiene'),
        ('Tribolium castaneum – Rotbrauner Mehlkäfer', 'Tribolium castaneum – Rotbrauner Mehlkäfer'),
        ('Bombyx mori – Seidenspinner', 'Bombyx mori – Seidenspinner'),
        ('Macaca mulatta – Rhesusaffe', 'Macaca mulatta – Rhesusaffe'),
        ('Rattus rattus – Hausratte (manchmal separat genutzt)', 'Rattus rattus – Hausratte (manchmal separat genutzt)'),
        ('Ciona intestinalis – Seescheide / Schlauch-Seescheide', 'Ciona intestinalis – Seescheide / Schlauch-Seescheide'),
        ('Branchiostoma floridae – Lanzettfischchen / Floridas Lanzettfischchen', 'Branchiostoma floridae – Lanzettfischchen / Floridas Lanzettfischchen'),
        ('Pisum sativum – Garten-Erbse', 'Pisum sativum – Garten-Erbse'),
        ('Solanum lycopersicum – Tomate', 'Solanum lycopersicum – Tomate'),
        ('Brachypodium distachyon – Schmalblättriges Zittergras', 'Brachypodium distachyon – Schmalblättriges Zittergras'),
        ('Volvox carteri – Kugelalge / Volvox', 'Volvox carteri – Kugelalge / Volvox'),
    ]

    model_organism = models.CharField(
        max_length=255,
        blank=True,
        choices=MODEL_ORGANISM_CHOICES,
        verbose_name='Modellorganismus'
    )

    RESEARCH_FIELD_CHOICES = [
        ('Onkologie / Krebsforschung', 'Onkologie / Krebsforschung'),
        ('Immunologie (inkl. Autoimmunerkrankungen, Impfstoffe, Checkpoint-Inhibitoren)', 'Immunologie (inkl. Autoimmunerkrankungen, Impfstoffe, Checkpoint-Inhibitoren)'),
        ('Neurowissenschaften / Neurologie (inkl. Neurodegeneration, Psyche)', 'Neurowissenschaften / Neurologie (inkl. Neurodegeneration, Psyche)'),
        ('Kardiologie / Herz-Kreislauf-Forschung', 'Kardiologie / Herz-Kreislauf-Forschung'),
        ('Infektiologie / Virologie / Mikrobiologie (inkl. Antibiotikaresistenz, Pandemievorbereitung)', 'Infektiologie / Virologie / Mikrobiologie (inkl. Antibiotikaresistenz, Pandemievorbereitung)'),
        ('Genetik / Genomik / Humangenetik', 'Genetik / Genomik / Humangenetik'),
        ('Molekularbiologie / Zellbiologie', 'Molekularbiologie / Zellbiologie'),
        ('Entwicklungsbiologie / Regenerative Medizin / Stammzellforschung', 'Entwicklungsbiologie / Regenerative Medizin / Stammzellforschung'),
        ('Endokrinologie / Stoffwechselforschung / Diabetes / Adipositas', 'Endokrinologie / Stoffwechselforschung / Diabetes / Adipositas'),
        ('Mikrobiom-Forschung (Darm-, Haut-, Lungenmikrobiom etc.)', 'Mikrobiom-Forschung (Darm-, Haut-, Lungenmikrobiom etc.)'),
        ('Präzisionsmedizin / Personalisierte Medizin', 'Präzisionsmedizin / Personalisierte Medizin'),
        ('Gentherapie / Genom-Editing (CRISPR, Prime Editing, Base Editing)', 'Gentherapie / Genom-Editing (CRISPR, Prime Editing, Base Editing)'),
        ('RNA-Therapeutika / mRNA-Technologien (über COVID hinaus)', 'RNA-Therapeutika / mRNA-Technologien (über COVID hinaus)'),
        ('Immuntherapien (CAR-T, bispezifische Antikörper, Krebsimpfstoffe)', 'Immuntherapien (CAR-T, bispezifische Antikörper, Krebsimpfstoffe)'),
        ('Künstliche Intelligenz / Machine Learning in Biologie & Medizin (Drug Discovery, Bildanalyse, Prädiktive Modelle)', 'Künstliche Intelligenz / Machine Learning in Biologie & Medizin (Drug Discovery, Bildanalyse, Prädiktive Modelle)'),
        ('Single-Cell- & Spatial-Omics (Single-Cell RNA-seq, Spatial Transcriptomics, Multi-Omics)', 'Single-Cell- & Spatial-Omics (Single-Cell RNA-seq, Spatial Transcriptomics, Multi-Omics)'),
        ('Synthetische Biologie / Bioengineering', 'Synthetische Biologie / Bioengineering'),
        ('Alternsforschung / Biogerontologie / Senolytika / Longevity', 'Alternsforschung / Biogerontologie / Senolytika / Longevity'),
        ('Long Covid / Postvirale Syndrome', 'Long Covid / Postvirale Syndrome'),
        ('Frauengesundheit / Geschlechtersensible Medizin (Endometriose, Menopause, reproduktive Gesundheit – 2026 stark gefördert)', 'Frauengesundheit / Geschlechtersensible Medizin (Endometriose, Menopause, reproduktive Gesundheit – 2026 stark gefördert)'),
        ('Organ-on-a-Chip / Organoids / Humane zelluläre Modelle', 'Organ-on-a-Chip / Organoids / Humane zelluläre Modelle'),
        ('Neurodegenerative Erkrankungen (Alzheimer, Parkinson, ALS – inkl. Viren-Hypothese)', 'Neurodegenerative Erkrankungen (Alzheimer, Parkinson, ALS – inkl. Viren-Hypothese)'),
        ('Kardiovaskuläre Präzisionsmedizin (Schwangerschafts-assoziierte Risiken, Menopause)', 'Kardiovaskuläre Präzisionsmedizin (Schwangerschafts-assoziierte Risiken, Menopause)'),
        ('Antimicrobial Resistance / Neue Antibiotika / Phagentherapie', 'Antimicrobial Resistance / Neue Antibiotika / Phagentherapie'),
        ('Zellfreie Biomanufacturing / Point-of-Care-Diagnostik', 'Zellfreie Biomanufacturing / Point-of-Care-Diagnostik'),
        ('Klimawandel & Gesundheit (Infektionskrankheiten, Allergien, Hitzeextremereignisse)', 'Klimawandel & Gesundheit (Infektionskrankheiten, Allergien, Hitzeextremereignisse)'),
        ('Digital Health / Datengetriebene Medizin / Big Data in der Klinik', 'Digital Health / Datengetriebene Medizin / Big Data in der Klinik'),
        ('Kognitive Neurowissenschaften / Gehirn-Computer-Schnittstellen (BCI)', 'Kognitive Neurowissenschaften / Gehirn-Computer-Schnittstellen (BCI)'),
        ('Krebsprävention / Früherkennung / Liquid Biopsy', 'Krebsprävention / Früherkennung / Liquid Biopsy'),
        ('Autoimmunerkrankungen & systemische Entzündung (Rheuma, Lupus, Multiple Sklerose)', 'Autoimmunerkrankungen & systemische Entzündung (Rheuma, Lupus, Multiple Sklerose)'),
    ]

    research_field = models.CharField(
        max_length=255,
        blank=True,
        choices=RESEARCH_FIELD_CHOICES,
        verbose_name='Forschungsgebiet'
    )
    
    # Standort-Informationen
    location = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Standort',
        help_text='z.B. Labor, Raum, Gebäude'
    )
    
    # Erweiterte Standort-Adresse
    location_university = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Universität/Institution'
    )
    location_institute = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Institut'
    )
    location_department = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Lehrstuhl/Abteilung'
    )
    location_street = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Straße'
    )
    location_house_number = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Hausnummer'
    )
    location_address_supplement = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Adresszusatz'
    )
    location_postal_code = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='PLZ'
    )
    location_city = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Stadt'
    )
    location_country = models.CharField(
        max_length=2,
        default='DE',
        blank=True,
        verbose_name='Land',
        help_text='ISO 3166-1 Alpha-2 Code'
    )
    
    # Koordinaten für Kartenansicht
    location_latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        verbose_name='Breitengrad (Latitude)'
    )
    location_longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        verbose_name='Längengrad (Longitude)'
    )

    installation_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Installationsdatum'
    )
    
    # Notizen
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    # VisiView Lizenz (optional)
    visiview_license = models.ForeignKey(
        'visiview.VisiViewLicense',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='associated_systems',
        verbose_name='VisiView Lizenz'
    )
    
    # Zuständiger Mitarbeiter
    responsible_employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responsible_systems',
        verbose_name='Zuständiger Mitarbeiter'
    )
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='systems_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'System'
        verbose_name_plural = 'Systeme'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.system_number} - {self.system_name}" if self.system_number else self.system_name
    
    def save(self, *args, **kwargs):
        if not self.system_number:
            self.system_number = self._generate_system_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_system_number():
        """Generiert die nächste Systemnummer im Format S-00001"""
        from django.db.models import Max
        
        last_system = System.objects.filter(
            system_number__isnull=False
        ).aggregate(Max('system_number'))
        
        last_number = last_system['system_number__max']
        
        if last_number:
            # Extrahiere die Nummer aus S-00001
            try:
                num = int(last_number.split('-')[1])
                next_num = num + 1
            except (IndexError, ValueError):
                next_num = 1
        else:
            next_num = 1
        
        return f"S-{next_num:05d}"


class SystemComponent(models.Model):
    """
    Komponente eines Systems - kann aus Warenlager oder custom sein
    """
    system = models.ForeignKey(
        System,
        on_delete=models.CASCADE,
        related_name='components',
        verbose_name='System'
    )
    
    # Position in der Komponentenliste
    position = models.PositiveIntegerField(
        default=1,
        verbose_name='Position'
    )
    
    # Verknüpfung mit Warenlager (optional)
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='system_usages',
        verbose_name='Lagerartikel'
    )
    
    # Custom Komponenten-Daten (wenn nicht aus Warenlager)
    COMPONENT_TYPE_CHOICES = [
        ('inventory', 'Aus Warenlager'),
        ('custom', 'Benutzerdefiniert'),
    ]
    component_type = models.CharField(
        max_length=20,
        choices=COMPONENT_TYPE_CHOICES,
        default='custom',
        verbose_name='Komponententyp'
    )
    
    # Komponenten-Details (für custom oder Überschreibung)
    name = models.CharField(
        max_length=200,
        verbose_name='Modell/Name'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    
    manufacturer = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Hersteller'
    )
    
    serial_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Seriennummer'
    )
    
    version = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Version/Treiber'
    )
    
    # Kategorie für bessere Organisation
    CATEGORY_CHOICES = [
        ('microscope', 'Mikroskop'),
        ('camera', 'Kamera'),
        ('objective', 'Objektiv'),
        ('stage', 'Tisch/Stage'),
        ('illumination', 'Beleuchtung'),
        ('filter', 'Filter'),
        ('controller', 'Controller'),
        ('software', 'Software'),
        ('accessory', 'Zubehör'),
        ('other', 'Sonstiges'),
    ]
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default='other',
        verbose_name='Kategorie'
    )
    
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    is_legacy = models.BooleanField(
        default=False,
        verbose_name='Legacy/Veraltet'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Systemkomponente'
        verbose_name_plural = 'Systemkomponenten'
        ordering = ['system', 'position']
    
    def __str__(self):
        return f"{self.system.system_number} - {self.name}"


class SystemPhoto(models.Model):
    """
    Fotos eines Systems
    """
    system = models.ForeignKey(
        System,
        on_delete=models.CASCADE,
        related_name='photos',
        verbose_name='System'
    )
    
    image = models.ImageField(
        upload_to=system_photo_upload_path,
        verbose_name='Foto'
    )
    
    title = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Titel'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    
    is_primary = models.BooleanField(
        default=False,
        verbose_name='Hauptbild'
    )
    
    position = models.PositiveIntegerField(
        default=1,
        verbose_name='Position'
    )
    
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Hochgeladen von'
    )
    
    is_outdated = models.BooleanField(
        default=False,
        verbose_name='Veraltet'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Systemfoto'
        verbose_name_plural = 'Systemfotos'
        ordering = ['system', 'position']
    
    def __str__(self):
        return f"{self.system.system_number} - {self.title or 'Foto'}"
    
    def save(self, *args, **kwargs):
        # Wenn als Hauptbild markiert, andere Hauptbilder entfernen
        if self.is_primary:
            SystemPhoto.objects.filter(
                system=self.system,
                is_primary=True
            ).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Entferne das Bild aus dem Media-Ordner, bevor der Datensatz geloescht wird
        image_name = self.image.name if self.image else None
        storage = self.image.storage if self.image else None
        super().delete(*args, **kwargs)
        if image_name and storage:
            try:
                storage.delete(image_name)
            except Exception:
                pass
