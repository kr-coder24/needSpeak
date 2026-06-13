# needSpeak Comprehensive Manual Test Suite (Live Gemini API)

This document provides 25 step-by-step manual test cases to verify all features of the **needSpeak** platform using the **Live Google Gemini API**. 

Since we are running in Live Mode, the platform will use real LLM processing. This allows you to test true Natural Language Understanding, Hindi/Hinglish parsing, dynamic Multi-Intent Decomposition, and live URL Scraping which were restricted in Mock Mode.

---

## 🛠 Setup & Prerequisites

1. Open `backend/.env` and ensure the following are set:
   ```env
   MOCK_MODE=0
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=your_actual_api_key_here
   ```
2. Restart the Backend if it was already running: `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`
3. Start Frontend: `cd frontend && npm run dev`
4. Open the UI at `http://localhost:5173`. Ensure the Mock Mode icon in the header is **off**.

---

## 🧠 Phase 1: True NLP & Core Intent Engine
*Goal: Verify the LLM can parse messy, unstructured, real-world text into structured JSON.*

### Test 1: Unstructured Grocery List
* **Action**: Enter `Hey, I need some rice, a few onions, salt, and maybe some snacks if you can find them.`
* **Verify**: The cart extracts the items correctly, ignoring filler words like "Hey", "maybe", and "if you can find them."

### Test 2: Implicit Quantities
* **Action**: Enter `I need to bake a cake, get me a dozen eggs, some milk, a bag of flour, and sugar.`
* **Verify**: The LLM infers standard quantities (e.g., 12 pieces for eggs, 1 pack for flour).

### Test 3: Complex Indian Recipe Extraction
* **Action**: Enter `I am making Palak Paneer for 4 people tonight.`
* **Verify**: The LLM autonomously knows the ingredients for Palak Paneer (spinach, paneer, garlic, spices) and scales it for 4 servings.

### Test 4: Hardware / DIY Scenario
* **Action**: Enter `My sink pipe is leaking badly, what do I need to fix it?`
* **Verify**: The LLM infers the required tools (wrench, plumbers tape, sealant) and sets `IntentType` to `DIY`.

### Test 5: Stationery / Supplies Scenario
* **Action**: Enter `My kid is starting 5th grade tomorrow, need school supplies.`
* **Verify**: The LLM infers standard 5th-grade supplies (notebooks, pens, pencils, ruler) under the `SUPPLIES` intent.

---

## 🌐 Phase 2: Live Web & Video Scraping
*Goal: Verify the system can extract ingredients directly from external URLs.*

### Test 6: Standard Recipe Blog URL
* **Action**: Enter a live recipe URL, e.g., `https://www.indianhealthyrecipes.com/chana-masala/`
* **Verify**: The backend scrapes the webpage text, and Gemini extracts the exact ingredients listed on the page.

### Test 7: YouTube Transcript Scraping
* **Action**: Enter a cooking video URL, e.g., `https://www.youtube.com/watch?v=A_oNqGtvJ54`
* **Verify**: The backend fetches the closed captions (transcript), and Gemini extracts the ingredients mentioned by the chef.

### Test 8: Mixed Text & URL
* **Action**: Enter `Make this recipe https://www.indianhealthyrecipes.com/dal-makhani/ and also get me some dish soap.`
* **Verify**: The system processes both the scraped recipe ingredients AND the dish soap request seamlessly.

---

## 🇮🇳 Phase 3: Hindi & Hinglish Support
*Goal: Verify localized language capabilities using Gemini.*

### Test 9: Pure Hindi (Devanagari)
* **Action**: Enter `मुझे ४ लोगो के लिए पाव भाजी बनानी है, सामान ले आओ।`
* **Verify**: The LLM extracts Pav, Butter, Potatoes, Tomatoes, Onions, and Pav Bhaji Masala.

### Test 10: Hinglish (Roman Script)
* **Action**: Enter `bhai aaj raat ko biryani banani hai dosto ke liye, sabzi aur masale likh de.`
* **Verify**: Extracts Biryani ingredients (Rice, Vegetables/Meat, Spices) accurately.

### Test 11: Mixed English & Hindi
* **Action**: Enter `Need to clean the house, get phool jhadu, pocha, and some floor cleaner liquid.`
* **Verify**: Translates and maps "phool jhadu" (broom) and "pocha" (mop) appropriately to catalog items.

---

## 🔀 Phase 4: Multi-Intent Decomposition (Phase 5 Feature)
*Goal: Verify the LLM can split completely disjointed tasks into separate shopping carts.*

### Test 12: Dual Disjoint Intents
* **Action**: Enter `I am going on a camping trip this weekend so I need a tent and flashlight. Also, we are having pasta for dinner tonight.`
* **Verify**: The UI displays **Two separate categories/tabs**:
  1. `GENERAL`/`SUPPLIES` intent containing Tent and Flashlight.
  2. `RECIPE` intent containing Pasta, Sauce, Cheese.

### Test 13: Triple Intents
* **Action**: Enter `Get me some paracetamol for my headache, ingredients for a chocolate cake, and a new notebook.`
* **Verify**: Cart splits into 3 intents: `MEDICAL`, `RECIPE`, and `SUPPLIES`.

---

## 🤔 Phase 5: Confidence Layer & Ambiguity
*Goal: Verify the LLM detects when a request is too vague to fulfill confidently.*

### Test 14: Broad Ambiguous Request
* **Action**: Enter `I have guests coming over, get some stuff.`
* **Verify**: The AI sets confidence to "low", does NOT build a cart, and replies asking: *"What kind of guests? Are you serving dinner, snacks, or drinks?"*

### Test 15: Resolving Ambiguity
* **Action**: (Not currently supported in a single session without memory, but verify the UI handles the question gracefully without crashing the cart panel).

---

## ⚖️ Phase 6: Quantity Engine (Arbitrary to Metric)
*Goal: Verify the LLM normalizes fuzzy human units into standard metric formats.*

### Test 16: Fuzzy Volumes
* **Action**: Enter `I need a pinch of saffron and a handful of almonds.`
* **Verify**: Gemini normalizes these to small gram weights (e.g., 1g saffron, 50g almonds).

### Test 17: American to Metric
* **Action**: Enter `1 pound of chicken and 2 sticks of butter.`
* **Verify**: Normalizes to approx 450g chicken and 200g butter.

---

## 💰 Phase 7: GoalCart (Budget Optimization)
*Goal: Verify the deterministic resolver enforces budget constraints on LLM outputs.*

### Test 18: High Budget
* **Action**: Set the UI Budget input to `3000` and enter `I am throwing a luxury dinner party`.
* **Verify**: High-quality or branded items are selected. No substitutions are flagged.

### Test 19: Strict Budget Substitution
* **Action**: Set the UI Budget input to `300` and enter `Ingredients for butter chicken`.
* **Verify**: The backend resolver swaps premium brands for cheaper alternatives. The UI highlights them in green as "Substituted" with a saved money reasoning.

### Test 20: Impossible Budget Handling
* **Action**: Set the UI Budget to `50` and enter `I need a new washing machine`.
* **Verify**: The system fails gracefully, either listing it as unavailable, or showing a massive budget overrun warning without crashing.

---

## 🛡️ Phase 8: Preference Constraints
*Goal: Verify LLM respects specific dietary or brand requests.*

### Test 21: Brand Lock-in
* **Action**: Enter `I only want Amul butter and Britannia biscuits.`
* **Verify**: The extracted items specify the brand, and the resolver attempts to match those exact brands over generics.

### Test 22: Dietary Constraints
* **Action**: Enter `I want to make a vegan pizza.`
* **Verify**: Gemini substitutes dairy cheese for vegan cheese and meat for plant-based alternatives *before* it hits the resolver.

---

## 🖱 Phase 9: ReviewCart (Frontend Interactive Features)
*Goal: Verify the human-in-the-loop interactions on the generated cart.*

### Test 23: UI Increment / Decrement
* **Action**: Click the `+` and `-` buttons on an item in the cart.
* **Verify**: The unit count changes, and the overall Cart Total Price updates instantly in the UI.

### Test 24: UI Delete Item
* **Action**: Click the Trash/Delete icon next to an item.
* **Verify**: The item is completely removed from the cart, and the total price recalculates.

### Test 25: Checkout Flow
* **Action**: Click the "Proceed to checkout" button.
* **Verify**: A success toast/alert appears confirming the final modified cart list.
