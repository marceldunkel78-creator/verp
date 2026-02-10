from django.db import migrations, models


MODEL_ORGANISM_OPTIONS = [
    'Escherichia coli – Kolibakterium / Darmbakterium',
    'Saccharomyces cerevisiae – Backhefe / Bäckerhefe',
    'Schizosaccharomyces pombe – Spalthefe',
    'Bacillus subtilis – Heubazillus',
    'Dictyostelium discoideum – Schleimpilz / Zellulärer Schleimpilz',
    'Arabidopsis thaliana – Ackerschmalwand / Thale-Kresse',
    'Physcomitrella patens – Laubmoos / Knospiges Laubmoos',
    'Marchantia polymorpha – Brunnenlebermoos / Gewöhnliches Lebermoos',
    'Oryza sativa – Reis',
    'Zea mays – Mais',
    'Nicotiana benthamiana – Aufrechter Tabak',
    'Medicago truncatula – Kleinfrüchtige Luzerne / Bartklee',
    'Lotus japonicus – Japanischer Hornklee',
    'Setaria viridis – Grünes Borstengras',
    'Caenorhabditis elegans – Fadenwurm / Eleganter Fadenwurm',
    'Drosophila melanogaster – Taufliege / Schwarze Fruchtfliege',
    'Danio rerio – Zebrabärbling / Zebrafisch',
    'Mus musculus – Hausmaus / Labormaus',
    'Rattus norvegicus – Wanderratte / Laborratte',
    'Xenopus laevis – Krallenfrosch / Afrikanischer Krallenfrosch',
    'Xenopus tropicalis – Westafrikanischer Krallenfrosch',
    'Gallus gallus – Haushuhn',
    'Oryzias latipes – Medaka / Japanischer Reisfisch',
    'Strongylocentrotus purpuratus – Purpur-Seeigel',
    'Neurospora crassa – Brotschimmelpilz / Roter Brotschimmel',
    'Chlamydomonas reinhardtii – Grünalge / Einzellige Grünalge',
    'Tetrahymena thermophila – Wimperntierchen',
    'Hydra vulgaris – Süßwasserpolyp',
    'Nematostella vectensis – Sternanemone',
    'Apis mellifera – Honigbiene',
    'Tribolium castaneum – Rotbrauner Mehlkäfer',
    'Bombyx mori – Seidenspinner',
    'Macaca mulatta – Rhesusaffe',
    'Rattus rattus – Hausratte (manchmal separat genutzt)',
    'Ciona intestinalis – Seescheide / Schlauch-Seescheide',
    'Branchiostoma floridae – Lanzettfischchen / Floridas Lanzettfischchen',
    'Pisum sativum – Garten-Erbse',
    'Solanum lycopersicum – Tomate',
    'Brachypodium distachyon – Schmalblättriges Zittergras',
    'Volvox carteri – Kugelalge / Volvox',
]

RESEARCH_FIELD_OPTIONS = [
    'Onkologie / Krebsforschung',
    'Immunologie (inkl. Autoimmunerkrankungen, Impfstoffe, Checkpoint-Inhibitoren)',
    'Neurowissenschaften / Neurologie (inkl. Neurodegeneration, Psyche)',
    'Kardiologie / Herz-Kreislauf-Forschung',
    'Infektiologie / Virologie / Mikrobiologie (inkl. Antibiotikaresistenz, Pandemievorbereitung)',
    'Genetik / Genomik / Humangenetik',
    'Molekularbiologie / Zellbiologie',
    'Entwicklungsbiologie / Regenerative Medizin / Stammzellforschung',
    'Endokrinologie / Stoffwechselforschung / Diabetes / Adipositas',
    'Mikrobiom-Forschung (Darm-, Haut-, Lungenmikrobiom etc.)',
    'Präzisionsmedizin / Personalisierte Medizin',
    'Gentherapie / Genom-Editing (CRISPR, Prime Editing, Base Editing)',
    'RNA-Therapeutika / mRNA-Technologien (über COVID hinaus)',
    'Immuntherapien (CAR-T, bispezifische Antikörper, Krebsimpfstoffe)',
    'Künstliche Intelligenz / Machine Learning in Biologie & Medizin (Drug Discovery, Bildanalyse, Prädiktive Modelle)',
    'Single-Cell- & Spatial-Omics (Single-Cell RNA-seq, Spatial Transcriptomics, Multi-Omics)',
    'Synthetische Biologie / Bioengineering',
    'Alternsforschung / Biogerontologie / Senolytika / Longevity',
    'Long Covid / Postvirale Syndrome',
    'Frauengesundheit / Geschlechtersensible Medizin (Endometriose, Menopause, reproduktive Gesundheit – 2026 stark gefördert)',
    'Organ-on-a-Chip / Organoids / Humane zelluläre Modelle',
    'Neurodegenerative Erkrankungen (Alzheimer, Parkinson, ALS – inkl. Viren-Hypothese)',
    'Kardiovaskuläre Präzisionsmedizin (Schwangerschafts-assoziierte Risiken, Menopause)',
    'Antimicrobial Resistance / Neue Antibiotika / Phagentherapie',
    'Zellfreie Biomanufacturing / Point-of-Care-Diagnostik',
    'Klimawandel & Gesundheit (Infektionskrankheiten, Allergien, Hitzeextremereignisse)',
    'Digital Health / Datengetriebene Medizin / Big Data in der Klinik',
    'Kognitive Neurowissenschaften / Gehirn-Computer-Schnittstellen (BCI)',
    'Krebsprävention / Früherkennung / Liquid Biopsy',
    'Autoimmunerkrankungen & systemische Entzündung (Rheuma, Lupus, Multiple Sklerose)',
]


def seed_options_and_migrate_systems(apps, schema_editor):
    ModelOrganismOption = apps.get_model('systems', 'ModelOrganismOption')
    ResearchFieldOption = apps.get_model('systems', 'ResearchFieldOption')
    System = apps.get_model('systems', 'System')

    model_organisms = {}
    for name in MODEL_ORGANISM_OPTIONS:
        obj, _ = ModelOrganismOption.objects.get_or_create(name=name)
        model_organisms[name] = obj

    research_fields = {}
    for name in RESEARCH_FIELD_OPTIONS:
        obj, _ = ResearchFieldOption.objects.get_or_create(name=name)
        research_fields[name] = obj

    for system in System.objects.all():
        if system.model_organism:
            obj = model_organisms.get(system.model_organism)
            if not obj:
                obj, _ = ModelOrganismOption.objects.get_or_create(name=system.model_organism)
                model_organisms[system.model_organism] = obj
            system.model_organisms.add(obj)
        if system.research_field:
            obj = research_fields.get(system.research_field)
            if not obj:
                obj, _ = ResearchFieldOption.objects.get_or_create(name=system.research_field)
                research_fields[system.research_field] = obj
            system.research_fields.add(obj)


class Migration(migrations.Migration):

    dependencies = [
        ('systems', '0010_add_model_organism_research_field'),
    ]

    operations = [
        migrations.CreateModel(
            name='ModelOrganismOption',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, unique=True, verbose_name='Modellorganismus')),
                ('is_active', models.BooleanField(default=True, verbose_name='Aktiv')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')),
            ],
            options={
                'verbose_name': 'Modellorganismus',
                'verbose_name_plural': 'Modellorganismen',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='ResearchFieldOption',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, unique=True, verbose_name='Forschungsgebiet')),
                ('is_active', models.BooleanField(default=True, verbose_name='Aktiv')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')),
            ],
            options={
                'verbose_name': 'Forschungsgebiet',
                'verbose_name_plural': 'Forschungsgebiete',
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='system',
            name='model_organisms',
            field=models.ManyToManyField(blank=True, related_name='systems', to='systems.modelorganismoption', verbose_name='Modellorganismen'),
        ),
        migrations.AddField(
            model_name='system',
            name='research_fields',
            field=models.ManyToManyField(blank=True, related_name='systems', to='systems.researchfieldoption', verbose_name='Forschungsgebiete'),
        ),
        migrations.RunPython(seed_options_and_migrate_systems, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='system',
            name='model_organism',
        ),
        migrations.RemoveField(
            model_name='system',
            name='research_field',
        ),
    ]
