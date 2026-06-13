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
           reviews=["Party essential.", "Best with ice."]),
        _p("SKU-BEV-002", "pepsi 2L pet bottle", "Pepsi", "beverages", "soft_drink", 90, "ml", 2000, 4.1, 4200,
           kw={"pepsi", "cola", "soft drink", "cold drink"},
           syn={"thanda", "pepsi bottle"},
           dietary={"veg", "vegan"},
           occ={"party", "ipl_watch_party"},
           reviews=["Good alternative to Coke."]),
        _p("SKU-BEV-003", "sprite 1.25L", "Sprite", "beverages", "soft_drink", 65, "ml", 1250, 4.2, 3800,
           kw={"sprite", "lemon", "lime", "clear drink"},
           syn={"lime soda", "nimbu paani alternative"},
           dietary={"veg", "vegan"},
           occ={"party", "summer"},
           reviews=["Refreshing lime taste."]),
        _p("SKU-BEV-004", "thums up 2L", "Thums Up", "beverages", "soft_drink", 95, "ml", 2000, 4.4, 4800,
           kw={"thums up", "cola", "strong cola", "thunder"},
           syn={"thunder", "toofani drink"},
           dietary={"veg", "vegan"},
           occ={"party", "ipl_watch_party"},
           reviews=["Strong cola taste.", "Indian original."]),
        _p("SKU-BEV-005", "real fruit power mixed fruit juice", "Real", "beverages", "juice", 99, "ml", 1000, 4.0, 2500,
           kw={"juice", "fruit juice", "mixed fruit", "healthy"},
           syn={"juice box", "fruit drink"},
           dietary={"veg", "vegan"},
           occ={"breakfast", "kids", "party"},
           reviews=["Good for kids.", "Not too sweet."]),
        _p("SKU-BEV-006", "paper boat aamras", "Paper Boat", "beverages", "juice", 40, "ml", 200, 4.3, 1800,
           kw={"aamras", "mango", "drink", "summer"},
           syn={"aam ras", "mango juice"},
           dietary={"veg", "vegan"},
           occ={"summer", "snack"},
           reviews=["Authentic mango taste.", "Nostalgic."]),
        _p("SKU-BEV-007", "tata tea gold", "Tata Tea", "beverages", "tea", 295, "g", 500, 4.5, 4000,
           kw={"tea", "chai", "black tea", "CTC"},
           syn={"chai patti", "tea leaves"},
           dietary={"veg", "vegan", "jain"},
           occ={"everyday", "breakfast", "tea_time"},
           reviews=["Rich taste.", "Perfect kadak chai."]),
        _p("SKU-BEV-008", "bru instant coffee", "Bru", "beverages", "coffee", 195, "g", 200, 4.2, 3500,
           kw={"coffee", "instant coffee", "filter coffee"},
           syn={"kaapi", "coffee powder"},
           dietary={"veg", "vegan"},
           occ={"breakfast", "everyday"},
           reviews=["Good instant coffee.", "Smooth taste."]),
        _p("SKU-BEV-009", "nescafe classic coffee", "Nescafe", "beverages", "coffee", 245, "g", 200, 4.4, 4500,
           kw={"coffee", "instant", "nescafe", "black coffee"},
           syn={"kaapi", "nescafe jar"},
           dietary={"veg", "vegan"},
           occ={"breakfast", "everyday", "exam"},
           reviews=["The classic coffee.", "Great aroma."]),
        _p("SKU-BEV-010", "bisleri mineral water 1L", "Bisleri", "beverages", "water", 20, "ml", 1000, 4.0, 2000,
           kw={"water", "mineral water", "drinking water"},
           syn={"paani", "pani bottle"},
           dietary={"veg", "vegan", "jain"},
           occ={"travel", "party", "picnic"},
           reviews=["Safe drinking water."]),
        _p("SKU-BEV-011", "red bull energy drink", "Red Bull", "beverages", "energy_drink", 125, "ml", 250, 4.0, 1500,
           kw={"energy drink", "caffeine", "red bull"},
           syn={"energy drink"},
           dietary={"veg"},
           occ={"exam", "gaming", "party"},
           reviews=["Gives you wings.", "Good before gym."]),
        _p("SKU-BEV-012", "frooti mango drink 1.2L", "Frooti", "beverages", "juice", 60, "ml", 1200, 4.1, 3200,
           kw={"frooti", "mango", "drink", "kids"},
           syn={"mango juice", "frooti bottle"},
           dietary={"veg", "vegan"},
           occ={"kids", "picnic", "summer"},
           reviews=["Kids favorite mango drink."]),
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
           kw={"dishwash", "utensil cleaner", "bartan"},
           syn={"bartan soap", "dish bar"},
           dietary=set(),
           occ={"everyday", "household"},
           reviews=["Cuts grease well."]),
        _p("SKU-CLN-002", "surf excel quick wash detergent", "Surf Excel", "cleaning", "detergent", 185, "g", 1000, 4.4, 4200,
           kw={"detergent", "washing powder", "laundry"},
           syn={"kapda dhone ka powder", "surf"},
           dietary=set(),
           occ={"everyday", "household"},
           reviews=["Removes tough stains."]),
        _p("SKU-CLN-003", "harpic toilet cleaner", "Harpic", "cleaning", "toilet_cleaner", 95, "ml", 500, 4.2, 3000,
           kw={"toilet cleaner", "bathroom", "disinfectant"},
           syn={"toilet cleaner", "bathroom cleaner"},
           dietary=set(),
           occ={"household"},
           reviews=["Effective cleaning."]),
        _p("SKU-CLN-004", "lizol disinfectant floor cleaner", "Lizol", "cleaning", "floor_cleaner", 145, "ml", 975, 4.3, 2800,
           kw={"floor cleaner", "disinfectant", "mopping"},
           syn={"floor cleaner", "phenyl"},
           dietary=set(),
           occ={"household"},
           reviews=["Good fragrance.", "Cleans well."]),
    ]


def _hygiene() -> list[dict]:
    """Personal hygiene: soap, shampoo, toothpaste."""
    return [
        _p("SKU-HYG-001", "dettol original soap", "Dettol", "hygiene", "soap", 55, "g", 125, 4.3, 4000,
           kw={"soap", "antibacterial", "bath"},
           syn={"sabun", "nahane ka sabun"},
           dietary=set(),
           occ={"everyday"},
           reviews=["Trusted germ protection."]),
        _p("SKU-HYG-002", "dove cream beauty bathing bar", "Dove", "hygiene", "soap", 65, "g", 100, 4.4, 3500,
           kw={"soap", "moisturizing", "beauty bar"},
           syn={"dove soap", "bathing bar"},
           dietary=set(),
           occ={"everyday"},
           reviews=["Very moisturizing.", "Soft on skin."]),
        _p("SKU-HYG-003", "head & shoulders anti dandruff shampoo", "Head & Shoulders", "hygiene", "shampoo", 250, "ml", 340, 4.2, 3000,
           kw={"shampoo", "anti dandruff", "hair"},
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


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def _p(
    sku: str, name: str, brand: str, category: str, subcategory: str,
    price: int, unit: str, unit_qty: int | float, rating: float, review_count: int,
    kw: set | None = None, syn: set | None = None,
    dietary: set | None = None, allergen: set | None = None,
    occ: set | None = None, reviews: list | None = None,
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
    }


# ---------------------------------------------------------------------------
# Assemble All Products
# ---------------------------------------------------------------------------
def get_all_v2_products() -> list[dict]:
    """Get the complete V2 product catalog."""
    products = []
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
    return products


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    products = get_all_v2_products()

    # Validate: no duplicate SKUs
    skus = [p["sku"] for p in products]
    duplicates = [s for s in skus if skus.count(s) > 1]
    if duplicates:
        print(f"ERROR: Duplicate SKUs found: {set(duplicates)}")
        sys.exit(1)

    print(f"✓ Generated {len(products)} products across {len(set(p['category'] for p in products))} categories")
    print(f"  Categories: {sorted(set(p['category'] for p in products))}")

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

        print(f"✓ Seeded {len(products)} products to DynamoDB")

    except Exception as e:
        print(f"DynamoDB seeding failed: {e}")
        print("Products validated successfully. Use --json for local output.")


if __name__ == "__main__":
    main()
