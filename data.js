/*
 * data.js — the destination catalogue the planner works from.
 *
 * Every place carries the four things the engine needs to reason about it:
 *
 *   lat / lon    so days can be clustered by geography and routed by distance
 *   open / closed so the scheduler can place it at an hour it is actually open
 *   mins / cost  so a day fits in the hours available and the trip fits a budget
 *   tags         so it can be scored against what the traveller cares about
 *
 * Costs are indicative adult entry prices in euro, rounded, and change with
 * time — they are here to make the budget arithmetic meaningful, not to be
 * quoted at a ticket desk. Opening hours are typical rather than exhaustive:
 * `open: [9, 18]` means roughly 09:00–18:00, and `closed` lists weekdays the
 * place is shut, with 0 = Sunday.
 */

'use strict';

/** The interests a traveller can pick, and the tag each one matches. */
const INTERESTS = [
  { id: 'history',      label: 'History',      icon: '🏛' },
  { id: 'art',          label: 'Art',          icon: '🎨' },
  { id: 'food',         label: 'Food',         icon: '🍽' },
  { id: 'architecture', label: 'Architecture', icon: '🏗' },
  { id: 'outdoors',     label: 'Outdoors',     icon: '🌳' },
  { id: 'views',        label: 'Views',        icon: '🌅' },
  { id: 'shopping',     label: 'Markets',      icon: '🛍' },
  { id: 'nightlife',    label: 'Nightlife',    icon: '🌙' },
];

const CITIES = {

  /* ------------------------------------------------------------ istanbul */

  istanbul: {
    name: 'Istanbul',
    country: 'Türkiye',
    blurb: 'Two continents, three empires and a ferry ride between them.',
    pace: { walkKmh: 4.4 },
    places: [
      { id: 'ist-hagia',    name: 'Hagia Sophia',              area: 'Sultanahmet', lat: 41.0086, lon: 28.9802, tags: ['history','architecture'],        cost: 25, mins: 90,  rating: 5.0, open: [9, 19],  closed: [],  blurb: 'Church, mosque, museum, mosque again — 1,500 years under one dome.' },
      { id: 'ist-blue',     name: 'Blue Mosque',               area: 'Sultanahmet', lat: 41.0054, lon: 28.9768, tags: ['architecture','history'],        cost: 0,  mins: 45,  rating: 4.7, open: [9, 18],  closed: [],  blurb: 'Six minarets and twenty thousand İznik tiles. Closed to visitors at prayer times.' },
      { id: 'ist-topkapi',  name: 'Topkapı Palace',            area: 'Sultanahmet', lat: 41.0115, lon: 28.9834, tags: ['history','views'],               cost: 30, mins: 150, rating: 4.8, open: [9, 18],  closed: [2], blurb: 'Four courtyards of Ottoman court life, with the Bosphorus at the end of them.' },
      { id: 'ist-basilica', name: 'Basilica Cistern',          area: 'Sultanahmet', lat: 41.0084, lon: 28.9779, tags: ['history','architecture'],        cost: 20, mins: 45,  rating: 4.5, open: [9, 22],  closed: [],  blurb: 'A sunken forest of Roman columns, two of them resting on Medusa heads.' },
      { id: 'ist-archmus',  name: 'Archaeology Museums',       area: 'Sultanahmet', lat: 41.0117, lon: 28.9812, tags: ['history','art'],                 cost: 12, mins: 100, rating: 4.4, open: [9, 18],  closed: [1], blurb: 'The Alexander Sarcophagus and a quiet courtyard almost nobody finds.' },
      { id: 'ist-grand',    name: 'Grand Bazaar',              area: 'Beyazıt',     lat: 41.0106, lon: 28.9681, tags: ['shopping','history'],            cost: 0,  mins: 90,  rating: 4.4, open: [9, 19],  closed: [0], blurb: '4,000 shops on 61 streets. Getting lost is the intended experience.' },
      { id: 'ist-spice',    name: 'Spice Bazaar',              area: 'Eminönü',     lat: 41.0165, lon: 28.9707, tags: ['shopping','food'],               cost: 0,  mins: 50,  rating: 4.3, open: [8, 19],  closed: [],  blurb: 'Saffron, pistachio paste and pyramids of lokum under vaulted brick.' },
      { id: 'ist-suley',    name: 'Süleymaniye Mosque',        area: 'Fatih',       lat: 41.0166, lon: 28.9639, tags: ['architecture','views'],          cost: 0,  mins: 60,  rating: 4.8, open: [9, 18],  closed: [],  blurb: "Sinan's masterpiece, and the best free view over the Golden Horn." },
      { id: 'ist-chora',    name: 'Chora Mosque',              area: 'Edirnekapı',  lat: 41.0312, lon: 28.9391, tags: ['art','history'],                 cost: 20, mins: 60,  rating: 4.7, open: [9, 18],  closed: [],  blurb: 'The finest Byzantine mosaics anywhere, a long way from the crowds.' },
      { id: 'ist-galata',   name: 'Galata Tower',              area: 'Karaköy',     lat: 41.0256, lon: 28.9744, tags: ['views','history'],               cost: 30, mins: 45,  rating: 4.3, open: [8, 23],  closed: [],  blurb: 'A Genoese watchtower with a 360° balcony. Go at dusk or not at all.' },
      { id: 'ist-istiklal', name: 'İstiklal Avenue',           area: 'Beyoğlu',     lat: 41.0335, lon: 28.9779, tags: ['shopping','nightlife'],          cost: 0,  mins: 70,  rating: 4.1, open: [10, 24], closed: [], blurb: 'Three kilometres of shopfronts, buskers and a red tram that predates all of it.' },
      { id: 'ist-pera',     name: 'Pera Museum',               area: 'Beyoğlu',     lat: 41.0313, lon: 28.9748, tags: ['art'],                           cost: 10, mins: 75,  rating: 4.3, open: [10, 19], closed: [1], blurb: "Orientalist painting, and Osman Hamdi Bey's Tortoise Trainer." },
      { id: 'ist-modern',   name: 'Istanbul Modern',           area: 'Karaköy',     lat: 41.0255, lon: 28.9720, tags: ['art','architecture','views'],    cost: 18, mins: 90,  rating: 4.5, open: [10, 18], closed: [1], blurb: 'Renzo Piano box on the water; the roof terrace is the exhibit.' },
      { id: 'ist-dolma',    name: 'Dolmabahçe Palace',         area: 'Beşiktaş',    lat: 41.0392, lon: 29.0001, tags: ['history','architecture'],        cost: 40, mins: 120, rating: 4.5, open: [9, 16],  closed: [1], blurb: 'The Ottomans spent a quarter of the treasury on it. It shows.' },
      { id: 'ist-bosph',    name: 'Bosphorus Ferry',           area: 'Eminönü',     lat: 41.0177, lon: 28.9739, tags: ['views','outdoors'],              cost: 8,  mins: 100, rating: 4.9, open: [10, 18], closed: [], blurb: 'The cheapest cruise in Europe: a commuter ferry up the strait and back.' },
      { id: 'ist-ortakoy',  name: 'Ortaköy Waterfront',        area: 'Beşiktaş',    lat: 41.0473, lon: 29.0270, tags: ['views','food','outdoors'],       cost: 0,  mins: 60,  rating: 4.4, open: [9, 24],  closed: [], blurb: 'A small baroque mosque framed by a suspension bridge, and stuffed kumpir.' },
      { id: 'ist-kadikoy',  name: 'Kadıköy Market Streets',    area: 'Kadıköy',     lat: 40.9903, lon: 29.0267, tags: ['food','shopping','nightlife'],   cost: 0,  mins: 90,  rating: 4.7, open: [9, 24],  closed: [], blurb: 'Where the city actually eats and drinks. Asian side, worth the ferry.' },
      { id: 'ist-moda',     name: 'Moda Seafront Walk',        area: 'Kadıköy',     lat: 40.9797, lon: 29.0263, tags: ['outdoors','views'],              cost: 0,  mins: 60,  rating: 4.5, open: [7, 23],  closed: [], blurb: 'Tea gardens, cats and the sun going down behind the old city.' },
      { id: 'ist-balat',    name: 'Balat & Fener Lanes',       area: 'Balat',       lat: 41.0294, lon: 28.9483, tags: ['architecture','outdoors'],       cost: 0,  mins: 90,  rating: 4.6, open: [9, 19],  closed: [], blurb: 'Painted houses stacked up a hill, Greek and Jewish Istanbul underneath.' },
      { id: 'ist-hamam',    name: 'Historic Hamam',            area: 'Sultanahmet', lat: 41.0093, lon: 28.9793, tags: ['history'],                       cost: 55, mins: 90,  rating: 4.6, open: [8, 22],  closed: [], blurb: 'Marble, steam and a scrub. Book the late slot and sleep well.' },
      { id: 'ist-princes',  name: 'Büyükada, Princes’ Islands', area: 'Adalar',     lat: 40.8570, lon: 29.1230, tags: ['outdoors','views'],              cost: 6,  mins: 300, rating: 4.6, open: [9, 19],  closed: [], blurb: 'No cars, pine woods and wooden mansions. A whole day, ferry included.' },
      { id: 'ist-cukur',    name: 'Çukurcuma Antique Quarter', area: 'Beyoğlu',    lat: 41.0323, lon: 28.9806, tags: ['shopping','art'],                cost: 0,  mins: 60,  rating: 4.2, open: [11, 19], closed: [0], blurb: 'Junk shops and good ones, on the streets below İstiklal.' },
      { id: 'ist-inno',     name: 'Museum of Innocence',       area: 'Çukurcuma',   lat: 41.0316, lon: 28.9810, tags: ['art','history'],                 cost: 12, mins: 70,  rating: 4.4, open: [10, 18], closed: [1], blurb: "Pamuk's novel built as a cabinet of 4,213 cigarette stubs and other relics." },
      { id: 'ist-rumeli',   name: 'Rumeli Fortress',           area: 'Sarıyer',     lat: 41.0850, lon: 29.0566, tags: ['history','views','outdoors'],    cost: 10, mins: 80,  rating: 4.5, open: [9, 18],  closed: [3], blurb: 'Built in four months in 1452 to strangle the strait. Steep steps, huge view.' },
      { id: 'ist-ciya',     name: 'Çiya Sofrası',              area: 'Kadıköy',     lat: 40.9899, lon: 29.0259, tags: ['food'],                          cost: 22, mins: 75,  rating: 4.8, open: [11, 22], closed: [], type: 'food', blurb: 'Regional Anatolian cooking that turned into a research project.' },
      { id: 'ist-karakoy',  name: 'Karaköy Meyhane Dinner',    area: 'Karaköy',     lat: 41.0245, lon: 28.9772, tags: ['food','nightlife'],              cost: 35, mins: 110, rating: 4.6, open: [18, 24], closed: [], type: 'food', blurb: 'Meze, rakı and no hurry whatsoever. The correct way to end a day.' },
      { id: 'ist-balik',    name: 'Fish Sandwich, Eminönü',    area: 'Eminönü',     lat: 41.0184, lon: 28.9731, tags: ['food'],                          cost: 6,  mins: 35,  rating: 4.3, open: [10, 22], closed: [], type: 'food', blurb: 'Grilled mackerel in bread, eaten standing up by the bridge.' },
      { id: 'ist-breakf',   name: 'Bebek Breakfast',           area: 'Bebek',       lat: 41.0776, lon: 29.0435, tags: ['food','views'],                  cost: 24, mins: 90,  rating: 4.5, open: [8, 13],  closed: [], type: 'food', blurb: 'A two-hour Turkish breakfast with the Bosphorus at the table edge.' },
    ],
  },

  /* ---------------------------------------------------------------- rome */

  rome: {
    name: 'Rome',
    country: 'Italy',
    blurb: 'Three thousand years of city, stacked on top of itself.',
    pace: { walkKmh: 4.4 },
    places: [
      { id: 'rom-colo',   name: 'Colosseum',                area: 'Celio',      lat: 41.8902, lon: 12.4922, tags: ['history','architecture'],       cost: 18, mins: 100, rating: 5.0, open: [9, 19],  closed: [], blurb: 'Fifty thousand seats, and a floor you can now walk out onto.' },
      { id: 'rom-forum',  name: 'Roman Forum & Palatine',   area: 'Celio',      lat: 41.8925, lon: 12.4853, tags: ['history'],                      cost: 0,  mins: 120, rating: 4.8, open: [9, 19],  closed: [], blurb: 'Included with the Colosseum ticket. Start on the Palatine and look down.' },
      { id: 'rom-panth',  name: 'Pantheon',                 area: 'Pigna',      lat: 41.8986, lon: 12.4769, tags: ['architecture','history'],       cost: 5,  mins: 40,  rating: 4.9, open: [9, 19],  closed: [], blurb: 'Still the largest unreinforced concrete dome on earth, at 1,900 years old.' },
      { id: 'rom-vatmus', name: 'Vatican Museums',          area: 'Vatican',    lat: 41.9065, lon: 12.4536, tags: ['art','history'],                cost: 20, mins: 180, rating: 4.7, open: [8, 19],  closed: [0], blurb: 'Seven kilometres of galleries funnelling into the Sistine Chapel.' },
      { id: 'rom-stpete', name: "St Peter's Basilica",      area: 'Vatican',    lat: 41.9022, lon: 12.4539, tags: ['architecture','history'],       cost: 0,  mins: 75,  rating: 4.8, open: [7, 18],  closed: [], blurb: 'Free to enter, and larger inside than your eye will accept.' },
      { id: 'rom-dome',   name: "St Peter's Dome Climb",    area: 'Vatican',    lat: 41.9022, lon: 12.4534, tags: ['views'],                        cost: 10, mins: 60,  rating: 4.7, open: [8, 17],  closed: [], blurb: '551 steps, narrowing and leaning, to the best view in Rome.' },
      { id: 'rom-castel', name: "Castel Sant'Angelo",       area: 'Borgo',      lat: 41.9031, lon: 12.4663, tags: ['history','views'],              cost: 15, mins: 80,  rating: 4.4, open: [9, 19],  closed: [1], blurb: "Hadrian's tomb, then a fortress, then a papal escape route." },
      { id: 'rom-trevi',  name: 'Trevi Fountain',           area: 'Trevi',      lat: 41.9009, lon: 12.4833, tags: ['architecture'],                 cost: 0,  mins: 30,  rating: 4.6, open: [0, 24],  closed: [], blurb: 'Go at 7am or midnight; at any other hour it is a crowd with a fountain in it.' },
      { id: 'rom-spanish',name: 'Spanish Steps',            area: 'Campo Marzio',lat: 41.9060, lon: 12.4823, tags: ['architecture','shopping'],     cost: 0,  mins: 35,  rating: 4.2, open: [0, 24],  closed: [], blurb: '135 steps between a boat-shaped fountain and a French church.' },
      { id: 'rom-borgh',  name: 'Galleria Borghese',        area: 'Pinciano',   lat: 41.9142, lon: 12.4922, tags: ['art'],                          cost: 15, mins: 120, rating: 4.9, open: [9, 19],  closed: [1], blurb: "Bernini's marble that behaves like flesh. Two-hour slots, booked ahead." },
      { id: 'rom-villa',  name: 'Villa Borghese Gardens',   area: 'Pinciano',   lat: 41.9139, lon: 12.4850, tags: ['outdoors','views'],             cost: 0,  mins: 70,  rating: 4.5, open: [7, 21],  closed: [], blurb: 'Eighty hectares of umbrella pine, with a terrace over Piazza del Popolo.' },
      { id: 'rom-traste', name: 'Trastevere Lanes',         area: 'Trastevere', lat: 41.8891, lon: 12.4696, tags: ['food','nightlife','outdoors'],  cost: 0,  mins: 90,  rating: 4.7, open: [10, 24], closed: [], blurb: 'Ivy, cobbles and the city eating outside. Loudest and best after dark.' },
      { id: 'rom-janic',  name: 'Janiculum Terrace',        area: 'Trastevere', lat: 41.8917, lon: 12.4614, tags: ['views','outdoors'],             cost: 0,  mins: 45,  rating: 4.7, open: [0, 24],  closed: [], blurb: 'The whole city laid out flat, and a cannon fired at noon.' },
      { id: 'rom-campo',  name: 'Campo de’ Fiori Market',   area: 'Parione',    lat: 41.8955, lon: 12.4722, tags: ['shopping','food'],              cost: 0,  mins: 45,  rating: 4.2, open: [7, 14],  closed: [0], blurb: 'A morning market under a statue of a man the Church burned here.' },
      { id: 'rom-navona', name: 'Piazza Navona',            area: 'Parione',    lat: 41.8992, lon: 12.4731, tags: ['architecture','art'],           cost: 0,  mins: 35,  rating: 4.5, open: [0, 24],  closed: [], blurb: 'Built on the shape of a Roman stadium, with Bernini’s rivers in the middle.' },
      { id: 'rom-capito', name: 'Capitoline Museums',       area: 'Campitelli', lat: 41.8931, lon: 12.4828, tags: ['art','history'],                cost: 16, mins: 110, rating: 4.6, open: [9, 20],  closed: [], blurb: 'The oldest public museum in the world, on Michelangelo’s square.' },
      { id: 'rom-appia',  name: 'Appian Way by Bike',       area: 'Appio',      lat: 41.8556, lon: 12.5163, tags: ['outdoors','history'],           cost: 15, mins: 180, rating: 4.6, open: [9, 18],  closed: [], blurb: 'Basalt paving, aqueducts and tombs, with almost nobody on it.' },
      { id: 'rom-ostia',  name: 'Ostia Antica',             area: 'Ostia',      lat: 41.7556, lon: 12.2919, tags: ['history','outdoors'],           cost: 18, mins: 210, rating: 4.7, open: [9, 18],  closed: [1], blurb: 'Rome’s port town, as complete as Pompeii and a train ride away.' },
      { id: 'rom-mmm',    name: 'Baths of Caracalla',       area: 'Aventino',   lat: 41.8790, lon: 12.4924, tags: ['history','architecture'],       cost: 10, mins: 80,  rating: 4.5, open: [9, 18],  closed: [1], blurb: 'Brick walls the height of an office block, once a spa for 1,600 people.' },
      { id: 'rom-avent',  name: 'Aventine Keyhole',         area: 'Aventino',   lat: 41.8829, lon: 12.4783, tags: ['views'],                        cost: 0,  mins: 30,  rating: 4.4, open: [7, 20],  closed: [], blurb: 'A keyhole in a green door, framing the dome three kilometres away.' },
      { id: 'rom-testac', name: 'Testaccio Market',         area: 'Testaccio',  lat: 41.8768, lon: 12.4750, tags: ['food','shopping'],              cost: 12, mins: 70,  rating: 4.6, open: [7, 15],  closed: [0], type: 'food', blurb: 'Where Romans buy lunch: box of supplì, allesso sandwich, done.' },
      { id: 'rom-carbo',  name: 'Trattoria Dinner, Testaccio', area: 'Testaccio', lat: 41.8778, lon: 12.4761, tags: ['food'],                       cost: 32, mins: 100, rating: 4.7, open: [19, 23], closed: [0], type: 'food', blurb: 'Cacio e pepe, carbonara, amatriciana — the four Roman pastas, done plainly.' },
      { id: 'rom-gelato', name: 'Gelato in the Centro',     area: 'Pigna',      lat: 41.8979, lon: 12.4783, tags: ['food'],                         cost: 4,  mins: 25,  rating: 4.5, open: [11, 23], closed: [], type: 'food', blurb: 'Pistachio should be dull green. If it is bright, walk out.' },
      { id: 'rom-pizza',  name: 'Pizza al Taglio Lunch',    area: 'Parione',    lat: 41.8975, lon: 12.4715, tags: ['food'],                         cost: 8,  mins: 35,  rating: 4.6, open: [11, 16], closed: [], type: 'food', blurb: 'Sold by weight, cut with scissors, eaten on a wall.' },
      { id: 'rom-coffee', name: "Sant'Eustachio Coffee",    area: 'Pigna',      lat: 41.8983, lon: 12.4753, tags: ['food'],                         cost: 3,  mins: 20,  rating: 4.4, open: [7, 21],  closed: [], type: 'food', blurb: 'Stand at the bar. Say "senza zucchero" if you do not want it sweetened.' },
      { id: 'rom-nightw', name: 'Centro Storico After Dark', area: 'Pigna',     lat: 41.8990, lon: 12.4760, tags: ['nightlife','architecture'],     cost: 0,  mins: 75,  rating: 4.8, open: [21, 24], closed: [], blurb: 'The Pantheon and Navona, floodlit and nearly empty. Rome’s best hour.' },
    ],
  },

  /* --------------------------------------------------------------- paris */

  paris: {
    name: 'Paris',
    country: 'France',
    blurb: 'Nineteenth-century town planning that never stopped working.',
    pace: { walkKmh: 4.5 },
    places: [
      { id: 'par-louvre', name: 'Louvre',                   area: '1st',        lat: 48.8606, lon: 2.3376, tags: ['art','history'],            cost: 22, mins: 180, rating: 4.8, open: [9, 18],  closed: [2], blurb: 'Pick two wings and ignore the rest, or it wins.' },
      { id: 'par-orsay',  name: "Musée d'Orsay",            area: '7th',        lat: 48.8600, lon: 2.3266, tags: ['art','architecture'],       cost: 16, mins: 120, rating: 4.9, open: [9, 18],  closed: [1], blurb: 'A railway station full of Impressionists, under the great clock.' },
      { id: 'par-orang',  name: 'Musée de l’Orangerie',     area: '1st',        lat: 48.8638, lon: 2.3226, tags: ['art'],                      cost: 13, mins: 70,  rating: 4.7, open: [9, 18],  closed: [2], blurb: "Monet's Water Lilies in two oval rooms built for them." },
      { id: 'par-eiffel', name: 'Eiffel Tower',             area: '7th',        lat: 48.8584, lon: 2.2945, tags: ['views','architecture'],     cost: 29, mins: 110, rating: 4.6, open: [9, 23],  closed: [], blurb: 'Booked slots, long lifts. The second floor beats the summit for the view.' },
      { id: 'par-notre',  name: 'Notre-Dame',               area: '4th',        lat: 48.8530, lon: 2.3499, tags: ['architecture','history'],   cost: 0,  mins: 60,  rating: 4.8, open: [8, 19],  closed: [], blurb: 'Reopened after the fire, scrubbed back to a colour nobody alive had seen.' },
      { id: 'par-sainte', name: 'Sainte-Chapelle',          area: '1st',        lat: 48.8554, lon: 2.3450, tags: ['architecture','art'],       cost: 13, mins: 45,  rating: 4.9, open: [9, 17],  closed: [], blurb: 'Fifteen windows, 1,113 scenes, and almost no wall left holding them up.' },
      { id: 'par-sacre',  name: 'Sacré-Cœur & Montmartre',  area: '18th',       lat: 48.8867, lon: 2.3431, tags: ['views','architecture'],     cost: 0,  mins: 90,  rating: 4.6, open: [6, 22],  closed: [], blurb: 'Up the hill on foot, not the funicular. The steps are the point.' },
      { id: 'par-pompi',  name: 'Centre Pompidou',          area: '4th',        lat: 48.8607, lon: 2.3522, tags: ['art','architecture','views'], cost: 15, mins: 110, rating: 4.5, open: [11, 21], closed: [2], blurb: 'The building inside out, and modern art on the top two floors.' },
      { id: 'par-rodin',  name: 'Musée Rodin',              area: '7th',        lat: 48.8553, lon: 2.3158, tags: ['art','outdoors'],           cost: 14, mins: 90,  rating: 4.7, open: [10, 18], closed: [1], blurb: 'The Thinker in a rose garden. Buy the garden-only ticket in summer.' },
      { id: 'par-marais', name: 'Le Marais Walk',           area: '3rd',        lat: 48.8590, lon: 2.3620, tags: ['architecture','shopping','food'], cost: 0, mins: 90, rating: 4.7, open: [10, 20], closed: [], blurb: 'Medieval streets that dodged Haussmann, plus the best falafel queue in the city.' },
      { id: 'par-vosges', name: 'Place des Vosges',         area: '4th',        lat: 48.8555, lon: 2.3655, tags: ['architecture','outdoors'],  cost: 0,  mins: 40,  rating: 4.6, open: [7, 22],  closed: [], blurb: "Paris's oldest planned square, and Victor Hugo's flat in the corner." },
      { id: 'par-lux',    name: 'Jardin du Luxembourg',     area: '6th',        lat: 48.8462, lon: 2.3372, tags: ['outdoors'],                 cost: 0,  mins: 70,  rating: 4.8, open: [7, 21],  closed: [], blurb: 'Green metal chairs you may move anywhere. Do that, and sit for an hour.' },
      { id: 'par-quart',  name: 'Latin Quarter & Panthéon', area: '5th',        lat: 48.8462, lon: 2.3464, tags: ['history','architecture'],   cost: 13, mins: 100, rating: 4.5, open: [10, 18], closed: [], blurb: 'Foucault’s pendulum still swinging, and the crypt underneath.' },
      { id: 'par-pere',   name: 'Père-Lachaise',            area: '20th',       lat: 48.8614, lon: 2.3922, tags: ['outdoors','history'],       cost: 0,  mins: 100, rating: 4.6, open: [8, 18],  closed: [], blurb: 'A hilly stone city of the dead. Take the map at the gate or lose an hour.' },
      { id: 'par-canal',  name: 'Canal Saint-Martin',       area: '10th',       lat: 48.8709, lon: 2.3661, tags: ['outdoors','nightlife'],     cost: 0,  mins: 70,  rating: 4.4, open: [8, 24],  closed: [], blurb: 'Iron footbridges, plane trees, and everyone under 35 sitting on the quay.' },
      { id: 'par-seine',  name: 'Seine Walk, Île Saint-Louis', area: '4th',     lat: 48.8517, lon: 2.3570, tags: ['outdoors','views'],         cost: 0,  mins: 60,  rating: 4.7, open: [0, 24],  closed: [], blurb: 'The quiet island behind the loud one. Ice cream, then the quay steps.' },
      { id: 'par-versai', name: 'Versailles',               area: 'Versailles', lat: 48.8049, lon: 2.1204, tags: ['history','architecture','outdoors'], cost: 21, mins: 300, rating: 4.7, open: [9, 18], closed: [1], blurb: 'Half a day minimum. The gardens are the better half and often free.' },
      { id: 'par-picas',  name: 'Musée Picasso',            area: '3rd',        lat: 48.8600, lon: 2.3626, tags: ['art'],                      cost: 14, mins: 90,  rating: 4.4, open: [10, 18], closed: [1], blurb: 'A 17th-century mansion holding the estate’s own pick of the work.' },
      { id: 'par-cata',   name: 'Catacombs',                area: '14th',       lat: 48.8338, lon: 2.3324, tags: ['history'],                  cost: 29, mins: 75,  rating: 4.3, open: [10, 20], closed: [1], blurb: 'Six million people, stacked politely. Book, or queue for three hours.' },
      { id: 'par-buttes', name: 'Buttes-Chaumont',          area: '19th',       lat: 48.8809, lon: 2.3826, tags: ['outdoors','views'],         cost: 0,  mins: 80,  rating: 4.6, open: [7, 22],  closed: [], blurb: 'A quarry turned into cliffs, a lake and a temple. Parisians, no tourists.' },
      { id: 'par-marche', name: "Marché d'Aligre",          area: '12th',       lat: 48.8489, lon: 2.3782, tags: ['shopping','food'],          cost: 0,  mins: 60,  rating: 4.5, open: [8, 13],  closed: [1], type: 'food', blurb: 'Covered hall, open street stalls and a wine bar that opens at nine.' },
      { id: 'par-bistro', name: 'Bistro Dinner, 11th',      area: '11th',       lat: 48.8570, lon: 2.3785, tags: ['food'],                     cost: 38, mins: 110, rating: 4.6, open: [19, 23], closed: [0], type: 'food', blurb: 'Chalkboard menu, four starters, four mains. Order what ran out yesterday.' },
      { id: 'par-boul',   name: 'Bakery Breakfast',         area: '6th',        lat: 48.8510, lon: 2.3340, tags: ['food'],                     cost: 7,  mins: 30,  rating: 4.7, open: [7, 12],  closed: [1], type: 'food', blurb: 'A croissant from a bakery with a queue of locals, eaten on the walk.' },
      { id: 'par-cheese', name: 'Rue Mouffetard Food Street', area: '5th',      lat: 48.8419, lon: 2.3497, tags: ['food','shopping'],          cost: 15, mins: 70,  rating: 4.5, open: [9, 19],  closed: [1], type: 'food', blurb: 'Cheese, bread, a bottle — assemble a picnic and carry it to the Luxembourg.' },
      { id: 'par-wine',   name: 'Wine Bar, Canal',          area: '10th',       lat: 48.8724, lon: 2.3655, tags: ['food','nightlife'],         cost: 25, mins: 90,  rating: 4.4, open: [18, 24], closed: [], type: 'food', blurb: 'Natural wine, a plate of charcuterie, and a very long evening.' },
    ],
  },

  /* ----------------------------------------------------------- barcelona */

  barcelona: {
    name: 'Barcelona',
    country: 'Spain',
    blurb: 'A grid on a plain, with Gaudí breaking it at intervals.',
    pace: { walkKmh: 4.5 },
    places: [
      { id: 'bcn-sagrada',name: 'Sagrada Família',          area: 'Eixample',   lat: 41.4036, lon: 2.1744, tags: ['architecture','art'],       cost: 26, mins: 100, rating: 5.0, open: [9, 19],  closed: [], blurb: 'A century and a half in, and the towers finally topped out.' },
      { id: 'bcn-guell',  name: 'Park Güell',               area: 'Gràcia',     lat: 41.4145, lon: 2.1527, tags: ['architecture','views','outdoors'], cost: 18, mins: 110, rating: 4.6, open: [9, 19], closed: [], blurb: 'A failed housing estate that became the best terrace in the city.' },
      { id: 'bcn-batllo', name: 'Casa Batlló',              area: 'Eixample',   lat: 41.3917, lon: 2.1650, tags: ['architecture'],             cost: 35, mins: 80,  rating: 4.7, open: [9, 20],  closed: [], blurb: 'A dragon’s back for a roof and not one straight line inside.' },
      { id: 'bcn-pedrera',name: 'La Pedrera (Casa Milà)',   area: 'Eixample',   lat: 41.3953, lon: 2.1619, tags: ['architecture','views'],     cost: 28, mins: 80,  rating: 4.6, open: [9, 20],  closed: [], blurb: 'Warrior chimneys on the roof, and the attic’s catenary arches below.' },
      { id: 'bcn-gotic',  name: 'Gothic Quarter Walk',      area: 'Ciutat Vella',lat: 41.3833, lon: 2.1767, tags: ['history','architecture'],  cost: 0,  mins: 90,  rating: 4.7, open: [8, 23],  closed: [], blurb: 'Roman wall, medieval lanes, and a cathedral with geese in the cloister.' },
      { id: 'bcn-catedral',name: 'Barcelona Cathedral',     area: 'Ciutat Vella',lat: 41.3839, lon: 2.1762, tags: ['architecture','history'],  cost: 9,  mins: 55,  rating: 4.5, open: [9, 18],  closed: [], blurb: 'Thirteen geese in the cloister, one for each year of Saint Eulàlia’s life.' },
      { id: 'bcn-picasso',name: 'Museu Picasso',            area: 'El Born',    lat: 41.3851, lon: 2.1810, tags: ['art'],                      cost: 14, mins: 90,  rating: 4.5, open: [10, 19], closed: [1], blurb: 'The early work — the years before he was Picasso. Five joined palaces.' },
      { id: 'bcn-mar',    name: 'Santa Maria del Mar',      area: 'El Born',    lat: 41.3839, lon: 2.1819, tags: ['architecture','history'],   cost: 6,  mins: 45,  rating: 4.8, open: [10, 20], closed: [], blurb: 'Built in 55 years by the port’s own workers, and it feels like one idea.' },
      { id: 'bcn-boque',  name: 'La Boqueria Market',       area: 'El Raval',   lat: 41.3817, lon: 2.1717, tags: ['food','shopping'],          cost: 0,  mins: 55,  rating: 4.4, open: [8, 20],  closed: [0], blurb: 'Go past the smoothie stalls at the front; the real market is at the back.' },
      { id: 'bcn-macba',  name: 'MACBA & Raval',            area: 'El Raval',   lat: 41.3833, lon: 2.1667, tags: ['art','architecture'],       cost: 12, mins: 90,  rating: 4.2, open: [11, 19], closed: [2], blurb: 'A white Meier box, permanently ringed by skateboarders.' },
      { id: 'bcn-montju', name: 'Montjuïc & Cable Car',     area: 'Montjuïc',   lat: 41.3639, lon: 2.1650, tags: ['views','outdoors'],         cost: 14, mins: 120, rating: 4.6, open: [10, 20], closed: [], blurb: 'Castle, gardens and the harbour from above. Take the cable car one way.' },
      { id: 'bcn-miro',   name: 'Fundació Joan Miró',       area: 'Montjuïc',   lat: 41.3685, lon: 2.1600, tags: ['art','architecture'],       cost: 14, mins: 90,  rating: 4.6, open: [10, 19], closed: [1], blurb: 'A building Sert designed for the work, full of light and shadow.' },
      { id: 'bcn-mnac',   name: 'MNAC (Catalan Art)',       area: 'Montjuïc',   lat: 41.3684, lon: 2.1535, tags: ['art','history','views'],    cost: 12, mins: 110, rating: 4.5, open: [10, 18], closed: [1], blurb: 'Romanesque frescoes lifted off Pyrenean church walls. Extraordinary.' },
      { id: 'bcn-barcel', name: 'Barceloneta Beach',        area: 'Barceloneta',lat: 41.3784, lon: 2.1925, tags: ['outdoors','views'],         cost: 0,  mins: 100, rating: 4.3, open: [7, 21],  closed: [], blurb: 'City beach, entirely artificial, built for the 1992 Olympics.' },
      { id: 'bcn-ciutad', name: 'Parc de la Ciutadella',    area: 'El Born',    lat: 41.3884, lon: 2.1867, tags: ['outdoors'],                 cost: 0,  mins: 70,  rating: 4.4, open: [8, 21],  closed: [], blurb: 'A monumental fountain a young Gaudí worked on, and rowing boats.' },
      { id: 'bcn-hosp',   name: 'Hospital de Sant Pau',     area: 'Guinardó',   lat: 41.4126, lon: 2.1744, tags: ['architecture'],             cost: 16, mins: 80,  rating: 4.7, open: [9, 18],  closed: [], blurb: 'Domènech i Montaner’s modernista hospital. Better than Gaudí, some say.' },
      { id: 'bcn-musica', name: 'Palau de la Música',       area: 'Sant Pere',  lat: 41.3875, lon: 2.1751, tags: ['architecture','art'],       cost: 20, mins: 60,  rating: 4.8, open: [10, 15], closed: [], blurb: 'A concert hall lit entirely by daylight through a stained-glass sun.' },
      { id: 'bcn-bunker', name: 'Bunkers del Carmel',       area: 'El Carmel',  lat: 41.4194, lon: 2.1622, tags: ['views','outdoors'],         cost: 0,  mins: 80,  rating: 4.8, open: [7, 21],  closed: [], blurb: 'Civil-war anti-aircraft platforms, now the 360° view everyone climbs for.' },
      { id: 'bcn-gracia', name: 'Gràcia Squares',           area: 'Gràcia',     lat: 41.4036, lon: 2.1561, tags: ['food','nightlife','outdoors'], cost: 0, mins: 80, rating: 4.6, open: [10, 24], closed: [], blurb: 'A separate town until 1897, and it still behaves like one after dark.' },
      { id: 'bcn-tibi',   name: 'Tibidabo',                 area: 'Collserola', lat: 41.4225, lon: 2.1189, tags: ['views','outdoors'],         cost: 15, mins: 180, rating: 4.4, open: [11, 20], closed: [1], blurb: 'A 1901 funfair on a mountain, with a church on top of it.' },
      { id: 'bcn-tapas',  name: 'Tapas Crawl, El Born',     area: 'El Born',    lat: 41.3845, lon: 2.1830, tags: ['food','nightlife'],         cost: 30, mins: 110, rating: 4.7, open: [19, 24], closed: [], type: 'food', blurb: 'Three bars, one plate each, standing up. Never sit down at the first.' },
      { id: 'bcn-verm',   name: 'Sunday Vermouth',          area: 'Gràcia',     lat: 41.4029, lon: 2.1573, tags: ['food'],                     cost: 12, mins: 60,  rating: 4.5, open: [12, 15], closed: [], type: 'food', blurb: 'Vermut on tap with a plate of olives. A Catalan institution, before lunch.' },
      { id: 'bcn-paella', name: 'Seafood Lunch, Barceloneta', area: 'Barceloneta', lat: 41.3771, lon: 2.1899, tags: ['food'],                  cost: 34, mins: 100, rating: 4.4, open: [13, 16], closed: [], type: 'food', blurb: 'Rice, not "paella" off a photo menu. Look for the ones facing away from the sea.' },
      { id: 'bcn-churro', name: 'Xurros amb Xocolata',      area: 'Ciutat Vella',lat: 41.3822, lon: 2.1750, tags: ['food'],                    cost: 6,  mins: 30,  rating: 4.5, open: [8, 13],  closed: [], type: 'food', blurb: 'Thick chocolate you eat with a spoon, and something to dip in it.' },
      { id: 'bcn-market', name: 'Mercat de Sant Antoni',    area: 'Sant Antoni',lat: 41.3793, lon: 2.1620, tags: ['shopping','food'],          cost: 10, mins: 60,  rating: 4.5, open: [8, 20],  closed: [0], type: 'food', blurb: 'The market locals use, in a restored iron hall, with a book market on Sundays.' },
    ],
  },

  /* ----------------------------------------------------------- amsterdam */

  amsterdam: {
    name: 'Amsterdam',
    country: 'Netherlands',
    blurb: 'A city built on piles, arranged in rings, and travelled by bicycle.',
    pace: { walkKmh: 4.6 },
    places: [
      { id: 'ams-rijks',  name: 'Rijksmuseum',              area: 'Museumkwartier', lat: 52.3600, lon: 4.8852, tags: ['art','history'],        cost: 23, mins: 160, rating: 4.9, open: [9, 17],  closed: [], blurb: 'The Night Watch, and eight hundred years of the country around it.' },
      { id: 'ams-vgogh',  name: 'Van Gogh Museum',          area: 'Museumkwartier', lat: 52.3584, lon: 4.8811, tags: ['art'],                  cost: 22, mins: 120, rating: 4.8, open: [9, 18],  closed: [], blurb: 'Two hundred paintings in the order he made them. Timed entry only.' },
      { id: 'ams-anne',   name: 'Anne Frank House',         area: 'Jordaan',    lat: 52.3752, lon: 4.8840, tags: ['history'],                  cost: 16, mins: 90,  rating: 4.8, open: [9, 22],  closed: [], blurb: 'Tickets only online, six weeks ahead. The annexe is left empty on purpose.' },
      { id: 'ams-stedel', name: 'Stedelijk Museum',         area: 'Museumkwartier', lat: 52.3580, lon: 4.8796, tags: ['art','architecture'],   cost: 22, mins: 100, rating: 4.4, open: [10, 18], closed: [], blurb: 'Modern and contemporary, in a building everyone calls the bathtub.' },
      { id: 'ams-canal',  name: 'Canal Ring Walk',          area: 'Grachtengordel', lat: 52.3700, lon: 4.8850, tags: ['architecture','outdoors'], cost: 0, mins: 90, rating: 4.8, open: [0, 24], closed: [], blurb: 'Herengracht, Keizersgracht, Prinsengracht — 17th-century zoning, still intact.' },
      { id: 'ams-boat',   name: 'Canal Boat Tour',          area: 'Centrum',    lat: 52.3730, lon: 4.8926, tags: ['views','outdoors'],         cost: 18, mins: 75,  rating: 4.5, open: [10, 22], closed: [], blurb: 'The city was built to be seen from the water. Take the small open boat.' },
      { id: 'ams-jordaan',name: 'Jordaan Lanes',            area: 'Jordaan',    lat: 52.3745, lon: 4.8800, tags: ['architecture','shopping','food'], cost: 0, mins: 80, rating: 4.7, open: [9, 22], closed: [], blurb: 'Workers’ housing that gentrified beautifully. Courtyards behind plain doors.' },
      { id: 'ams-begijn', name: 'Begijnhof',                area: 'Centrum',    lat: 52.3691, lon: 4.8899, tags: ['history','architecture'],   cost: 0,  mins: 35,  rating: 4.6, open: [9, 17],  closed: [], blurb: 'A silent 14th-century courtyard, thirty metres off the busiest street.' },
      { id: 'ams-vonde',  name: 'Vondelpark',               area: 'Oud-Zuid',   lat: 52.3580, lon: 4.8686, tags: ['outdoors'],                 cost: 0,  mins: 70,  rating: 4.6, open: [7, 23],  closed: [], blurb: 'Forty-seven hectares, and the whole city in it the moment the sun appears.' },
      { id: 'ams-neme',   name: 'NEMO Science Museum Roof', area: 'Oosterdok',  lat: 52.3738, lon: 4.9123, tags: ['views','architecture'],     cost: 0,  mins: 45,  rating: 4.4, open: [10, 19], closed: [], blurb: 'The sloping copper roof is a free public square with the best city view.' },
      { id: 'ams-eye',    name: 'Eye Filmmuseum',           area: 'Noord',      lat: 52.3844, lon: 4.9006, tags: ['art','architecture','views'], cost: 12, mins: 80, rating: 4.5, open: [10, 19], closed: [], blurb: 'Free ferry across the IJ, then a white origami building on the far bank.' },
      { id: 'ams-nooord', name: 'Amsterdam-Noord & NDSM',   area: 'Noord',      lat: 52.4008, lon: 4.8931, tags: ['art','nightlife'],          cost: 0,  mins: 100, rating: 4.4, open: [10, 24], closed: [], blurb: 'A shipyard turned into studios, murals and a beach bar. Ferry is free.' },
      { id: 'ams-albert', name: 'Albert Cuyp Market',       area: 'De Pijp',    lat: 52.3556, lon: 4.8917, tags: ['shopping','food'],          cost: 0,  mins: 60,  rating: 4.3, open: [9, 17],  closed: [0], blurb: 'A kilometre of stalls. Buy a stroopwafel pressed while you wait.' },
      { id: 'ams-pijp',   name: 'De Pijp Evening',          area: 'De Pijp',    lat: 52.3547, lon: 4.8930, tags: ['food','nightlife'],         cost: 0,  mins: 80,  rating: 4.5, open: [17, 24], closed: [], blurb: 'The neighbourhood that eats out. Small plates, loud rooms, no reservations.' },
      { id: 'ams-hermit', name: 'H’ART Museum',             area: 'Centrum',    lat: 52.3652, lon: 4.9020, tags: ['art','history'],            cost: 20, mins: 100, rating: 4.4, open: [10, 17], closed: [], blurb: 'A 17th-century almshouse on the Amstel, now borrowing major shows.' },
      { id: 'ams-tropen', name: 'Tropenmuseum',             area: 'Oost',       lat: 52.3624, lon: 4.9226, tags: ['history','art'],            cost: 18, mins: 100, rating: 4.5, open: [10, 17], closed: [1], blurb: 'The colonial collection, re-hung to argue with itself. Honest and good.' },
      { id: 'ams-bike',   name: 'Bike Ride to Amstelpark',  area: 'Amstel',     lat: 52.3300, lon: 4.8935, tags: ['outdoors','views'],         cost: 12, mins: 150, rating: 4.7, open: [8, 20],  closed: [], blurb: 'Out along the river past windmills, on a bike, like a functioning adult.' },
      { id: 'ams-zaanse', name: 'Zaanse Schans',            area: 'Zaandam',    lat: 52.4741, lon: 4.8172, tags: ['history','outdoors'],       cost: 15, mins: 210, rating: 4.3, open: [9, 17],  closed: [], blurb: 'Working windmills half an hour north. Touristy, and still worth the train.' },
      { id: 'ams-heine',  name: 'Brown Café Afternoon',     area: 'Jordaan',    lat: 52.3736, lon: 4.8823, tags: ['food','nightlife'],         cost: 14, mins: 70,  rating: 4.6, open: [12, 24], closed: [], type: 'food', blurb: 'Sand on the floor, tobacco in the walls, and beer that takes five minutes.' },
      { id: 'ams-indo',   name: 'Indonesian Rijsttafel',    area: 'Oud-Zuid',   lat: 52.3565, lon: 4.8790, tags: ['food'],                     cost: 40, mins: 120, rating: 4.7, open: [18, 23], closed: [], type: 'food', blurb: 'Fifteen small dishes at once — the Dutch colonial dinner, taken seriously.' },
      { id: 'ams-herring',name: 'Herring from a Cart',      area: 'Centrum',    lat: 52.3702, lon: 4.8906, tags: ['food'],                     cost: 5,  mins: 20,  rating: 4.2, open: [10, 18], closed: [], type: 'food', blurb: 'Raw, with onion and pickle. Hold it by the tail. Do it once.' },
      { id: 'ams-pancake',name: 'Pancake Lunch',            area: 'Jordaan',    lat: 52.3760, lon: 4.8817, tags: ['food'],                     cost: 16, mins: 60,  rating: 4.4, open: [11, 17], closed: [], type: 'food', blurb: 'Plate-sized, savoury or sweet, and enough to end the day’s walking.' },
      { id: 'ams-coffee', name: 'Canal-side Coffee Stop',   area: 'Grachtengordel', lat: 52.3688, lon: 4.8855, tags: ['food'],                 cost: 5,  mins: 30,  rating: 4.5, open: [8, 18],  closed: [], type: 'food', blurb: 'Apple pie with cream, at a table you have to lean over the water to reach.' },
      { id: 'ams-fries',  name: 'Fries with Mayonnaise',    area: 'Centrum',    lat: 52.3711, lon: 4.8888, tags: ['food'],                     cost: 5,  mins: 20,  rating: 4.3, open: [11, 23], closed: [], type: 'food', blurb: 'In a paper cone, with a small fork. The queue is the recommendation.' },
    ],
  },
};

/** Cities in the order the picker should list them. */
const CITY_IDS = ['istanbul', 'rome', 'paris', 'barcelona', 'amsterdam'];
