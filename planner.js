/*
 * planner.js — the itinerary engine.
 *
 * This file contains no DOM code at all. It takes a request object and returns
 * a plan object, which makes it testable on its own and keeps the interesting
 * part of the project separate from the interface drawn around it.
 *
 * Planning a trip is a scheduling problem with four constraints pulling
 * against each other: what the traveller wants to see, what a day physically
 * holds, what is open when, and what the budget allows. The engine works in
 * six passes, each one narrowing the problem for the next:
 *
 *   1  score      rank every place against the traveller's interests
 *   2  select     choose a subset that fits the days and the budget
 *   3  cluster    group the subset geographically, one cluster per day
 *   4  route      order each day to cut walking (nearest neighbour, then 2-opt)
 *   5  schedule   lay the route against real opening hours and travel times
 *   6  improve    hill-climb: swap places between days while the plan gets better
 *
 * Passes 4 and 6 are the ones doing real optimisation work, and the plan
 * reports what they achieved so the result can be shown rather than claimed.
 */

'use strict';

/* ----------------------------------------------------------------- tuning */

/** How much of a day each pace is willing to spend on scheduled activity. */
const PACE = {
  relaxed:  { label: 'Relaxed',  maxStops: 4, targetMins: 330 },
  balanced: { label: 'Balanced', maxStops: 5, targetMins: 420 },
  packed:   { label: 'Packed',   maxStops: 7, targetMins: 510 },
};

/** Beyond this distance we assume public transport rather than walking. */
const TRANSIT_THRESHOLD_KM = 2.2;

/** Flat fare assumed for one public-transport hop, in euro. */
const TRANSIT_FARE = 2;

/** Minimum gap between two stops, however close together they are. */
const MIN_HOP_MINS = 6;

/* --------------------------------------------------------------- geometry */

const Geo = {
  /** Great-circle distance between two {lat, lon} points, in kilometres. */
  distance(a, b) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  },

  /** Mean position of a set of places. */
  centroid(places) {
    if (!places.length) return { lat: 0, lon: 0 };
    const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
    const lon = places.reduce((s, p) => s + p.lon, 0) / places.length;
    return { lat, lon };
  },

  /** Total length of a route, following the order given. */
  pathLength(places) {
    let km = 0;
    for (let i = 1; i < places.length; i++) km += Geo.distance(places[i - 1], places[i]);
    return km;
  },
};

/* ------------------------------------------------------------------ travel */

/**
 * How a traveller gets from one place to the next. Short gaps are walked;
 * longer ones are assumed to use public transport, which is faster but costs
 * a fare and carries a fixed waiting overhead.
 */
function hop(from, to, walkKmh) {
  const km = Geo.distance(from, to);
  if (km <= TRANSIT_THRESHOLD_KM) {
    return { km, mins: Math.max(MIN_HOP_MINS, Math.round((km / walkKmh) * 60)), mode: 'walk', cost: 0 };
  }
  return { km, mins: Math.round(10 + km * 2.4), mode: 'transit', cost: TRANSIT_FARE };
}

/* ------------------------------------------------------------- 1. scoring */

/**
 * Rank a place from 0–1 against what the traveller asked for.
 *
 * Interest match dominates, because a plan full of highly-rated places the
 * traveller does not care about is a bad plan. Rating is the tie-breaker, and
 * a small value term nudges the selection away from spending the whole budget
 * on two expensive tickets.
 */
function scorePlace(place, interests, budgetPerDay) {
  const matched = interests.length
    ? place.tags.filter((t) => interests.includes(t)).length
    : 0;

  // Diminishing returns: matching two interests is good, matching four is not
  // twice as good again.
  const interestScore = interests.length ? Math.min(1, matched / Math.min(2, interests.length)) : 0.6;

  const ratingScore = (place.rating - 3.8) / 1.2; // 3.8–5.0 mapped onto 0–1
  const share = budgetPerDay > 0 ? place.cost / budgetPerDay : 0;
  const valueScore = 1 - Math.min(1, share); // free places score 1, day-eating ones 0

  let raw = 0.55 * interestScore + 0.30 * clamp01(ratingScore) + 0.15 * valueScore;

  // If the traveller named their interests, a place matching none of them is
  // filler. It can still make the trip when there is room, but it should never
  // outrank something they actually asked for.
  if (interests.length && matched === 0 && place.type !== 'food') raw *= 0.55;

  return clamp01(raw);
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/* ----------------------------------------------------------- 2. selection */

/**
 * Choose which places make the trip.
 *
 * This is a bounded knapsack: maximise total score subject to a time budget
 * (days × the pace's daily target) and a money budget. Solving it exactly is
 * expensive and unnecessary, so we take the standard greedy approximation —
 * order by score per minute and take while it fits — then run a swap pass that
 * fixes the cases where greedy leaves obvious value on the table.
 */
function selectPlaces(city, request, weekdays) {
  const pace = PACE[request.pace];
  const timeBudget = pace.targetMins * request.days;
  const budgetPerDay = request.budget / request.days;

  // A place is unusable if it is shut on every day of the trip, and the
  // traveller can veto anything they do not fancy.
  const vetoed = new Set(request.exclude || []);
  const open = city.places.filter(
    (p) => !vetoed.has(p.id) && weekdays.some((w) => !(p.closed || []).includes(w)));

  const scored = open
    .map((p) => ({ place: p, score: scorePlace(p, request.interests, budgetPerDay) }))
    .sort((a, b) => b.score / b.place.mins - a.score / a.place.mins);

  const chosen = [];
  let mins = 0;
  let cost = 0;

  const foodWanted = request.meals ? request.days : 0;
  let foodTaken = 0;

  // Reserve budget for the meals we intend to add, so tickets cannot eat it.
  const foodReserve = foodWanted * 18;

  for (const { place, score } of scored) {
    const isFood = place.type === 'food';
    if (isFood && foodTaken >= foodWanted) continue;
    if (!isFood && chosen.filter((c) => !c.place.type).length >= pace.maxStops * request.days) continue;

    const ceiling = isFood ? request.budget : request.budget - foodReserve;
    if (mins + place.mins > timeBudget) continue;
    if (cost + place.cost > ceiling) continue;

    chosen.push({ place, score });
    mins += place.mins;
    cost += place.cost;
    if (isFood) foodTaken++;
  }

  // Greedy fills with cheap quick wins; try trading one of them for a
  // higher-scoring place that was skipped because it did not fit at the time.
  const takenIds = new Set(chosen.map((c) => c.place.id));
  for (const cand of scored) {
    if (takenIds.has(cand.place.id)) continue;
    if (cand.place.type === 'food') continue;

    const worst = chosen
      .filter((c) => !c.place.type && c.score < cand.score)
      .sort((a, b) => a.score - b.score)[0];
    if (!worst) continue;

    const newMins = mins - worst.place.mins + cand.place.mins;
    const newCost = cost - worst.place.cost + cand.place.cost;
    if (newMins > timeBudget || newCost > request.budget - foodReserve) continue;

    chosen.splice(chosen.indexOf(worst), 1);
    takenIds.delete(worst.place.id);
    chosen.push(cand);
    takenIds.add(cand.place.id);
    mins = newMins;
    cost = newCost;
  }

  const takenNow = new Set(chosen.map((c) => c.place.id));
  const pool = scored.filter((s) => !takenNow.has(s.place.id));

  return {
    chosen: chosen.map((c) => c.place),
    pool,
    scores: new Map(scored.map((c) => [c.place.id, c.score])),
    spentCost: cost,
  };
}

/**
 * Greedy insertion, run after the first schedule is built.
 *
 * Selection works on estimates — a day's target minutes — so the real
 * schedule almost always leaves gaps: an afternoon that ends at four, budget
 * still unspent. This pass walks the places that missed the first cut, best
 * first, and tries each one at every position of every day, keeping the
 * cheapest feasible insertion. It is what turns a plausible shortlist into a
 * day that is actually full.
 */
function topUp(days, pool, request, walkKmh, budgetLeft) {
  const target = PACE[request.pace].targetMins;
  let remaining = budgetLeft;
  const added = [];

  const load = (day) => day.items.reduce((s, i) => s + i.place.mins, 0);

  const byScore = pool.slice().sort((a, b) => b.score - a.score);

  for (const { place } of byScore) {
    if (place.cost > remaining) continue;

    // Prefer days that still have room. Without this the pass keeps adding to
    // whichever day is already densest, because that is where the next stop is
    // always nearest — and one day ends up with nine stops and another with one.
    const hungry = days.map((d, i) => i).filter((i) => load(days[i]) < target);
    const candidates = hungry.length ? hungry : days.map((d, i) => i);

    let best = null;
    for (const d of candidates) {
      const day = days[d];
      if ((place.closed || []).includes(day.date.getDay())) continue;

      const current = day.items.map((i) => i.place);
      for (let pos = 0; pos <= current.length; pos++) {
        const trial = current.slice(0, pos).concat([place], current.slice(pos));
        const scheduled = scheduleDay(trial, day.date, request, walkKmh);
        if (scheduled.rejected.length) continue;

        const detour = scheduled.routeKm - day.routeKm;
        const extraFare = scheduled.transitCost - day.transitCost;
        if (place.cost + extraFare > remaining) continue;
        if (!best || detour < best.detour) best = { d, detour, scheduled, extraFare };
      }
    }

    if (best) {
      days[best.d] = best.scheduled;
      remaining -= place.cost + best.extraFare;
      added.push(place);
    }
  }

  return { added, remaining };
}

/**
 * Even the days out.
 *
 * Clustering balances the shortlist, but opening hours, the repair pass and
 * the budget all pull stops around afterwards, and a trip can end up with a
 * twelve-hour Monday and a Tuesday that finishes before lunch. This moves
 * stops from the fullest day to the emptiest while the gap is worth closing,
 * accepting a longer walk to get there — an even trip is worth a kilometre.
 */
/**
 * A last re-ordering of each finished day.
 *
 * Stops arrive after the routing pass has run — the repair pass rehouses what
 * would not fit, the top-up pass inserts wherever the detour is smallest — so
 * by the end a day is rarely still in its optimal order. This re-runs the
 * route search over each day's final set of stops and keeps the new order only
 * if every stop still lands inside its opening hours. Optimality never
 * overrules a closed door.
 */
function finalPolish(days, request, walkKmh) {
  let improved = 0;

  days.forEach((day, i) => {
    if (day.items.length < 3) return;

    const places = day.items.map((item) => item.place);
    const candidate = scheduleDay(optimiseRoute(places).route, day.date, request, walkKmh);

    if (candidate.rejected.length) return;
    if (candidate.items.length < day.items.length) return;
    if (candidate.routeKm >= day.routeKm - 0.01) return;

    days[i] = candidate;
    improved++;
  });

  return improved;
}

/** What the whole trip costs as currently scheduled: tickets plus fares. */
function tripCost(days) {
  return days.reduce(
    (s, d) => s + d.transitCost + d.items.reduce((t, i) => t + i.place.cost, 0), 0);
}

function rebalanceDays(days, request, walkKmh) {
  if (days.length < 2) return 0;

  const load = (day) => day.items.reduce((s, i) => s + i.place.mins, 0);
  let moves = 0;

  for (let guard = 0; guard < 30; guard++) {
    const loads = days.map(load);
    const fullest = loads.indexOf(Math.max(...loads));
    const emptiest = loads.indexOf(Math.min(...loads));
    if (fullest === emptiest) break;
    if (loads[fullest] - loads[emptiest] < 120) break;
    if (days[fullest].items.length < 2) break;

    let best = null;
    for (const item of days[fullest].items) {
      const place = item.place;
      if ((place.closed || []).includes(days[emptiest].date.getDay())) continue;

      // Keep the surviving stops in the order they already had. Re-optimising
      // here can produce an order that no longer fits the opening hours, which
      // would make a perfectly good move look infeasible.
      const kept = days[fullest].items.map((i) => i.place).filter((p) => p !== place);
      const source = scheduleDay(kept, days[fullest].date, request, walkKmh);
      if (source.rejected.length) continue;

      const current = days[emptiest].items.map((i) => i.place);
      for (let pos = 0; pos <= current.length; pos++) {
        const trial = current.slice(0, pos).concat([place], current.slice(pos));
        const target = scheduleDay(trial, days[emptiest].date, request, walkKmh);
        if (target.rejected.length) continue;

        // Moving a stop can turn a walk into a metro ride, and fares count
        // against the budget like tickets do. A move that breaks the budget is
        // not an improvement.
        const fareChange =
          (source.transitCost - days[fullest].transitCost) +
          (target.transitCost - days[emptiest].transitCost);
        if (tripCost(days) + fareChange > request.budget) continue;

        const detour = target.routeKm - days[emptiest].routeKm;
        if (!best || detour < best.detour) best = { detour, source, target };
      }
    }

    if (!best) break;
    days[fullest] = best.source;
    days[emptiest] = best.target;
    moves++;
  }

  return moves;
}

/**
 * Last line of defence on the budget.
 *
 * The hill-climbing pass can move a stop onto a day where reaching it needs a
 * metro fare it did not need before, which is a small cost the earlier passes
 * had no way to predict. If the trip ends up over budget, drop stops — worst
 * value first, measured as score per euro — until it is not.
 */
function trimToBudget(days, request, scores, walkKmh) {
  const removed = [];

  let guard = 0;
  while (tripCost(days) > request.budget && guard++ < 40) {
    let worst = null;
    days.forEach((day, d) => {
      day.items.forEach((item) => {
        if (item.place.cost === 0) return; // dropping a free stop saves nothing
        const value = (scores.get(item.place.id) || 0.5) / item.place.cost;
        if (!worst || value < worst.value) worst = { d, place: item.place, value };
      });
    });
    if (!worst) break;

    const kept = days[worst.d].items.map((i) => i.place).filter((p) => p !== worst.place);
    days[worst.d] = scheduleDay(kept, days[worst.d].date, request, walkKmh);
    removed.push(worst.place);
  }

  return removed;
}

/* ---------------------------------------------------------- 3. clustering */

/**
 * Split the selected places into one geographic group per day, so a day is
 * spent in a neighbourhood rather than crossing the city four times.
 *
 * k-means with k = days, seeded the k-means++ way (each new seed is the place
 * furthest from the seeds already chosen) because random seeding on this few
 * points regularly produces one enormous cluster and two empty ones.
 */
function clusterByDay(places, days) {
  if (days === 1) return [places.slice()];

  const seeds = [places[0]];
  while (seeds.length < days) {
    let best = null;
    let bestDist = -1;
    for (const p of places) {
      if (seeds.includes(p)) continue;
      const d = Math.min(...seeds.map((s) => Geo.distance(s, p)));
      if (d > bestDist) { bestDist = d; best = p; }
    }
    if (!best) break;
    seeds.push(best);
  }

  let centres = seeds.map((s) => ({ lat: s.lat, lon: s.lon }));
  let groups = [];

  for (let iter = 0; iter < 40; iter++) {
    groups = centres.map(() => []);
    for (const p of places) {
      let bestI = 0;
      let bestD = Infinity;
      centres.forEach((c, i) => {
        const d = Geo.distance(c, p);
        if (d < bestD) { bestD = d; bestI = i; }
      });
      groups[bestI].push(p);
    }

    const moved = centres.map((c, i) => {
      if (!groups[i].length) return c;
      const n = Geo.centroid(groups[i]);
      return n;
    });

    const shift = moved.reduce((s, c, i) => s + Geo.distance(c, centres[i]), 0);
    centres = moved;
    if (shift < 0.01) break;
  }

  return balanceClusters(groups, centres);
}

/**
 * k-means optimises for tightness, not for fairness, so it happily returns a
 * day with nine stops and a day with one. This moves places from the fullest
 * group to the emptiest, always picking the place that minds least — the one
 * closest to the receiving group's centre.
 */
function balanceClusters(groups, centres) {
  const total = groups.reduce((s, g) => s + g.reduce((t, p) => t + p.mins, 0), 0);
  const target = total / groups.length;

  for (let pass = 0; pass < 60; pass++) {
    const load = groups.map((g) => g.reduce((t, p) => t + p.mins, 0));
    const fullest = load.indexOf(Math.max(...load));
    const emptiest = load.indexOf(Math.min(...load));
    if (fullest === emptiest) break;
    if (load[fullest] - target < 30 && target - load[emptiest] < 30) break;
    if (groups[fullest].length <= 1) break;

    let best = null;
    let bestD = Infinity;
    for (const p of groups[fullest]) {
      const d = Geo.distance(centres[emptiest], p);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best) break;

    groups[fullest].splice(groups[fullest].indexOf(best), 1);
    groups[emptiest].push(best);
    centres[emptiest] = Geo.centroid(groups[emptiest]);
    centres[fullest] = Geo.centroid(groups[fullest]);
  }

  return groups;
}

/* -------------------------------------------------------------- 4. routing */

/** Nearest-neighbour ordering from the place closest to the group's centre. */
function nearestNeighbour(places) {
  if (places.length < 3) return places.slice();
  const centre = Geo.centroid(places);
  const remaining = places.slice();

  let current = remaining.reduce((best, p) =>
    Geo.distance(centre, p) < Geo.distance(centre, best) ? p : best, remaining[0]);
  const route = [current];
  remaining.splice(remaining.indexOf(current), 1);

  while (remaining.length) {
    let next = remaining[0];
    let bestD = Geo.distance(current, next);
    for (const p of remaining) {
      const d = Geo.distance(current, p);
      if (d < bestD) { bestD = d; next = p; }
    }
    route.push(next);
    remaining.splice(remaining.indexOf(next), 1);
    current = next;
  }
  return route;
}

/** Nearest-neighbour ordering that starts from a nominated place. */
function nearestNeighbourFrom(places, startIndex) {
  const remaining = places.slice();
  let current = remaining.splice(startIndex, 1)[0];
  const route = [current];

  while (remaining.length) {
    let next = 0;
    let bestD = Infinity;
    remaining.forEach((p, i) => {
      const d = Geo.distance(current, p);
      if (d < bestD) { bestD = d; next = i; }
    });
    current = remaining.splice(next, 1)[0];
    route.push(current);
  }
  return route;
}

/**
 * 2-opt: repeatedly reverse the segment between two stops when doing so
 * shortens the route. It is the classic local-search improvement for the
 * travelling-salesman problem.
 */
function twoOpt(route) {
  if (route.length < 4) return { route: route.slice(), swaps: 0 };

  let best = route.slice();
  let improved = true;
  let swaps = 0;
  let guard = 0;

  while (improved && guard++ < 100) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const before =
          Geo.distance(best[i - 1], best[i]) +
          (k + 1 < best.length ? Geo.distance(best[k], best[k + 1]) : 0);
        const after =
          Geo.distance(best[i - 1], best[k]) +
          (k + 1 < best.length ? Geo.distance(best[i], best[k + 1]) : 0);

        if (after < before - 1e-9) {
          const middle = best.slice(i, k + 1).reverse();
          best = best.slice(0, i).concat(middle, best.slice(k + 1));
          improved = true;
          swaps++;
        }
      }
    }
  }
  return { route: best, swaps };
}

/**
 * Multi-start local search for a day's route.
 *
 * Nearest neighbour is greedy, so where it starts decides how good it ends up,
 * and on an open path — you do not have to finish where you began — a bad
 * start can lose to no optimisation at all. So we run it from every possible
 * first stop, polish each result with 2-opt, and keep the shortest. The
 * traveller's own shortlist order is thrown into the same competition, which
 * guarantees the engine can never hand back something worse than the list it
 * was given.
 */
function optimiseRoute(group) {
  if (group.length < 3) return { route: group.slice(), swaps: 0, starts: 1 };

  const candidates = [group.slice()];
  for (let i = 0; i < group.length; i++) candidates.push(nearestNeighbourFrom(group, i));

  let best = null;
  let swaps = 0;

  for (const candidate of candidates) {
    const result = twoOpt(candidate);
    swaps += result.swaps;
    const km = Geo.pathLength(result.route);
    if (!best || km < best.km) best = { route: result.route, km };
  }

  return { route: best.route, swaps, starts: candidates.length };
}

/* ------------------------------------------------------------ 5. scheduling */

/**
 * Lay a day's route against the clock.
 *
 * Walks the route in order, adding travel time between stops and pushing the
 * clock forward to a place's opening hour when we arrive early. Anything that
 * cannot be fitted — because it closes too soon, or the day runs out — is
 * handed back so the caller can try to place it on another day rather than
 * silently dropping it.
 */
function scheduleDay(route, date, request, walkKmh) {
  const weekday = date.getDay();
  const dayStart = request.startHour * 60;
  const dayEnd = request.endHour * 60;

  const items = [];
  const rejected = [];
  let clock = dayStart;
  let previous = null;
  let walkKm = 0;
  let routeKm = 0;
  let transitCost = 0;

  for (const place of route) {
    if ((place.closed || []).includes(weekday)) { rejected.push(place); continue; }

    const move = previous ? hop(previous, place, walkKmh) : { km: 0, mins: 0, mode: 'start', cost: 0 };
    let arrive = clock + move.mins;

    const opens = place.open[0] * 60;
    const closes = place.open[1] * 60;

    // Arriving before the doors open means waiting, which is only worth doing
    // if the wait is short.
    if (arrive < opens) {
      if (opens - arrive > 75) { rejected.push(place); continue; }
      arrive = opens;
    }

    const finish = arrive + place.mins;
    if (finish > closes || finish > dayEnd) { rejected.push(place); continue; }

    items.push({
      place,
      start: arrive,
      end: finish,
      travelMins: move.mins,
      travelKm: move.km,
      mode: move.mode,
    });

    walkKm += move.mode === 'walk' ? move.km : 0;
    routeKm += move.km;
    transitCost += move.cost;
    clock = finish;
    previous = place;
  }

  return { date, items, rejected, walkKm, routeKm, transitCost, endsAt: clock };
}

/**
 * Try to find a home for places the first scheduling pass could not fit, by
 * testing every insertion point on every day and keeping the one that adds the
 * least detour. This is the repair step that stops a Monday closure from
 * quietly deleting a museum from the trip.
 */
function repair(days, orphans, request, walkKmh) {
  const stillHomeless = [];

  for (const place of orphans) {
    let best = null;

    for (let d = 0; d < days.length; d++) {
      const day = days[d];
      if ((place.closed || []).includes(day.date.getDay())) continue;

      const current = day.items.map((i) => i.place);
      for (let pos = 0; pos <= current.length; pos++) {
        const trial = current.slice(0, pos).concat([place], current.slice(pos));
        const scheduled = scheduleDay(trial, day.date, request, walkKmh);
        if (scheduled.rejected.length) continue;

        const detour = scheduled.routeKm - day.routeKm;
        if (!best || detour < best.detour) best = { d, detour, scheduled };
      }
    }

    if (best) days[best.d] = best.scheduled;
    else stillHomeless.push(place);
  }

  return stillHomeless;
}

/* -------------------------------------------------------------- 6. improve */

/**
 * Hill climbing over the finished plan: try moving each place to a different
 * day, keep the move if the whole trip gets shorter on foot without losing a
 * stop, and stop when a full sweep finds no improvement. It is a small,
 * honest local search — no annealing, no randomness, and it converges in a
 * handful of sweeps at this problem size.
 */
function improve(days, request, walkKmh) {
  const totalRoute = (ds) => ds.reduce((s, d) => s + d.routeKm, 0);
  const totalStops = (ds) => ds.reduce((s, d) => s + d.items.length, 0);

  let moves = 0;
  let evaluated = 0;

  for (let sweep = 0; sweep < 6; sweep++) {
    let changed = false;

    for (let from = 0; from < days.length; from++) {
      for (const item of days[from].items.slice()) {
        for (let to = 0; to < days.length; to++) {
          if (to === from) continue;
          if ((item.place.closed || []).includes(days[to].date.getDay())) continue;

          const keptPlaces = days[from].items.map((i) => i.place).filter((p) => p !== item.place);
          const movedInto = days[to].items.map((i) => i.place).concat([item.place]);

          const a = scheduleDay(twoOpt(nearestNeighbour(keptPlaces)).route, days[from].date, request, walkKmh);
          const b = scheduleDay(twoOpt(nearestNeighbour(movedInto)).route, days[to].date, request, walkKmh);
          evaluated++;

          const trial = days.slice();
          trial[from] = a;
          trial[to] = b;

          if (totalStops(trial) >= totalStops(days) && totalRoute(trial) < totalRoute(days) - 0.05) {
            days[from] = a;
            days[to] = b;
            moves++;
            changed = true;
            break;
          }
        }
      }
    }
    if (!changed) break;
  }

  return { moves, evaluated };
}

/* ------------------------------------------------------------------- plan */

/**
 * Build a full itinerary.
 *
 * @param {object} request
 *   cityId     key into CITIES
 *   startDate  Date of the first day
 *   days       1–5
 *   budget     total euro for entry, food and local transport
 *   interests  array of interest ids
 *   pace       'relaxed' | 'balanced' | 'packed'
 *   startHour  hour the traveller wants to start (default 9)
 *   endHour    hour they want to be finished (default 21)
 *   meals      whether to schedule one food stop per day
 */
function planTrip(request) {
  const city = CITIES[request.cityId];
  if (!city) throw new Error('Unknown city: ' + request.cityId);

  const walkKmh = city.pace.walkKmh;

  const dates = Array.from({ length: request.days }, (_, i) => {
    const d = new Date(request.startDate);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekdays = dates.map((d) => d.getDay());

  /* 1–2 — score and select */
  const { chosen, pool, scores, spentCost } = selectPlaces(city, request, weekdays);
  if (!chosen.length) {
    return { city, request, days: [], dropped: [], stats: null, empty: true };
  }

  /* 3 — cluster into days */
  const clusters = clusterByDay(chosen, request.days);

  /*
   * 4 — route each day.
   *
   * The baseline is the order the places came out of selection: the itinerary
   * you get by writing a shortlist and visiting it top to bottom. Comparing
   * against that is what makes the optimisation figure mean something — a
   * nearest-neighbour route is already near-optimal on eight points, so
   * measuring 2-opt against it would flatter the engine and tell nobody
   * anything.
   */
  let twoOptSwaps = 0;
  let routeStarts = 0;

  const routed = clusters.map((group) => {
    const { route, swaps, starts } = optimiseRoute(group);
    twoOptSwaps += swaps;
    routeStarts += starts;
    return route;
  });

  /* 5 — schedule, then repair anything that would not fit */
  let days = routed.map((route, i) => scheduleDay(route, dates[i], request, walkKmh));
  const orphans = days.flatMap((d) => d.rejected);
  days.forEach((d) => { d.rejected = []; });
  const dropped = repair(days, orphans, request, walkKmh);

  /* 5b — fill the gaps the estimate left behind */
  const scheduledCost = () => days.reduce((s, d) => s + d.items.reduce((t, i) => t + i.place.cost, 0), 0);
  const transitSoFar = () => days.reduce((s, d) => s + d.transitCost, 0);
  const fill = topUp(days, pool, request, walkKmh, request.budget - scheduledCost() - transitSoFar());

  /*
   * 6 — hill-climb, hold the budget, then even out the days.
   *
   * The budget trim comes before the rebalance on purpose: trimming after it
   * would undo the moves it just made, dropping exactly the stops that had
   * been used to fill out an empty day.
   */
  const climb = improve(days, request, walkKmh);
  const trimmed = trimToBudget(days, request, scores, walkKmh);
  const balanceMoves = rebalanceDays(days, request, walkKmh);
  const polished = finalPolish(days, request, walkKmh);

  /* Totals */
  const entryCost = scheduledCost();
  const transitCost = transitSoFar();
  const walkKm = days.reduce((s, d) => s + d.walkKm, 0);
  const routeKm = days.reduce((s, d) => s + d.routeKm, 0);
  const stops = days.reduce((s, d) => s + d.items.length, 0);
  const minutes = days.reduce((s, d) => s + d.items.reduce((t, i) => t + i.place.mins, 0), 0);

  const matched = days.flatMap((d) => d.items)
    .filter((i) => i.place.tags.some((t) => request.interests.includes(t))).length;

  /*
   * What the routing was worth, measured at the end.
   *
   * The comparison is made on the stops that actually ended up in the plan,
   * against the order a person would naturally write them down in — most
   * wanted first. Measuring the two on different sets of stops, or before the
   * later passes have finished moving things around, would produce a number
   * that flatters the engine and means nothing.
   */
  const baselineKm = days.reduce((sum, day) => {
    const byPreference = day.items
      .map((i) => i.place)
      .sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
    return sum + Geo.pathLength(byPreference);
  }, 0);
  const optimisedKm = routeKm;

  // Anything in the catalogue that never made the plan, with the reason —
  // a plan should be able to say why it left something out.
  const vetoed = new Set(request.exclude || []);
  const inPlan = new Set(days.flatMap((d) => d.items.map((i) => i.place.id)));
  const leftOut = city.places
    .filter((p) => !inPlan.has(p.id))
    .map((p) => {
      if (vetoed.has(p.id)) return { place: p, reason: 'vetoed' };
      const alwaysShut = weekdays.every((w) => (p.closed || []).includes(w));
      if (alwaysShut) return { place: p, reason: 'closed' };
      if (p.cost > request.budget - entryCost - transitCost) return { place: p, reason: 'budget' };
      return { place: p, reason: 'time' };
    });

  return {
    city,
    request,
    days,
    dropped,
    leftOut,
    empty: false,
    scores,
    stats: {
      stops,
      minutes,
      entryCost,
      transitCost,
      totalCost: entryCost + transitCost,
      budget: request.budget,
      walkKm,
      routeKm,
      baselineKm,
      optimisedKm,
      savedKm: Math.max(0, baselineKm - optimisedKm),
      savedPct: baselineKm > 0 ? Math.round(((baselineKm - optimisedKm) / baselineKm) * 100) : 0,
      twoOptSwaps,
      routeStarts,
      climbMoves: climb.moves,
      balanceMoves,
      polished,
      evaluated: climb.evaluated,
      toppedUp: fill.added.length,
      trimmed: trimmed.length,
      considered: city.places.length,
      interestHitRate: stops ? Math.round((matched / stops) * 100) : 0,
    },
  };
}

/* Node can require this file for testing; the browser just gets the globals. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { planTrip, Geo, PACE, scorePlace, twoOpt, nearestNeighbour, clusterByDay };
}
