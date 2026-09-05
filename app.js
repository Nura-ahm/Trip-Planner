/*
 * app.js — the interface.
 *
 * Everything here is presentation: reading the form into a request, handing it
 * to planTrip(), and drawing what comes back. All the planning logic lives in
 * planner.js, which does not know this file exists.
 *
 *   Store    remembers the last request in localStorage, defensively
 *   Form     builds and reads the controls
 *   Maps     projects a day's stops into an SVG route diagram
 *   Render   draws the itinerary, the budget and the optimisation report
 *   Export   text, CSV, calendar and print
 */

'use strict';

/* ------------------------------------------------------------------ helpers */

const $ = (sel) => document.querySelector(sel);

/** Escape anything that will be interpolated into HTML. */
function esc(value) {
  const el = document.createElement('span');
  el.textContent = value == null ? '' : String(value);
  return el.innerHTML;
}

/** Minutes past midnight → "14:05". */
function clock(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/** 95 → "1 h 35". */
function duration(mins) {
  if (mins < 60) return mins + ' min';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

function money(euros) {
  return '€' + Math.round(euros);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function longDate(date) {
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function isoDate(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/* -------------------------------------------------------------------- store */

const Store = {
  KEY: 'itinerary.request.v1',

  load() {
    try {
      const raw = localStorage.getItem(Store.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null; // private mode, blocked storage — not worth complaining about
    }
  },

  save(request) {
    try {
      localStorage.setItem(Store.KEY, JSON.stringify({
        ...request,
        startDate: isoDate(request.startDate),
      }));
    } catch (err) { /* nothing we can do, and nothing the traveller needs to know */ }
  },
};

/* --------------------------------------------------------------------- state */

const State = {
  plan: null,
  excluded: [],
  visibleDay: 'all',
};

/* ---------------------------------------------------------------------- form */

const Form = {
  build() {
    // Cities
    $('.cities').innerHTML = CITY_IDS.map((id, i) => {
      const c = CITIES[id];
      return `
        <label class="city">
          <input type="radio" name="city" value="${esc(id)}" ${i === 0 ? 'checked' : ''}>
          <strong>${esc(c.name)}</strong>
          <span>${esc(c.country)}</span>
          <small>${c.places.length} places</small>
        </label>`;
    }).join('');

    // Interests
    $('#interests').innerHTML = INTERESTS.map((int) => `
      <label class="chip">
        <input type="checkbox" name="interest" value="${esc(int.id)}">
        <span aria-hidden="true">${int.icon}</span>${esc(int.label)}
      </label>`).join('');

    // Hours
    const hours = (from, to, selected) => {
      let html = '';
      for (let h = from; h <= to; h++) {
        html += `<option value="${h}" ${h === selected ? 'selected' : ''}>${clock(h * 60)}</option>`;
      }
      return html;
    };
    $('#start-hour').innerHTML = hours(7, 12, 9);
    $('#end-hour').innerHTML = hours(16, 23, 21);

    // Default to a month out, so opening days are realistic rather than today's
    const start = new Date();
    start.setDate(start.getDate() + 30);
    $('#start-date').value = isoDate(start);
    $('#start-date').min = isoDate(new Date());

    // Catalogue totals in the hero
    const total = CITY_IDS.reduce((s, id) => s + CITIES[id].places.length, 0);
    $('#hero-places').textContent = total;
    $('#hero-cities').textContent = CITY_IDS.length;

    Form.restore();
    Form.sync();
  },

  restore() {
    const saved = Store.load();
    if (!saved) return;
    try {
      const city = document.querySelector(`input[name="city"][value="${saved.cityId}"]`);
      if (city) city.checked = true;
      if (saved.days) $('#days').value = saved.days;
      if (saved.budget) $('#budget').value = saved.budget;
      if (saved.pace) {
        const pace = document.querySelector(`input[name="pace"][value="${saved.pace}"]`);
        if (pace) pace.checked = true;
      }
      if (saved.startHour) $('#start-hour').value = saved.startHour;
      if (saved.endHour) $('#end-hour').value = saved.endHour;
      if (typeof saved.meals === 'boolean') $('#meals').checked = saved.meals;
      (saved.interests || []).forEach((id) => {
        const chip = document.querySelector(`input[name="interest"][value="${id}"]`);
        if (chip) chip.checked = true;
      });
      // The saved date may be in the past by now; only reuse it if it is not.
      if (saved.startDate && new Date(saved.startDate) >= new Date(isoDate(new Date()))) {
        $('#start-date').value = saved.startDate;
      }
    } catch (err) { /* a corrupt saved request should not stop the page loading */ }
  },

  /** Keep the live captions under the controls honest. */
  sync() {
    const budget = Number($('#budget').value);
    const days = Number($('#days').value);
    $('#budget-value').textContent = money(budget);
    $('#budget-per-day').textContent =
      `${money(budget / days)} a day for entry, food and local transport.`;

    const date = new Date($('#start-date').value + 'T00:00:00');
    $('#start-weekday').textContent = isNaN(date) ? ' ' : `A ${DAY_NAMES[date.getDay()]}.`;

    const pace = document.querySelector('input[name="pace"]:checked').value;
    $('#pace-hint').textContent = {
      relaxed: 'About four stops a day, with room to sit down.',
      balanced: 'About five stops a day.',
      packed: 'Up to seven stops a day. Bring good shoes.',
    }[pace];

    const start = Number($('#start-hour').value);
    const end = Number($('#end-hour').value);
    $('#form-note').textContent = end - start < 6
      ? `That is only ${end - start} hours a day — expect a short itinerary.`
      : '';
  },

  read() {
    const date = new Date($('#start-date').value + 'T00:00:00');
    return {
      cityId: document.querySelector('input[name="city"]:checked').value,
      startDate: isNaN(date) ? new Date() : date,
      days: Number($('#days').value),
      budget: Number($('#budget').value),
      interests: [...document.querySelectorAll('input[name="interest"]:checked')].map((i) => i.value),
      pace: document.querySelector('input[name="pace"]:checked').value,
      startHour: Number($('#start-hour').value),
      endHour: Number($('#end-hour').value),
      meals: $('#meals').checked,
      exclude: State.excluded,
    };
  },

  surprise() {
    const city = CITY_IDS[Math.floor(Math.random() * CITY_IDS.length)];
    document.querySelector(`input[name="city"][value="${city}"]`).checked = true;

    document.querySelectorAll('input[name="interest"]').forEach((chip) => {
      chip.checked = Math.random() < 0.4;
    });

    $('#days').value = 2 + Math.floor(Math.random() * 3);
    $('#budget').value = 150 + Math.floor(Math.random() * 12) * 30;

    const start = new Date();
    start.setDate(start.getDate() + 14 + Math.floor(Math.random() * 60));
    $('#start-date').value = isoDate(start);

    State.excluded = [];
    Form.sync();
  },
};

/* ---------------------------------------------------------------------- maps */

const Maps = {
  /**
   * Draw one day's route.
   *
   * Longitude is scaled by cos(latitude) so the diagram keeps the city's real
   * proportions instead of stretching east–west, and the whole thing is fitted
   * into the viewBox with a margin wide enough for the labels.
   */
  day(items, index) {
    const W = 320;
    const H = 250;
    const pad = 22;

    if (!items.length) {
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="No stops"></svg>`;
    }

    const midLat = items.reduce((s, i) => s + i.place.lat, 0) / items.length;
    const k = Math.cos((midLat * Math.PI) / 180);

    const pts = items.map((i) => ({ x: i.place.lon * k, y: -i.place.lat }));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const spanX = Math.max(maxX - minX, 1e-4);
    const spanY = Math.max(maxY - minY, 1e-4);
    const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);

    const offX = (W - spanX * scale) / 2;
    const offY = (H - spanY * scale) / 2;

    const screen = pts.map((p) => ({
      x: offX + (p.x - minX) * scale,
      y: offY + (p.y - minY) * scale,
    }));

    const path = screen.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    // Numbers only, no names. One outlier — an afternoon out on the Appian Way,
    // an island ferry — squashes the rest of the day into a corner, and stacked
    // labels there are unreadable. The numbers match the timeline beside it,
    // which is where the names already are.
    const nodes = screen.map((p, i) => `
        <g>
          <circle class="map-node" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9.5"/>
          <text class="map-label" x="${p.x.toFixed(1)}" y="${(p.y + 3.2).toFixed(1)}">${i + 1}</text>
        </g>`).join('');

    // A scale bar, so the diagram can be read as a distance and not just a shape.
    const kmPerUnit = 111.32; // degrees of latitude to kilometres
    const barKm = Maps.niceStep((spanY * kmPerUnit) / 3);
    const barPx = Math.min(W - 40, (barKm / kmPerUnit) * scale);

    return `
      <svg viewBox="0 0 ${W} ${H}" role="img"
           aria-label="Route map for day ${index + 1}: ${items.length} stops in visiting order">
        ${items.length > 1 ? `<path class="map-route" d="${path}"/>` : ''}
        ${nodes}
        <g class="map-scale">
          <line x1="14" y1="${H - 14}" x2="${(14 + barPx).toFixed(1)}" y2="${H - 14}"/>
          <line x1="14" y1="${H - 18}" x2="14" y2="${H - 10}"/>
          <line x1="${(14 + barPx).toFixed(1)}" y1="${H - 18}" x2="${(14 + barPx).toFixed(1)}" y2="${H - 10}"/>
          <text x="${(18 + barPx).toFixed(1)}" y="${H - 10.5}">${barKm < 1 ? barKm * 1000 + ' m' : barKm + ' km'}</text>
        </g>
      </svg>`;
  },

  /** Round a distance to something a person would print on a scale bar. */
  niceStep(km) {
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
    return steps.find((s) => s >= km) || 100;
  },
};

/* -------------------------------------------------------------------- render */

const Render = {
  everything(plan) {
    const results = $('#results');
    results.hidden = false;

    const nights = plan.request.days === 1 ? 'one day' : `${plan.request.days} days`;
    $('#results-title').textContent = `${plan.city.name}, ${nights}`;
    $('#results-sub').textContent = plan.city.blurb;

    Render.summary(plan);
    Render.budget(plan);
    Render.working(plan);
    Render.tabs(plan);
    Render.days(plan);
    Render.leftOut(plan);
  },

  summary(plan) {
    const s = plan.stats;
    const over = s.totalCost > s.budget;
    $('#summary').innerHTML = `
      <div class="stat">
        <b>${s.stops}</b><span>stops planned</span>
        <small>${duration(s.minutes)} of it</small>
      </div>
      <div class="stat ${over ? 'over' : ''}">
        <b>${money(s.totalCost)}</b><span>of your ${money(s.budget)}</span>
        <small>${over ? 'over budget' : money(s.budget - s.totalCost) + ' left over'}</small>
      </div>
      <div class="stat">
        <b>${s.walkKm.toFixed(1)} km</b><span>on foot in total</span>
        <small>${(s.walkKm / plan.request.days).toFixed(1)} km a day</small>
      </div>
      <div class="stat">
        ${s.savedPct > 0
          ? `<b>${s.savedPct}%</b><span>shorter, once ordered</span>
             <small>${s.savedKm.toFixed(1)} km saved by routing</small>`
          : `<b>${s.optimisedKm.toFixed(1)} km</b><span>of travel between stops</span>
             <small>ordered around the opening hours</small>`}
      </div>`;
  },

  budget(plan) {
    const s = plan.stats;
    const items = plan.days.flatMap((d) => d.items);
    const food = items.filter((i) => i.place.type === 'food').reduce((t, i) => t + i.place.cost, 0);
    const entry = s.entryCost - food;
    const scale = Math.max(s.budget, s.totalCost) || 1;
    const pct = (n) => ((n / scale) * 100).toFixed(1) + '%';

    $('#budget-bar').innerHTML = `
      <div class="bar-track">
        <div class="bar-seg bar-entry" style="width:${pct(entry)}"></div>
        <div class="bar-seg bar-food" style="width:${pct(food)}"></div>
        <div class="bar-seg bar-transit" style="width:${pct(s.transitCost)}"></div>
      </div>
      <div class="bar-key">
        <span><i class="dot" style="background:var(--teal)"></i> Entry ${money(entry)}</span>
        <span><i class="dot" style="background:var(--gold)"></i> Food ${money(food)}</span>
        <span><i class="dot" style="background:var(--teal-lt)"></i> Local transport ${money(s.transitCost)}</span>
        <span>Unspent ${money(Math.max(0, s.budget - s.totalCost))}</span>
      </div>`;
  },

  /**
   * The optimisation report. This is the part worth reading: it says what each
   * pass actually did on this particular trip, so the claims on the page can
   * be checked rather than taken on faith.
   */
  working(plan) {
    const s = plan.stats;

    $('#working-headline').textContent = s.savedPct > 0
      ? `${s.considered} places considered · ${s.stops} scheduled · route ${s.savedPct}% shorter`
      : `${s.considered} places considered · ${s.stops} scheduled · ordered around the opening hours`;

    const passes = [
      ['Scored', `<b>${s.considered}</b> places rated against ${plan.request.interests.length || 'no'} chosen interest${plan.request.interests.length === 1 ? '' : 's'}. <b>${s.interestHitRate}%</b> of the stops that made it match at least one.`],
      ['Selected', `Shortlisted inside a ${duration(PACE[plan.request.pace].targetMins * plan.request.days)} time budget and ${money(s.budget)}.`],
      ['Clustered', `Split into <b>${plan.request.days}</b> geographic group${plan.request.days === 1 ? '' : 's'} by k-means, then balanced so no day is empty.`],
      ['Routed', `<b>${s.routeStarts}</b> starting points tried, <b>${s.twoOptSwaps}</b> improving 2-opt swaps kept.`],
      ['Scheduled', `Laid against real opening hours, with travel time between every stop.`],
      ['Topped up', `<b>${s.toppedUp}</b> extra stop${s.toppedUp === 1 ? '' : 's'} slotted in where the detour was smallest, filling the gaps the estimate left.`],
      ['Improved', `<b>${s.evaluated}</b> alternative arrangements evaluated, <b>${s.climbMoves}</b> improving move${s.climbMoves === 1 ? '' : 's'} and <b>${s.balanceMoves}</b> balancing move${s.balanceMoves === 1 ? '' : 's'} taken. <b>${s.polished}</b> day${s.polished === 1 ? '' : 's'} re-ordered at the end.`],
    ];

    const worstBar = Math.max(s.baselineKm, s.optimisedKm) || 1;

    $('#working-body').innerHTML = `
      <div class="working-grid">
        ${passes.map(([name, text]) => `
          <div class="pass"><h4>${esc(name)}</h4><p>${text}</p></div>`).join('')}
      </div>
      <div class="compare">
        <h4>What the routing pass was worth</h4>
        <div class="compare-row">
          <span>Most-wanted first</span>
          <div class="compare-bar" style="width:${((s.baselineKm / worstBar) * 100).toFixed(1)}%"></div>
          <b>${s.baselineKm.toFixed(1)} km</b>
        </div>
        <div class="compare-row">
          <span>As scheduled</span>
          <div class="compare-bar opt" style="width:${((s.optimisedKm / worstBar) * 100).toFixed(1)}%"></div>
          <b>${s.optimisedKm.toFixed(1)} km</b>
        </div>
        <p class="hint">
          The same stops both times — first in the order you would naturally write
          them down, then in the order they are actually scheduled.
          ${s.savedPct <= 0
            ? `Here the scheduled route is the longer of the two: the shortest
               order would have put a stop outside its opening hours, and an open
               door beats a saved kilometre.`
            : ''}
        </p>
      </div>`;
  },

  tabs(plan) {
    const tabs = [`<button class="day-tab" type="button" role="tab" data-day="all"
        aria-selected="${State.visibleDay === 'all'}">Whole trip</button>`]
      .concat(plan.days.map((d, i) => `
        <button class="day-tab" type="button" role="tab" data-day="${i}"
          aria-selected="${State.visibleDay === String(i)}">Day ${i + 1}</button>`));
    $('#day-tabs').innerHTML = tabs.join('');
  },

  days(plan) {
    const visible = State.visibleDay === 'all'
      ? plan.days.map((d, i) => i)
      : [Number(State.visibleDay)];

    $('#itinerary').innerHTML = visible.map((i) => Render.day(plan, plan.days[i], i)).join('');
  },

  day(plan, day, index) {
    const mins = day.items.reduce((s, i) => s + i.place.mins, 0);
    const cost = day.items.reduce((s, i) => s + i.place.cost, 0);

    if (!day.items.length) {
      return `
        <article class="day">
          <div class="day-head">
            <div><h3>Day ${index + 1}</h3><p>${esc(longDate(day.date))}</p></div>
          </div>
          <p class="stop-blurb">Nothing could be scheduled on this day — usually a budget that has run out, or a lot of places closed on a ${DAY_NAMES[day.date.getDay()]}.</p>
        </article>`;
    }

    const rows = day.items.map((item, n) => {
      const distance = item.travelKm < 0.1 ? 'round the corner' : `${item.travelKm.toFixed(1)} km`;
      const leg = n === 0 ? '' : `
        <div class="leg">${item.mode === 'walk' ? 'walk' : 'transport'} ${distance} · ${item.travelMins} min</div>`;

      const tags = item.place.tags.map((t) => {
        const hit = plan.request.interests.includes(t);
        const label = (INTERESTS.find((i) => i.id === t) || { label: t }).label;
        return `<span class="tag ${hit ? 'hit' : ''}">${esc(label)}</span>`;
      }).join('');

      return `
        ${leg}
        <li class="stop">
          <div class="stop-time">${clock(item.start)}<br><span style="color:var(--ink-3)">${clock(item.end)}</span></div>
          <div class="stop-body">
            <div class="stop-title">
              <span class="num">${n + 1}</span>
              <h4>${esc(item.place.name)}</h4>
              <span class="stop-area">${esc(item.place.area)}</span>
            </div>
            <p class="stop-blurb">${esc(item.place.blurb)}</p>
            <div class="stop-facts">
              <span>${duration(item.place.mins)}</span>
              <span class="cost">${item.place.cost ? money(item.place.cost) : 'free'}</span>
              <span>${item.place.open[0] === 0 && item.place.open[1] === 24
                ? 'open all hours'
                : `open ${clock(item.place.open[0] * 60)}–${clock(item.place.open[1] * 60)}`}</span>
            </div>
            <div class="stop-tags">${tags}</div>
            <div class="stop-actions">
              <button class="btn-drop" type="button" data-drop="${esc(item.place.id)}"
                      title="Remove this stop and rebuild the itinerary around it">Replace this stop</button>
            </div>
          </div>
        </li>`;
    }).join('');

    return `
      <article class="day">
        <div class="day-head">
          <div>
            <h3>Day ${index + 1}</h3>
            <p>${esc(longDate(day.date))}</p>
          </div>
          <div class="day-meta">
            <span>${day.items.length} stops</span>
            <span>${duration(mins)}</span>
            <span>${day.walkKm.toFixed(1)} km on foot</span>
            <span>${cost ? money(cost) : 'free'}</span>
            <span>ends ${clock(day.items[day.items.length - 1].end)}</span>
          </div>
        </div>
        <div class="day-body">
          <ul class="stops">${rows}</ul>
          <figure class="day-map">
            ${Maps.day(day.items, index)}
            <figcaption>Day ${index + 1}, in order. North is up.</figcaption>
          </figure>
        </div>
      </article>`;
  },

  leftOut(plan) {
    const interesting = plan.leftOut.filter((l) => l.reason !== 'time').slice(0, 12);
    const vetoed = plan.leftOut.filter((l) => l.reason === 'vetoed');

    if (!interesting.length) { $('#leftout').innerHTML = ''; return; }

    const label = {
      closed: 'closed on your dates',
      budget: 'over budget',
      vetoed: 'you removed it',
    };

    $('#leftout').innerHTML = `
      <h3>Left out</h3>
      <p>What did not make it, and why.${vetoed.length ? ' Anything you removed comes back if you change the dates or the budget.' : ''}</p>
      <ul>
        ${interesting.map((l) => `
          <li><b>${esc(l.place.name)}</b> — <em>${label[l.reason]}</em></li>`).join('')}
      </ul>`;
  },

  toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2600);
  },
};

/* -------------------------------------------------------------------- export */

const Export = {
  text(plan) {
    const lines = [];
    lines.push(`${plan.city.name} — ${plan.request.days} day${plan.request.days === 1 ? '' : 's'}`);
    lines.push('='.repeat(46));

    plan.days.forEach((day, i) => {
      lines.push('');
      lines.push(`DAY ${i + 1} — ${longDate(day.date)}`);
      day.items.forEach((item) => {
        lines.push(`  ${clock(item.start)}–${clock(item.end)}  ${item.place.name} (${item.place.area})`);
        lines.push(`${' '.repeat(17)}${item.place.cost ? money(item.place.cost) : 'free'} · ${duration(item.place.mins)}`);
      });
      lines.push(`  — ${day.items.length} stops, ${day.walkKm.toFixed(1)} km on foot`);
    });

    lines.push('');
    lines.push(`Total ${money(plan.stats.totalCost)} of a ${money(plan.stats.budget)} budget, ${plan.stats.walkKm.toFixed(1)} km on foot.`);
    lines.push('Planned with nura-ahm.github.io/Trip-Planner');
    return lines.join('\n');
  },

  csv(plan) {
    const cell = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    const rows = [[
      'day', 'date', 'order', 'start', 'end', 'place', 'area', 'tags',
      'minutes', 'cost_eur', 'arrive_by', 'leg_km', 'lat', 'lon',
    ]];

    plan.days.forEach((day, i) => {
      day.items.forEach((item, n) => {
        rows.push([
          i + 1, isoDate(day.date), n + 1, clock(item.start), clock(item.end),
          item.place.name, item.place.area, item.place.tags.join(' '),
          item.place.mins, item.place.cost,
          n === 0 ? 'start' : item.mode, item.travelKm.toFixed(2),
          item.place.lat, item.place.lon,
        ]);
      });
    });

    return rows.map((r) => r.map(cell).join(',')).join('\n');
  },

  /** A floating-time calendar file: no timezone, so it lands where you are. */
  ics(plan) {
    const stamp = (date, mins) => {
      const d = new Date(date);
      d.setHours(0, mins, 0, 0);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
    };
    const fold = (s) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

    // DTSTART and DTEND are deliberately floating — 09:00 means 09:00 wherever
    // you are — but DTSTAMP is a real UTC instant and has to be built as one.
    const utcStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const events = [];
    plan.days.forEach((day, i) => {
      day.items.forEach((item, n) => {
        events.push([
          'BEGIN:VEVENT',
          `UID:${item.place.id}-${i}-${n}@trip-planner`,
          `DTSTAMP:${utcStamp()}`,
          `DTSTART:${stamp(day.date, item.start)}`,
          `DTEND:${stamp(day.date, item.end)}`,
          `SUMMARY:${fold(item.place.name)}`,
          `LOCATION:${fold(item.place.area + ', ' + plan.city.name)}`,
          `DESCRIPTION:${fold(item.place.blurb + ' — ' + (item.place.cost ? money(item.place.cost) : 'free'))}`,
          `GEO:${item.place.lat};${item.place.lon}`,
          'END:VEVENT',
        ].join('\r\n'));
      });
    });

    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Itinerary//Trip Planner//EN',
      'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR',
    ].join('\r\n');
  },

  download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

/* ---------------------------------------------------------------------- run */

function run(options = {}) {
  const request = Form.read();

  if (request.endHour - request.startHour < 3) {
    Render.toast('Give yourself at least three hours in the day.');
    return;
  }

  let plan;
  try {
    plan = planTrip(request);
  } catch (err) {
    Render.toast('Something went wrong building that plan.');
    return;
  }

  Store.save(request);

  // Keep the previous plan in State when the new one comes back empty. The old
  // itinerary is still the one on screen, and the exports read from State — so
  // adopting an empty plan here would hand back a header-only CSV and an empty
  // calendar file while a full trip is visible above them.
  if (plan.empty || !plan.stats.stops) {
    Render.toast('Nothing fits those constraints — try more budget or more hours.');
    return;
  }

  State.plan = plan;

  Render.everything(plan);

  if (options.scroll !== false) {
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* -------------------------------------------------------------------- events */

function wire() {
  $('#trip-form').addEventListener('submit', (event) => {
    event.preventDefault();
    State.excluded = [];
    State.visibleDay = 'all';
    run();
  });

  $('#trip-form').addEventListener('input', Form.sync);
  $('#trip-form').addEventListener('change', Form.sync);

  $('#surprise').addEventListener('click', () => {
    Form.surprise();
    State.visibleDay = 'all';
    run();
  });

  // Day tabs
  $('#day-tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-day]');
    if (!tab || !State.plan) return;
    State.visibleDay = tab.dataset.day;
    Render.tabs(State.plan);
    Render.days(State.plan);

    // Redrawing the strip destroys the button that was just activated, which
    // drops keyboard focus to the body. Put it back on the equivalent tab.
    const restored = $(`#day-tabs [data-day="${State.visibleDay}"]`);
    if (restored) restored.focus();
  });

  // "Not this one" — veto a place and replan around it
  $('#itinerary').addEventListener('click', (event) => {
    const button = event.target.closest('[data-drop]');
    if (!button) return;
    const id = button.dataset.drop;
    if (State.excluded.includes(id)) return;
    State.excluded.push(id);
    run({ scroll: false });
    Render.toast('Replanned without it.');
  });

  // Exports
  $('#export-text').addEventListener('click', async () => {
    if (!State.plan) return;
    const text = Export.text(State.plan);
    try {
      await navigator.clipboard.writeText(text);
      Render.toast('Itinerary copied to the clipboard.');
    } catch (err) {
      Export.download('itinerary.txt', text, 'text/plain');
      Render.toast('Downloaded as a text file instead.');
    }
  });

  $('#export-csv').addEventListener('click', () => {
    if (!State.plan) return;
    Export.download(`${State.plan.city.name.toLowerCase()}-itinerary.csv`,
      Export.csv(State.plan), 'text/csv');
  });

  $('#export-ics').addEventListener('click', () => {
    if (!State.plan) return;
    Export.download(`${State.plan.city.name.toLowerCase()}-itinerary.ics`,
      Export.ics(State.plan), 'text/calendar');
    Render.toast('Open the file to add the trip to your calendar.');
  });

  $('#print').addEventListener('click', () => window.print());
}

/* --------------------------------------------------------------------- boot */

document.addEventListener('DOMContentLoaded', () => {
  Form.build();
  wire();
});
