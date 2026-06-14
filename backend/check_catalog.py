import sys
sys.stdout.reconfigure(encoding='utf-8')
from seed_catalog_v2 import get_all_v2_products

products = get_all_v2_products()
skus = [p['sku'] for p in products]
dups = set(s for s in skus if skus.count(s) > 1)

print(f"Total products: {len(products)}")
print(f"Categories: {len(set(p['category'] for p in products))}")
print(f"Duplicate SKUs: {dups if dups else 'None'}")
print()
cats = {}
for p in products:
    cats[p['category']] = cats.get(p['category'], 0) + 1
for k, v in sorted(cats.items()):
    print(f"  {k}: {v}")
