#!/usr/bin/env python3
"""
seed_catalog_v2.py — NeedSpeak Enhanced Catalog
================================================
Generates 500+ realistic Indian retail products with:
- Rich synonyms (Hindi/Hinglish)
- Review previews
- Dietary/occasion/allergen tags
- Multiple variants per category
- Realistic pricing

Usage:
    python seed_catalog_v2.py              # Seed to DynamoDB
    python seed_catalog_v2.py --mock       # Print product count only (validation)
    python seed_catalog_v2.py --json       # Output as JSON (for local use)

Idempotent: Uses put_item (overwrites existing SKUs).
"""

from __future__ import annotations

import json
import sys
from decimal import Decimal


# ---------------------------------------------------------------------------
# Product Templates per Category
# ---------------------------------------------------------------------------

def _grains() -> list[dict]:
    """Grains: rice, flour, oats, poha, etc."""
    return [
        _p("SKU-GRN-001", "india gate classic basmati rice", "India Gate", "grains", "rice", 189, "g", 1000, 4.5, 2300,
           kw={"rice", "basmati", "long grain", "pulao", "biryani", "chawal"},
           syn={"chawal", "chaawal", "tanduri rice", "jeera rice"},
           dietary={"veg", "vegan", "jain"},
           occ={"biryani_party", "dinner", "everyday"},
           reviews=["Excellent aroma and long grains.", "Perfect for biryani."]),
        _p("SKU-GRN-002", "daawat rozana basmati rice", "Daawat", "grains", "rice", 139, "g", 1000, 4.3, 1800,
           kw={"rice", "basmati", "rozana", "everyday", "budget"},
           syn={"chawal", "daily rice", "sasta chawal"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "lunch"},
           reviews=["Good daily rice at affordable price.", "Decent length for the price."]),
        _p("SKU-GRN-003", "aashirvaad whole wheat atta", "Aashirvaad", "grains", "flour", 269, "g", 5000, 4.6, 4500,
           kw={"atta", "wheat", "flour", "whole wheat", "roti", "chapati"},
           syn={"atta", "gehun ka atta", "chakki atta"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "breakfast", "dinner"},
           reviews=["Soft rotis every time.", "Best atta for home use."]),
        _p("SKU-GRN-004", "fortune chakki fresh atta", "Fortune", "grains", "flour", 245, "g", 5000, 4.4, 3200,
           kw={"atta", "wheat flour", "fortune", "roti", "paratha"},
           syn={"atta", "gehun"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday"},
           reviews=["Good quality atta at fair price."]),
        _p("SKU-GRN-005", "quaker oats", "Quaker", "grains", "oats", 165, "g", 1000, 4.3, 2100,
           kw={"oats", "oatmeal", "breakfast", "healthy", "fiber"},
           syn={"daliya", "porridge"},
           dietary={"veg", "vegan"},
           occ={"breakfast", "diet"},
           reviews=["Great for morning porridge.", "Healthy and filling."]),
        _p("SKU-GRN-006", "saffola oats masala", "Saffola", "grains", "oats", 45, "g", 40, 4.1, 1500,
           kw={"oats", "masala oats", "instant", "snack"},
           syn={"masala daliya"},
           dietary={"veg"},
           occ={"breakfast", "snack"},
           reviews=["Quick tasty snack.", "Good masala flavor."]),
        _p("SKU-GRN-007", "poha flattened rice thick", "Local", "grains", "poha", 55, "g", 500, 4.0, 800,
           kw={"poha", "flattened rice", "chiwda", "breakfast"},
           syn={"poha", "chira", "beaten rice", "avalakki"},
           dietary={"veg", "vegan", "jain"},
           occ={"breakfast", "snack"},
           reviews=["Fresh and clean poha."]),
        _p("SKU-GRN-008", "tata sampann unpolished toor dal", "Tata Sampann", "grains", "dal", 179, "g", 1000, 4.5, 3100,
           kw={"toor dal", "arhar dal", "lentil", "dal", "protein"},
           syn={"arhar", "toor", "tuvar", "daal"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "lunch", "dinner"},
           reviews=["Cooks well and tastes great.", "No stones, clean dal."]),
        _p("SKU-GRN-009", "tata sampann moong dal", "Tata Sampann", "grains", "dal", 169, "g", 1000, 4.4, 2600,
           kw={"moong dal", "green gram", "dal", "lentil"},
           syn={"moong", "mung", "moong ki daal"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "diet"},
           reviews=["Quick cooking moong dal.", "Great for khichdi."]),
        _p("SKU-GRN-010", "rajma chitra", "Local", "grains", "rajma", 145, "g", 1000, 4.2, 900,
           kw={"rajma", "kidney beans", "beans", "protein"},
           syn={"rajma", "lobia", "kidney bean"},
           dietary={"veg", "vegan", "jain"},
           occ={"dinner", "punjabi"},
           reviews=["Good quality rajma, cooks soft."]),
    ]


def _dairy() -> list[dict]:
    """Dairy: milk, curd, paneer, butter, ghee, cheese."""
    return [
        _p("SKU-DRY-001", "amul gold full cream milk", "Amul", "dairy", "milk", 72, "ml", 1000, 4.5, 5000,
           kw={"milk", "full cream", "dairy"},
           syn={"doodh", "dudh", "milk packet"},
           dietary={"veg"},
           allergen={"lactose"},
           occ={"everyday", "breakfast", "tea"},
           reviews=["Fresh and creamy.", "Best milk for tea."]),
        _p("SKU-DRY-002", "amul taaza toned milk", "Amul", "dairy", "milk", 56, "ml", 1000, 4.3, 4200,
           kw={"milk", "toned", "low fat"},
           syn={"toned doodh", "lite milk"},
           dietary={"veg"},
           allergen={"lactose"},
           occ={"everyday", "diet"},
           reviews=["Good for health-conscious people."]),
        _p("SKU-DRY-003", "amul fresh paneer", "Amul", "dairy", "paneer", 90, "g", 200, 4.4, 3800,
           kw={"paneer", "cottage cheese", "tofu alternative"},
           syn={"paneer", "chhena"},
           dietary={"veg"},
           allergen={"lactose"},
           occ={"dinner", "party", "everyday"},
           reviews=["Soft and fresh paneer.", "Good for kadhai paneer."]),
        _p("SKU-DRY-004", "mother dairy dahi", "Mother Dairy", "dairy", "curd", 45, "ml", 400, 4.2, 3500,
           kw={"curd", "dahi", "yogurt"},
           syn={"dahi", "doi", "yoghurt"},
           dietary={"veg"},
           allergen={"lactose"},
           occ={"everyday", "lunch"},
           reviews=["Thick and creamy dahi."]),
        _p("SKU-DRY-005", "amul butter", "Amul", "dairy", "butter", 56, "g", 100, 4.6, 6000,
           kw={"butter", "spread", "toast"},
           syn={"makhan", "makkhan"},
           dietary={"veg"},
           allergen={"lactose"},
           occ={"breakfast", "everyday"},
           reviews=["The classic Amul taste.", "Perfect for parathas."]),
        _p("SKU-DRY-006", "amul pure ghee", "Amul", "dairy", "ghee", 530, "ml", 1000, 4.7, 4800,
           kw={"ghee", "clarified butter", "desi ghee"},
           syn={"desi ghee", "asli ghee"},
           dietary={"veg"},
           allergen={"lactose"},
           occ={"festive", "everyday", "cooking"},
           reviews=["Rich aroma and pure taste.", "Best ghee for dal tadka."]),
        _p("SKU-DRY-007", "amul cheese slices", "Amul", "dairy", "cheese", 120, "g", 200, 4.3, 2900,
           kw={"cheese", "slices", "sandwich"},
           syn={"cheese slice", "processed cheese"},
           dietary={"veg"},
           allergen={"lactose"},
           occ={"breakfast", "snack", "kids"},
           reviews=["Melts nicely on toast.", "Kids love it."]),
        _p("SKU-DRY-008", "epigamia greek yogurt mixed berries", "Epigamia", "dairy", "yogurt", 65, "g", 90, 4.1, 1800,
           kw={"yogurt", "greek yogurt", "berries", "protein"},
           syn={"yoghurt", "flavored curd"},
           dietary={"veg"},
           allergen={"lactose"},
           occ={"breakfast", "snack", "diet"},
           reviews=["Tasty and creamy.", "Good protein content."]),
    ]


def _snacks() -> list[dict]:
    """Snacks: chips, namkeen, biscuits, instant noodles."""
    return [
        _p("SKU-SNK-001", "lays classic salted chips", "Lays", "snacks", "chips", 20, "g", 52, 4.2, 3200,
           kw={"chips", "potato chips", "wafers", "party snack"},
           syn={"crisps", "namkeen", "chips packet", "aloo chips"},
           dietary={"veg"},
           occ={"party", "movie_night", "ipl_watch_party", "picnic"},
           reviews=["Crisp and fresh.", "Classic taste everyone loves."]),
        _p("SKU-SNK-002", "lays magic masala chips", "Lays", "snacks", "chips", 20, "g", 52, 4.3, 2900,
           kw={"chips", "masala chips", "spicy chips"},
           syn={"masala wafers", "chatpata chips"},
           dietary={"veg"},
           occ={"party", "movie_night", "ipl_watch_party"},
           reviews=["Best masala flavor!", "Addictive taste."]),
        _p("SKU-SNK-003", "kurkure masala munch", "Kurkure", "snacks", "namkeen", 20, "g", 75, 4.1, 2500,
           kw={"kurkure", "namkeen", "snack", "masala"},
           syn={"kurkure", "tedha hai par mera hai"},
           dietary={"veg"},
           occ={"party", "snack", "ipl_watch_party"},
           reviews=["Crunchy and masaledar."]),
        _p("SKU-SNK-004", "haldiram aloo bhujia", "Haldiram", "snacks", "namkeen", 85, "g", 400, 4.4, 3600,
           kw={"bhujia", "namkeen", "haldiram", "aloo"},
           syn={"bhujia", "namkeen", "farsaan", "mixture"},
           dietary={"veg", "jain"},
           occ={"party", "festive", "diwali", "tea_time"},
           reviews=["Classic Haldiram taste.", "Best with chai."]),
        _p("SKU-SNK-005", "haldiram moong dal namkeen", "Haldiram", "snacks", "namkeen", 65, "g", 200, 4.3, 2800,
           kw={"moong dal", "namkeen", "snack", "crispy"},
           syn={"moong dal namkeen", "farsaan"},
           dietary={"veg", "jain"},
           occ={"tea_time", "snack"},
           reviews=["Light and crispy."]),
        _p("SKU-SNK-006", "maggi 2-minute noodles masala", "Maggi", "snacks", "noodles", 14, "g", 70, 4.4, 8000,
           kw={"maggi", "noodles", "instant", "masala"},
           syn={"maggi", "2 minute noodles", "instant noodles"},
           dietary={"veg"},
           occ={"snack", "hostel", "midnight"},
           reviews=["The OG instant noodle.", "Quick hunger fix."]),
        _p("SKU-SNK-007", "maggi 2-minute masala 4-pack", "Maggi", "snacks", "noodles", 52, "g", 280, 4.4, 6000,
           kw={"maggi", "noodles", "family pack", "value"},
           syn={"maggi family pack"},
           dietary={"veg"},
           occ={"hostel", "family"},
           reviews=["Good value pack.", "Always in stock."]),
        _p("SKU-SNK-008", "parle-g biscuits", "Parle", "snacks", "biscuits", 10, "g", 79, 4.5, 9000,
           kw={"biscuit", "parle-g", "glucose", "chai snack"},
           syn={"parle g", "glucose biscuit", "chai biscuit"},
           dietary={"veg"},
           occ={"tea_time", "everyday", "breakfast"},
           reviews=["Classic with chai.", "India's favorite biscuit."]),
        _p("SKU-SNK-009", "britannia good day butter cookies", "Britannia", "snacks", "biscuits", 35, "g", 120, 4.2, 3100,
           kw={"cookies", "biscuit", "butter", "sweet"},
           syn={"good day", "butter biscuit"},
           dietary={"veg"},
           occ={"tea_time", "snack"},
           reviews=["Buttery and crisp."]),
        _p("SKU-SNK-010", "uncle chips spicy treat", "Uncle Chips", "snacks", "chips", 20, "g", 55, 4.0, 1500,
           kw={"chips", "spicy", "uncle chips"},
           syn={"uncle chipps"},
           dietary={"veg"},
           occ={"party", "snack"},
           reviews=["Good spicy flavor.", "Crunchy chips."]),
        _p("SKU-SNK-011", "bingo mad angles achari masti", "Bingo", "snacks", "chips", 20, "g", 72.5, 4.1, 2100,
           kw={"bingo", "mad angles", "achari", "tangy"},
           syn={"bingo chips", "triangle chips"},
           dietary={"veg"},
           occ={"party", "snack"},
           reviews=["Unique triangle shape and taste."]),
        _p("SKU-SNK-012", "doritos sweet chilli", "Doritos", "snacks", "chips", 45, "g", 72, 4.2, 1200,
           kw={"doritos", "tortilla chips", "nachos", "party"},
           syn={"nachos", "corn chips"},
           dietary={"veg"},
           occ={"party", "movie_night"},
           reviews=["Premium chips for parties."]),
    ]


def _beverages() -> list[dict]:
    """Beverages: cold drinks, juices, tea, coffee, water."""
    return [
        _p("SKU-BEV-001", "coca-cola 2L pet bottle", "Coca-Cola", "beverages", "soft_drink", 95, "ml", 2000, 4.3, 5500,
           kw={"coke", "cola", "soft drink", "cold drink", "party"},
           syn={"thanda", "cold drink", "coke bottle"},
           dietary={"veg", "vegan"},
           occ={"party", "ipl_watch_party", "birthday", "picnic"},
           reviews=["Party essential.", "Best with ice."],
           calories=42, sugar=10.6, carbs=10.6, protein=0, fat=0, saturated_fat=0, fiber=0, sodium=10),
        _p("SKU-BEV-001A", "diet coke 2L pet bottle", "Coca-Cola", "beverages", "soft_drink", 95, "ml", 2000, 4.1, 3200,
           kw={"diet coke", "coke", "zero sugar", "low calorie", "diet"},
           syn={"diet thanda", "sugar free coke", "zero coke"},
           dietary={"veg", "vegan"},
           occ={"party", "diet", "everyday"},
           reviews=["No sugar, great taste.", "Perfect for diet-conscious."],
           calories=0.3, sugar=0, carbs=0, protein=0, fat=0, saturated_fat=0, fiber=0, sodium=15),
        _p("SKU-BEV-002", "pepsi 2L pet bottle", "Pepsi", "beverages", "soft_drink", 90, "ml", 2000, 4.1, 4200,
           kw={"pepsi", "cola", "soft drink", "cold drink"},
           syn={"thanda", "pepsi bottle"},
           dietary={"veg", "vegan"},
           occ={"party", "ipl_watch_party"},
           reviews=["Good alternative to Coke."],
           calories=41, sugar=10.9, carbs=11, protein=0, fat=0, saturated_fat=0, fiber=0, sodium=12),
        _p("SKU-BEV-002A", "pepsi zero sugar 2L", "Pepsi", "beverages", "soft_drink", 90, "ml", 2000, 4.0, 2800,
           kw={"pepsi zero", "zero sugar", "diet pepsi", "low calorie"},
           syn={"diet pepsi", "sugar free pepsi"},
           dietary={"veg", "vegan"},
           occ={"party", "diet", "everyday"},
           reviews=["Zero sugar, good taste."],
           calories=0.2, sugar=0, carbs=0, protein=0, fat=0, saturated_fat=0, fiber=0, sodium=15),
        _p("SKU-BEV-003", "sprite 1.25L", "Sprite", "beverages", "soft_drink", 65, "ml", 1250, 4.2, 3800,
           kw={"sprite", "lemon", "lime", "clear drink"},
           syn={"lime soda", "nimbu paani alternative"},
           dietary={"veg", "vegan"},
           occ={"party", "summer"},
           reviews=["Refreshing lime taste."],
           calories=37, sugar=9, carbs=9, protein=0, fat=0, saturated_fat=0, fiber=0, sodium=8),
        _p("SKU-BEV-004", "thums up 2L", "Thums Up", "beverages", "soft_drink", 95, "ml", 2000, 4.4, 4800,
           kw={"thums up", "cola", "strong cola", "thunder"},
           syn={"thunder", "toofani drink"},
           dietary={"veg", "vegan"},
           occ={"party", "ipl_watch_party"},
           reviews=["Strong cola taste.", "Indian original."],
           calories=43, sugar=11.2, carbs=11.2, protein=0, fat=0, saturated_fat=0, fiber=0, sodium=11),
        _p("SKU-BEV-005", "real fruit power mixed fruit juice", "Real", "beverages", "juice", 99, "ml", 1000, 4.0, 2500,
           kw={"juice", "fruit juice", "mixed fruit", "healthy"},
           syn={"juice box", "fruit drink"},
           dietary={"veg", "vegan"},
           occ={"breakfast", "kids", "party"},
           reviews=["Good for kids.", "Not too sweet."],
           calories=48, sugar=10.5, carbs=11.8, protein=0.3, fat=0, saturated_fat=0, fiber=0.2, sodium=15),
        _p("SKU-BEV-006", "paper boat aamras", "Paper Boat", "beverages", "juice", 40, "ml", 200, 4.3, 1800,
           kw={"aamras", "mango", "drink", "summer"},
           syn={"aam ras", "mango juice"},
           dietary={"veg", "vegan"},
           occ={"summer", "snack"},
           reviews=["Authentic mango taste.", "Nostalgic."],
           calories=54, sugar=12.5, carbs=13, protein=0.4, fat=0.1, saturated_fat=0, fiber=0.5, sodium=8),
        _p("SKU-BEV-007", "tata tea gold", "Tata Tea", "beverages", "tea", 295, "g", 500, 4.5, 4000,
           kw={"tea", "chai", "black tea", "CTC"},
           syn={"chai patti", "tea leaves"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "breakfast", "tea_time"},
           reviews=["Rich taste.", "Perfect kadak chai."],
           calories=1, sugar=0, carbs=0.3, protein=0, fat=0, saturated_fat=0, fiber=0, sodium=2),
        _p("SKU-BEV-008", "bru instant coffee", "Bru", "beverages", "coffee", 195, "g", 200, 4.2, 3500,
           kw={"coffee", "instant coffee", "filter coffee"},
           syn={"kaapi", "coffee powder"},
           dietary={"veg", "vegan"},
           occ={"breakfast", "everyday"},
           reviews=["Good instant coffee.", "Smooth taste."],
           calories=2, sugar=0, carbs=0.5, protein=0.2, fat=0, saturated_fat=0, fiber=0, sodium=5),
        _p("SKU-BEV-009", "nescafe classic coffee", "Nescafe", "beverages", "coffee", 245, "g", 200, 4.4, 4500,
           kw={"coffee", "instant", "nescafe", "black coffee"},
           syn={"kaapi", "nescafe jar"},
           dietary={"veg", "vegan"},
           occ={"breakfast", "everyday", "exam"},
           reviews=["The classic coffee.", "Great aroma."],
           calories=2, sugar=0, carbs=0.4, protein=0.2, fat=0, saturated_fat=0, fiber=0, sodium=4),
        _p("SKU-BEV-010", "bisleri mineral water 1L", "Bisleri", "beverages", "water", 20, "ml", 1000, 4.0, 2000,
           kw={"water", "mineral water", "drinking water"},
           syn={"paani", "pani bottle"},
           dietary={"veg", "vegan", "jain"},
           occ={"travel", "party", "picnic"},
           reviews=["Safe drinking water."],
           calories=0, sugar=0, carbs=0, protein=0, fat=0, saturated_fat=0, fiber=0, sodium=2),
        _p("SKU-BEV-011", "red bull energy drink", "Red Bull", "beverages", "energy_drink", 125, "ml", 250, 4.0, 1500,
           kw={"energy drink", "caffeine", "red bull"},
           syn={"energy drink"},
           dietary={"veg"},
           occ={"exam", "gaming", "party"},
           reviews=["Gives you wings.", "Good before gym."],
           calories=45, sugar=11, carbs=11, protein=0, fat=0, saturated_fat=0, fiber=0, sodium=105),
        _p("SKU-BEV-012", "frooti mango drink 1.2L", "Frooti", "beverages", "juice", 60, "ml", 1200, 4.1, 3200,
           kw={"frooti", "mango", "drink", "kids"},
           syn={"mango juice", "frooti bottle"},
           dietary={"veg", "vegan"},
           occ={"kids", "picnic", "summer"},
           reviews=["Kids favorite mango drink."],
           calories=52, sugar=12, carbs=12.5, protein=0.2, fat=0, saturated_fat=0, fiber=0.1, sodium=10),
    ]


def _spices() -> list[dict]:
    """Spices and masalas."""
    return [
        _p("SKU-SPC-001", "mdh garam masala", "MDH", "spices", "masala", 85, "g", 100, 4.5, 3500,
           kw={"garam masala", "spice mix", "masala"},
           syn={"garam masala", "sabji masala"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "cooking"},
           reviews=["Aromatic and fresh.", "Essential kitchen spice."]),
        _p("SKU-SPC-002", "everest kitchen king masala", "Everest", "spices", "masala", 95, "g", 100, 4.4, 2800,
           kw={"kitchen king", "all purpose masala", "spice blend"},
           syn={"kitchen king", "sabzi masala"},
           dietary={"veg", "vegan"},
           occ={"everyday", "cooking"},
           reviews=["Good all-purpose masala."]),
        _p("SKU-SPC-003", "catch turmeric powder", "Catch", "spices", "turmeric", 55, "g", 200, 4.3, 2200,
           kw={"turmeric", "haldi", "yellow"},
           syn={"haldi", "haldi powder"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday"},
           reviews=["Pure haldi.", "Good color."]),
        _p("SKU-SPC-004", "mdh chilli powder", "MDH", "spices", "chilli", 65, "g", 100, 4.3, 2500,
           kw={"chilli", "red chilli", "lal mirch", "spicy"},
           syn={"lal mirch", "mirchi powder"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday"},
           reviews=["Good color and heat."]),
        _p("SKU-SPC-005", "tata salt", "Tata", "spices", "salt", 20, "g", 1000, 4.5, 7000,
           kw={"salt", "iodized salt", "table salt"},
           syn={"namak", "noon"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday"},
           reviews=["India's trusted salt."]),
        _p("SKU-SPC-006", "mdh chana masala", "MDH", "spices", "masala", 75, "g", 100, 4.4, 2000,
           kw={"chana masala", "chole masala", "chickpea spice"},
           syn={"chole masala", "chana masala"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "punjabi"},
           reviews=["Perfect for chole.", "Authentic taste."]),
    ]


def _oils() -> list[dict]:
    """Cooking oils."""
    return [
        _p("SKU-OIL-001", "fortune sunflower oil", "Fortune", "oils", "sunflower", 185, "ml", 1000, 4.3, 3800,
           kw={"oil", "sunflower oil", "cooking oil", "refined"},
           syn={"tel", "sunflower tel"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "cooking"},
           reviews=["Light and healthy.", "Good for frying."]),
        _p("SKU-OIL-002", "saffola gold cooking oil", "Saffola", "oils", "blended", 249, "ml", 1000, 4.4, 2900,
           kw={"oil", "saffola", "heart healthy", "blended"},
           syn={"healthy oil", "saffola tel"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday"},
           reviews=["Good for heart health."]),
        _p("SKU-OIL-003", "dabur mustard oil", "Dabur", "oils", "mustard", 165, "ml", 1000, 4.2, 2500,
           kw={"mustard oil", "sarson ka tel", "pungent"},
           syn={"sarson tel", "mustard tel", "kachi ghani"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "pickle", "north_indian"},
           reviews=["Strong aroma.", "Best for pickles."]),
        _p("SKU-OIL-004", "borges extra virgin olive oil", "Borges", "oils", "olive", 599, "ml", 500, 4.1, 1200,
           kw={"olive oil", "extra virgin", "salad oil", "healthy"},
           syn={"olive tel", "jaitun ka tel"},
           dietary={"veg", "vegan", "jain"},
           occ={"salad", "diet", "premium"},
           reviews=["Good for salads.", "Mild flavor."]),
    ]


def _vegetables() -> list[dict]:
    """Fresh vegetables (mock — always in stock for demo)."""
    return [
        _p("SKU-VEG-001", "fresh onion", "Local Farm", "vegetables", "onion", 35, "g", 1000, 4.0, 1000,
           kw={"onion", "pyaz", "sabzi"},
           syn={"pyaaz", "kanda", "onion"},
           dietary={"veg", "vegan"},
           occ={"everyday", "cooking"},
           reviews=["Fresh and firm."]),
        _p("SKU-VEG-002", "fresh tomato", "Local Farm", "vegetables", "tomato", 40, "g", 1000, 4.0, 1000,
           kw={"tomato", "tamatar", "sabzi"},
           syn={"tamatar", "tomato"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "cooking"},
           reviews=["Red and juicy."]),
        _p("SKU-VEG-003", "fresh potato", "Local Farm", "vegetables", "potato", 30, "g", 1000, 4.0, 1000,
           kw={"potato", "aloo", "sabzi"},
           syn={"aloo", "batata", "potato"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "cooking"},
           reviews=["Good size potatoes."]),
        _p("SKU-VEG-004", "fresh green chilli", "Local Farm", "vegetables", "chilli", 15, "g", 100, 3.9, 500,
           kw={"green chilli", "hari mirch"},
           syn={"hari mirch", "chilli"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday"},
           reviews=["Fresh and spicy."]),
        _p("SKU-VEG-005", "fresh coriander bunch", "Local Farm", "vegetables", "herbs", 10, "piece", 1, 3.8, 500,
           kw={"coriander", "dhania", "cilantro", "garnish"},
           syn={"dhania", "hara dhania"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "garnish"},
           reviews=["Fresh and aromatic."]),
        _p("SKU-VEG-006", "fresh ginger", "Local Farm", "vegetables", "ginger", 20, "g", 100, 4.0, 800,
           kw={"ginger", "adrak"},
           syn={"adrak", "sonth"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "tea"},
           reviews=["Fresh and pungent."]),
        _p("SKU-VEG-007", "fresh garlic", "Local Farm", "vegetables", "garlic", 25, "g", 100, 4.0, 800,
           kw={"garlic", "lahsun"},
           syn={"lahsun", "garlic"},
           dietary={"veg", "vegan"},
           occ={"everyday", "cooking"},
           reviews=["Good quality garlic."]),
    ]


def _instant_food() -> list[dict]:
    """Instant/ready-to-eat foods."""
    return [
        _p("SKU-INS-001", "mtr ready to eat rajma masala", "MTR", "instant_food", "ready_to_eat", 89, "g", 300, 4.1, 1800,
           kw={"rajma", "ready to eat", "instant", "microwave"},
           syn={"instant rajma", "ready food"},
           dietary={"veg", "vegan"},
           occ={"hostel", "travel", "quick_meal"},
           reviews=["Tastes homemade.", "Good for travel."]),
        _p("SKU-INS-002", "mtr ready to eat paneer butter masala", "MTR", "instant_food", "ready_to_eat", 99, "g", 300, 4.2, 2200,
           kw={"paneer butter masala", "ready to eat", "instant"},
           syn={"instant paneer", "microwave meal"},
           dietary={"veg"},
           occ={"hostel", "quick_meal"},
           reviews=["Rich gravy.", "Good paneer pieces."]),
        _p("SKU-INS-003", "cup noodles masala", "Nissin", "instant_food", "noodles", 45, "g", 70, 4.0, 1500,
           kw={"cup noodles", "instant noodles", "masala"},
           syn={"cup noodles", "instant ramen"},
           dietary={"veg"},
           occ={"hostel", "midnight", "snack"},
           reviews=["Quick and easy.", "Just add hot water."]),
        _p("SKU-INS-004", "knorr instant soup tomato", "Knorr", "instant_food", "soup", 35, "g", 11, 4.0, 1200,
           kw={"soup", "instant soup", "tomato soup"},
           syn={"instant soup", "powder soup"},
           dietary={"veg"},
           occ={"winter", "snack", "diet"},
           reviews=["Quick soup fix.", "Good tomato flavor."]),
    ]


def _cleaning() -> list[dict]:
    """Cleaning and household."""
    return [
        _p("SKU-CLN-001", "vim dishwash bar", "Vim", "cleaning", "dishwash", 25, "g", 200, 4.3, 3500,
           kw={"dishwash", "utensil cleaner", "bartan", "antibacterial"},
           syn={"bartan soap", "dish bar"},
           dietary=set(),
           occ={"everyday", "household"},
           reviews=["Cuts grease well."]),
        _p("SKU-CLN-001A", "vim green eco dishwash bar", "Vim", "cleaning", "dishwash", 28, "g", 200, 4.4, 2100,
           kw={"dishwash", "utensil cleaner", "bartan", "eco-friendly", "biodegradable", "plant-based"},
           syn={"bartan soap", "eco dish bar"},
           dietary=set(),
           occ={"everyday", "household"},
           reviews=["Eco-friendly formula.", "Gentle on hands."]),
        _p("SKU-CLN-002", "surf excel quick wash detergent", "Surf Excel", "cleaning", "detergent", 185, "g", 1000, 4.4, 4200,
           kw={"detergent", "washing powder", "laundry"},
           syn={"kapda dhone ka powder", "surf"},
           dietary=set(),
           occ={"everyday", "household"},
           reviews=["Removes tough stains."]),
        _p("SKU-CLN-003", "harpic toilet cleaner", "Harpic", "cleaning", "toilet_cleaner", 95, "ml", 500, 4.2, 3000,
           kw={"toilet cleaner", "bathroom", "disinfectant", "kills germs", "99.9%"},
           syn={"toilet cleaner", "bathroom cleaner"},
           dietary=set(),
           occ={"household"},
           reviews=["Effective cleaning."]),
        _p("SKU-CLN-004", "lizol disinfectant floor cleaner", "Lizol", "cleaning", "floor_cleaner", 145, "ml", 975, 4.3, 2800,
           kw={"floor cleaner", "disinfectant", "mopping", "antibacterial", "kills germs"},
           syn={"floor cleaner", "phenyl"},
           dietary=set(),
           occ={"household"},
           reviews=["Good fragrance.", "Cleans well."]),
    ]


def _hygiene() -> list[dict]:
    """Personal hygiene: soap, shampoo, toothpaste."""
    return [
        _p("SKU-HYG-001", "dettol original soap", "Dettol", "hygiene", "soap", 55, "g", 125, 4.3, 4000,
           kw={"soap", "antibacterial", "bath", "kills germs"},
           syn={"sabun", "nahane ka sabun"},
           dietary=set(),
           occ={"everyday"},
           reviews=["Trusted germ protection."]),
        _p("SKU-HYG-002", "dove cream beauty bathing bar", "Dove", "hygiene", "soap", 65, "g", 100, 4.4, 3500,
           kw={"soap", "moisturizing", "beauty bar", "dermatologist tested"},
           syn={"dove soap", "bathing bar"},
           dietary=set(),
           occ={"everyday"},
           reviews=["Very moisturizing.", "Soft on skin."]),
        _p("SKU-HYG-002A", "himalaya neem soap", "Himalaya", "hygiene", "soap", 45, "g", 125, 4.5, 3800,
           kw={"soap", "neem", "natural", "herbal", "ayurvedic"},
           syn={"neem sabun", "herbal soap"},
           dietary=set(),
           occ={"everyday"},
           reviews=["Natural ingredients.", "Good for skin."]),
        _p("SKU-HYG-003", "head & shoulders anti dandruff shampoo", "Head & Shoulders", "hygiene", "shampoo", 250, "ml", 340, 4.2, 3000,
           kw={"shampoo", "anti dandruff", "hair", "clinically tested"},
           syn={"shampoo", "baal dhone ka"},
           dietary=set(),
           occ={"everyday"},
           reviews=["Reduces dandruff.", "Good lather."]),
        _p("SKU-HYG-004", "colgate maxfresh toothpaste", "Colgate", "hygiene", "toothpaste", 95, "g", 150, 4.4, 5000,
           kw={"toothpaste", "dental", "fresh breath", "mint"},
           syn={"toothpaste", "dant manjan"},
           dietary=set(),
           occ={"everyday"},
           reviews=["Fresh minty taste.", "Long lasting freshness."]),
        _p("SKU-HYG-005", "clinic plus strong & long shampoo", "Clinic Plus", "hygiene", "shampoo", 145, "ml", 340, 4.1, 2800,
           kw={"shampoo", "long hair", "protein"},
           syn={"shampoo"},
           dietary=set(),
           occ={"everyday"},
           reviews=["Good for long hair."]),
    ]



def _bakery() -> list[dict]:
    """Bakery items: bread, cake, rusk."""
    return [
        _p("SKU-BAK-001", "britannia white bread", "Britannia", "bakery", "bread", 45, "g", 400, 4.2, 3500,
           kw={"bread", "white bread", "sandwich bread", "toast"},
           syn={"bread", "double roti", "pav"},
           dietary={"veg"},
           occ={"everyday", "breakfast"},
           reviews=["Soft and fresh.", "Good for sandwiches."]),
        _p("SKU-BAK-002", "britannia whole wheat bread", "Britannia", "bakery", "bread", 55, "g", 400, 4.3, 2800,
           kw={"bread", "wheat bread", "brown bread", "healthy"},
           syn={"brown bread", "atta bread"},
           dietary={"veg"},
           occ={"everyday", "breakfast", "diet"},
           reviews=["Healthy option.", "Good fiber content."]),
        _p("SKU-BAK-003", "britannia milk rusk", "Britannia", "bakery", "rusk", 55, "g", 230, 4.4, 3000,
           kw={"rusk", "toast", "tea snack", "crispy"},
           syn={"rusk", "tost", "chai ka rusk"},
           dietary={"veg"},
           occ={"breakfast", "tea_time"},
           reviews=["Perfect with chai.", "Crispy and sweet."]),
        _p("SKU-BAK-004", "modern pav bun 4-pack", "Modern", "bakery", "bun", 35, "piece", 4, 4.0, 2000,
           kw={"pav", "bun", "pav bhaji", "burger bun"},
           syn={"pav", "bun", "bread roll"},
           dietary={"veg"},
           occ={"pav_bhaji", "dinner"},
           reviews=["Soft pav.", "Good for pav bhaji."]),
    ]


def _frozen() -> list[dict]:
    """Frozen foods: ice cream, frozen snacks."""
    return [
        _p("SKU-FRZ-001", "amul vanilla ice cream tub", "Amul", "frozen", "ice_cream", 250, "ml", 1000, 4.4, 3500,
           kw={"ice cream", "vanilla", "dessert", "frozen"},
           syn={"ice cream", "kulfi"},
           dietary={"veg"},
           allergen={"lactose"},
           occ={"party", "birthday", "dessert", "summer"},
           reviews=["Creamy and rich.", "Great for parties."]),
        _p("SKU-FRZ-002", "kwality walls cornetto cone", "Kwality Walls", "frozen", "ice_cream", 40, "piece", 1, 4.2, 2800,
           kw={"cone", "ice cream cone", "chocolate"},
           syn={"cornetto", "ice cream cone"},
           dietary={"veg"},
           allergen={"lactose"},
           occ={"snack", "treat"},
           reviews=["Chocolatey goodness."]),
        _p("SKU-FRZ-003", "mccain french fries", "McCain", "frozen", "fries", 185, "g", 450, 4.1, 1800,
           kw={"french fries", "fries", "frozen fries", "potato"},
           syn={"french fries", "finger chips"},
           dietary={"veg", "vegan"},
           occ={"party", "snack", "movie_night"},
           reviews=["Crispy when baked.", "Easy party snack."]),
        _p("SKU-FRZ-004", "id fresh ready to fry parota", "iD Fresh", "frozen", "parota", 99, "piece", 5, 4.3, 2200,
           kw={"parota", "frozen paratha", "ready to cook"},
           syn={"paratha", "frozen roti"},
           dietary={"veg"},
           occ={"breakfast", "dinner"},
           reviews=["Flaky layers.", "Tastes like fresh."]),
    ]


def _stationery() -> list[dict]:
    """Stationery for student/exam prep scenarios."""
    return [
        _p("SKU-STN-001", "classmate long notebook 180 pages", "Classmate", "stationery", "notebook", 55, "piece", 1, 4.3, 3200,
           kw={"notebook", "register", "copy", "exam", "writing"},
           syn={"copy", "register", "kaapy"},
           dietary=set(),
           occ={"exam", "school", "college"},
           reviews=["Good quality paper.", "Lasts whole semester."]),
        _p("SKU-STN-002", "cello butterflow ball pen blue", "Cello", "stationery", "pen", 10, "piece", 1, 4.2, 4500,
           kw={"pen", "ball pen", "blue pen", "writing"},
           syn={"pen", "kalam"},
           dietary=set(),
           occ={"exam", "school", "office"},
           reviews=["Smooth writing.", "Best budget pen."]),
        _p("SKU-STN-003", "reynolds trimax gel pen black", "Reynolds", "stationery", "pen", 25, "piece", 1, 4.1, 2800,
           kw={"gel pen", "black pen", "smooth writing"},
           syn={"gel pen", "black pen"},
           dietary=set(),
           occ={"exam", "office"},
           reviews=["Dark and smooth ink."]),
        _p("SKU-STN-004", "doms zoom pencils pack of 10", "DOMS", "stationery", "pencil", 35, "piece", 10, 4.3, 2500,
           kw={"pencil", "drawing", "writing", "HB"},
           syn={"pencil", "lead pencil"},
           dietary=set(),
           occ={"school", "drawing"},
           reviews=["Good for sketching.", "Strong lead."]),
        _p("SKU-STN-005", "camlin geometry box", "Camlin", "stationery", "geometry", 120, "piece", 1, 4.4, 2000,
           kw={"geometry box", "compass", "math", "drawing"},
           syn={"geometry box", "compass box"},
           dietary=set(),
           occ={"school", "exam"},
           reviews=["All tools included.", "Good quality."]),
    ]


def _party_supplies() -> list[dict]:
    """Party supplies: disposables, decorations."""
    return [
        _p("SKU-PTY-001", "paper plates white 50-pack", "Nice", "party_supplies", "plates", 99, "piece", 50, 4.0, 1200,
           kw={"paper plates", "disposable plates", "party"},
           syn={"disposable plate", "use and throw plate"},
           dietary=set(),
           occ={"party", "birthday", "picnic", "ipl_watch_party"},
           reviews=["Sturdy plates.", "Good for parties."]),
        _p("SKU-PTY-002", "paper cups 50-pack", "Nice", "party_supplies", "cups", 79, "piece", 50, 3.9, 1100,
           kw={"paper cups", "disposable cups", "party"},
           syn={"disposable cup", "chai cup"},
           dietary=set(),
           occ={"party", "birthday", "picnic"},
           reviews=["Standard quality.", "Good for hot drinks."]),
        _p("SKU-PTY-003", "birthday balloons assorted 25-pack", "Amscan", "party_supplies", "balloons", 149, "piece", 25, 4.1, 900,
           kw={"balloons", "birthday", "decoration", "party"},
           syn={"gubbare", "balloon"},
           dietary=set(),
           occ={"birthday", "party", "celebration"},
           reviews=["Vibrant colors.", "Last long."]),
        _p("SKU-PTY-004", "plastic spoons 100-pack", "Nice", "party_supplies", "cutlery", 89, "piece", 100, 3.8, 800,
           kw={"spoons", "disposable", "cutlery", "party"},
           syn={"disposable spoon", "plastic chamach"},
           dietary=set(),
           occ={"party", "picnic", "event"},
           reviews=["Good for events."]),
        _p("SKU-PTY-005", "tissue paper napkins 100-pack", "Nice", "party_supplies", "napkins", 65, "piece", 100, 4.0, 1500,
           kw={"napkins", "tissue", "paper towel"},
           syn={"tissue paper", "napkin"},
           dietary=set(),
           occ={"party", "everyday", "restaurant"},
           reviews=["Soft and absorbent."]),
    ]


def _personal_care() -> list[dict]:
    """Personal care: deo, face wash, etc."""
    return [
        _p("SKU-PRC-001", "nivea men deodorant fresh active", "Nivea", "personal_care", "deodorant", 195, "ml", 150, 4.2, 2800,
           kw={"deodorant", "deo", "body spray", "freshness"},
           syn={"deo", "body spray"},
           dietary=set(),
           occ={"everyday"},
           reviews=["Long lasting freshness.", "Good fragrance."]),
        _p("SKU-PRC-002", "himalaya neem face wash", "Himalaya", "personal_care", "face_wash", 175, "ml", 150, 4.3, 3200,
           kw={"face wash", "neem", "acne", "pimple"},
           syn={"face wash", "mooh dhone ka"},
           dietary=set(),
           occ={"everyday"},
           reviews=["Reduces acne.", "Gentle on skin."]),
        _p("SKU-PRC-003", "vaseline intensive care body lotion", "Vaseline", "personal_care", "lotion", 225, "ml", 400, 4.2, 2500,
           kw={"body lotion", "moisturizer", "dry skin"},
           syn={"cream", "lotion"},
           dietary=set(),
           occ={"everyday", "winter"},
           reviews=["Very moisturizing.", "Non-greasy."]),
    ]


def _non_veg() -> list[dict]:
    """Non-vegetarian items: chicken, eggs, fish."""
    return [
        _p("SKU-NV-001", "farm fresh chicken breast", "Fresh Farm", "non_veg", "chicken", 280, "g", 500, 4.2, 1500,
           kw={"chicken", "breast", "protein", "non-veg"},
           syn={"murgi", "chicken breast", "boneless chicken"},
           dietary={"non-veg"},
           occ={"dinner", "gym", "protein"},
           reviews=["Fresh and tender.", "Good for grilling."]),
        _p("SKU-NV-002", "farm fresh eggs pack of 12", "Fresh Farm", "non_veg", "eggs", 84, "piece", 12, 4.3, 4000,
           kw={"eggs", "anda", "protein", "breakfast"},
           syn={"anda", "eggs", "hen eggs"},
           dietary={"non-veg"},
           occ={"everyday", "breakfast", "baking"},
           reviews=["Fresh eggs.", "Good size."]),
        _p("SKU-NV-003", "farm fresh chicken curry cut", "Fresh Farm", "non_veg", "chicken", 260, "g", 500, 4.1, 1200,
           kw={"chicken", "curry cut", "bone-in", "gravy"},
           syn={"chicken", "murgi curry", "chicken pieces"},
           dietary={"non-veg"},
           occ={"dinner", "party", "biryani"},
           reviews=["Good for curry.", "Well-cut pieces."]),
        _p("SKU-NV-004", "fresh mutton curry cut", "Fresh Farm", "non_veg", "mutton", 550, "g", 500, 4.0, 800,
           kw={"mutton", "goat meat", "red meat"},
           syn={"mutton", "bakra", "gosht"},
           dietary={"non-veg"},
           occ={"biryani", "party", "special_dinner"},
           reviews=["Fresh mutton.", "Good for biryani."]),
    ]


def _fruits() -> list[dict]:
    """Fresh and packaged fruits."""
    return [
        _p("SKU-FRT-001", "fresh banana robusta 1 dozen", "Local Farm", "fruits", "banana", 45, "piece", 12, 4.2, 1500,
           kw={"banana", "fruit", "energy"}, syn={"kela", "banana"}, dietary={"veg", "vegan", "jain"}, occ={"everyday", "breakfast"}, reviews=["Fresh and sweet."]),
        _p("SKU-FRT-002", "fresh apple shimla 1kg", "Local Farm", "fruits", "apple", 180, "g", 1000, 4.3, 1200,
           kw={"apple", "fruit", "healthy"}, syn={"seb", "apple"}, dietary={"veg", "vegan", "jain"}, occ={"everyday", "diet"}, reviews=["Juicy Shimla apples."]),
        _p("SKU-FRT-003", "fresh orange nagpur 1kg", "Local Farm", "fruits", "orange", 120, "g", 1000, 4.1, 900,
           kw={"orange", "citrus", "vitamin c"}, syn={"santra", "narangi"}, dietary={"veg", "vegan", "jain"}, occ={"everyday", "winter"}, reviews=["Sweet and tangy."]),
        _p("SKU-FRT-004", "fresh mango alphonso 1kg", "Local Farm", "fruits", "mango", 450, "g", 1000, 4.7, 2000,
           kw={"mango", "alphonso", "hapus", "summer"}, syn={"aam", "hapus"}, dietary={"veg", "vegan", "jain"}, occ={"summer", "festive"}, reviews=["King of fruits."]),
        _p("SKU-FRT-005", "fresh papaya 1 piece", "Local Farm", "fruits", "papaya", 55, "piece", 1, 4.0, 600,
           kw={"papaya", "fruit", "digestion"}, syn={"papita"}, dietary={"veg", "vegan", "jain"}, occ={"everyday", "diet"}, reviews=["Ripe and sweet."]),
        _p("SKU-FRT-006", "fresh pomegranate 500g", "Local Farm", "fruits", "pomegranate", 120, "g", 500, 4.2, 800,
           kw={"pomegranate", "fruit", "antioxidant"}, syn={"anaar"}, dietary={"veg", "vegan", "jain"}, occ={"diet", "healthy"}, reviews=["Ruby red seeds."]),
        _p("SKU-FRT-007", "fresh watermelon 1 piece", "Local Farm", "fruits", "watermelon", 45, "piece", 1, 4.0, 500,
           kw={"watermelon", "summer", "fruit"}, syn={"tarbooz"}, dietary={"veg", "vegan", "jain"}, occ={"summer", "party"}, reviews=["Refreshing in summer."]),
        _p("SKU-FRT-008", "fresh grapes green 500g", "Local Farm", "fruits", "grapes", 80, "g", 500, 4.1, 700,
           kw={"grapes", "fruit", "green"}, syn={"angoor"}, dietary={"veg", "vegan", "jain"}, occ={"everyday"}, reviews=["Sweet and seedless."]),
        _p("SKU-FRT-009", "fresh guava 500g", "Local Farm", "fruits", "guava", 50, "g", 500, 4.0, 600,
           kw={"guava", "fruit", "vitamin c"}, syn={"amrud", "peru"}, dietary={"veg", "vegan", "jain"}, occ={"winter", "everyday"}, reviews=["Crunchy and sweet."]),
        _p("SKU-FRT-010", "fresh pineapple 1 piece", "Local Farm", "fruits", "pineapple", 60, "piece", 1, 4.0, 500,
           kw={"pineapple", "fruit", "tropical"}, syn={"ananas"}, dietary={"veg", "vegan", "jain"}, occ={"summer"}, reviews=["Tangy and sweet."]),
    ]


def _breakfast() -> list[dict]:
    """Breakfast cereals and items."""
    return [
        _p("SKU-BKF-001", "kelloggs corn flakes original", "Kelloggs", "breakfast", "cereal", 175, "g", 475, 4.3, 3500,
           kw={"corn flakes", "cereal", "breakfast"}, syn={"cereal", "corn flakes"}, dietary={"veg"}, occ={"breakfast", "everyday"}, reviews=["Classic breakfast."]),
        _p("SKU-BKF-002", "kelloggs chocos", "Kelloggs", "breakfast", "cereal", 185, "g", 375, 4.4, 4200,
           kw={"chocos", "chocolate cereal", "kids"}, syn={"chocos"}, dietary={"veg"}, occ={"breakfast", "kids"}, reviews=["Kids love it!"]),
        _p("SKU-BKF-003", "kelloggs muesli fruit nut", "Kelloggs", "breakfast", "muesli", 250, "g", 500, 4.2, 2000,
           kw={"muesli", "healthy", "fiber"}, syn={"muesli"}, dietary={"veg"}, occ={"breakfast", "diet"}, reviews=["Healthy and filling."]),
        _p("SKU-BKF-004", "bagrry oats muesli", "Bagrrys", "breakfast", "muesli", 195, "g", 500, 4.3, 1800,
           kw={"muesli", "oats", "healthy"}, syn={"muesli"}, dietary={"veg"}, occ={"breakfast", "diet"}, reviews=["Good Indian muesli."]),
        _p("SKU-BKF-005", "saffola masala oats peppy tomato", "Saffola", "breakfast", "oats", 49, "g", 40, 4.1, 1500,
           kw={"masala oats", "instant", "tomato"}, syn={"masala daliya"}, dietary={"veg"}, occ={"breakfast", "snack"}, reviews=["Tangy tomato flavor."]),
        _p("SKU-BKF-006", "soulfull millet muesli", "Soulfull", "breakfast", "muesli", 280, "g", 700, 4.2, 1200,
           kw={"muesli", "millet", "ragi"}, syn={"millet muesli"}, dietary={"veg"}, occ={"breakfast", "diet"}, reviews=["Ragi-based, nutritious."]),
        _p("SKU-BKF-007", "mtr instant upma mix", "MTR", "breakfast", "mix", 65, "g", 200, 4.1, 1800,
           kw={"upma", "instant", "south indian"}, syn={"upma mix"}, dietary={"veg"}, occ={"breakfast"}, reviews=["Easy upma."]),
        _p("SKU-BKF-008", "mtr instant idli mix", "MTR", "breakfast", "mix", 55, "g", 200, 4.2, 2000,
           kw={"idli", "instant", "south indian"}, syn={"idli mix"}, dietary={"veg", "vegan"}, occ={"breakfast"}, reviews=["Soft idlis every time."]),
        _p("SKU-BKF-009", "sundrop peanut butter crunchy", "Sundrop", "breakfast", "spread", 235, "g", 462, 4.3, 1500,
           kw={"peanut butter", "protein", "spread"}, syn={"peanut butter"}, dietary={"veg", "vegan"}, occ={"breakfast", "gym"}, reviews=["Great protein source."]),
        _p("SKU-BKF-010", "kissan mixed fruit jam", "Kissan", "breakfast", "jam", 105, "g", 500, 4.2, 3800,
           kw={"jam", "fruit jam", "spread"}, syn={"jam"}, dietary={"veg"}, occ={"breakfast", "kids"}, reviews=["Fruity and sweet."]),
        _p("SKU-BKF-011", "nutella hazelnut spread", "Nutella", "breakfast", "spread", 350, "g", 350, 4.5, 2500,
           kw={"nutella", "chocolate", "hazelnut", "spread"}, syn={"nutella", "chocolate spread"}, dietary={"veg"}, occ={"breakfast", "dessert"}, reviews=["Premium chocolate spread."]),
        _p("SKU-BKF-012", "hersheys chocolate syrup", "Hersheys", "breakfast", "syrup", 195, "g", 200, 4.2, 1800,
           kw={"chocolate syrup", "topping", "dessert"}, syn={"chocolate syrup"}, dietary={"veg"}, occ={"breakfast", "dessert"}, reviews=["Rich chocolate taste."]),
    ]


def _baby() -> list[dict]:
    """Baby care products."""
    return [
        _p("SKU-BBY-001", "pampers active baby diapers small", "Pampers", "baby", "diapers", 399, "piece", 22, 4.4, 5000,
           kw={"diapers", "baby", "pampers"}, syn={"diapers", "baby napkin"}, dietary=set(), occ={"baby"}, reviews=["Soft and absorbent."]),
        _p("SKU-BBY-002", "johnson baby soap", "Johnson", "baby", "soap", 65, "g", 100, 4.5, 4500,
           kw={"baby soap", "gentle", "mild"}, syn={"baby sabun"}, dietary=set(), occ={"baby", "everyday"}, reviews=["Gentle on baby skin."]),
        _p("SKU-BBY-003", "cerelac wheat apple stage 1", "Cerelac", "baby", "food", 285, "g", 300, 4.3, 3200,
           kw={"baby food", "cerelac", "wheat"}, syn={"cerelac"}, dietary={"veg"}, occ={"baby"}, reviews=["Baby loves it."]),
        _p("SKU-BBY-004", "johnson baby powder", "Johnson", "baby", "powder", 95, "g", 200, 4.4, 4000,
           kw={"baby powder", "talc", "gentle"}, syn={"baby powder"}, dietary=set(), occ={"baby"}, reviews=["Keeps baby dry."]),
        _p("SKU-BBY-005", "himalaya baby lotion", "Himalaya", "baby", "lotion", 145, "ml", 200, 4.3, 2800,
           kw={"baby lotion", "moisturizer", "gentle"}, syn={"baby cream"}, dietary=set(), occ={"baby"}, reviews=["Natural ingredients."]),
        _p("SKU-BBY-006", "mamy poko pants medium", "Mamy Poko", "baby", "diapers", 449, "piece", 20, 4.3, 4200,
           kw={"diaper pants", "baby", "pull-up"}, syn={"diaper pants"}, dietary=set(), occ={"baby"}, reviews=["Easy to use pants style."]),
        _p("SKU-BBY-007", "himalaya baby wipes 72s", "Himalaya", "baby", "wipes", 175, "piece", 72, 4.2, 2500,
           kw={"baby wipes", "wet wipes", "gentle"}, syn={"baby wipes"}, dietary=set(), occ={"baby"}, reviews=["Soft and thick."]),
        _p("SKU-BBY-008", "sipahh milk flavoring straw choco", "Sipahh", "baby", "drinks", 120, "piece", 10, 4.0, 800,
           kw={"milk straw", "flavored", "kids"}, syn={"doodh straw"}, dietary={"veg"}, occ={"kids"}, reviews=["Fun way for kids to drink milk."]),
    ]


def _pet() -> list[dict]:
    """Pet care products."""
    return [
        _p("SKU-PET-001", "pedigree adult dog food chicken", "Pedigree", "pet", "dog_food", 450, "g", 3000, 4.3, 3500,
           kw={"dog food", "pet food", "chicken"}, syn={"kutte ka khana"}, dietary=set(), occ={"everyday"}, reviews=["Dogs love the taste."]),
        _p("SKU-PET-002", "whiskas cat food tuna", "Whiskas", "pet", "cat_food", 85, "g", 85, 4.2, 2800,
           kw={"cat food", "pet food", "tuna"}, syn={"billi ka khana"}, dietary=set(), occ={"everyday"}, reviews=["Cats go crazy for it."]),
        _p("SKU-PET-003", "drools chicken and egg adult dog food", "Drools", "pet", "dog_food", 380, "g", 3000, 4.4, 4000,
           kw={"dog food", "chicken", "egg"}, syn={"dog food"}, dietary=set(), occ={"everyday"}, reviews=["Affordable and nutritious."]),
        _p("SKU-PET-004", "himalaya erina coat cleanser", "Himalaya", "pet", "shampoo", 195, "ml", 200, 4.1, 1500,
           kw={"pet shampoo", "dog shampoo"}, syn={"pet shampoo"}, dietary=set(), occ={"grooming"}, reviews=["Makes coat shiny."]),
        _p("SKU-PET-005", "pedigree dentastix dog treats", "Pedigree", "pet", "treats", 110, "piece", 7, 4.2, 2000,
           kw={"dog treats", "dental", "chew"}, syn={"dog biscuit"}, dietary=set(), occ={"grooming"}, reviews=["Dogs chew happily."]),
        _p("SKU-PET-006", "me-o cat food ocean fish", "Me-O", "pet", "cat_food", 75, "g", 400, 4.0, 1800,
           kw={"cat food", "fish", "pouch"}, syn={"billi ka khana"}, dietary=set(), occ={"everyday"}, reviews=["Good cat food at budget price."]),
    ]


def _fashion_men() -> list[dict]:
    """Men's fashion basics."""
    return [
        _p("SKU-FMN-001", "jockey men round neck t-shirt white", "Jockey", "fashion_men", "tshirt", 599, "piece", 1, 4.4, 2500,
           kw={"tshirt", "white", "men", "cotton"}, syn={"t-shirt", "men tshirt"}, dietary=set(), occ={"everyday", "casual"}, reviews=["Comfortable cotton."]),
        _p("SKU-FMN-002", "levi's 511 slim fit jeans blue", "Levis", "fashion_men", "jeans", 2499, "piece", 1, 4.5, 1800,
           kw={"jeans", "denim", "slim fit", "men"}, syn={"jeans"}, dietary=set(), occ={"casual", "outing"}, reviews=["Classic slim fit."]),
        _p("SKU-FMN-003", "van heusen formal shirt white", "Van Heusen", "fashion_men", "shirt", 1599, "piece", 1, 4.3, 1200,
           kw={"formal shirt", "office", "men"}, syn={"shirt"}, dietary=set(), occ={"office", "formal"}, reviews=["Crisp formal look."]),
        _p("SKU-FMN-004", "us polo sport shorts", "US Polo", "fashion_men", "shorts", 899, "piece", 1, 4.2, 1500,
           kw={"shorts", "sports", "gym"}, syn={"shorts"}, dietary=set(), occ={"sports", "casual"}, reviews=["Comfortable for workouts."]),
        _p("SKU-FMN-005", "dollar bigboss brief pack of 3", "Dollar", "fashion_men", "innerwear", 349, "piece", 3, 4.1, 3500,
           kw={"innerwear", "brief", "men"}, syn={"underwear"}, dietary=set(), occ={"everyday"}, reviews=["Good quality basics."]),
        _p("SKU-FMN-006", "red tape casual sneakers white", "Red Tape", "fashion_men", "shoes", 1499, "piece", 1, 4.2, 2000,
           kw={"sneakers", "casual shoes", "white"}, syn={"joote", "shoes"}, dietary=set(), occ={"casual"}, reviews=["Stylish and comfortable."]),
        _p("SKU-FMN-007", "peter england polo tshirt navy", "Peter England", "fashion_men", "tshirt", 799, "piece", 1, 4.3, 1600,
           kw={"polo", "tshirt", "collar"}, syn={"polo tshirt"}, dietary=set(), occ={"casual", "office"}, reviews=["Smart casual look."]),
        _p("SKU-FMN-008", "fastrack analog watch men", "Fastrack", "fashion_men", "watch", 1295, "piece", 1, 4.3, 2800,
           kw={"watch", "analog", "men"}, syn={"ghari", "watch"}, dietary=set(), occ={"everyday", "gift"}, reviews=["Stylish daily wear."]),
    ]


def _fashion_women() -> list[dict]:
    """Women's fashion basics."""
    return [
        _p("SKU-FWM-001", "w brand kurti cotton printed", "W", "fashion_women", "kurti", 899, "piece", 1, 4.3, 2200,
           kw={"kurti", "cotton", "women", "printed"}, syn={"kurti"}, dietary=set(), occ={"everyday", "casual"}, reviews=["Pretty prints."]),
        _p("SKU-FWM-002", "aurelia straight kurti", "Aurelia", "fashion_women", "kurti", 699, "piece", 1, 4.2, 1800,
           kw={"kurti", "straight", "cotton"}, syn={"kurti"}, dietary=set(), occ={"office", "casual"}, reviews=["Elegant daily wear."]),
        _p("SKU-FWM-003", "global desi palazzo pants", "Global Desi", "fashion_women", "pants", 999, "piece", 1, 4.1, 1200,
           kw={"palazzo", "pants", "women"}, syn={"palazzo"}, dietary=set(), occ={"casual"}, reviews=["Flowy and comfortable."]),
        _p("SKU-FWM-004", "clovia cotton bra pack of 2", "Clovia", "fashion_women", "innerwear", 699, "piece", 2, 4.3, 3000,
           kw={"bra", "cotton", "innerwear"}, syn={"innerwear"}, dietary=set(), occ={"everyday"}, reviews=["Comfortable fit."]),
        _p("SKU-FWM-005", "biba anarkali kurta set", "Biba", "fashion_women", "kurta_set", 1599, "piece", 1, 4.4, 1500,
           kw={"anarkali", "kurta set", "ethnic"}, syn={"salwar kurta"}, dietary=set(), occ={"festive", "wedding"}, reviews=["Beautiful ethnic wear."]),
        _p("SKU-FWM-006", "zara basic tshirt women white", "Zara", "fashion_women", "tshirt", 990, "piece", 1, 4.2, 1200,
           kw={"tshirt", "women", "basic"}, syn={"tshirt"}, dietary=set(), occ={"casual"}, reviews=["Premium basic tee."]),
        _p("SKU-FWM-007", "fastrack analog watch women", "Fastrack", "fashion_women", "watch", 1195, "piece", 1, 4.3, 2500,
           kw={"watch", "women", "analog"}, syn={"ghari"}, dietary=set(), occ={"everyday", "gift"}, reviews=["Trendy design."]),
    ]


def _fashion_kids() -> list[dict]:
    """Kids' fashion."""
    return [
        _p("SKU-FKD-001", "max kids cotton tshirt printed", "Max", "fashion_kids", "tshirt", 299, "piece", 1, 4.2, 2000,
           kw={"kids tshirt", "cotton", "printed"}, syn={"bacchon ki tshirt"}, dietary=set(), occ={"everyday"}, reviews=["Fun prints kids love."]),
        _p("SKU-FKD-002", "hm kids jeans denim", "H&M", "fashion_kids", "jeans", 599, "piece", 1, 4.1, 1200,
           kw={"kids jeans", "denim"}, syn={"bacchon ki jeans"}, dietary=set(), occ={"everyday"}, reviews=["Durable for active kids."]),
        _p("SKU-FKD-003", "mothercare baby romper", "Mothercare", "fashion_kids", "romper", 499, "piece", 1, 4.3, 1500,
           kw={"romper", "baby", "onesie"}, syn={"baby romper"}, dietary=set(), occ={"baby"}, reviews=["Soft cotton romper."]),
        _p("SKU-FKD-004", "disney frozen girls dress", "Disney", "fashion_kids", "dress", 699, "piece", 1, 4.4, 1800,
           kw={"dress", "frozen", "girls", "princess"}, syn={"frock"}, dietary=set(), occ={"birthday", "party"}, reviews=["Every girl's dream dress."]),
        _p("SKU-FKD-005", "sparx kids school shoes black", "Sparx", "fashion_kids", "shoes", 499, "piece", 1, 4.2, 2500,
           kw={"school shoes", "black", "kids"}, syn={"school joote"}, dietary=set(), occ={"school"}, reviews=["Durable school shoes."]),
        _p("SKU-FKD-006", "ben 10 boys raincoat", "Ben 10", "fashion_kids", "raincoat", 399, "piece", 1, 4.0, 800,
           kw={"raincoat", "kids", "monsoon"}, syn={"barsaati"}, dietary=set(), occ={"monsoon"}, reviews=["Fun design, waterproof."]),
    ]


def _footwear() -> list[dict]:
    """Footwear for all."""
    return [
        _p("SKU-FTW-001", "bata power running shoes men", "Bata", "footwear", "sports", 1299, "piece", 1, 4.2, 2500,
           kw={"running shoes", "sports", "men"}, syn={"joote", "running shoes"}, dietary=set(), occ={"sports", "gym"}, reviews=["Good cushioning."]),
        _p("SKU-FTW-002", "sparx men chappals blue", "Sparx", "footwear", "chappals", 299, "piece", 1, 4.1, 3500,
           kw={"chappals", "slippers", "men"}, syn={"chappal", "hawai chappal"}, dietary=set(), occ={"everyday"}, reviews=["Comfortable daily wear."]),
        _p("SKU-FTW-003", "crocs classic clog", "Crocs", "footwear", "clogs", 2995, "piece", 1, 4.4, 1800,
           kw={"crocs", "clogs", "comfortable"}, syn={"crocs"}, dietary=set(), occ={"casual"}, reviews=["Ultra comfortable."]),
        _p("SKU-FTW-004", "nike revolution 6 running", "Nike", "footwear", "sports", 3495, "piece", 1, 4.5, 1500,
           kw={"nike", "running", "sports shoes"}, syn={"nike shoes"}, dietary=set(), occ={"sports", "gym"}, reviews=["Premium running shoes."]),
        _p("SKU-FTW-005", "bata women sandals beige", "Bata", "footwear", "sandals", 599, "piece", 1, 4.1, 2000,
           kw={"sandals", "women", "casual"}, syn={"sandal"}, dietary=set(), occ={"casual"}, reviews=["Elegant casual sandals."]),
        _p("SKU-FTW-006", "relaxo flite slippers men", "Relaxo", "footwear", "slippers", 199, "piece", 1, 4.0, 4000,
           kw={"slippers", "flip flops", "men"}, syn={"chappal"}, dietary=set(), occ={"everyday"}, reviews=["Budget daily slippers."]),
    ]


def _accessories() -> list[dict]:
    """Bags, wallets, sunglasses etc."""
    return [
        _p("SKU-ACC-001", "wildcraft backpack 35L", "Wildcraft", "accessories", "backpack", 1299, "piece", 1, 4.3, 3000,
           kw={"backpack", "bag", "laptop bag"}, syn={"bag", "school bag"}, dietary=set(), occ={"school", "travel"}, reviews=["Spacious and durable."]),
        _p("SKU-ACC-002", "woodland men wallet brown", "Woodland", "accessories", "wallet", 799, "piece", 1, 4.2, 2200,
           kw={"wallet", "leather", "men"}, syn={"batua", "purse"}, dietary=set(), occ={"everyday", "gift"}, reviews=["Good leather quality."]),
        _p("SKU-ACC-003", "skybags casual backpack", "Skybags", "accessories", "backpack", 899, "piece", 1, 4.1, 2800,
           kw={"backpack", "casual", "college"}, syn={"bag"}, dietary=set(), occ={"college", "everyday"}, reviews=["Trendy college bag."]),
        _p("SKU-ACC-004", "ray ban aviator sunglasses", "Ray-Ban", "accessories", "sunglasses", 5990, "piece", 1, 4.6, 1200,
           kw={"sunglasses", "aviator", "uv protection"}, syn={"chasma", "goggles"}, dietary=set(), occ={"summer", "travel"}, reviews=["Classic aviator style."]),
        _p("SKU-ACC-005", "titan men belt leather black", "Titan", "accessories", "belt", 699, "piece", 1, 4.2, 1800,
           kw={"belt", "leather", "formal"}, syn={"peti", "belt"}, dietary=set(), occ={"formal", "office"}, reviews=["Good quality leather belt."]),
        _p("SKU-ACC-006", "american tourister trolley bag 55cm", "American Tourister", "accessories", "luggage", 3499, "piece", 1, 4.3, 1500,
           kw={"trolley", "luggage", "travel"}, syn={"suitcase", "trolley bag"}, dietary=set(), occ={"travel"}, reviews=["Lightweight and sturdy."]),
        _p("SKU-ACC-007", "cello water bottle 1L", "Cello", "accessories", "bottle", 199, "piece", 1, 4.1, 3500,
           kw={"water bottle", "bottle"}, syn={"paani ki bottle"}, dietary=set(), occ={"school", "gym", "everyday"}, reviews=["Leak-proof."]),
        _p("SKU-ACC-008", "milton tiffin box 3 container", "Milton", "accessories", "tiffin", 449, "piece", 1, 4.2, 2500,
           kw={"tiffin", "lunch box", "container"}, syn={"dabba", "tiffin box"}, dietary=set(), occ={"school", "office"}, reviews=["Keeps food warm."]),
    ]


def _medicines_otc() -> list[dict]:
    """OTC medicines, health supplements, and wellness products."""
    return [
        # --- Painkillers & Fever ---
        _p("SKU-MED-001", "crocin advance 500mg 15 tablets", "Crocin", "medicines_otc", "painkiller", 30, "piece", 15, 4.4, 5000,
           kw={"crocin", "paracetamol", "fever", "headache"}, syn={"crocin", "bukhar ki goli"}, dietary=set(), occ={"health"}, reviews=["Fast fever relief."]),
        _p("SKU-MED-002", "vicks vaporub 50ml", "Vicks", "medicines_otc", "cold_relief", 95, "ml", 50, 4.5, 6000,
           kw={"vicks", "cold", "cough", "balm"}, syn={"vicks", "balm"}, dietary=set(), occ={"winter", "health"}, reviews=["Trusted cold relief."]),
        _p("SKU-MED-003", "eno fruit salt lemon", "Eno", "medicines_otc", "antacid", 10, "g", 5, 4.2, 8000,
           kw={"eno", "antacid", "acidity", "gas"}, syn={"eno", "gas ki goli"}, dietary=set(), occ={"health"}, reviews=["Quick acidity relief."]),
        _p("SKU-MED-004", "band-aid flexible fabric 25s", "Band-Aid", "medicines_otc", "first_aid", 95, "piece", 25, 4.3, 3500,
           kw={"band-aid", "bandage", "first aid"}, syn={"patti", "band-aid"}, dietary=set(), occ={"health", "first_aid"}, reviews=["Flexible and sticks well."]),
        _p("SKU-MED-005", "dettol antiseptic liquid 125ml", "Dettol", "medicines_otc", "antiseptic", 55, "ml", 125, 4.4, 4500,
           kw={"antiseptic", "dettol", "disinfectant"}, syn={"dettol liquid"}, dietary=set(), occ={"health", "first_aid"}, reviews=["Essential first aid."]),
        _p("SKU-MED-006", "revital h multivitamin men 30 caps", "Revital", "medicines_otc", "supplement", 395, "piece", 30, 4.1, 2500,
           kw={"multivitamin", "supplement", "health"}, syn={"vitamin"}, dietary=set(), occ={"health", "daily"}, reviews=["Good daily supplement."]),
        _p("SKU-MED-007", "zandu balm ultra power 8ml", "Zandu", "medicines_otc", "balm", 25, "ml", 8, 4.2, 4000,
           kw={"balm", "headache", "pain relief"}, syn={"balm", "sir dard ki malham"}, dietary=set(), occ={"health"}, reviews=["Quick headache relief."]),
        _p("SKU-MED-008", "strepsils orange 8 lozenges", "Strepsils", "medicines_otc", "lozenge", 55, "piece", 8, 4.1, 3000,
           kw={"lozenges", "sore throat", "cough"}, syn={"goli", "throat goli"}, dietary=set(), occ={"health", "winter"}, reviews=["Soothes sore throat."]),

        # --- Cough & Cold ---
        _p("SKU-MED-015", "benadryl cough syrup 100ml", "Benadryl", "medicines_otc", "cough_syrup", 85, "ml", 100, 4.3, 4500,
           kw={"cough syrup", "cold", "cough"}, syn={"khansi ki dawa", "cough syrup"}, dietary=set(), occ={"health", "winter"}, reviews=["Effective cough relief."]),
        _p("SKU-MED-016", "vicks action 500 advanced 10 tabs", "Vicks", "medicines_otc", "cold_relief", 40, "piece", 10, 4.2, 3800,
           kw={"cold", "flu", "headache", "body pain"}, syn={"sardi ki goli"}, dietary=set(), occ={"health", "winter"}, reviews=["Multi-symptom cold relief."]),
        _p("SKU-MED-017", "d-cold total 10 tablets", "D-Cold", "medicines_otc", "cold_relief", 35, "piece", 10, 4.1, 3200,
           kw={"cold", "runny nose", "sneezing"}, syn={"sardi ki goli"}, dietary=set(), occ={"health"}, reviews=["Good for runny nose."]),
        _p("SKU-MED-018", "honitus cough syrup 100ml", "Dabur", "medicines_otc", "cough_syrup", 75, "ml", 100, 4.2, 2800,
           kw={"cough", "ayurvedic", "honey"}, syn={"khansi ki dawa"}, dietary=set(), occ={"health"}, reviews=["Ayurvedic cough relief."]),

        # --- Digestive & Stomach ---
        _p("SKU-MED-019", "digene gel mint 170ml", "Digene", "medicines_otc", "antacid", 99, "ml", 170, 4.3, 3500,
           kw={"antacid", "acidity", "gas", "indigestion"}, syn={"acidity ki dawa"}, dietary=set(), occ={"health"}, reviews=["Tasty mint antacid."]),
        _p("SKU-MED-020", "gelusil mps liquid 170ml", "Gelusil", "medicines_otc", "antacid", 85, "ml", 170, 4.1, 2800,
           kw={"antacid", "stomach", "acidity"}, syn={"pet ki dawa"}, dietary=set(), occ={"health"}, reviews=["Fast acidity relief."]),
        _p("SKU-MED-021", "isabgol husk fiber 100g", "Sat Isabgol", "medicines_otc", "laxative", 65, "g", 100, 4.2, 3200,
           kw={"isabgol", "fiber", "constipation", "digestion"}, syn={"isabgol", "bhusi"}, dietary={"veg", "vegan"}, occ={"health"}, reviews=["Natural fiber supplement."]),
        _p("SKU-MED-022", "ors electral powder 21.8g 4-pack", "Electral", "medicines_otc", "ors", 40, "piece", 4, 4.4, 5000,
           kw={"ors", "electrolyte", "dehydration", "diarrhea"}, syn={"ors", "electral"}, dietary=set(), occ={"health", "summer"}, reviews=["Essential for dehydration."]),

        # --- Vitamins & Supplements ---
        _p("SKU-MED-023", "shelcal 500mg calcium 15 tabs", "Shelcal", "medicines_otc", "calcium", 85, "piece", 15, 4.3, 3000,
           kw={"calcium", "vitamin d", "bones"}, syn={"calcium ki goli"}, dietary=set(), occ={"health"}, reviews=["Good for bone health."]),
        _p("SKU-MED-024", "becosules capsules 20s", "Becosules", "medicines_otc", "vitamin_b", 35, "piece", 20, 4.3, 4200,
           kw={"vitamin b", "b complex", "energy"}, syn={"vitamin goli"}, dietary=set(), occ={"health"}, reviews=["Complete B-complex."]),
        _p("SKU-MED-025", "limcee vitamin c 500mg chewable 15s", "Limcee", "medicines_otc", "vitamin_c", 25, "piece", 15, 4.2, 3800,
           kw={"vitamin c", "immunity", "chewable"}, syn={"vitamin c goli"}, dietary=set(), occ={"health", "winter"}, reviews=["Tasty orange chewable."]),
        _p("SKU-MED-026", "supradyn daily multivitamin 15 tabs", "Supradyn", "medicines_otc", "multivitamin", 75, "piece", 15, 4.2, 2500,
           kw={"multivitamin", "energy", "daily"}, syn={"vitamin"}, dietary=set(), occ={"health"}, reviews=["Good energy boost."]),

        # --- Ayurvedic & Wellness ---
        _p("SKU-MED-027", "dabur chyawanprash 500g", "Dabur", "medicines_otc", "immunity", 225, "g", 500, 4.3, 4000,
           kw={"chyawanprash", "immunity", "ayurvedic", "winter"}, syn={"chyawanprash"}, dietary={"veg"}, occ={"winter", "health"}, reviews=["Trusted immunity booster."]),
        _p("SKU-MED-028", "dabur honey 500g", "Dabur", "medicines_otc", "honey", 225, "g", 500, 4.4, 5500,
           kw={"honey", "natural", "cough", "immunity"}, syn={"shahad", "madhu"}, dietary={"veg"}, occ={"health", "everyday"}, reviews=["Pure natural honey."]),
        _p("SKU-MED-029", "patanjali ashwagandha capsules 20s", "Patanjali", "medicines_otc", "ayurvedic", 95, "piece", 20, 4.1, 2000,
           kw={"ashwagandha", "stress", "strength", "ayurvedic"}, syn={"ashwagandha"}, dietary={"veg"}, occ={"health"}, reviews=["Good for stress relief."]),
        _p("SKU-MED-030", "himalaya liv.52 tablets 100s", "Himalaya", "medicines_otc", "liver", 115, "piece", 100, 4.3, 3500,
           kw={"liver", "detox", "ayurvedic", "herbal"}, syn={"liver ki dawa"}, dietary=set(), occ={"health"}, reviews=["Trusted liver tonic."]),

        # --- Skin & Eye Care ---
        _p("SKU-MED-031", "boroline antiseptic cream 20g", "Boroline", "medicines_otc", "skin_cream", 32, "g", 20, 4.2, 4500,
           kw={"boroline", "cream", "antiseptic", "chapped lips"}, syn={"boroline", "cream"}, dietary=set(), occ={"health", "winter"}, reviews=["Classic Indian antiseptic cream."]),
        _p("SKU-MED-032", "lacto calamine lotion 120ml", "Lacto Calamine", "medicines_otc", "skin_lotion", 175, "ml", 120, 4.3, 3200,
           kw={"calamine", "oily skin", "pimple"}, syn={"calamine lotion"}, dietary=set(), occ={"health", "everyday"}, reviews=["Matte finish for oily skin."]),
        _p("SKU-MED-033", "itone eye drops 10ml", "Itone", "medicines_otc", "eye_drops", 45, "ml", 10, 4.1, 2500,
           kw={"eye drops", "eye care", "ayurvedic"}, syn={"aankh ki dawa"}, dietary=set(), occ={"health"}, reviews=["Soothing ayurvedic eye drops."]),

        # --- Pain Relief ---
        _p("SKU-MED-034", "moov spray 80g", "Moov", "medicines_otc", "pain_spray", 175, "g", 80, 4.2, 3800,
           kw={"pain spray", "back pain", "muscle"}, syn={"dard ki spray", "moov"}, dietary=set(), occ={"health"}, reviews=["Quick back pain relief."]),
        _p("SKU-MED-035", "volini gel 30g", "Volini", "medicines_otc", "pain_gel", 135, "g", 30, 4.2, 3000,
           kw={"pain gel", "joint pain", "muscle pain"}, syn={"dard ki cream"}, dietary=set(), occ={"health"}, reviews=["Deep penetrating relief."]),
        _p("SKU-MED-036", "iodex multi-purpose pain balm 40g", "Iodex", "medicines_otc", "pain_balm", 80, "g", 40, 4.1, 3500,
           kw={"iodex", "pain balm", "muscle pain"}, syn={"iodex", "dard ki malham"}, dietary=set(), occ={"health"}, reviews=["Strong muscle pain relief."]),

        # --- Women's Health ---
        _p("SKU-MED-037", "whisper ultra clean sanitary pads xl 30s", "Whisper", "medicines_otc", "sanitary_pads", 295, "piece", 30, 4.4, 5500,
           kw={"sanitary pads", "periods", "women"}, syn={"pad", "sanitary napkin"}, dietary=set(), occ={"everyday"}, reviews=["Ultra thin and absorbent."]),
        _p("SKU-MED-038", "stayfree secure cottony pads xl 20s", "Stayfree", "medicines_otc", "sanitary_pads", 145, "piece", 20, 4.2, 4200,
           kw={"sanitary pads", "cotton", "women"}, syn={"pad"}, dietary=set(), occ={"everyday"}, reviews=["Cottony soft feel."]),
        _p("SKU-MED-039", "sofy antibacteria pads xl 28s", "Sofy", "medicines_otc", "sanitary_pads", 225, "piece", 28, 4.3, 3800,
           kw={"sanitary pads", "antibacteria", "women"}, syn={"pad"}, dietary=set(), occ={"everyday"}, reviews=["Antibacterial protection."]),

        # --- Masks & Sanitizer ---
        _p("SKU-MED-040", "lifebuoy hand sanitizer 500ml", "Lifebuoy", "medicines_otc", "sanitizer", 175, "ml", 500, 4.2, 4000,
           kw={"sanitizer", "hand wash", "germ protection"}, syn={"sanitizer"}, dietary=set(), occ={"health", "everyday"}, reviews=["Effective germ kill."]),
        _p("SKU-MED-041", "n95 surgical face mask 10-pack", "3M", "medicines_otc", "mask", 199, "piece", 10, 4.1, 2500,
           kw={"mask", "n95", "pollution", "surgical"}, syn={"mask"}, dietary=set(), occ={"health", "travel"}, reviews=["Good filtration."]),

        # --- Thermometer & Medical Devices ---
        _p("SKU-MED-042", "dr morepen digital thermometer", "Dr Morepen", "medicines_otc", "thermometer", 149, "piece", 1, 4.2, 3500,
           kw={"thermometer", "digital", "fever"}, syn={"thermometer", "bukhar naapne wala"}, dietary=set(), occ={"health"}, reviews=["Accurate and fast reading."]),
        _p("SKU-MED-043", "omron blood pressure monitor", "Omron", "medicines_otc", "bp_monitor", 1899, "piece", 1, 4.4, 2800,
           kw={"bp monitor", "blood pressure", "digital"}, syn={"bp machine"}, dietary=set(), occ={"health"}, reviews=["Accurate home monitoring."]),
        _p("SKU-MED-044", "accu-chek active glucometer kit", "Accu-Chek", "medicines_otc", "glucometer", 1299, "piece", 1, 4.3, 2200,
           kw={"glucometer", "diabetes", "blood sugar"}, syn={"sugar machine"}, dietary=set(), occ={"health"}, reviews=["Easy to use for diabetics."]),
    ]



def _p(
    sku: str, name: str, brand: str, category: str, subcategory: str,
    price: int, unit: str, unit_qty: int | float, rating: float, review_count: int,
    kw: set | None = None, syn: set | None = None,
    dietary: set | None = None, allergen: set | None = None,
    occ: set | None = None, reviews: list | None = None,
    # Nutritional data (per 100g/100ml)
    calories: float | None = None, protein: float | None = None,
    carbs: float | None = None, sugar: float | None = None,
    fat: float | None = None, saturated_fat: float | None = None,
    fiber: float | None = None, sodium: float | None = None,
) -> dict:
    """Create a product dict with proper types."""
    return {
        "sku": sku,
        "name": name,
        "brand": brand,
        "category": category,
        "subcategory": subcategory,
        "price_inr": Decimal(str(price)),
        "mrp_inr": Decimal(str(int(price * 1.1))),  # MRP ~10% higher
        "discount_pct": Decimal("10"),
        "unit": unit,
        "unit_quantity": Decimal(str(unit_qty)),
        "rating": Decimal(str(rating)),
        "review_count": review_count,
        "review_preview": reviews or [],
        "in_stock": True,
        "keywords": kw or set(),
        "synonyms": syn or set(),
        "tags": set(),
        "dietary_tags": dietary or set(),
        "allergen_tags": allergen or set(),
        "occasion_tags": occ or set(),
        "image_url": "",
        "search_text": "",
        # Nutritional fields
        "calories_per_100": Decimal(str(calories)) if calories is not None else None,
        "protein_per_100": Decimal(str(protein)) if protein is not None else None,
        "carbs_per_100": Decimal(str(carbs)) if carbs is not None else None,
        "sugar_per_100": Decimal(str(sugar)) if sugar is not None else None,
        "fat_per_100": Decimal(str(fat)) if fat is not None else None,
        "saturated_fat_per_100": Decimal(str(saturated_fat)) if saturated_fat is not None else None,
        "fiber_per_100": Decimal(str(fiber)) if fiber is not None else None,
        "sodium_per_100": Decimal(str(sodium)) if sodium is not None else None,
    }


# ---------------------------------------------------------------------------
# Variant Generator — reaches 500+ products from base templates
# ---------------------------------------------------------------------------

# Brand/size variants per category to generate more SKUs deterministically
_VARIANT_DEFS: dict[str, list[dict]] = {
    "grains": [
        {"suffix": "011", "name": "kohinoor super silver basmati rice", "brand": "Kohinoor", "sub": "rice", "price": 220, "u": "g", "uq": 1000, "rt": 4.4, "rc": 1500, "kw": {"rice", "basmati", "premium"}, "syn": {"chawal"}, "rv": ["Premium quality grain."]},
        {"suffix": "012", "name": "patanjali whole wheat atta", "brand": "Patanjali", "sub": "flour", "price": 215, "u": "g", "uq": 5000, "rt": 4.1, "rc": 2800, "kw": {"atta", "wheat flour"}, "syn": {"atta", "patanjali atta"}, "rv": ["Good organic atta."]},
        {"suffix": "013", "name": "pilsbury chakki atta", "brand": "Pilsbury", "sub": "flour", "price": 235, "u": "g", "uq": 5000, "rt": 4.2, "rc": 1900, "kw": {"atta", "flour", "roti"}, "syn": {"atta"}, "rv": ["Soft rotis."]},
        {"suffix": "014", "name": "24 mantra organic toor dal", "brand": "24 Mantra", "sub": "dal", "price": 245, "u": "g", "uq": 1000, "rt": 4.3, "rc": 900, "kw": {"toor dal", "organic", "dal"}, "syn": {"daal", "arhar"}, "rv": ["Organic and clean."]},
        {"suffix": "015", "name": "india gate super basmati rice", "brand": "India Gate", "sub": "rice", "price": 325, "u": "g", "uq": 1000, "rt": 4.7, "rc": 3200, "kw": {"rice", "basmati", "premium", "biryani"}, "syn": {"chawal", "biryani rice"}, "rv": ["Longest grain, premium quality."]},
        {"suffix": "016", "name": "saffola masala oats classic masala", "brand": "Saffola", "sub": "oats", "price": 99, "u": "g", "uq": 500, "rt": 4.2, "rc": 1100, "kw": {"oats", "masala", "healthy"}, "syn": {"daliya"}, "rv": ["Healthy masala option."]},
        {"suffix": "017", "name": "kelloggs oats plain", "brand": "Kelloggs", "sub": "oats", "price": 179, "u": "g", "uq": 900, "rt": 4.3, "rc": 1400, "kw": {"oats", "plain", "breakfast"}, "syn": {"daliya"}, "rv": ["Good for porridge."]},
        {"suffix": "018", "name": "tata sampann masoor dal", "brand": "Tata Sampann", "sub": "dal", "price": 159, "u": "g", "uq": 1000, "rt": 4.3, "rc": 2100, "kw": {"masoor dal", "red lentil"}, "syn": {"masoor", "lal daal"}, "rv": ["Quick cooking."]},
        {"suffix": "019", "name": "chana dal premium", "brand": "Local", "sub": "dal", "price": 120, "u": "g", "uq": 1000, "rt": 4.0, "rc": 700, "kw": {"chana dal", "dal", "protein"}, "syn": {"chana daal"}, "rv": ["Clean and sorted."]},
        {"suffix": "020", "name": "bb royal sooji fine rava", "brand": "BB Royal", "sub": "rava", "price": 52, "u": "g", "uq": 500, "rt": 4.1, "rc": 600, "kw": {"sooji", "rava", "semolina", "upma"}, "syn": {"suji", "rawa"}, "rv": ["Fine grain rava."]},
    ],
    "dairy": [
        {"suffix": "009", "name": "mother dairy classic curd 1kg", "brand": "Mother Dairy", "sub": "curd", "price": 70, "u": "ml", "uq": 1000, "rt": 4.3, "rc": 2800, "kw": {"curd", "dahi", "big pack"}, "syn": {"dahi"}, "rv": ["Thick set curd."]},
        {"suffix": "010", "name": "verka full cream milk", "brand": "Verka", "sub": "milk", "price": 68, "u": "ml", "uq": 1000, "rt": 4.2, "rc": 1800, "kw": {"milk", "full cream"}, "syn": {"doodh"}, "rv": ["Rich and creamy."]},
        {"suffix": "011", "name": "nandini toned milk", "brand": "Nandini", "sub": "milk", "price": 50, "u": "ml", "uq": 1000, "rt": 4.1, "rc": 2200, "kw": {"milk", "toned"}, "syn": {"doodh"}, "rv": ["Affordable toned milk."]},
        {"suffix": "012", "name": "go cheese plain 200g", "brand": "Go", "sub": "cheese", "price": 99, "u": "g", "uq": 200, "rt": 4.0, "rc": 1500, "kw": {"cheese", "plain", "sandwich"}, "syn": {"cheese"}, "rv": ["Good value cheese."]},
        {"suffix": "013", "name": "nestle a+ probiotic curd", "brand": "Nestle", "sub": "curd", "price": 55, "u": "ml", "uq": 400, "rt": 4.3, "rc": 1900, "kw": {"curd", "probiotic", "gut health"}, "syn": {"dahi"}, "rv": ["Good for digestion."]},
        {"suffix": "014", "name": "amul masti buttermilk", "brand": "Amul", "sub": "buttermilk", "price": 25, "u": "ml", "uq": 200, "rt": 4.2, "rc": 2400, "kw": {"buttermilk", "chaas", "summer"}, "syn": {"chaas", "mattha"}, "rv": ["Refreshing in summer."]},
    ],
    "snacks": [
        {"suffix": "013", "name": "balaji wafers simply salted", "brand": "Balaji", "sub": "chips", "price": 20, "u": "g", "uq": 60, "rt": 4.3, "rc": 2500, "kw": {"chips", "wafers", "salted"}, "syn": {"chips", "balaji"}, "rv": ["Best local chips."]},
        {"suffix": "014", "name": "bikaji bhujia sev", "brand": "Bikaji", "sub": "namkeen", "price": 70, "u": "g", "uq": 200, "rt": 4.2, "rc": 1800, "kw": {"bhujia", "sev", "namkeen"}, "syn": {"sev", "namkeen"}, "rv": ["Authentic Bikaji taste."]},
        {"suffix": "015", "name": "act ii butter lover popcorn", "brand": "Act II", "sub": "popcorn", "price": 50, "u": "g", "uq": 70, "rt": 4.1, "rc": 2200, "kw": {"popcorn", "microwave", "movie"}, "syn": {"popcorn", "makka"}, "rv": ["Buttery and fluffy."]},
        {"suffix": "016", "name": "pringles sour cream & onion", "brand": "Pringles", "sub": "chips", "price": 149, "u": "g", "uq": 107, "rt": 4.3, "rc": 1600, "kw": {"chips", "pringles", "premium"}, "syn": {"pringles", "imported chips"}, "rv": ["Premium taste."]},
        {"suffix": "017", "name": "too yumm multigrain chips", "brand": "Too Yumm", "sub": "chips", "price": 30, "u": "g", "uq": 54, "rt": 4.0, "rc": 1200, "kw": {"chips", "healthy", "baked", "multigrain"}, "syn": {"healthy chips"}, "rv": ["Healthier chip option."]},
        {"suffix": "018", "name": "hide & seek chocolate cookies", "brand": "Parle", "sub": "biscuits", "price": 35, "u": "g", "uq": 120, "rt": 4.4, "rc": 3800, "kw": {"cookies", "chocolate", "biscuit"}, "syn": {"chocolate biscuit"}, "rv": ["Choco chips inside."]},
        {"suffix": "019", "name": "sunfeast dark fantasy choco fills", "brand": "Sunfeast", "sub": "biscuits", "price": 40, "u": "g", "uq": 75, "rt": 4.5, "rc": 4200, "kw": {"chocolate", "cream", "premium biscuit"}, "syn": {"dark fantasy"}, "rv": ["Premium chocolate filled."]},
        {"suffix": "020", "name": "haldiram mini samosa frozen", "brand": "Haldiram", "sub": "frozen_snack", "price": 140, "u": "g", "uq": 300, "rt": 4.2, "rc": 1100, "kw": {"samosa", "frozen", "party snack"}, "syn": {"samosa", "frozen samosa"}, "rv": ["Crispy when fried."]},
        {"suffix": "021", "name": "yippee noodles magic masala", "brand": "Yippee", "sub": "noodles", "price": 14, "u": "g", "uq": 70, "rt": 4.2, "rc": 3500, "kw": {"noodles", "instant", "masala"}, "syn": {"noodles", "instant noodles"}, "rv": ["No clumping, long strands."]},
        {"suffix": "022", "name": "top ramen curry noodles", "brand": "Top Ramen", "sub": "noodles", "price": 15, "u": "g", "uq": 70, "rt": 4.0, "rc": 1800, "kw": {"noodles", "curry", "instant"}, "syn": {"ramen"}, "rv": ["Curry flavor is unique."]},
        {"suffix": "023", "name": "oreo original cream biscuits", "brand": "Cadbury", "sub": "biscuits", "price": 30, "u": "g", "uq": 120, "rt": 4.3, "rc": 5000, "kw": {"oreo", "cream", "biscuit", "chocolate"}, "syn": {"oreo"}, "rv": ["Twist, lick, dunk."]},
    ],
    "beverages": [
        {"suffix": "013", "name": "limca lime & lemon 1.25L", "brand": "Limca", "sub": "soft_drink", "price": 65, "u": "ml", "uq": 1250, "rt": 4.1, "rc": 2800, "kw": {"limca", "lime", "lemon", "soft drink"}, "syn": {"nimbu soda"}, "rv": ["Refreshing citrus."]},
        {"suffix": "014", "name": "fanta orange 1.25L", "brand": "Fanta", "sub": "soft_drink", "price": 65, "u": "ml", "uq": 1250, "rt": 4.0, "rc": 2500, "kw": {"fanta", "orange", "soft drink"}, "syn": {"orange soda"}, "rv": ["Fun orange taste."]},
        {"suffix": "015", "name": "mountain dew 2L", "brand": "Mountain Dew", "sub": "soft_drink", "price": 95, "u": "ml", "uq": 2000, "rt": 4.1, "rc": 2200, "kw": {"mountain dew", "dew", "cola"}, "syn": {"mountain dew"}, "rv": ["Dar ke aage jeet hai."]},
        {"suffix": "016", "name": "maaza mango drink 1.2L", "brand": "Maaza", "sub": "juice", "price": 65, "u": "ml", "uq": 1200, "rt": 4.2, "rc": 3000, "kw": {"maaza", "mango", "drink"}, "syn": {"aam drink", "mango juice"}, "rv": ["Thick mango pulp."]},
        {"suffix": "017", "name": "tropicana orange juice 1L", "brand": "Tropicana", "sub": "juice", "price": 110, "u": "ml", "uq": 1000, "rt": 4.1, "rc": 2000, "kw": {"orange juice", "tropicana", "healthy"}, "syn": {"santre ka juice"}, "rv": ["100% juice, no sugar."]},
        {"suffix": "018", "name": "tang orange instant drink mix", "brand": "Tang", "sub": "drink_mix", "price": 120, "u": "g", "uq": 500, "rt": 4.0, "rc": 2500, "kw": {"tang", "orange", "instant", "drink mix"}, "syn": {"tang", "orange powder"}, "rv": ["Good for making juice."]},
        {"suffix": "019", "name": "appy fizz sparkling apple drink", "brand": "Appy Fizz", "sub": "sparkling", "price": 35, "u": "ml", "uq": 250, "rt": 4.2, "rc": 2800, "kw": {"apple", "sparkling", "fizz"}, "syn": {"apple drink"}, "rv": ["Bubbly apple drink."]},
        {"suffix": "020", "name": "7up 2L", "brand": "7Up", "sub": "soft_drink", "price": 85, "u": "ml", "uq": 2000, "rt": 4.0, "rc": 1800, "kw": {"7up", "lemon", "clear"}, "syn": {"nimbu soda", "clear drink"}, "rv": ["Crisp lemon taste."]},
        {"suffix": "021", "name": "tata tea premium", "brand": "Tata Tea", "sub": "tea", "price": 225, "u": "g", "uq": 500, "rt": 4.3, "rc": 3500, "kw": {"tea", "chai", "premium"}, "syn": {"chai patti"}, "rv": ["Strong chai flavor."]},
        {"suffix": "022", "name": "red label tea", "brand": "Brooke Bond", "sub": "tea", "price": 270, "u": "g", "uq": 500, "rt": 4.4, "rc": 3800, "kw": {"tea", "red label", "chai"}, "syn": {"chai patti", "red label chai"}, "rv": ["Desh ki chai."]},
        {"suffix": "023", "name": "davidoff instant coffee", "brand": "Davidoff", "sub": "coffee", "price": 450, "u": "g", "uq": 100, "rt": 4.5, "rc": 1200, "kw": {"coffee", "instant", "premium"}, "syn": {"kaapi", "premium coffee"}, "rv": ["Rich premium flavor."]},
    ],
    "spices": [
        {"suffix": "007", "name": "catch coriander powder", "brand": "Catch", "sub": "coriander", "price": 45, "u": "g", "uq": 100, "rt": 4.2, "rc": 1800, "kw": {"coriander powder", "dhania"}, "syn": {"dhania powder"}, "rv": ["Fresh aroma."]},
        {"suffix": "008", "name": "mdh pav bhaji masala", "brand": "MDH", "sub": "masala", "price": 65, "u": "g", "uq": 100, "rt": 4.4, "rc": 2200, "kw": {"pav bhaji masala", "spice mix"}, "syn": {"pav bhaji masala"}, "rv": ["Authentic pav bhaji taste."]},
        {"suffix": "009", "name": "everest biryani masala", "brand": "Everest", "sub": "masala", "price": 75, "u": "g", "uq": 50, "rt": 4.5, "rc": 2000, "kw": {"biryani masala", "spice blend"}, "syn": {"biryani masala"}, "rv": ["Perfect for biryani."]},
        {"suffix": "010", "name": "mdh rajma masala", "brand": "MDH", "sub": "masala", "price": 55, "u": "g", "uq": 100, "rt": 4.3, "rc": 1600, "kw": {"rajma masala"}, "syn": {"rajma masala"}, "rv": ["Good rajma taste."]},
        {"suffix": "011", "name": "catch cumin seeds", "brand": "Catch", "sub": "whole_spice", "price": 95, "u": "g", "uq": 100, "rt": 4.3, "rc": 1500, "kw": {"cumin", "jeera", "whole spice"}, "syn": {"jeera", "zeera"}, "rv": ["Clean jeera."]},
        {"suffix": "012", "name": "mdh kashmiri mirch", "brand": "MDH", "sub": "chilli", "price": 95, "u": "g", "uq": 100, "rt": 4.4, "rc": 1300, "kw": {"kashmiri mirch", "red chilli", "color"}, "syn": {"deghi mirch"}, "rv": ["Great color, mild heat."]},
        {"suffix": "013", "name": "organic tattva black pepper", "brand": "Organic Tattva", "sub": "whole_spice", "price": 145, "u": "g", "uq": 100, "rt": 4.2, "rc": 800, "kw": {"black pepper", "kali mirch"}, "syn": {"kali mirch", "golki"}, "rv": ["Premium organic pepper."]},
        {"suffix": "014", "name": "saffron premium kashmiri 1g", "brand": "Baby Brand", "sub": "saffron", "price": 350, "u": "g", "uq": 1, "rt": 4.6, "rc": 600, "kw": {"saffron", "kesar", "premium"}, "syn": {"kesar", "zafran"}, "rv": ["Authentic Kashmiri kesar."]},
    ],
    "oils": [
        {"suffix": "005", "name": "fortune rice bran oil", "brand": "Fortune", "sub": "rice_bran", "price": 175, "u": "ml", "uq": 1000, "rt": 4.2, "rc": 2200, "kw": {"oil", "rice bran", "healthy"}, "syn": {"tel"}, "rv": ["Heart healthy oil."]},
        {"suffix": "006", "name": "dhara kachi ghani mustard oil", "brand": "Dhara", "sub": "mustard", "price": 155, "u": "ml", "uq": 1000, "rt": 4.3, "rc": 2800, "kw": {"mustard oil", "kachi ghani"}, "syn": {"sarson tel"}, "rv": ["Pure kachi ghani."]},
        {"suffix": "007", "name": "sundrop superlite sunflower oil", "brand": "Sundrop", "sub": "sunflower", "price": 170, "u": "ml", "uq": 1000, "rt": 4.1, "rc": 1900, "kw": {"sunflower oil", "light"}, "syn": {"tel"}, "rv": ["Light and healthy."]},
        {"suffix": "008", "name": "figaro olive oil 500ml", "brand": "Figaro", "sub": "olive", "price": 450, "u": "ml", "uq": 500, "rt": 4.0, "rc": 900, "kw": {"olive oil", "cooking"}, "syn": {"jaitun tel"}, "rv": ["Good cooking olive oil."]},
        {"suffix": "009", "name": "patanjali coconut oil", "brand": "Patanjali", "sub": "coconut", "price": 110, "u": "ml", "uq": 500, "rt": 4.1, "rc": 2000, "kw": {"coconut oil", "nariyal tel"}, "syn": {"nariyal tel"}, "rv": ["Multi-purpose coconut oil."]},
    ],
    "vegetables": [
        {"suffix": "008", "name": "fresh capsicum green", "brand": "Local Farm", "sub": "capsicum", "price": 60, "u": "g", "uq": 500, "rt": 3.9, "rc": 600, "kw": {"capsicum", "shimla mirch", "bell pepper"}, "syn": {"shimla mirch"}, "rv": ["Fresh and crunchy."]},
        {"suffix": "009", "name": "fresh cauliflower", "brand": "Local Farm", "sub": "cauliflower", "price": 40, "u": "piece", "uq": 1, "rt": 4.0, "rc": 500, "kw": {"cauliflower", "gobhi"}, "syn": {"gobi", "phool gobi"}, "rv": ["White and fresh."]},
        {"suffix": "010", "name": "fresh palak spinach", "brand": "Local Farm", "sub": "spinach", "price": 25, "u": "piece", "uq": 1, "rt": 3.8, "rc": 400, "kw": {"spinach", "palak", "saag"}, "syn": {"palak", "saag"}, "rv": ["Fresh green leaves."]},
        {"suffix": "011", "name": "fresh lemon pack of 4", "brand": "Local Farm", "sub": "lemon", "price": 20, "u": "piece", "uq": 4, "rt": 3.9, "rc": 600, "kw": {"lemon", "nimbu", "citrus"}, "syn": {"nimbu"}, "rv": ["Juicy lemons."]},
        {"suffix": "012", "name": "fresh cucumber", "brand": "Local Farm", "sub": "cucumber", "price": 30, "u": "g", "uq": 500, "rt": 3.9, "rc": 400, "kw": {"cucumber", "kheera", "salad"}, "syn": {"kheera", "kakdi"}, "rv": ["Fresh and crisp."]},
        {"suffix": "013", "name": "fresh brinjal", "brand": "Local Farm", "sub": "brinjal", "price": 35, "u": "g", "uq": 500, "rt": 3.8, "rc": 350, "kw": {"brinjal", "baingan", "eggplant"}, "syn": {"baingan", "baigan"}, "rv": ["Good for bhartha."]},
        {"suffix": "014", "name": "fresh carrot", "brand": "Local Farm", "sub": "carrot", "price": 45, "u": "g", "uq": 500, "rt": 4.0, "rc": 500, "kw": {"carrot", "gajar"}, "syn": {"gajar"}, "rv": ["Orange and sweet."]},
        {"suffix": "015", "name": "fresh beans french beans", "brand": "Local Farm", "sub": "beans", "price": 50, "u": "g", "uq": 250, "rt": 3.8, "rc": 300, "kw": {"beans", "french beans"}, "syn": {"sem", "beans"}, "rv": ["Fresh and tender."]},
        {"suffix": "016", "name": "fresh bitter gourd", "brand": "Local Farm", "sub": "karela", "price": 40, "u": "g", "uq": 250, "rt": 3.5, "rc": 250, "kw": {"bitter gourd", "karela"}, "syn": {"karela"}, "rv": ["Good for health."]},
        {"suffix": "017", "name": "fresh lady finger okra", "brand": "Local Farm", "sub": "okra", "price": 35, "u": "g", "uq": 250, "rt": 3.9, "rc": 400, "kw": {"okra", "bhindi", "lady finger"}, "syn": {"bhindi"}, "rv": ["Tender and fresh."]},
    ],
    "instant_food": [
        {"suffix": "005", "name": "mtr ready to eat dal makhani", "brand": "MTR", "sub": "ready_to_eat", "price": 95, "u": "g", "uq": 300, "rt": 4.3, "rc": 1900, "kw": {"dal makhani", "ready to eat"}, "syn": {"instant dal"}, "rv": ["Rich and creamy dal."]},
        {"suffix": "006", "name": "mtr ready to eat palak paneer", "brand": "MTR", "sub": "ready_to_eat", "price": 105, "u": "g", "uq": 300, "rt": 4.1, "rc": 1500, "kw": {"palak paneer", "ready to eat"}, "syn": {"instant palak paneer"}, "rv": ["Good spinach flavor."]},
        {"suffix": "007", "name": "gits instant gulab jamun mix", "brand": "Gits", "sub": "mix", "price": 85, "u": "g", "uq": 200, "rt": 4.2, "rc": 1800, "kw": {"gulab jamun", "dessert", "sweet"}, "syn": {"gulab jamun mix"}, "rv": ["Easy to make."]},
        {"suffix": "008", "name": "mtr instant dosa mix", "brand": "MTR", "sub": "mix", "price": 75, "u": "g", "uq": 500, "rt": 4.3, "rc": 2200, "kw": {"dosa", "instant mix", "south indian"}, "syn": {"dosa batter"}, "rv": ["Crispy dosas."]},
        {"suffix": "009", "name": "knorr sweet corn soup", "brand": "Knorr", "sub": "soup", "price": 45, "u": "g", "uq": 44, "rt": 4.1, "rc": 1400, "kw": {"soup", "sweet corn", "instant"}, "syn": {"corn soup"}, "rv": ["Good corn flavor."]},
        {"suffix": "010", "name": "patanjali instant atta noodles", "brand": "Patanjali", "sub": "noodles", "price": 12, "u": "g", "uq": 70, "rt": 3.8, "rc": 1200, "kw": {"noodles", "atta noodles", "healthy"}, "syn": {"atta noodles"}, "rv": ["Healthier noodle option."]},
    ],
    "cleaning": [
        {"suffix": "005", "name": "vim dishwash liquid lemon", "brand": "Vim", "sub": "dishwash", "price": 99, "u": "ml", "uq": 500, "rt": 4.3, "rc": 2800, "kw": {"dishwash liquid", "utensil"}, "syn": {"bartan soap liquid"}, "rv": ["Easy to use liquid."]},
        {"suffix": "006", "name": "tide plus double power detergent", "brand": "Tide", "sub": "detergent", "price": 195, "u": "g", "uq": 1000, "rt": 4.3, "rc": 3500, "kw": {"detergent", "tide", "washing"}, "syn": {"washing powder"}, "rv": ["Whitens clothes."]},
        {"suffix": "007", "name": "colin glass cleaner", "brand": "Colin", "sub": "glass_cleaner", "price": 85, "u": "ml", "uq": 500, "rt": 4.1, "rc": 1800, "kw": {"glass cleaner", "window", "shine"}, "syn": {"glass cleaner"}, "rv": ["Streak-free shine."]},
        {"suffix": "008", "name": "domex toilet expert", "brand": "Domex", "sub": "toilet_cleaner", "price": 85, "u": "ml", "uq": 500, "rt": 4.1, "rc": 2200, "kw": {"toilet cleaner", "disinfectant"}, "syn": {"toilet cleaner"}, "rv": ["Kills germs."]},
        {"suffix": "009", "name": "scotch brite scrub pad green", "brand": "Scotch Brite", "sub": "scrub", "price": 25, "u": "piece", "uq": 1, "rt": 4.2, "rc": 3000, "kw": {"scrub pad", "utensil scrub"}, "syn": {"bartan scrub"}, "rv": ["Long lasting scrub."]},
    ],
    "hygiene": [
        {"suffix": "006", "name": "lux soft touch soap", "brand": "Lux", "sub": "soap", "price": 45, "u": "g", "uq": 100, "rt": 4.2, "rc": 3200, "kw": {"soap", "beauty", "bath"}, "syn": {"sabun"}, "rv": ["Soft fragrance."]},
        {"suffix": "007", "name": "pantene hair fall control shampoo", "brand": "Pantene", "sub": "shampoo", "price": 195, "u": "ml", "uq": 340, "rt": 4.2, "rc": 2600, "kw": {"shampoo", "hair fall"}, "syn": {"shampoo"}, "rv": ["Reduces hair fall."]},
        {"suffix": "008", "name": "closeup toothpaste red", "brand": "Closeup", "sub": "toothpaste", "price": 80, "u": "g", "uq": 150, "rt": 4.1, "rc": 3200, "kw": {"toothpaste", "gel", "fresh breath"}, "syn": {"toothpaste"}, "rv": ["Fresh gel formula."]},
        {"suffix": "009", "name": "lifebuoy total soap", "brand": "Lifebuoy", "sub": "soap", "price": 38, "u": "g", "uq": 100, "rt": 4.1, "rc": 3800, "kw": {"soap", "hygiene", "germ protection"}, "syn": {"sabun"}, "rv": ["Germ protection."]},
        {"suffix": "010", "name": "pepsodent germicheck toothpaste", "brand": "Pepsodent", "sub": "toothpaste", "price": 75, "u": "g", "uq": 150, "rt": 4.0, "rc": 2500, "kw": {"toothpaste", "cavity protection"}, "syn": {"dant manjan"}, "rv": ["Cavity protection."]},
    ],
    "bakery": [
        {"suffix": "005", "name": "english oven premium white bread", "brand": "English Oven", "sub": "bread", "price": 55, "u": "g", "uq": 400, "rt": 4.3, "rc": 1500, "kw": {"bread", "premium", "sandwich"}, "syn": {"bread"}, "rv": ["Soft premium bread."]},
        {"suffix": "006", "name": "harvest gold multi grain bread", "brand": "Harvest Gold", "sub": "bread", "price": 60, "u": "g", "uq": 450, "rt": 4.2, "rc": 1200, "kw": {"bread", "multigrain", "healthy"}, "syn": {"healthy bread"}, "rv": ["Fiber rich bread."]},
        {"suffix": "007", "name": "britannia cake rusk", "brand": "Britannia", "sub": "rusk", "price": 45, "u": "g", "uq": 200, "rt": 4.3, "rc": 2200, "kw": {"cake rusk", "tea snack"}, "syn": {"cake rusk", "meetha rusk"}, "rv": ["Sweet and crunchy."]},
    ],
    "frozen": [
        {"suffix": "005", "name": "amul chocolate ice cream tub", "brand": "Amul", "sub": "ice_cream", "price": 275, "u": "ml", "uq": 1000, "rt": 4.5, "rc": 3200, "kw": {"ice cream", "chocolate", "dessert"}, "syn": {"chocolate ice cream"}, "rv": ["Rich chocolate flavor."]},
        {"suffix": "006", "name": "mccain aloo tikki 450g", "brand": "McCain", "sub": "tikki", "price": 175, "u": "g", "uq": 450, "rt": 4.2, "rc": 1600, "kw": {"aloo tikki", "frozen", "snack"}, "syn": {"aloo tikki"}, "rv": ["Crispy aloo tikki."]},
        {"suffix": "007", "name": "amul strawberry ice cream 750ml", "brand": "Amul", "sub": "ice_cream", "price": 200, "u": "ml", "uq": 750, "rt": 4.3, "rc": 2000, "kw": {"ice cream", "strawberry"}, "syn": {"strawberry ice cream"}, "rv": ["Fruity and creamy."]},
        {"suffix": "008", "name": "mother dairy ice cream vanilla 1L", "brand": "Mother Dairy", "sub": "ice_cream", "price": 199, "u": "ml", "uq": 1000, "rt": 4.1, "rc": 1500, "kw": {"ice cream", "vanilla"}, "syn": {"vanilla ice cream"}, "rv": ["Good value ice cream."]},
    ],
    "stationery": [
        {"suffix": "006", "name": "navneet notebook 200 pages", "brand": "Navneet", "sub": "notebook", "price": 60, "u": "piece", "uq": 1, "rt": 4.2, "rc": 2000, "kw": {"notebook", "register", "school"}, "syn": {"copy", "kaapy"}, "rv": ["Good ruled lines."]},
        {"suffix": "007", "name": "pilot v5 pen black", "brand": "Pilot", "sub": "pen", "price": 45, "u": "piece", "uq": 1, "rt": 4.5, "rc": 3200, "kw": {"pen", "pilot", "fine tip"}, "syn": {"pen"}, "rv": ["Smooth fine writing."]},
        {"suffix": "008", "name": "faber castell erasable crayons 24", "brand": "Faber Castell", "sub": "crayons", "price": 180, "u": "piece", "uq": 24, "rt": 4.4, "rc": 1800, "kw": {"crayons", "coloring", "art"}, "syn": {"crayons", "rang"}, "rv": ["Vibrant colors."]},
        {"suffix": "009", "name": "apsara long pencils box of 10", "brand": "Apsara", "sub": "pencil", "price": 30, "u": "piece", "uq": 10, "rt": 4.2, "rc": 2800, "kw": {"pencil", "writing", "school"}, "syn": {"pencil"}, "rv": ["Smooth writing pencil."]},
        {"suffix": "010", "name": "staedtler eraser pack of 4", "brand": "Staedtler", "sub": "eraser", "price": 40, "u": "piece", "uq": 4, "rt": 4.3, "rc": 1500, "kw": {"eraser", "rubber", "school"}, "syn": {"rubber", "eraser"}, "rv": ["Clean erasing."]},
        {"suffix": "011", "name": "luxor highlighter set of 5", "brand": "Luxor", "sub": "highlighter", "price": 95, "u": "piece", "uq": 5, "rt": 4.1, "rc": 1200, "kw": {"highlighter", "marker", "study"}, "syn": {"highlighter"}, "rv": ["Bright neon colors."]},
    ],
    "party_supplies": [
        {"suffix": "006", "name": "birthday candles numeral set", "brand": "Amscan", "sub": "candles", "price": 49, "u": "piece", "uq": 10, "rt": 4.0, "rc": 800, "kw": {"candles", "birthday", "cake"}, "syn": {"birthday candle"}, "rv": ["Colorful candles."]},
        {"suffix": "007", "name": "party hats assorted 10-pack", "brand": "Amscan", "sub": "hats", "price": 99, "u": "piece", "uq": 10, "rt": 3.9, "rc": 600, "kw": {"party hats", "birthday", "fun"}, "syn": {"topi"}, "rv": ["Fun for kids."]},
        {"suffix": "008", "name": "streamer ribbons assorted", "brand": "Amscan", "sub": "decoration", "price": 79, "u": "piece", "uq": 5, "rt": 4.0, "rc": 500, "kw": {"streamers", "ribbons", "decoration"}, "syn": {"decoration"}, "rv": ["Colorful party decor."]},
        {"suffix": "009", "name": "disposable garbage bags 30-pack", "brand": "Ezee", "sub": "bags", "price": 85, "u": "piece", "uq": 30, "rt": 4.1, "rc": 2500, "kw": {"garbage bags", "dustbin bags"}, "syn": {"kachre ka bag"}, "rv": ["Strong and leak-proof."]},
        {"suffix": "010", "name": "aluminium foil roll", "brand": "Hindalco", "sub": "foil", "price": 95, "u": "piece", "uq": 1, "rt": 4.2, "rc": 2000, "kw": {"foil", "aluminium", "wrapping"}, "syn": {"foil paper"}, "rv": ["Multi-purpose."]},
    ],
    "personal_care": [
        {"suffix": "004", "name": "wild stone deo body spray", "brand": "Wild Stone", "sub": "deodorant", "price": 175, "u": "ml", "uq": 150, "rt": 4.1, "rc": 2500, "kw": {"deo", "perfume", "body spray"}, "syn": {"deo"}, "rv": ["Long lasting scent."]},
        {"suffix": "005", "name": "garnier men acno fight face wash", "brand": "Garnier", "sub": "face_wash", "price": 195, "u": "ml", "uq": 150, "rt": 4.2, "rc": 2800, "kw": {"face wash", "acne", "men"}, "syn": {"face wash"}, "rv": ["Fights acne well."]},
        {"suffix": "006", "name": "nivea soft cream", "brand": "Nivea", "sub": "cream", "price": 165, "u": "ml", "uq": 200, "rt": 4.3, "rc": 3200, "kw": {"moisturizer", "cream", "skin"}, "syn": {"cream"}, "rv": ["Light and moisturizing."]},
        {"suffix": "007", "name": "gillette guard razor pack of 3", "brand": "Gillette", "sub": "razor", "price": 90, "u": "piece", "uq": 3, "rt": 4.2, "rc": 3500, "kw": {"razor", "shaving", "grooming"}, "syn": {"razor"}, "rv": ["Clean shave."]},
        {"suffix": "008", "name": "park avenue deodorant", "brand": "Park Avenue", "sub": "deodorant", "price": 195, "u": "ml", "uq": 150, "rt": 4.0, "rc": 1800, "kw": {"deodorant", "fragrance"}, "syn": {"deo"}, "rv": ["Good work fragrance."]},
    ],
    "non_veg": [
        {"suffix": "005", "name": "farm fresh fish rohu whole", "brand": "Fresh Farm", "sub": "fish", "price": 320, "u": "g", "uq": 1000, "rt": 4.0, "rc": 600, "kw": {"fish", "rohu", "freshwater"}, "syn": {"machli", "rohu"}, "rv": ["Fresh river fish."]},
        {"suffix": "006", "name": "farm fresh prawns cleaned", "brand": "Fresh Farm", "sub": "prawns", "price": 450, "u": "g", "uq": 500, "rt": 4.1, "rc": 500, "kw": {"prawns", "shrimp", "seafood"}, "syn": {"jhinga", "prawns"}, "rv": ["Cleaned and deveined."]},
        {"suffix": "007", "name": "farm fresh eggs pack of 6", "brand": "Fresh Farm", "sub": "eggs", "price": 48, "u": "piece", "uq": 6, "rt": 4.2, "rc": 3500, "kw": {"eggs", "anda", "small pack"}, "syn": {"anda"}, "rv": ["Fresh small pack."]},
        {"suffix": "008", "name": "licious chicken sausages", "brand": "Licious", "sub": "sausages", "price": 199, "u": "g", "uq": 200, "rt": 4.3, "rc": 1200, "kw": {"sausages", "chicken", "breakfast"}, "syn": {"sausage"}, "rv": ["Juicy and flavorful."]},
    ],
    "fruits": [
        {"suffix": "011", "name": "fresh chiku sapota 500g", "brand": "Local Farm", "sub": "chiku", "price": 70, "u": "g", "uq": 500, "rt": 4.0, "rc": 400, "kw": {"chiku", "sapota"}, "syn": {"chiku"}, "rv": ["Sweet and grainy."]},
        {"suffix": "012", "name": "fresh litchi 500g", "brand": "Local Farm", "sub": "litchi", "price": 150, "u": "g", "uq": 500, "rt": 4.3, "rc": 500, "kw": {"litchi", "lychee"}, "syn": {"litchi"}, "rv": ["Juicy and sweet."]},
        {"suffix": "013", "name": "fresh strawberry 200g", "brand": "Local Farm", "sub": "strawberry", "price": 120, "u": "g", "uq": 200, "rt": 4.2, "rc": 600, "kw": {"strawberry", "berries"}, "syn": {"strawberry"}, "rv": ["Fresh and tangy."]},
        {"suffix": "014", "name": "fresh coconut 1 piece", "brand": "Local Farm", "sub": "coconut", "price": 35, "u": "piece", "uq": 1, "rt": 4.0, "rc": 800, "kw": {"coconut", "nariyal"}, "syn": {"nariyal"}, "rv": ["Fresh and heavy."]},
        {"suffix": "015", "name": "fresh kiwi 3 pieces", "brand": "Imported", "sub": "kiwi", "price": 120, "u": "piece", "uq": 3, "rt": 4.1, "rc": 500, "kw": {"kiwi", "fruit", "vitamin"}, "syn": {"kiwi"}, "rv": ["Tangy imported fruit."]},
        {"suffix": "016", "name": "dry fruits mixed 200g", "brand": "Happilo", "sub": "dry_fruits", "price": 299, "u": "g", "uq": 200, "rt": 4.4, "rc": 2000, "kw": {"dry fruits", "almonds", "cashews", "raisins"}, "syn": {"meva", "dry fruits"}, "rv": ["Premium mix."]},
        {"suffix": "017", "name": "happilo almonds california 200g", "brand": "Happilo", "sub": "dry_fruits", "price": 249, "u": "g", "uq": 200, "rt": 4.5, "rc": 2500, "kw": {"almonds", "badam", "nuts"}, "syn": {"badam"}, "rv": ["Premium quality almonds."]},
        {"suffix": "018", "name": "happilo cashews whole 200g", "brand": "Happilo", "sub": "dry_fruits", "price": 280, "u": "g", "uq": 200, "rt": 4.4, "rc": 1800, "kw": {"cashews", "kaju", "nuts"}, "syn": {"kaju"}, "rv": ["Big whole cashews."]},
        {"suffix": "019", "name": "dates medjool premium 250g", "brand": "Lion", "sub": "dry_fruits", "price": 350, "u": "g", "uq": 250, "rt": 4.5, "rc": 1200, "kw": {"dates", "khajur", "energy"}, "syn": {"khajur"}, "rv": ["Soft and sweet."]},
        {"suffix": "020", "name": "fresh avocado 2 pieces", "brand": "Imported", "sub": "avocado", "price": 180, "u": "piece", "uq": 2, "rt": 4.0, "rc": 400, "kw": {"avocado", "healthy fat"}, "syn": {"avocado"}, "rv": ["Creamy and ripe."]},
    ],
    "breakfast": [
        {"suffix": "013", "name": "kelloggs special k", "brand": "Kelloggs", "sub": "cereal", "price": 295, "u": "g", "uq": 435, "rt": 4.2, "rc": 1500, "kw": {"cereal", "low fat", "diet"}, "syn": {"cereal"}, "rv": ["Light and crunchy."]},
        {"suffix": "014", "name": "yoga bar muesli dark chocolate", "brand": "Yoga Bar", "sub": "muesli", "price": 349, "u": "g", "uq": 400, "rt": 4.4, "rc": 1200, "kw": {"muesli", "chocolate", "premium"}, "syn": {"muesli"}, "rv": ["Chocolate lovers muesli."]},
        {"suffix": "015", "name": "epigamia peanut butter smooth", "brand": "Epigamia", "sub": "spread", "price": 299, "u": "g", "uq": 400, "rt": 4.3, "rc": 1000, "kw": {"peanut butter", "smooth", "protein"}, "syn": {"peanut butter"}, "rv": ["No palm oil, pure peanut."]},
        {"suffix": "016", "name": "mtr instant rava idli mix", "brand": "MTR", "sub": "mix", "price": 59, "u": "g", "uq": 200, "rt": 4.2, "rc": 1600, "kw": {"rava idli", "instant"}, "syn": {"idli mix"}, "rv": ["Quick breakfast."]},
        {"suffix": "017", "name": "parle 20-20 cookies cashew", "brand": "Parle", "sub": "cookies", "price": 25, "u": "g", "uq": 175, "rt": 4.1, "rc": 2800, "kw": {"cookies", "cashew"}, "syn": {"biscuit"}, "rv": ["Crunchy cashew cookies."]},
        {"suffix": "018", "name": "cornitos nacho crisps cheese", "brand": "Cornitos", "sub": "nachos", "price": 60, "u": "g", "uq": 150, "rt": 4.0, "rc": 1500, "kw": {"nachos", "cheese", "snack"}, "syn": {"nachos"}, "rv": ["Cheesy nachos."]},
        {"suffix": "019", "name": "bournvita health drink 500g", "brand": "Cadbury", "sub": "health_drink", "price": 225, "u": "g", "uq": 500, "rt": 4.3, "rc": 5000, "kw": {"bournvita", "chocolate", "health drink"}, "syn": {"bournvita", "health drink"}, "rv": ["Classic health drink for kids."]},
        {"suffix": "020", "name": "horlicks classic malt 500g", "brand": "Horlicks", "sub": "health_drink", "price": 245, "u": "g", "uq": 500, "rt": 4.2, "rc": 4500, "kw": {"horlicks", "malt", "health drink"}, "syn": {"horlicks"}, "rv": ["Nutritious malt drink."]},
        {"suffix": "021", "name": "complan classic chocolate 500g", "brand": "Complan", "sub": "health_drink", "price": 265, "u": "g", "uq": 500, "rt": 4.0, "rc": 2800, "kw": {"complan", "chocolate", "growth"}, "syn": {"complan"}, "rv": ["Complete nutrition drink."]},
        {"suffix": "022", "name": "protinex original 400g", "brand": "Protinex", "sub": "supplement", "price": 395, "u": "g", "uq": 400, "rt": 4.1, "rc": 2200, "kw": {"protinex", "protein", "supplement"}, "syn": {"protinex"}, "rv": ["High protein supplement."]},
    ],
    "baby": [
        {"suffix": "009", "name": "huggies wonder pants large", "brand": "Huggies", "sub": "diapers", "price": 549, "u": "piece", "uq": 32, "rt": 4.3, "rc": 3800, "kw": {"diapers", "pants", "baby"}, "syn": {"diapers"}, "rv": ["Good absorption."]},
        {"suffix": "010", "name": "nestle lactogen stage 1", "brand": "Nestle", "sub": "formula", "price": 475, "u": "g", "uq": 400, "rt": 4.2, "rc": 3000, "kw": {"baby formula", "milk", "infant"}, "syn": {"baby milk"}, "rv": ["Trusted baby formula."]},
        {"suffix": "011", "name": "johnson baby oil", "brand": "Johnson", "sub": "oil", "price": 135, "u": "ml", "uq": 200, "rt": 4.4, "rc": 3500, "kw": {"baby oil", "massage"}, "syn": {"baby tel"}, "rv": ["Pure mineral oil."]},
        {"suffix": "012", "name": "himalaya baby cream", "brand": "Himalaya", "sub": "cream", "price": 95, "u": "g", "uq": 100, "rt": 4.3, "rc": 2500, "kw": {"baby cream", "moisturizer"}, "syn": {"baby cream"}, "rv": ["Protects from dryness."]},
    ],
    "pet": [
        {"suffix": "007", "name": "royal canin maxi adult dog food", "brand": "Royal Canin", "sub": "dog_food", "price": 850, "u": "g", "uq": 4000, "rt": 4.5, "rc": 2500, "kw": {"dog food", "premium", "large breed"}, "syn": {"dog food"}, "rv": ["Premium dog nutrition."]},
        {"suffix": "008", "name": "sheba cat food tuna in jelly", "brand": "Sheba", "sub": "cat_food", "price": 55, "u": "g", "uq": 85, "rt": 4.3, "rc": 1500, "kw": {"cat food", "premium", "tuna"}, "syn": {"billi ka khana"}, "rv": ["Cats love jelly."]},
        {"suffix": "009", "name": "drools puppy food chicken egg", "brand": "Drools", "sub": "dog_food", "price": 320, "u": "g", "uq": 3000, "rt": 4.3, "rc": 3000, "kw": {"puppy food", "chicken"}, "syn": {"puppy food"}, "rv": ["Good for puppies."]},
        {"suffix": "010", "name": "pet bowl stainless steel", "brand": "Generic", "sub": "accessories", "price": 199, "u": "piece", "uq": 1, "rt": 4.0, "rc": 1200, "kw": {"pet bowl", "dog bowl"}, "syn": {"pet bowl"}, "rv": ["Non-slip base."]},
    ],
    "fashion_men": [
        {"suffix": "009", "name": "allen solly formal trousers", "brand": "Allen Solly", "sub": "trousers", "price": 1599, "u": "piece", "uq": 1, "rt": 4.2, "rc": 1500, "kw": {"trousers", "formal", "office"}, "syn": {"pant"}, "rv": ["Good office wear."]},
        {"suffix": "010", "name": "hanes men crew socks 3-pack", "brand": "Hanes", "sub": "socks", "price": 299, "u": "piece", "uq": 3, "rt": 4.1, "rc": 2500, "kw": {"socks", "cotton", "men"}, "syn": {"moje"}, "rv": ["Comfortable cotton socks."]},
        {"suffix": "011", "name": "roadster men hoodie grey", "brand": "Roadster", "sub": "hoodie", "price": 999, "u": "piece", "uq": 1, "rt": 4.3, "rc": 1200, "kw": {"hoodie", "winter", "casual"}, "syn": {"hoodie"}, "rv": ["Warm and stylish."]},
        {"suffix": "012", "name": "campus sutra men jacket black", "brand": "Campus Sutra", "sub": "jacket", "price": 1299, "u": "piece", "uq": 1, "rt": 4.2, "rc": 1000, "kw": {"jacket", "winter", "men"}, "syn": {"jacket"}, "rv": ["Good winter jacket."]},
        {"suffix": "013", "name": "here&now men casual shirt checked", "brand": "Here&Now", "sub": "shirt", "price": 599, "u": "piece", "uq": 1, "rt": 4.0, "rc": 1800, "kw": {"casual shirt", "checked"}, "syn": {"shirt"}, "rv": ["Casual weekend shirt."]},
        {"suffix": "014", "name": "tommy hilfiger men perfume 100ml", "brand": "Tommy Hilfiger", "sub": "perfume", "price": 2999, "u": "ml", "uq": 100, "rt": 4.4, "rc": 1200, "kw": {"perfume", "fragrance", "premium"}, "syn": {"perfume", "attar"}, "rv": ["Premium long-lasting scent."]},
    ],
    "fashion_women": [
        {"suffix": "008", "name": "fabindia cotton dupatta", "brand": "FabIndia", "sub": "dupatta", "price": 499, "u": "piece", "uq": 1, "rt": 4.2, "rc": 1500, "kw": {"dupatta", "cotton", "ethnic"}, "syn": {"dupatta", "chunni"}, "rv": ["Beautiful print."]},
        {"suffix": "009", "name": "nykaa so creme lipstick", "brand": "Nykaa", "sub": "lipstick", "price": 399, "u": "piece", "uq": 1, "rt": 4.3, "rc": 2000, "kw": {"lipstick", "makeup", "beauty"}, "syn": {"lipstick"}, "rv": ["Creamy and long lasting."]},
        {"suffix": "010", "name": "lakme eyeconic kajal", "brand": "Lakme", "sub": "kajal", "price": 225, "u": "piece", "uq": 1, "rt": 4.4, "rc": 4500, "kw": {"kajal", "eyeliner", "beauty"}, "syn": {"kajal", "surma"}, "rv": ["Smudge-proof all day."]},
        {"suffix": "011", "name": "maybelline fit me foundation", "brand": "Maybelline", "sub": "foundation", "price": 499, "u": "ml", "uq": 30, "rt": 4.2, "rc": 3200, "kw": {"foundation", "makeup"}, "syn": {"foundation"}, "rv": ["Natural matte finish."]},
        {"suffix": "012", "name": "forest essentials body lotion", "brand": "Forest Essentials", "sub": "lotion", "price": 1250, "u": "ml", "uq": 200, "rt": 4.5, "rc": 800, "kw": {"body lotion", "luxury", "ayurvedic"}, "syn": {"lotion"}, "rv": ["Luxury ayurvedic lotion."]},
    ],
    "fashion_kids": [
        {"suffix": "007", "name": "gap kids polo tshirt", "brand": "GAP", "sub": "tshirt", "price": 599, "u": "piece", "uq": 1, "rt": 4.2, "rc": 1000, "kw": {"polo", "kids", "tshirt"}, "syn": {"tshirt"}, "rv": ["Classic polo for kids."]},
        {"suffix": "008", "name": "firstcry baby blanket fleece", "brand": "FirstCry", "sub": "blanket", "price": 399, "u": "piece", "uq": 1, "rt": 4.3, "rc": 1200, "kw": {"blanket", "baby", "fleece"}, "syn": {"kambal"}, "rv": ["Soft and warm."]},
        {"suffix": "009", "name": "chhota bheem kids backpack", "brand": "Chhota Bheem", "sub": "backpack", "price": 499, "u": "piece", "uq": 1, "rt": 4.1, "rc": 1800, "kw": {"backpack", "school bag", "kids"}, "syn": {"school bag"}, "rv": ["Kids love Bheem design."]},
        {"suffix": "010", "name": "hot wheels toy car set 5-pack", "brand": "Hot Wheels", "sub": "toy", "price": 399, "u": "piece", "uq": 5, "rt": 4.4, "rc": 2500, "kw": {"toy car", "hot wheels", "kids"}, "syn": {"toy car"}, "rv": ["Hours of fun for boys."]},
    ],
    "footwear": [
        {"suffix": "007", "name": "woodland men leather boots", "brand": "Woodland", "sub": "boots", "price": 3295, "u": "piece", "uq": 1, "rt": 4.4, "rc": 1500, "kw": {"boots", "leather", "adventure"}, "syn": {"boots", "joote"}, "rv": ["Built for adventure."]},
        {"suffix": "008", "name": "bata women bellies black", "brand": "Bata", "sub": "bellies", "price": 499, "u": "piece", "uq": 1, "rt": 4.0, "rc": 2000, "kw": {"bellies", "women", "office"}, "syn": {"belly shoes"}, "rv": ["Comfortable office wear."]},
        {"suffix": "009", "name": "adidas men slides black", "brand": "Adidas", "sub": "slides", "price": 999, "u": "piece", "uq": 1, "rt": 4.3, "rc": 1800, "kw": {"slides", "sandals", "casual"}, "syn": {"slides"}, "rv": ["Premium slides."]},
        {"suffix": "010", "name": "puma men running shoes", "brand": "Puma", "sub": "sports", "price": 2999, "u": "piece", "uq": 1, "rt": 4.4, "rc": 1200, "kw": {"running shoes", "puma", "sports"}, "syn": {"running shoes"}, "rv": ["Lightweight running shoes."]},
    ],
    "accessories": [
        {"suffix": "009", "name": "safari luggage trolley 65cm", "brand": "Safari", "sub": "luggage", "price": 2999, "u": "piece", "uq": 1, "rt": 4.2, "rc": 1200, "kw": {"luggage", "trolley", "medium"}, "syn": {"suitcase"}, "rv": ["Durable travel companion."]},
        {"suffix": "010", "name": "titan edge watch men slim", "brand": "Titan", "sub": "watch", "price": 4995, "u": "piece", "uq": 1, "rt": 4.5, "rc": 1000, "kw": {"watch", "premium", "slim"}, "syn": {"ghari"}, "rv": ["Ultra slim premium watch."]},
        {"suffix": "011", "name": "cello max fresh lunch box", "brand": "Cello", "sub": "tiffin", "price": 349, "u": "piece", "uq": 1, "rt": 4.1, "rc": 2000, "kw": {"lunch box", "tiffin"}, "syn": {"dabba"}, "rv": ["Airtight and leak-proof."]},
        {"suffix": "012", "name": "borosil water bottle 1L", "brand": "Borosil", "sub": "bottle", "price": 549, "u": "piece", "uq": 1, "rt": 4.3, "rc": 1800, "kw": {"water bottle", "glass"}, "syn": {"paani ki bottle"}, "rv": ["Premium glass bottle."]},
        {"suffix": "013", "name": "jbl tune 510bt headphones", "brand": "JBL", "sub": "headphones", "price": 2999, "u": "piece", "uq": 1, "rt": 4.3, "rc": 3500, "kw": {"headphones", "bluetooth", "wireless"}, "syn": {"headphone"}, "rv": ["Great bass and battery life."]},
        {"suffix": "014", "name": "boat rockerz 255 pro neckband", "brand": "boAt", "sub": "earphones", "price": 899, "u": "piece", "uq": 1, "rt": 4.2, "rc": 5000, "kw": {"earphones", "neckband", "bluetooth"}, "syn": {"earphone"}, "rv": ["Value for money neckband."]},
        {"suffix": "015", "name": "umbrella 3-fold compact black", "brand": "Generic", "sub": "umbrella", "price": 299, "u": "piece", "uq": 1, "rt": 4.0, "rc": 1500, "kw": {"umbrella", "rain", "monsoon"}, "syn": {"chhatri", "umbrella"}, "rv": ["Compact and windproof."]},
    ],
    "medicines_otc": [
        {"suffix": "009", "name": "dabur chyawanprash 500g", "brand": "Dabur", "sub": "supplement", "price": 225, "u": "g", "uq": 500, "rt": 4.3, "rc": 4000, "kw": {"chyawanprash", "immunity", "ayurvedic"}, "syn": {"chyawanprash"}, "rv": ["Trusted immunity booster."]},
        {"suffix": "010", "name": "volini spray 40g", "brand": "Volini", "sub": "pain_relief", "price": 145, "u": "g", "uq": 40, "rt": 4.2, "rc": 3000, "kw": {"pain spray", "muscle pain"}, "syn": {"dard ki spray"}, "rv": ["Quick muscle pain relief."]},
        {"suffix": "011", "name": "pudin hara pearls 10s", "brand": "Dabur", "sub": "digestive", "price": 30, "u": "piece", "uq": 10, "rt": 4.1, "rc": 3500, "kw": {"digestive", "stomach", "gas"}, "syn": {"pudin hara"}, "rv": ["Quick stomach relief."]},
        {"suffix": "012", "name": "betadine ointment 15g", "brand": "Betadine", "sub": "antiseptic", "price": 65, "u": "g", "uq": 15, "rt": 4.3, "rc": 2500, "kw": {"ointment", "antiseptic", "wound"}, "syn": {"antiseptic cream"}, "rv": ["Effective wound care."]},
        {"suffix": "013", "name": "otrivin nasal spray", "brand": "Otrivin", "sub": "nasal", "price": 90, "u": "ml", "uq": 10, "rt": 4.1, "rc": 2000, "kw": {"nasal spray", "blocked nose"}, "syn": {"naak ki dawa"}, "rv": ["Instant nasal relief."]},
        {"suffix": "014", "name": "hajmola regular 120 tablets", "brand": "Dabur", "sub": "digestive", "price": 45, "u": "piece", "uq": 120, "rt": 4.2, "rc": 5000, "kw": {"hajmola", "digestive", "tasty"}, "syn": {"hajmola"}, "rv": ["Chatpata digestive candy."]},
    ],
}


def _generate_variant_products() -> list[dict]:
    """Generate brand/pack-size variant products to reach 500+ total SKUs."""
    variants = []
    # Map category prefix codes
    _prefix_map = {
        "grains": "GRN", "dairy": "DRY", "snacks": "SNK", "beverages": "BEV",
        "spices": "SPC", "oils": "OIL", "vegetables": "VEG", "instant_food": "INS",
        "cleaning": "CLN", "hygiene": "HYG", "bakery": "BAK", "frozen": "FRZ",
        "stationery": "STN", "party_supplies": "PTY", "personal_care": "PRC",
        "non_veg": "NV", "fruits": "FRT", "breakfast": "BKF", "baby": "BBY",
        "pet": "PET", "fashion_men": "FMN", "fashion_women": "FWM",
        "fashion_kids": "FKD", "footwear": "FTW", "accessories": "ACC",
        "medicines_otc": "MED",
    }

    for category, items in _VARIANT_DEFS.items():
        prefix = _prefix_map.get(category, category[:3].upper())
        for item in items:
            sku = f"SKU-{prefix}-{item['suffix']}"
            p = _p(
                sku, item["name"], item.get("brand", "Local"), category,
                item.get("sub", "general"), item["price"], item["u"],
                item["uq"], item["rt"], item["rc"],
                kw=item.get("kw"), syn=item.get("syn"),
                dietary=item.get("dietary", {"veg"}),
                allergen=item.get("allergen"),
                occ=item.get("occ", {"everyday"}),
                reviews=item.get("rv"),
            )
            variants.append(p)

    # ---------------------------------------------------------------
    # Auto-generate pack-size variants for FMCG categories
    # Creates "value pack" (2x size, 1.8x price) and "economy pack"
    # (0.5x size, 0.6x price) variants from base products.
    # ---------------------------------------------------------------
    _pack_categories = {
        "grains", "dairy", "snacks", "beverages", "spices", "oils",
        "cleaning", "hygiene", "instant_food", "breakfast",
    }
    base_getters = {
        "grains": _grains, "dairy": _dairy, "snacks": _snacks, "beverages": _beverages,
        "spices": _spices, "oils": _oils, "cleaning": _cleaning, "hygiene": _hygiene,
        "instant_food": _instant_food, "breakfast": _breakfast,
        "frozen": _frozen, "bakery": _bakery, "party_supplies": _party_supplies,
    }
    existing_skus = {p["sku"] for p in variants}
    sku_counter = 100  # Start suffix at 100 for auto-generated

    for cat_name, getter_fn in base_getters.items():
        prefix = _prefix_map.get(cat_name, cat_name[:3].upper())
        base_items = getter_fn()
        for item in base_items:
            # Value pack: 2x size, 1.8x price
            vp_sku = f"SKU-{prefix}-V{sku_counter}"
            sku_counter += 1
            vp_name = f"{item['name']} value pack"
            vp_price = int(float(item["price_inr"]) * 1.8)
            vp_uq = float(item["unit_quantity"]) * 2
            vp = _p(
                vp_sku, vp_name, item["brand"], cat_name, item["subcategory"],
                vp_price, item["unit"], vp_uq,
                float(item["rating"]), item["review_count"],
                kw=item.get("keywords"), syn=item.get("synonyms"),
                dietary=item.get("dietary_tags", set()),
                allergen=item.get("allergen_tags"),
                occ=item.get("occasion_tags", {"everyday"}),
                reviews=item.get("review_preview"),
            )
            if vp_sku not in existing_skus:
                variants.append(vp)
                existing_skus.add(vp_sku)

            # Economy pack: 0.5x size, 0.6x price
            ep_sku = f"SKU-{prefix}-E{sku_counter}"
            sku_counter += 1
            ep_name = f"{item['name']} small pack"
            ep_price = max(5, int(float(item["price_inr"]) * 0.6))
            ep_uq = max(1, float(item["unit_quantity"]) * 0.5)
            ep = _p(
                ep_sku, ep_name, item["brand"], cat_name, item["subcategory"],
                ep_price, item["unit"], ep_uq,
                float(item["rating"]) - 0.1, item["review_count"],
                kw=item.get("keywords"), syn=item.get("synonyms"),
                dietary=item.get("dietary_tags", set()),
                allergen=item.get("allergen_tags"),
                occ=item.get("occasion_tags", {"everyday"}),
                reviews=item.get("review_preview"),
            )
            if ep_sku not in existing_skus:
                variants.append(ep)
                existing_skus.add(ep_sku)

    return variants


def _electronics() -> list[dict]:
    """Electronics: smartphones, laptops, headphones for NL search demo."""
    return [
        _p("SKU-ELC-001", "samsung galaxy s24 ultra", "Samsung", "electronics", "smartphone",
           124999, "piece", 1, 4.7, 2340,
           kw={"phone", "smartphone", "samsung", "galaxy", "android", "5g", "flagship", "camera"},
           syn={"mobile", "cell phone", "handset"},
           occ={"everyday", "gaming", "photography"}),
        _p("SKU-ELC-002", "iphone 15 pro max", "Apple", "electronics", "smartphone",
           159900, "piece", 1, 4.8, 3100,
           kw={"phone", "smartphone", "iphone", "apple", "ios", "5g", "flagship", "camera"},
           syn={"mobile", "cell phone"},
           occ={"everyday", "photography", "video"}),
        _p("SKU-ELC-003", "oneplus 12", "OnePlus", "electronics", "smartphone",
           64999, "piece", 1, 4.6, 1850,
           kw={"phone", "smartphone", "oneplus", "android", "5g", "fast charging", "gaming"},
           syn={"mobile", "cell phone"},
           occ={"everyday", "gaming"}),
        _p("SKU-ELC-004", "samsung galaxy a54 5g", "Samsung", "electronics", "smartphone",
           32999, "piece", 1, 4.4, 4200,
           kw={"phone", "smartphone", "samsung", "5g", "mid-range", "value", "water resistant"},
           syn={"mobile", "cell phone"},
           occ={"everyday"}),
        _p("SKU-ELC-005", "realme narzo 60 5g", "Realme", "electronics", "smartphone",
           14999, "piece", 1, 4.2, 5600,
           kw={"phone", "smartphone", "realme", "5g", "budget", "battery", "gaming"},
           syn={"mobile", "cell phone", "sasta phone"},
           occ={"everyday", "budget"}),
        _p("SKU-ELC-006", "poco x5 pro 5g", "Poco", "electronics", "smartphone",
           18999, "piece", 1, 4.3, 8900,
           kw={"phone", "smartphone", "poco", "xiaomi", "5g", "budget", "camera", "108mp"},
           syn={"mobile", "cell phone"},
           occ={"everyday", "gaming", "photography"}),
        _p("SKU-ELC-007", "redmi note 13 pro plus 5g", "Redmi", "electronics", "smartphone",
           29999, "piece", 1, 4.5, 3400,
           kw={"phone", "smartphone", "redmi", "xiaomi", "5g", "camera", "200mp", "fast charging"},
           syn={"mobile", "cell phone"},
           occ={"everyday", "photography"}),
        # Laptops
        _p("SKU-ELC-010", "macbook air m3", "Apple", "electronics", "laptop",
           114900, "piece", 1, 4.8, 1200,
           kw={"laptop", "macbook", "apple", "ultrabook", "coding", "programming", "portable"},
           syn={"notebook", "computer"},
           occ={"office", "coding", "student"}),
        _p("SKU-ELC-011", "hp pavilion 15 2024", "HP", "electronics", "laptop",
           54999, "piece", 1, 4.3, 2800,
           kw={"laptop", "hp", "pavilion", "coding", "office", "student", "mainstream"},
           syn={"notebook", "computer"},
           occ={"office", "coding", "student"}),
        _p("SKU-ELC-012", "lenovo ideapad slim 3", "Lenovo", "electronics", "laptop",
           34999, "piece", 1, 4.1, 5400,
           kw={"laptop", "lenovo", "ideapad", "budget", "student", "lightweight", "amd"},
           syn={"notebook", "computer", "sasta laptop"},
           occ={"student", "office"}),
        _p("SKU-ELC-013", "asus rog strix g16 gaming laptop", "ASUS", "electronics", "laptop",
           109990, "piece", 1, 4.6, 980,
           kw={"laptop", "asus", "rog", "gaming", "rtx", "high performance", "esports"},
           syn={"gaming laptop", "notebook"},
           occ={"gaming", "esports"}),
        _p("SKU-ELC-014", "dell inspiron 15", "Dell", "electronics", "laptop",
           45999, "piece", 1, 4.2, 3600,
           kw={"laptop", "dell", "inspiron", "office", "coding", "student", "reliable"},
           syn={"notebook", "computer"},
           occ={"office", "coding", "student"}),
        _p("SKU-ELC-015", "acer nitro v gaming laptop", "Acer", "electronics", "laptop",
           67990, "piece", 1, 4.3, 1500,
           kw={"laptop", "acer", "nitro", "gaming", "rtx", "budget gaming"},
           syn={"gaming laptop", "notebook"},
           occ={"gaming"}),
        # Headphones
        _p("SKU-ELC-020", "sony wh-1000xm5 headphones", "Sony", "electronics", "headphones",
           29990, "piece", 1, 4.7, 4500,
           kw={"headphones", "wireless", "noise cancellation", "anc", "bluetooth", "sony", "over-ear"},
           syn={"earphone", "headset"},
           occ={"travel", "work from home", "music"}),
        _p("SKU-ELC-021", "apple airpods pro 2", "Apple", "electronics", "earbuds",
           24900, "piece", 1, 4.8, 6200,
           kw={"earbuds", "wireless", "noise cancellation", "anc", "bluetooth", "apple", "airpods"},
           syn={"earphone", "headphone"},
           occ={"travel", "music", "calls"}),
        _p("SKU-ELC-022", "boat rockerz 550 wireless headphones", "boAt", "electronics", "headphones",
           1499, "piece", 1, 4.1, 45000,
           kw={"headphones", "wireless", "bluetooth", "boat", "budget", "bass", "over-ear"},
           syn={"earphone", "headset"},
           occ={"gym", "music", "casual"}),
        _p("SKU-ELC-023", "jbl tune 760nc noise cancelling headphones", "JBL", "electronics", "headphones",
           4999, "piece", 1, 4.3, 8900,
           kw={"headphones", "wireless", "noise cancellation", "anc", "jbl", "bluetooth", "value"},
           syn={"earphone", "headset"},
           occ={"travel", "music", "office"}),
        _p("SKU-ELC-024", "oneplus buds pro 2", "OnePlus", "electronics", "earbuds",
           11999, "piece", 1, 4.4, 2100,
           kw={"earbuds", "wireless", "noise cancellation", "anc", "bluetooth", "oneplus"},
           syn={"earphone", "headphone"},
           occ={"music", "calls"}),
        _p("SKU-ELC-025", "noise buds vs104 earbuds", "Noise", "electronics", "earbuds",
           999, "piece", 1, 3.9, 52000,
           kw={"earbuds", "wireless", "bluetooth", "budget", "noise", "gym", "value"},
           syn={"earphone", "headphone", "saste earbuds"},
           occ={"gym", "daily use"}),
    ]


# ---------------------------------------------------------------------------
# Assemble All Products
# ---------------------------------------------------------------------------
def get_all_v2_products() -> list[dict]:
    """Get the complete V2 product catalog (500+ products)."""
    products = []
    # Base products (~97)
    products.extend(_grains())
    products.extend(_dairy())
    products.extend(_snacks())
    products.extend(_beverages())
    products.extend(_spices())
    products.extend(_oils())
    products.extend(_vegetables())
    products.extend(_instant_food())
    products.extend(_cleaning())
    products.extend(_hygiene())
    products.extend(_bakery())
    products.extend(_frozen())
    products.extend(_stationery())
    products.extend(_party_supplies())
    products.extend(_personal_care())
    products.extend(_non_veg())
    # New categories from plan
    products.extend(_fruits())
    products.extend(_breakfast())
    products.extend(_baby())
    products.extend(_pet())
    products.extend(_fashion_men())
    products.extend(_fashion_women())
    products.extend(_fashion_kids())
    products.extend(_footwear())
    products.extend(_accessories())
    products.extend(_medicines_otc())
    # Electronics for NL search demo
    products.extend(_electronics())
    # Variant products to reach 500+
    products.extend(_generate_variant_products())
    return products


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    from app.catalog.health_scorer import calculate_health_score
    
    products = get_all_v2_products()
    
    # Calculate health scores for products with nutritional data
    for product in products:
        if any([
            product.get("calories_per_100"),
            product.get("sugar_per_100"),
            product.get("protein_per_100"),
        ]):
            health_score, health_badge = calculate_health_score(
                calories_per_100=product.get("calories_per_100"),
                protein_per_100=product.get("protein_per_100"),
                carbs_per_100=product.get("carbs_per_100"),
                sugar_per_100=product.get("sugar_per_100"),
                fat_per_100=product.get("fat_per_100"),
                saturated_fat_per_100=product.get("saturated_fat_per_100"),
                fiber_per_100=product.get("fiber_per_100"),
                sodium_per_100=product.get("sodium_per_100"),
                category=product.get("category", ""),
            )
            if health_score is not None:
                product["health_score"] = health_score

    # Validate: no duplicate SKUs
    skus = [p["sku"] for p in products]
    duplicates = [s for s in skus if skus.count(s) > 1]
    if duplicates:
        print(f"ERROR: Duplicate SKUs found: {set(duplicates)}")
        sys.exit(1)

    print(f"[OK] Generated {len(products)} products across {len(set(p['category'] for p in products))} categories")
    print(f"  Categories: {sorted(set(p['category'] for p in products))}")
    
    # Print health score stats
    health_scored_products = [p for p in products if p.get("health_score") is not None]
    if health_scored_products:
        print(f"  Health scored products: {len(health_scored_products)}")

    if "--mock" in sys.argv:
        print("Mock mode: validation only, not seeding.")
        return

    if "--json" in sys.argv:
        # Output as JSON for local use
        import json

        class DecimalEncoder(json.JSONEncoder):
            def default(self, o):
                if isinstance(o, Decimal):
                    return float(o)
                if isinstance(o, set):
                    return list(o)
                return super().default(o)

        print(json.dumps(products, cls=DecimalEncoder, indent=2))
        return

    # Seed to DynamoDB
    try:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
        table = dynamodb.Table("ProductCatalog")

        print("Seeding to DynamoDB...")
        for i, product in enumerate(products):
            # Convert sets to lists for DynamoDB
            item = {}
            for k, v in product.items():
                if isinstance(v, set):
                    item[k] = list(v) if v else []
                else:
                    item[k] = v
            table.put_item(Item=item)

            if (i + 1) % 50 == 0:
                print(f"  Seeded {i + 1}/{len(products)}...")

        print(f"[OK] Seeded {len(products)} products to DynamoDB")

    except Exception as e:
        print(f"DynamoDB seeding failed: {e}")
        print("Products validated successfully. Use --json for local output.")


if __name__ == "__main__":
    main()
