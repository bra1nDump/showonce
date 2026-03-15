# Workflow: Manheim Deal Finder

**User**: Used car dealer
**Goal**: Find cars on Manheim listed below market value by a target percentage
**Status**: 🟡 Observed login + search + vehicle detail flow

## Workflow Steps (Draft)

### Step 1: Search Manheim
- **App**: Chrome (profile: ******** — already logged in, do NOT relaunch)
- **URL**: `home.manheim.com/landingPage`
- **Action**: Search with zip code **91607**, radius **250 miles**
- **Note**: User is already authenticated — no login step needed in automation
- **Status**: ✅ Observed

### Step 2: Browse & Filter Listings
- **App**: Chrome — Manheim search results
- **URL pattern**: `landingPage#/results/{search-id}`
- **Action**: Scroll through results, apply mental filters:
  - Year ≥ 2016 (prefer 2020+)
  - Ask price < Adj MMR average
  - Skip SALVAGE titles
  - Look for cars WITH damage (lower CR = potential margin)
- **Data captured per listing**: Year, make, model, trim, mileage, ask price, MMR range + avg, CR score, title flags
- **Status**: ✅ Observed

### Step 3: Review Condition Report (FILTER)
- **App**: Chrome — Manheim vehicle detail page
- **Action**: Check condition score, damage photos, structural status, tire ratings, Carfax
- **Decision**: If damage is too severe (structural, engine problems) → skip. If cosmetic/fixable → proceed to KBB.
- **Key data points checked**:
  - Overall condition score (e.g. 4.8 = Clean, 2.8 = Below Average)
  - Structural damage (yes/no) — SKIP if yes
  - Exterior/interior damage list + severity (light scratch vs heavy scratch)
  - Damage photos (tagged DMG)
  - Tire ratings
  - Owner count, accident history
  - Announcements (Engine Problem, Frame Damage = red flags)
  - Title status — must be clean
- **Status**: ✅ Observed

### Step 4: Cross-Reference on KBB
- **App**: Chrome — kbb.com
- **Action**: Look up same car (year/make/model/trim/mileage) on Kelley Blue Book
- **Data captured**: KBB fair market value **for that car's condition**
- **Purpose**: Independent valuation — is the Manheim price actually a deal vs retail?
- **Status**: ⏳ Waiting to observe KBB step

### Step 5: Build Shortlist & Recommend Max Bid
- **App**: Currently mental / manual
- **Action**: Compare Manheim ask vs KBB value, calculate recommended max bid price
- **Output**: Table of good deals with:
  - Car details (year/make/model/miles)
  - Manheim ask price
  - MMR average
  - KBB fair value (condition-adjusted)
  - Recommended max bid (to ensure profit after repair + resale)
- **What happens next?**: Place bid on Manheim or save for later
- **Status**: ⏳ Waiting for demo

## Deal Criteria (confirmed by user)

| Criterion | Rule |
|-----------|------|
| **Price** | Below adjusted MMR (Manheim Market Report average) |
| **Year** | 2016 or newer; **2020+ preferred** |
| **Title** | Clean title ONLY (skip salvage/rebuilt/absent) |
| **Damage** | Cars WITH visible or listed damage are OK (that's where margin lives) |
| **Location** | Zip 91607, 250-mile radius |

## Open Questions
- [x] Where does market value come from? → KBB (kbb.com) for condition + market value
- [x] What percentage below market value triggers a "deal"? → 10% (multiply by 0.9)
- [ ] How many cars do they typically scan per session?
- [x] Do they filter by specific makes/models or scan everything? → Filter by zip 91607, 250mi radius
- [x] Do they have a Manheim account we can automate login for? → Yes, observed login with dealer ID *****
- [ ] What do they do AFTER finding a deal? (Bid? Add to list? Call someone?)
- [x] Does user agree to use MMR instead of FB Marketplace? → User prefers KBB
- [x] Year filter? → 2016+, prefer 2020+
- [x] Title requirements? → Clean only
- [x] Damage tolerance? → Damage OK (cosmetic damage = lower price = deal potential)

## Screen Observations Log

### Session: 2026-03-14 ~18:10 PDT

1. **Login**: User navigated to `auth.manheim.com`, entered credentials (dealer ID starting with `****`), submitted login form
2. **Landing page**: Arrived at `home.manheim.com/landingPage` — got an error on first try, retried by typing "man" in address bar
3. **Search results**: Navigated to saved search results: `landingPage#/results/13d35c53-f3e7-4c0b-9236-d771e014615a`
4. **Vehicle detail**: Clicked into a specific listing: `landingPage#/details/2HGFE2F58SH572363/OVE`
   - VIN: `2HGFE2F58SH572363` (Honda Civic, ~2025 model year)
   - Source: OVE (Manheim's online auction platform)
5. **Browsed details**: Clicked around the detail page (multiple clicks at different positions — likely reviewing condition, price, photos)
6. **Back to results**: Returned to browse more listings

### Session: 2026-03-14 ~18:53 PDT

1. **Voice confirmed workflow**: User wants to automate daily deal sourcing — check Manheim listings, compare against KBB values, find cars priced below market.
2. **Vehicle detail**: Navigated to `landingPage#/details/2HGFC2F73HH512264/OVE`
   - VIN: `2HGFC2F73HH512264` (Honda Civic, ~2017 model year)
   - Source: OVE
3. **Vehicle detail**: Clicked into Honda Accord listing — full OCR captured:
   - **Car**: 2020 Honda Accord Sedan LX 1.5T, 71,079 mi, FWD, 1.5L Turbo, CVT
   - **MMR**: $17,750 - $20,100 range, avg $18,950
   - **Buy Now**: $18,599 | **Bid**: $18,299 (0 bids, starting bid = floor)
   - **Condition**: 4.8 Clean, no structural damage
   - **Damage**: Front bumper heavy scratch, rear bumper light scratch
   - **History**: 1 owner, 0 accidents
   - **Location**: Las Vegas, NV (at dealership)
   - **Seller**: Las Vegas Auto Sports
   - User is reviewing photos (especially damage images) and condition details

### Session: 2026-03-14 ~19:08 PDT

1. **Search results**: Browsed Honda Civic + Chevy Traverse listings near 91607 (250mi)
   - Noted vehicles with ask below MMR (potential deals)
   - Identified salvage titles to skip (2018 Civic LX, 2019 Ioniq Hybrid)
2. **Vehicle detail**: Viewed 2019 Chevy Impala Premier 2LZ
   - VIN: 2G1105S31K9146286 | 140,912 mi | Condition 2.8 Below Average
   - Current Bid: $5,700 | MMR: $6,150-$10,500 avg $8,325
   - **Red flags**: Engine warning light, title absent, multiple substandard paint repairs
   - Seller: Carvana LLC | Pickup: CA - Mira Loma
   - Transport to San Bernardino: $155
3. **Vehicle detail**: Clicked into 2019 Honda Civic Sedan EX
   - VIN: 19XFC1F34KE208191 | 66,759 mi | Condition 4.2 Clean
   - Buy Now: $20,900 | Bid: $18,900 | MMR: $16,450-$19,100 avg $17,750
   - No structural damage, no active codes
   - 10 exterior items: 5x acceptable paint repair, 5x small dent
   - Interior clean, tires all 6/32"
   - 1 owner, **2 accidents** | Location: Las Vegas, NV
   - Seller: Boktor Motors
   - ⚠️ Ask ($18,900) above MMR avg ($17,750) — not a deal on MMR alone
   - **KBB tab open but not yet visited** — still waiting to observe KBB lookup step

### Session: 2026-03-14 ~19:33 PDT — Search Results Scan

**Search URL**: `landingPage#/results/4cea5470-b3b7-4dc5-a510-21e00b7f4da9`
**Filters**: Zip 91607, 250mi — **NO year/title filters applied** (10,538 vehicles)

| # | Year | Car | Miles | Ask | MMR Avg | Δ MMR | CR | Title | Match? |
|---|------|-----|-------|-----|---------|-------|----|-------|--------|
| 1 | 2020 | Civic Hatch EX | 55,559 | $17,000 | $17,250 | -1.4% | 2.8 | Clean? | ⭐ Marginal |
| 2 | 2018 | Civic Hatch EX | 75,953 | $15,000 | $14,850 | +1.0% | 3.3 | Clean? | ❌ Above MMR |
| 3 | 2019 | Civic Sedan EX | 66,759 | $18,900 | $17,750 | +6.5% | 4.2 | Clean? | ❌ Above MMR |
| 4 | 2018 | Civic Sedan LX | 63,884 | $13,000 | $10,650 | +22% | 1.8 | **SALVAGE** | ❌ Salvage |
| 5 | 2022 | Civic Sedan EX | 37,443 | $19,000 | $20,700 | **-8.2%** | 2.8 | Clean? | ⭐⭐ |
| 6 | 2024 | Civic Hatch Sport | 12,654 | $22,000 | $24,400 | **-9.8%** | 3.7 | Clean? | ⭐⭐ |
| 7 | 2019 | Civic Sedan LX | 137,205 | $10,500 | $9,050 | +16% | 3.9 | Clean? | ❌ Above MMR |
| 8 | 2012 | Civic Sedan LX | 159,421 | $4,500 | $2,875 | +56% | 1.7 | N/S | ❌ Year+price |
| 9 | 2022 | Civic Sedan Sport | 38,403 | $17,000 | $20,000 | **-15%** | 2.9 | R flag? | ⭐⭐⭐ Best |
| 10 | 2008 | Civic Sedan GX | 140,197 | $1,000 | $1,700 | -41% | 3.6 | R flag? | ❌ Year |
| 11 | 2017 | Civic Sedan EX | 45,741 | ? | $16,250 | ? | ? | Clean? | ⏳ Need data |

**Top deals (price below MMR + year 2016+ + no salvage tag):**
1. 🏆 **2022 Civic Sport** — 15% below MMR ($3k under) — needs title check (R flag)
2. **2024 Civic Hatch Sport** — 9.8% below ($2.4k under)
3. **2022 Civic EX** — 8.2% below ($1.7k under)

**Note**: "R" flag on some listings may indicate reserve status, rebuilt title, or other — need to click in to verify title status. Also no year/title filters applied — adding filters would dramatically reduce the 10k+ result set.

## Data Points Captured Per Vehicle

From observation, the automation needs to extract these fields:
- Year, Make, Model, Trim
- VIN
- Mileage
- Condition Rating (1-5 scale)
- Structural Damage (yes/no)
- Asking Price / Current Bid / Buy Now
- Adjusted MMR (range + average)
- Title Status (salvage = skip)
- Owner count, Accident count
- Location / Pickup point
- Key exterior/interior damage items
- Warning lights / active codes

### Session: 2026-03-14 ~19:53 PDT — Vehicle Detail Review

**Vehicle**: 2019 Honda Civic Sedan LX
- **VIN**: 2HGFC2F64KH531386
- **Mileage**: 137,205 mi
- **Drivetrain**: FWD, 2.0L 4 Cyl, CVT, Gasoline
- **Condition**: 3.9 Average
- **Structural Damage**: No
- **Buy Now**: $10,500 | **Bid**: $10,500 (Starting Bid = Floor)
- **MMR**: $7,625 - $10,500 range, **Avg $9,050**
- **Δ MMR**: **+16%** (ask above MMR avg) ❌ NOT A DEAL
- **Status**: On Sale (Timed Sale) — Ends in 1d 17h 6m
- **Location**: CA - Montclair (at dealership)
- **Seller**: Infinity Auto Group
- **Interest**: 8,651 searches, 134 views, 0 bids, 0 offers
- **History**: 1 owner, 2 accidents
- **Title**: Not Specified / state --
- **Tires**: All 6/32" (good)
- **Keys**: 1 key, 0 fob
- **Color**: Orange exterior, Black interior
- **Announcements**: Green Light / Ride & Drive
- **Exterior damage (7 items)**:
  - Front bumper: acceptable paint repair
  - Front windshield: pitted/scratched/star
  - Driver quarter panel: acceptable paint repair + multiple dents
  - Rear bumper: paint damage
  - Passenger quarter: small dent
  - Passenger rear door: multiple scratches
  - Passenger front door: paint damage
- **Interior damage (3 items)**:
  - Front passenger seat: stained
  - 2nd row seats: stained
  - Interior panels: worn/scratched (all 4 door panels)
- **Other**: TPMS warning light
- **Active codes**: None
- **MSRP (new)**: $20,350

**Assessment**: ❌ Skip — Ask price ($10,500) is 16% above MMR avg ($9,050). High mileage (137k), 2 accidents, cosmetic damage throughout, stained interior, windshield needs replacement. Even at MMR avg this wouldn't meet the 10% below threshold. 0 bids confirms market agrees it's overpriced.

---
*Created: 2026-03-14 17:40 PDT*
*Last updated: 2026-03-14 19:53 PDT*
