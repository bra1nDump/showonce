# Research: Used Car Market Value Data Sources

**Goal**: Find data sources that give a competitive edge over other dealers on Manheim
**Key insight**: The edge comes from having DIFFERENT or FASTER data than competitors

## Recommendation: 3-Tier Strategy

### 🥇 Top Pick: MarketCheck API + Black Book combo

**Why this wins:**
- MarketCheck aggregates RETAIL listing data (AutoTrader, Cars.com, CarGurus, dealer sites)
- Comparing retail asking prices against Manheim wholesale prices = your profit margin is visible
- Black Book gives DAILY wholesale updates with regional adjustments
- Together: you see both what cars sell for at retail AND the most current wholesale benchmark
- Most small dealers don't use either of these programmatically

**Automation feasibility: ★★★★★**
- Both have well-documented REST APIs
- MarketCheck: pay-per-call, designed for programmatic use
- Black Book: subscription API, ~$200-500/mo for dealers

---

## All Sources Compared

| Source | Type | Edge | API? | Automation | Cost | 
|--------|------|------|------|------------|------|
| **MarketCheck** | Aggregated retail listings | 🟢 HIGH | ✅ REST API | Very easy | Pay-per-call |
| **Black Book** | Daily wholesale values | 🟢 HIGH | ✅ REST API | Very easy | ~$200-500/mo |
| **CarGurus IMV** | Real-time retail pricing | 🟡 MED-HIGH | ⚠️ Partial | Moderate | Dealer account |
| **NADA / J.D. Power** | Lending/wholesale values | 🟡 MEDIUM | ✅ API | Easy | Subscription |
| **Edmunds TMV** | Actual transaction prices | 🟡 MEDIUM | ✅ API | Easy | Free tier + paid |
| **KBB Dealer** | Retail & trade-in | 🟠 LOW-MED | ✅ Cox Auto API | Easy | Dealer account |
| **Manheim MMR** | Wholesale auction values | 🔴 LOW | ✅ In-platform | Easy | Included w/ Manheim |
| **FB Marketplace** | Retail sold prices | 🔴 LOW | ❌ None | Not feasible | N/A |

## Detailed Source Profiles

### 1. MarketCheck API ⭐ RECOMMENDED
- **What**: Aggregated listing data from 30k+ dealers, 100M+ historical listings
- **Data**: Current & historical retail prices, days-on-market, price drops, dealer info
- **Why edge**: See what the RETAIL market looks like for any car before buying wholesale
- **API**: `api.marketcheck.com` — REST, well-documented
- **Key metrics available**:
  - Average retail listing price by year/make/model/trim/mileage
  - Days on market (how fast does this car sell?)
  - Price drop history (are dealers cutting prices on this model?)
  - Supply count (how many are listed nationally/regionally?)
  - Historical price trends (appreciating or depreciating?)

### 2. Black Book ⭐ RECOMMENDED
- **What**: Daily wholesale & retail values
- **Data**: Updated DAILY from auctions, dealer transactions, retail sales
- **Why edge**: Daily updates vs weekly for competitors; regional adjustments
- **API**: REST API for subscribers
- **Key advantage**: When market moves fast, daily data = first-mover advantage

### 3. CarGurus Instant Market Value (IMV)
- **What**: Algorithm-based pricing from 40M+ active listings
- **Data**: Current market value, deal ratings (Great/Good/Fair/Overpriced)
- **Why edge**: Based on CURRENT listings, shows real-time supply/demand
- **API**: Dealer API available, but IMV specifically may need scraping
- **Risk**: Moderate scraping protection

### 4. NADA Guides (J.D. Power)
- **What**: Wholesale, retail, and LENDING values
- **Data**: Transaction-based, used by banks for auto loans
- **Why edge**: "Lending value" shows what banks will finance — useful for financing arbitrage
- **API**: J.D. Power Valuation API
- **Use case**: If NADA says $25k lending value but Manheim has car at $20k → strong buy signal

### 5. Edmunds TMV (True Market Value)
- **What**: What people ACTUALLY paid (not asking price)
- **Data**: Based on real dealer transactions
- **API**: `developer.edmunds.com` — free tier available
- **Why useful**: Asking price ≠ transaction price. TMV shows reality.

### 6. KBB (Kelley Blue Book)
- **What**: Consumer-facing retail/trade-in values + dealer wholesale data
- **Data**: Market transactions, listings, auction data
- **API**: Through Cox Automotive (same parent as Manheim)
- **Edge**: Low — everyone checks KBB. But dealer API has extra wholesale data.

### 7. Manheim MMR
- **What**: Wholesale values from Manheim's own auction data
- **Data**: 10M+ annual transactions
- **Edge**: Low — every Manheim user sees the same MMR
- **Still useful**: Good baseline, but not a differentiator

### 8. Facebook Marketplace
- **What**: Consumer retail sold listings
- **Edge**: Low + NOT automatable
- **No API**, active anti-scraping, sold listing data is especially hard to access
- **Verdict**: Not viable for automation

---

## Proposed Automated Workflow

```
For each car on Manheim:
  1. Get Manheim listing: year, make, model, trim, mileage, condition, bid/asking price
  2. Query MarketCheck API → get avg retail price, days-on-market, supply
  3. Query Black Book API → get daily wholesale value, regional adjustment
  4. Calculate:
     - Retail-wholesale spread = MarketCheck avg retail - Manheim price
     - vs Black Book = Black Book wholesale - Manheim price  
     - Deal score = weighted composite
  5. Flag if:
     - Manheim price ≤ 90% of Black Book wholesale (user's 0.9 rule)
     - AND retail-wholesale spread > $X (enough profit margin)
     - AND days-on-market < Y days (sells fast)
  6. Output: sorted list of deals with profit potential
```

---

*Researched: 2026-03-14 17:42 PDT*
