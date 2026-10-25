from django.core.management.base import BaseCommand
from products.models import Category, Product, ProductImage

class Command(BaseCommand):
    help = 'Seeds initial Savannah Seedlings catalog and categories'

    def handle(self, *args, **options):
        self.stdout.write('Seeding Savannah Seedlings catalog...')

        # Categories
        cat_avocado, _ = Category.objects.get_or_create(
            name='Avocado Seedlings',
            defaults={'description': 'High-yield grafted avocado varieties suitable for Kenya climates.'}
        )
        cat_mango, _ = Category.objects.get_or_create(
            name='Mango Seedlings',
            defaults={'description': 'Premium grafted mango varieties with fast maturity.'}
        )
        cat_citrus, _ = Category.objects.get_or_create(
            name='Citrus & Oranges',
            defaults={'description': 'Sweet, juicy, disease-resistant citrus varieties.'}
        )
        cat_passion, _ = Category.objects.get_or_create(
            name='Passion & Vines',
            defaults={'description': 'High-performing grafted passion fruit seedlings.'}
        )
        cat_nuts, _ = Category.objects.get_or_create(
            name='Macadamia & Nuts',
            defaults={'description': 'Export-grade macadamia nut seedlings for long-term farming.'}
        )
        cat_exotics, _ = Category.objects.get_or_create(
            name='Exotic Fruits',
            defaults={'description': 'High-value exotic fruit seedlings including Dragon Fruit and Pomegranate.'}
        )

        products_data = [
            {
                'name': 'Grafted Hass Avocado Seedling',
                'category': cat_avocado,
                'price': 250.00,
                'original_price': 300.00,
                'material': 'Grafted Hass (Persea americana)',
                'stock': 150,
                'description': 'Certified high-yielding grafted Hass Avocado seedling. Ideal for both commercial export farming and home orchards across Kenya. Matures in 2.5 - 3 years.',
                'planting_procedure': (
                    "1. Dig a hole measuring 2ft x 2ft x 2ft (60cm x 60cm x 60cm).\n"
                    "2. Mix topsoil with well-decomposed manure (1:1 ratio) and add 200g of phosphate fertilizer.\n"
                    "3. Carefully remove the plastic bag without disturbing the root ball.\n"
                    "4. Place the seedling upright in the hole and pack the soil firmly around the root zone.\n"
                    "5. Water thoroughly immediately after planting (at least 15-20 liters).\n"
                    "6. Water twice weekly during dry spells and mulch around the base to retain moisture."
                )
            },
            {
                'name': 'Grafted Kent Mango Seedling',
                'category': cat_mango,
                'price': 300.00,
                'original_price': 350.00,
                'material': 'Grafted Kent (Mangifera indica)',
                'stock': 120,
                'description': 'Sweet, fiberless, large export-quality Kent mango seedling. Highly resistant to anthracnose and thrives in medium to dry tropical zones.',
                'planting_procedure': (
                    "1. Hole spacing: 8m x 8m. Hole size: 2ft x 2ft x 2ft.\n"
                    "2. Blend topsoil with 1 bucket of organic manure and 150g DAP.\n"
                    "3. Plant the seedling at the exact nursery depth level.\n"
                    "4. Water heavily upon planting (20 liters) and water weekly until established.\n"
                    "5. Apply nitrogen fertilizer after 6 months to boost foliage growth."
                )
            },
            {
                'name': 'Pixie Orange Seedling',
                'category': cat_citrus,
                'price': 350.00,
                'original_price': 400.00,
                'material': 'Grafted Pixie Tangerine',
                'stock': 200,
                'description': 'Seedless, high-demand sweet Pixie Orange seedling. Exceptionally popular in Kenyan markets due to long shelf life and high profitability.',
                'planting_procedure': (
                    "1. Dig holes 2ft x 2ft x 2ft spaced 4m x 4m apart in a full-sun location.\n"
                    "2. Combine topsoil with well-rotted cow/poultry manure and 150g NPK 17:17:17.\n"
                    "3. Set seedling in center, firm soil gently around the stem, ensuring union remains above soil level.\n"
                    "4. Mulch generously around the plant (keep mulch 10cm away from trunk).\n"
                    "5. Water consistently 2-3 times per week during establishing months."
                )
            },
            {
                'name': 'Grafted Yellow Passion Fruit Seedling',
                'category': cat_passion,
                'price': 150.00,
                'original_price': 180.00,
                'material': 'Grafted Yellow Rootstock',
                'stock': 300,
                'description': 'Fusarium wilt-resistant grafted yellow passion seedling. Provides fast cash returns within 9-12 months from planting with proper trellising.',
                'planting_procedure': (
                    "1. Prepare 1.5ft x 1.5ft holes spaced 2m along trellised wire rows.\n"
                    "2. Mix topsoil with 10kg decomposed manure.\n"
                    "3. Plant gently and construct a sturdy trellis wire support (2m height).\n"
                    "4. Train main shoot upwards using sisal twine.\n"
                    "5. Prune lower lateral branches until the vine reaches the top support wire."
                )
            },
            {
                'name': 'Export Grade Macadamia Nut Seedling',
                'category': cat_nuts,
                'price': 350.00,
                'original_price': 400.00,
                'material': 'Grafted Macadamia (INTEG-695)',
                'stock': 100,
                'description': 'Grafted high-nut shell quality Macadamia seedling (Integri-695 / Nelmac 2). Excellent long-term investment crop for central & eastern Kenya.',
                'planting_procedure': (
                    "1. Dig 3ft x 3ft x 3ft holes spaced 7m x 7m.\n"
                    "2. Mix topsoil with 2 buckets of organic compost.\n"
                    "3. Plant seedling ensuring graft union is 10cm above ground.\n"
                    "4. Water with 20 liters every 4 days during initial dry season.\n"
                    "5. Protect young trees with stakes and windbreakers."
                )
            },
            {
                'name': 'Red Dragon Fruit Seedling (Pitaya)',
                'category': cat_exotics,
                'price': 500.00,
                'original_price': 600.00,
                'material': 'Self-fertile Red Flesh Pitaya',
                'stock': 80,
                'description': 'High-value exotic Red Flesh Dragon Fruit plant cutting / seedling. Requires minimal water once established and bears fruit in 12-18 months.',
                'planting_procedure': (
                    "1. Set up sturdy concrete or wooden climbing post (1.8m height) with top ring frame.\n"
                    "2. Dig 1.5ft hole at post base, fill with well-drained soil rich in compost and sand.\n"
                    "3. Tie cuttings upright against the post.\n"
                    "4. Water moderately 1-2 times per week (avoid waterlogging).\n"
                    "5. Apply organic potassium booster when flowering commences."
                )
            }
        ]

        for pdata in products_data:
            p, created = Product.objects.get_or_create(
                name=pdata['name'],
                defaults={
                    'category': pdata['category'],
                    'price': pdata['price'],
                    'original_price': pdata['original_price'],
                    'material': pdata['material'],
                    'stock': pdata['stock'],
                    'description': pdata['description'],
                    'planting_procedure': pdata['planting_procedure']
                }
            )
            if not created:
                p.category = pdata['category']
                p.price = pdata['price']
                p.original_price = pdata['original_price']
                p.material = pdata['material']
                p.stock = pdata['stock']
                p.description = pdata['description']
                p.planting_procedure = pdata['planting_procedure']
                p.save()

        self.stdout.write(self.style.SUCCESS('Successfully seeded Savannah Seedlings products!'))
