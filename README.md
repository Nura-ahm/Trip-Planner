# Trip Planner

A city trip planner that builds a day-by-day itinerary from your interests,
budget and dates — and then shows you the optimisation it did to get there.

**Live demo:** https://nura-ahm.github.io/Trip-Planner/

Vanilla HTML, CSS and JavaScript. No framework, no build step, no backend.

---

## What it actually does

You give it a city, some dates, a budget, a pace and the things you like. It
returns a scheduled itinerary: which places, on which day, in which order, at
what time, for what money — with a route map per day and a report of what each
planning pass did.

It is **not** a language model, and there is no API key to enter. This is
classical AI — scoring, a knapsack, k-means, a travelling-salesman heuristic and
hill climbing — running in the browser. That is a deliberate choice: a static
page cannot hold a secret key without giving it away, and itinerary building is
a scheduling problem, which is the kind of thing algorithms are good at.

## The engine

`planner.js` works in seven passes, each narrowing the problem for the next.

| Pass | What it does |
| --- | --- |
| **Score** | Rates every place against the chosen interests, its own standing, and what it does to a day's budget. Interests dominate — a plan full of excellent places you did not ask for is a bad plan. |
| **Select** | A bounded knapsack: maximise score inside a time budget and a money budget. Greedy by score-per-minute, then a swap pass that fixes what greedy gets wrong. |
| **Cluster** | k-means over the coordinates, one cluster per day, seeded furthest-point-first, then balanced by total minutes — k-means optimises for tightness and will happily hand back a nine-stop day and a one-stop day. |
| **Route** | Each day is an open travelling-salesman problem. Nearest neighbour from *every* possible starting stop, each result polished with 2-opt, shortest kept — with the unoptimised order entered in the same competition, so the result can never be worse than the list it started from. |
| **Schedule** | Lays the route against real opening hours and travel times, walking short hops and taking transport on long ones. Anything that will not fit is offered to every other day at every position before it is dropped. |
| **Top up** | Selection works on estimates, so the real schedule leaves gaps. This inserts the best remaining places wherever the detour is smallest, preferring days that still have room. |
| **Improve** | Hill climbing across days, a budget trim, a day-balancing pass, and a final per-day re-route — which is only adopted if every stop still lands inside its opening hours. |

Each run reports what it did: places considered, starting points tried, 2-opt
swaps kept, arrangements evaluated, moves taken, and the distance before and
after ordering. The claims on the page are checkable rather than decorative.

### On the honesty of the headline number

The "X% shorter" figure compares the same stops in two orders: the order you
would naturally write them down (most wanted first) against the order they are
actually scheduled in. Comparing against a nearest-neighbour route instead would
flatter the engine — nearest neighbour is already near-optimal on eight points.

Sometimes that figure is negative, and the page says so. It happens when the
shortest possible order would put a stop outside its opening hours: the engine
takes the extra kilometre rather than send you to a closed door. Reporting that
honestly seemed better than quietly picking a baseline that never loses.

## Files

| File | Role |
| --- | --- |
| `data.js` | The catalogue — 5 cities, 128 places, with coordinates, hours, durations, costs and tags |
| `planner.js` | The engine. No DOM code at all, so it can be tested on its own |
| `app.js` | The interface: form, itinerary, SVG route maps, exports |
| `styles.css` | Design tokens, layout, print styles |
| `index.html` | Structure and copy |

`planner.js` touching no DOM is the point of the split: the interesting half of
the project was developed and tested headlessly, across every combination of
city, length, pace, budget and start weekday — 3,375 plans — checking that no
stop is ever scheduled outside its opening hours, on a day it is closed, past
the end of the day, or twice; and that no plan ever exceeds its budget.

## Features

- Five cities, 128 hand-curated places
- Eight interest filters, three paces, custom start and end hours
- Budget tracked across entry, food and local transport, with a breakdown
- Per-day SVG route map with a scale bar, drawn from the coordinates
- "Replace this stop" — veto anything and the trip is rebuilt around it
- Export as text, CSV or a calendar file (`.ics`), plus a print stylesheet
- A "left out" list that says *why* each place did not make it
- Remembers your last search in `localStorage`, and still works where storage is blocked
- Responsive from 320px, keyboard accessible, and `prefers-reduced-motion` respected

## Known limits

- **Distances are straight-line.** Real streets are longer. The comparison
  between routes is still fair, since both are measured the same way.
- **Prices and hours are indicative.** Hand-entered, and they move with the
  season. Good enough to plan around; not a booking confirmation.
- **The catalogue is small by design.** Five cities curated properly beat fifty
  scraped badly.

## Running it

Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
```

---

Built by [Nura M. Ahmed](https://nura-ahm.github.io/).
