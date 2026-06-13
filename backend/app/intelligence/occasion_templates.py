"""
OccasionCart Templates — Predefined shopping templates for common Indian scenarios.

Each template includes a prompt template, default attendees, budget, and relevant
product categories. The frontend renders these as clickable cards; selecting one
auto-fills the chat prompt and triggers /api/parse.

Person C owns this file.
"""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class OccasionTemplate(BaseModel):
    """A predefined occasion template shown to users."""
    id: str
    name: str
    emoji: str
    description: str
    prompt_template: str
    default_attendees: int = 4
    default_budget_inr: int = 2000
    categories: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    blueprint: list[dict] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------
OCCASION_TEMPLATES: list[OccasionTemplate] = [
    OccasionTemplate(
        id="ipl_watch_party",
        name="IPL Watch Party",
        emoji="🏏",
        description="Snacks, drinks, and disposables for a cricket viewing party.",
        prompt_template="IPL watch party for {attendees} people, budget ₹{budget}. Need snacks like chips, namkeen, popcorn, cold drinks, paper cups, paper plates, and some finger food.",
        default_attendees=10,
        default_budget_inr=2000,
        categories=["snacks", "beverages", "disposables"],
        tags=["sports", "party", "cricket"],
        blueprint=[
            {"name": "Potato Chips", "quantity": 4, "unit": "pack", "category": "snacks", "optional": False},
            {"name": "Cola", "quantity": 2, "unit": "bottle", "category": "beverages", "optional": False},
            {"name": "Paper Cups", "quantity": 1, "unit": "pack", "category": "disposables", "optional": False},
            {"name": "Paper Plates", "quantity": 1, "unit": "pack", "category": "disposables", "optional": False},
            {"name": "Popcorn", "quantity": 2, "unit": "pack", "category": "snacks", "optional": False},
            {"name": "Namkeen Mix", "quantity": 2, "unit": "pack", "category": "snacks", "optional": False},
        ]
    ),
    OccasionTemplate(
        id="birthday_party",
        name="Birthday Party",
        emoji="🎂",
        description="Cake supplies, decorations, snacks, and party essentials.",
        prompt_template="Birthday party for {attendees} people, budget ₹{budget}. Need cake mix or ready cake, candles, balloons, streamers, party hats, juice boxes, chips, sandwiches, paper plates, napkins.",
        default_attendees=15,
        default_budget_inr=3000,
        categories=["snacks", "beverages", "bakery", "decorations", "disposables"],
        tags=["celebration", "kids", "party"],
        blueprint=[
            {"name": "Chocolate Cake", "quantity": 1, "unit": "piece", "category": "bakery", "optional": False},
            {"name": "Birthday Candles", "quantity": 1, "unit": "pack", "category": "decorations", "optional": False},
            {"name": "Balloons", "quantity": 2, "unit": "pack", "category": "decorations", "optional": False},
            {"name": "Party Hats", "quantity": 2, "unit": "pack", "category": "decorations", "optional": False},
            {"name": "Juice Boxes", "quantity": 3, "unit": "pack", "category": "beverages", "optional": False},
            {"name": "Potato Chips", "quantity": 3, "unit": "pack", "category": "snacks", "optional": False},
            {"name": "Paper Plates", "quantity": 2, "unit": "pack", "category": "disposables", "optional": False},
        ]
    ),
    OccasionTemplate(
        id="weekly_grocery",
        name="Weekly Grocery",
        emoji="🛒",
        description="Staples, vegetables, dairy, and pantry essentials for the week.",
        prompt_template="Weekly grocery shopping for a family of {attendees} people, budget ₹{budget}. Need rice, dal, atta, cooking oil, milk, bread, eggs, onions, tomatoes, potatoes, seasonal vegetables, tea, sugar, salt, spices.",
        default_attendees=4,
        default_budget_inr=2500,
        categories=["grains", "dairy", "vegetables", "spices", "oils"],
        tags=["weekly", "family", "essentials"],
        blueprint=[
            {"name": "Basmati Rice", "quantity": 5, "unit": "kg", "category": "grains", "optional": False},
            {"name": "Toor Dal", "quantity": 1, "unit": "kg", "category": "grains", "optional": False},
            {"name": "Whole Wheat Atta", "quantity": 5, "unit": "kg", "category": "grains", "optional": False},
            {"name": "Sunflower Oil", "quantity": 1, "unit": "L", "category": "oils", "optional": False},
            {"name": "Milk", "quantity": 2, "unit": "L", "category": "dairy", "optional": False},
            {"name": "Eggs", "quantity": 1, "unit": "pack", "category": "dairy", "optional": False},
            {"name": "Onions", "quantity": 2, "unit": "kg", "category": "vegetables", "optional": False},
            {"name": "Tomatoes", "quantity": 1, "unit": "kg", "category": "vegetables", "optional": False},
            {"name": "Potatoes", "quantity": 2, "unit": "kg", "category": "vegetables", "optional": False},
            {"name": "Tea Powder", "quantity": 1, "unit": "pack", "category": "spices", "optional": False},
            {"name": "Sugar", "quantity": 1, "unit": "kg", "category": "spices", "optional": False},
        ]
    ),
    OccasionTemplate(
        id="hostel_restock",
        name="Hostel Restock",
        emoji="🏠",
        description="Quick meals, snacks, and hygiene essentials for hostel life.",
        prompt_template="Monthly hostel restock for {attendees} person, budget ₹{budget}. Need instant noodles, biscuits, peanut butter, bread, jam, milk powder, tea bags, soap, shampoo, toothpaste, washing powder, snacks.",
        default_attendees=1,
        default_budget_inr=1500,
        categories=["snacks", "beverages", "hygiene", "instant_food"],
        tags=["student", "hostel", "monthly"],
    ),
    OccasionTemplate(
        id="travel_essentials",
        name="Travel Essentials",
        emoji="✈️",
        description="Packing must-haves for a trip — toiletries, snacks, meds.",
        prompt_template="Travel packing list for {attendees} people on a 3-day trip, budget ₹{budget}. Need travel-size shampoo, soap, toothpaste, sunscreen, hand sanitizer, bandaids, energy bars, dry snacks, water bottles, tissues, wet wipes.",
        default_attendees=2,
        default_budget_inr=1000,
        categories=["hygiene", "medicines_otc", "snacks"],
        tags=["travel", "trip", "packing"],
    ),
    OccasionTemplate(
        id="diwali_party",
        name="Diwali Celebration",
        emoji="🪔",
        description="Sweets, dry fruits, diyas, and festive essentials for Diwali.",
        prompt_template="Diwali celebration shopping for {attendees} guests, budget ₹{budget}. Need diyas, rangoli colors, sweets box, dry fruits, namkeen, candles, fairy lights, gift wrapping paper, incense sticks.",
        default_attendees=10,
        default_budget_inr=3000,
        categories=["sweets", "dry_fruits", "decorations", "snacks"],
        tags=["festival", "diwali", "celebration"],
    ),
    OccasionTemplate(
        id="holi_party",
        name="Holi Party",
        emoji="🎨",
        description="Colors, water guns, snacks, and thandai for Holi.",
        prompt_template="Holi party for {attendees} people, budget ₹{budget}. Need organic colors (gulal), water balloons, pichkaris, thandai mix, gujiya, namkeen, cold drinks, paper cups, towels.",
        default_attendees=12,
        default_budget_inr=2500,
        categories=["colors", "snacks", "beverages", "disposables"],
        tags=["festival", "holi", "outdoor"],
    ),
    OccasionTemplate(
        id="movie_night",
        name="Movie Night",
        emoji="🎬",
        description="Popcorn, drinks, and cozy snacks for a movie marathon.",
        prompt_template="Movie night for {attendees} people, budget ₹{budget}. Need popcorn kernels, butter, nachos, salsa, cold drinks, candy, ice cream, chips.",
        default_attendees=5,
        default_budget_inr=800,
        categories=["snacks", "beverages"],
        tags=["movie", "night", "casual"],
    ),
    OccasionTemplate(
        id="picnic",
        name="Picnic / Outing",
        emoji="🧺",
        description="Sandwiches, fruits, and picnic-friendly food for outdoors.",
        prompt_template="Picnic for {attendees} people, budget ₹{budget}. Need bread, cheese, jam, fruits, juice, water bottles, chips, cookies, paper plates, napkins, wet wipes, garbage bags.",
        default_attendees=6,
        default_budget_inr=1200,
        categories=["snacks", "fruits", "beverages", "disposables"],
        tags=["outdoor", "family", "weekend"],
    ),
    OccasionTemplate(
        id="new_home_setup",
        name="New Home Setup",
        emoji="🏡",
        description="First apartment essentials — kitchen, cleaning, bathroom.",
        prompt_template="New home setup for {attendees} people, budget ₹{budget}. Need cooking utensils, plates, glasses, cleaning supplies (broom, mop, wiper, dustbin), bathroom essentials (toilet cleaner, soap, towels), kitchen staples (oil, salt, sugar, tea).",
        default_attendees=2,
        default_budget_inr=5000,
        categories=["kitchen", "cleaning", "bathroom", "grains"],
        tags=["home", "setup", "essentials"],
    ),
    OccasionTemplate(
        id="exam_prep",
        name="Exam Prep Supplies",
        emoji="📚",
        description="Brain food, energy snacks, and stationery for exam season.",
        prompt_template="Exam preparation supplies for {attendees} person, budget ₹{budget}. Need energy bars, dry fruits (almonds, walnuts), green tea, coffee, dark chocolate, sticky notes, highlighters, pens, notebooks.",
        default_attendees=1,
        default_budget_inr=800,
        categories=["snacks", "beverages", "stationery"],
        tags=["student", "exam", "focus"],
    ),
    OccasionTemplate(
        id="baby_shower",
        name="Baby Shower",
        emoji="👶",
        description="Gifts, decorations, and party supplies for a baby shower.",
        prompt_template="Baby shower party for {attendees} guests, budget ₹{budget}. Need baby-themed decorations, balloons, pastel streamers, cake, juice, finger sandwiches, party favors, gift wrapping, photo booth props.",
        default_attendees=20,
        default_budget_inr=4000,
        categories=["decorations", "bakery", "snacks", "beverages"],
        tags=["celebration", "baby", "party"],
    ),
]


def get_all_templates() -> list[dict]:
    """Return all occasion templates as dicts for the API."""
    return [t.model_dump() for t in OCCASION_TEMPLATES]


def get_template_by_id(template_id: str) -> OccasionTemplate | None:
    """Look up a single template by ID."""
    for t in OCCASION_TEMPLATES:
        if t.id == template_id:
            return t
    return None


def render_prompt(template_id: str, attendees: int | None = None, budget: int | None = None) -> str | None:
    """Render a template's prompt with the given attendees and budget."""
    t = get_template_by_id(template_id)
    if not t:
        return None
    return t.prompt_template.format(
        attendees=attendees or t.default_attendees,
        budget=budget or t.default_budget_inr,
    )
