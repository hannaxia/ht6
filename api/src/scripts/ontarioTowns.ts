/**
 * Ontario, Canada towns and cities beyond the hand-picked major-city list
 * in scrapeCanadianHotels.ts. Generated from GeoNames' free Canada gazetteer
 * export (https://download.geonames.org/export/dump/CA.zip, admin1 code
 * "08" = Ontario, feature class "P" = populated place), filtered to real
 * places with population >= 1000 (or an administrative-center feature code,
 * since GeoNames population data is sparse/stale for many small towns) and
 * excluding names that look like businesses/POIs mistagged as populated
 * places. Deduplicated against the major cities already covered by wider,
 * hand-picked boxes elsewhere in scrapeCanadianHotels.ts.
 *
 * Bounding box half-width scales with population (small towns get a tight
 * ~3-5km box; larger ones up to ~13-24km) — [west, south, east, north].
 * GeoNames data license: https://www.geonames.org/about.html (CC BY 4.0).
 */
import type { BoundingBox } from "../stay22/client.js";

export const ONTARIO_TOWNS: Record<string, BoundingBox> = {
  mississauga: { west: -79.7783, south: 43.4589, east: -79.5383, north: 43.6989 }, // Mississauga
  brampton: { west: -79.8863, south: 43.5634, east: -79.6463, north: 43.8034 }, // Brampton
  etobicoke: { west: -79.6899, south: 43.5242, east: -79.4498, north: 43.7642 }, // Etobicoke
  markham: { west: -79.3863, south: 43.7468, east: -79.1463, north: 43.9868 }, // Markham
  vaughan: { west: -79.6183, south: 43.7161, east: -79.3783, north: 43.9561 }, // Vaughan
  kitchener: { west: -80.6312, south: 43.3054, east: -80.3912, north: 43.5454 }, // Kitchener
  oakville: { west: -79.8029, south: 43.3301, east: -79.5629, north: 43.5701 }, // Oakville
  richmondHill: { west: -79.5573, south: 43.7511, east: -79.3172, north: 43.9911 }, // Richmond Hill
  burlington: { west: -79.9571, south: 43.2662, east: -79.7171, north: 43.5062 }, // Burlington
  nepean: { west: -75.8425, south: 45.2162, east: -75.6025, north: 45.4562 }, // Nepean
  oshawa: { west: -78.9696, south: 43.7801, east: -78.7296, north: 44.0201 }, // Oshawa
  gloucester: { west: -75.7533, south: 45.23, east: -75.5133, north: 45.47 }, // Gloucester
  guelph: { west: -80.376, south: 43.4259, east: -80.136, north: 43.6659 }, // Guelph
  whitby: { west: -79.0529, south: 43.7634, east: -78.8129, north: 44.0034 }, // Whitby
  milton: { west: -80.0029, south: 43.3968, east: -79.7629, north: 43.6368 }, // Milton
  cambridge: { west: -80.4327, south: 43.2401, east: -80.1927, north: 43.4801 }, // Cambridge
  orleans: { west: -75.6243, south: 45.3373, east: -75.3843, north: 45.5773 }, // Orléans
  ottawaSouth: { west: -75.8073, south: 45.2721, east: -75.5672, north: 45.5121 }, // Ottawa South
  ajax: { west: -79.1529, south: 43.7301, east: -78.9129, north: 43.9701 }, // Ajax
  waterloo: { west: -80.6364, south: 43.3468, east: -80.3964, north: 43.5868 }, // Waterloo
  brantford: { west: -80.3864, south: 43.0134, east: -80.1464, north: 43.2534 }, // Brantford
  pickering: { west: -79.2029, south: 43.8301, east: -79.0629, north: 43.9701 }, // Pickering
  newmarket: { west: -79.5363, south: 43.9801, east: -79.3963, north: 44.1201 }, // Newmarket
  kanata: { west: -75.9861, south: 45.2301, east: -75.8461, north: 45.3701 }, // Kanata
  peterborough: { west: -78.3862, south: 44.2301, east: -78.2462, north: 44.3701 }, // Peterborough
  caledon: { west: -80.0632, south: 43.7954, east: -79.9232, north: 43.9354 }, // Caledon
  stoneyCreek: { west: -79.8363, south: 43.1468, east: -79.6963, north: 43.2868 }, // Stoney Creek
  sarnia: { west: -82.4741, south: 42.9087, east: -82.3341, north: 43.0487 }, // Sarnia
  saultSteMarie: { west: -84.4032, south: 46.4468, east: -84.2633, north: 46.5868 }, // Sault Ste. Marie
  haltonHills: { west: -80.0015, south: 43.5703, east: -79.8615, north: 43.7103 }, // Halton Hills
  norfolkCounty: { west: -80.453, south: 42.7634, east: -80.313, north: 42.9034 }, // Norfolk County
  aurora: { west: -79.5363, south: 43.9301, east: -79.3963, north: 44.0701 }, // Aurora
  welland: { west: -79.3196, south: 42.9134, east: -79.1796, north: 43.0534 }, // Welland
  belleville: { west: -77.4528, south: 44.0968, east: -77.3128, north: 44.2368 }, // Belleville
  cornwall: { west: -74.7981, south: 44.9481, east: -74.6582, north: 45.0881 }, // Cornwall
  georgetown: { west: -79.9863, south: 43.5801, east: -79.8463, north: 43.7201 }, // Georgetown
  quinteWest: { west: -77.6362, south: 44.1134, east: -77.4962, north: 44.2534 }, // Quinte West
  chatham: { west: -82.2549, south: 42.3422, east: -82.1149, north: 42.4822 }, // Chatham
  innisfil: { west: -79.7196, south: 44.2301, east: -79.5796, north: 44.3701 }, // Innisfil
  timmins: { west: -81.4031, south: 48.3969, east: -81.2631, north: 48.5369 }, // Timmins
  stittsville: { west: -75.9861, south: 45.1801, east: -75.8461, north: 45.3201 }, // Stittsville
  ancaster: { west: -80.0572, south: 43.1481, east: -79.9172, north: 43.2881 }, // Ancaster
  woodstock: { west: -80.8197, south: 43.0634, east: -80.6797, north: 43.2034 }, // Woodstock
  bowmanville: { west: -78.7529, south: 43.8468, east: -78.6129, north: 43.9868 }, // Bowmanville
  stThomas: { west: -81.2504, south: 42.7036, east: -81.1104, north: 42.8436 }, // St. Thomas
  stouffville: { west: -79.3196, south: 43.8968, east: -79.1796, north: 44.0368 }, // Stouffville
  leamington: { west: -82.6698, south: 41.9801, east: -82.5298, north: 42.1201 }, // Leamington
  brant: { west: -80.4197, south: 43.0634, east: -80.2797, north: 43.2034 }, // Brant
  laSalle: { west: -83.1309, south: 42.1748, east: -82.991, north: 42.3148 }, // LaSalle
  stratford: { west: -81.0197, south: 43.2968, east: -80.8797, north: 43.4368 }, // Stratford
  orillia: { west: -79.4907, south: 44.5387, east: -79.3507, north: 44.6787 }, // Orillia
  orangeville: { west: -80.1697, south: 43.8468, east: -80.0297, north: 43.9868 }, // Orangeville
  fortErie: { west: -79.0029, south: 42.8301, east: -78.8629, north: 42.9701 }, // Fort Erie
  grimsby: { west: -79.6113, south: 43.1551, east: -79.5213, north: 43.2451 }, // Grimsby
  bolton: { west: -79.7829, south: 43.8345, east: -79.6929, north: 43.9245 }, // Bolton
  princeEdward: { west: -77.2945, south: 43.9551, east: -77.2045, north: 44.0451 }, // Prince Edward
  brooklin: { west: -79.0047, south: 43.9133, east: -78.9147, north: 44.0033 }, // Brooklin
  fallingbrook: { west: -75.529, south: 45.4306, east: -75.439, north: 45.5206 }, // Fallingbrook
  bridlewood: { west: -75.9019, south: 45.2402, east: -75.8119, north: 45.3302 }, // Bridlewood
  waterdown: { west: -79.9279, south: 43.2884, east: -79.8379, north: 43.3784 }, // Waterdown
  midland: { west: -79.928, south: 44.7051, east: -79.838, north: 44.7951 }, // Midland
  eastGwillimbury: { west: -79.4828, south: 44.0559, east: -79.3928, north: 44.1459 }, // East Gwillimbury
  brockville: { west: -75.732, south: 44.5463, east: -75.642, north: 44.6363 }, // Brockville
  strathroy: { west: -81.6673, south: 42.9101, east: -81.5773, north: 43.0001 }, // Strathroy
  tecumseh: { west: -82.929, south: 42.271, east: -82.839, north: 42.361 }, // Tecumseh
  kingsville: { west: -82.7781, south: 42.0551, east: -82.6881, north: 42.1451 }, // Kingsville
  collingwood: { west: -80.2614, south: 44.4384, east: -80.1714, north: 44.5284 }, // Collingwood
  owenSound: { west: -80.9885, south: 44.5222, east: -80.8985, north: 44.6122 }, // Owen Sound
  uxbridge: { west: -79.1613, south: 44.0551, east: -79.0713, north: 44.1451 }, // Uxbridge
  fergus: { west: -80.4226, south: 43.661, east: -80.3326, north: 43.751 }, // Fergus
  wasagaBeach: { west: -80.0614, south: 44.4718, east: -79.9714, north: 44.5618 }, // Wasaga Beach
  lindsay: { west: -78.7779, south: 44.3051, east: -78.6879, north: 44.3951 }, // Lindsay
  huntsville: { west: -79.2613, south: 45.2884, east: -79.1713, north: 45.3784 }, // Huntsville
  alliston: { west: -79.9113, south: 44.1051, east: -79.8213, north: 44.1951 }, // Alliston
  thorold: { west: -79.2446, south: 43.0718, east: -79.1546, north: 43.1618 }, // Thorold
  tillsonburg: { west: -80.7712, south: 42.8149, east: -80.6812, north: 42.9049 }, // Tillsonburg
  portColborne: { west: -79.2779, south: 42.8551, east: -79.1879, north: 42.9451 }, // Port Colborne
  cobourg: { west: -78.2101, south: 43.9148, east: -78.1201, north: 44.0048 }, // Cobourg
  valleyEast: { west: -81.0423, south: 46.6, east: -80.9523, north: 46.69 }, // Valley East
  petawawa: { west: -77.3251, south: 45.8495, east: -77.2351, north: 45.9395 }, // Petawawa
  vanier: { west: -75.71, south: 45.3949, east: -75.62, north: 45.4849 }, // Vanier
  bracebridge: { west: -79.3613, south: 44.9884, east: -79.2713, north: 45.0784 }, // Bracebridge
  greaterNapanee: { west: -76.9944, south: 44.2051, east: -76.9044, north: 44.2951 }, // Greater Napanee
  mississippiMills: { west: -76.2444, south: 45.1884, east: -76.1544, north: 45.2784 }, // Mississippi Mills
  westNipissing: { west: -79.9695, south: 46.3266, east: -79.8795, north: 46.4166 }, // West Nipissing
  blossomPark: { west: -75.6717, south: 45.3039, east: -75.5817, north: 45.3939 }, // Blossom Park
  simcoe: { west: -80.3447, south: 42.7884, east: -80.2547, north: 42.8784 }, // Simcoe
  amherstburg: { west: -83.1448, south: 42.0551, east: -83.0548, north: 42.1451 }, // Amherstburg
  pembroke: { west: -77.1612, south: 45.7718, east: -77.0712, north: 45.8618 }, // Pembroke
  ingersoll: { west: -80.928, south: 42.9884, east: -80.838, north: 43.0784 }, // Ingersoll
  newHamburg: { west: -80.7447, south: 43.3384, east: -80.6547, north: 43.4284 }, // New Hamburg
  northPerth: { west: -81.0122, south: 43.6801, east: -80.9222, north: 43.7701 }, // North Perth
  lowertown: { west: -75.7382, south: 45.3869, east: -75.6482, north: 45.4769 }, // Lowertown
  portHope: { west: -78.4445, south: 43.9718, east: -78.3545, north: 44.0618 }, // Port Hope
  elliotLake: { west: -82.6781, south: 46.3384, east: -82.5881, north: 46.4284 }, // Elliot Lake
  sandyHill: { west: -75.7236, south: 45.3802, east: -75.6336, north: 45.4702 }, // Sandy Hill
  gravenhurst: { west: -79.4113, south: 44.8718, east: -79.3213, north: 44.9618 }, // Gravenhurst
  paris: { west: -80.4283, south: 43.155, east: -80.3383, north: 43.245 }, // Paris
  queenswoodHeights: { west: -75.5506, south: 45.4258, east: -75.4606, north: 45.5158 }, // Queenswood Heights
  erin: { west: -80.1094, south: 43.7279, east: -80.0194, north: 43.8179 }, // Erin
  carletonPlace: { west: -76.1944, south: 45.0884, east: -76.1044, north: 45.1784 }, // Carleton Place
  glenCairn: { west: -75.925, south: 45.2478, east: -75.835, north: 45.3378 }, // Glen Cairn
  elmira: { west: -80.5947, south: 43.5551, east: -80.5047, north: 43.6451 }, // Elmira
  lambtonShores: { west: -81.9781, south: 43.1218, east: -81.8881, north: 43.2118 }, // Lambton Shores
  temiskamingShores: { west: -79.7603, south: 47.4488, east: -79.6703, north: 47.5388 }, // Temiskaming Shores
  wallaceburg: { west: -82.4335, south: 42.548, east: -82.3435, north: 42.638 }, // Wallaceburg
  hawkesbury: { west: -74.6609, south: 45.5551, east: -74.5709, north: 45.6451 }, // Hawkesbury
  penetanguishene: { west: -79.9614, south: 44.7384, east: -79.8714, north: 44.8284 }, // Penetanguishene
  southHuron: { west: -81.5415, south: 43.2918, east: -81.4915, north: 43.3418 }, // South Huron
  plantagenet: { west: -75.0187, south: 45.5076, east: -74.9687, north: 45.5576 }, // Plantagenet
  belleRiver: { west: -82.7369, south: 42.2676, east: -82.6869, north: 42.3176 }, // Belle River
  overbrook: { west: -75.677, south: 45.4023, east: -75.627, north: 45.4523 }, // Overbrook
  portPerry: { west: -78.9694, south: 44.0818, east: -78.9194, north: 44.1318 }, // Port Perry
  theBlueMountains: { west: -80.483, south: 44.5334, east: -80.433, north: 44.5834 }, // The Blue Mountains
  acton: { west: -80.0665, south: 43.6047, east: -80.0165, north: 43.6547 }, // Acton
  dorchester: { west: -81.0914, south: 42.9584, east: -81.0414, north: 43.0084 }, // Dorchester
  bellsCorners: { west: -75.8551, south: 45.2909, east: -75.8051, north: 45.3409 }, // Bells Corners
  huronEast: { west: -81.3248, south: 43.5918, east: -81.2747, north: 43.6418 }, // Huron East
  greely: { west: -75.5861, south: 45.2364, east: -75.5361, north: 45.2864 }, // Greely
  smithsFalls: { west: -76.0483, south: 44.8795, east: -75.9983, north: 44.9295 }, // Smiths Falls
  arnprior: { west: -76.3744, south: 45.4084, east: -76.3244, north: 45.4584 }, // Arnprior
  embrun: { west: -75.2977, south: 45.2507, east: -75.2477, north: 45.3007 }, // Embrun
  kingCity: { west: -79.5519, south: 43.9036, east: -79.5019, north: 43.9536 }, // King City
  kapuskasing: { west: -82.4581, south: 49.3919, east: -82.4081, north: 49.4419 }, // Kapuskasing
  concord: { west: -79.5079, south: 43.7751, east: -79.4579, north: 43.8251 }, // Concord
  essex: { west: -82.8498, south: 42.1501, east: -82.7998, north: 42.2001 }, // Essex
  renfrew: { west: -76.7077, south: 45.4418, east: -76.6577, north: 45.4918 }, // Renfrew
  dryden: { west: -92.7753, south: 49.7583, east: -92.7253, north: 49.8083 }, // Dryden
  blackburnHamlet: { west: -75.5896, south: 45.4117, east: -75.5396, north: 45.4617 }, // Blackburn Hamlet
  shelburne: { west: -80.2291, south: 44.0537, east: -80.1791, north: 44.1037 }, // Shelburne
  portElgin: { west: -81.4148, south: 44.4111, east: -81.3648, north: 44.4611 }, // Port Elgin
  hintonburg: { west: -75.7533, south: 45.3788, east: -75.7033, north: 45.4288 }, // Hintonburg
  elora: { west: -80.458, south: 43.6584, east: -80.408, north: 43.7084 }, // Elora
  kirklandLake: { west: -80.0627, south: 48.1196, east: -80.0127, north: 48.1696 }, // Kirkland Lake
  fortFrances: { west: -93.4253, south: 48.5917, east: -93.3753, north: 48.6417 }, // Fort Frances
  hanover: { west: -81.058, south: 44.1251, east: -81.008, north: 44.1751 }, // Hanover
  goderich: { west: -81.7384, south: 43.7167, east: -81.6884, north: 43.7667 }, // Goderich
  listowel: { west: -80.9747, south: 43.7084, east: -80.9247, north: 43.7584 }, // Listowel
  camlachie: { west: -82.1866, south: 43.011, east: -82.1366, north: 43.061 }, // Camlachie
  aylmer: { west: -81.008, south: 42.7418, east: -80.958, north: 42.7918 }, // Aylmer
  napanee: { west: -76.9744, south: 44.2251, east: -76.9244, north: 44.2751 }, // Napanee
  stMarys: { west: -81.158, south: 43.2251, east: -81.108, north: 43.2751 }, // St. Marys
  bluewater: { west: -81.6248, south: 43.4418, east: -81.5748, north: 43.4918 }, // Bluewater
  king: { west: -79.6151, south: 43.9401, east: -79.5651, north: 43.9901 }, // King
  sturgeonFalls: { west: -79.9414, south: 46.3418, east: -79.8914, north: 46.3918 }, // Sturgeon Falls
  kincardine: { west: -81.6581, south: 44.1584, east: -81.6081, north: 44.2084 }, // Kincardine
  parrySound: { west: -80.0603, south: 45.3223, east: -80.0103, north: 45.3723 }, // Parry Sound
  russell: { west: -75.391, south: 45.2251, east: -75.341, north: 45.2751 }, // Russell
  chippawa: { west: -79.0722, south: 43.0321, east: -79.0222, north: 43.0821 }, // Chippawa
  dunnville: { west: -79.6413, south: 42.8751, east: -79.5913, north: 42.9251 }, // Dunnville
  siouxLookout: { west: -91.9466, south: 50.0741, east: -91.8966, north: 50.1241 }, // Sioux Lookout
  corunna: { west: -82.4581, south: 42.8584, east: -82.4081, north: 42.9084 }, // Corunna
  petrolia: { west: -82.177, south: 42.857, east: -82.127, north: 42.907 }, // Petrolia
  lively: { west: -81.1747, south: 46.4084, east: -81.1247, north: 46.4584 }, // Lively
  perth: { west: -76.2744, south: 44.8751, east: -76.2244, north: 44.9251 }, // Perth
  gananoque: { west: -76.1911, south: 44.3084, east: -76.1411, north: 44.3584 }, // Gananoque
  viscountAlexanderPark: { west: -75.6562, south: 45.4277, east: -75.6062, north: 45.4777 }, // Viscount Alexander Park
  cochrane: { west: -81.0581, south: 49.0419, east: -81.0081, north: 49.0919 }, // Cochrane
  ayr: { west: -80.4747, south: 43.2584, east: -80.4247, north: 43.3084 }, // Ayr
  delhi: { west: -80.5247, south: 42.8251, east: -80.4747, north: 42.8751 }, // Delhi
  tottenham: { west: -79.8305, south: 43.9994, east: -79.7805, north: 44.0494 }, // Tottenham
  breslau: { west: -80.4414, south: 43.4418, east: -80.3914, north: 43.4918 }, // Breslau
  mountForest: { west: -80.747, south: 43.9545, east: -80.697, north: 44.0045 }, // Mount Forest
  almonte: { west: -76.2208, south: 45.2049, east: -76.1708, north: 45.2549 }, // Almonte
  baden: { west: -80.6747, south: 43.3751, east: -80.6247, north: 43.4251 }, // Baden
  mountAlbert: { west: -79.3413, south: 44.1084, east: -79.2913, north: 44.1584 }, // Mount Albert
  meaford: { west: -80.6358, south: 44.5823, east: -80.5858, north: 44.6323 }, // Meaford
  exeter: { west: -81.5043, south: 43.3185, east: -81.4543, north: 43.3685 }, // Exeter
  hearst: { west: -83.6915, south: 49.6585, east: -83.6415, north: 49.7085 }, // Hearst
  walkerton: { west: -81.1781, south: 44.1052, east: -81.1281, north: 44.1552 }, // Walkerton
  picton: { west: -77.1714, south: 43.9768, east: -77.1214, north: 44.0268 }, // Picton
  tilbury: { west: -82.4581, south: 42.2418, east: -82.4081, north: 42.2918 }, // Tilbury
  espanola: { west: -81.7915, south: 46.2334, east: -81.7415, north: 46.2834 }, // Espanola
  azilda: { west: -81.1248, south: 46.5251, east: -81.0747, north: 46.5751 }, // Azilda
  mississaugaBeach: { west: -79.1113, south: 43.2338, east: -79.0612, north: 43.2838 }, // Mississauga Beach
  greenstone: { west: -87.1917, south: 49.7084, east: -87.1417, north: 49.7584 }, // Greenstone
  rockwood: { west: -80.1694, south: 43.594, east: -80.1194, north: 43.644 }, // Rockwood
  caledonEast: { west: -79.8919, south: 43.8441, east: -79.8419, north: 43.8941 }, // Caledon East
  prescott: { west: -75.541, south: 44.6918, east: -75.491, north: 44.7418 }, // Prescott
  redLake: { west: -93.8524, south: 50.9918, east: -93.8024, north: 51.0418 }, // Red Lake
  deepRiver: { west: -77.5245, south: 46.0751, east: -77.4745, north: 46.1251 }, // Deep River
  iroquoisFalls: { west: -80.7081, south: 48.7419, east: -80.6581, north: 48.7919 }, // Iroquois Falls
  beeton: { west: -79.8066, south: 44.0549, east: -79.7566, north: 44.1049 }, // Beeton
  vineland: { west: -79.4195, south: 43.1263, east: -79.3695, north: 43.1763 }, // Vineland
  bancroft: { west: -77.882, south: 45.0325, east: -77.832, north: 45.0825 }, // Bancroft
  richmond: { west: -75.8577, south: 45.1584, east: -75.8077, north: 45.2084 }, // Richmond
  callander: { west: -79.3913, south: 46.1918, east: -79.3413, north: 46.2418 }, // Callander
  bobcaygeon: { west: -78.567, south: 44.5212, east: -78.517, north: 44.5712 }, // Bobcaygeon
  newEdinburgh: { west: -75.7128, south: 45.4164, east: -75.6628, north: 45.4664 }, // New Edinburgh
  blindRiver: { west: -82.9832, south: 46.1584, east: -82.9332, north: 46.2084 }, // Blind River
  campbellford: { west: -77.8245, south: 44.2834, east: -77.7745, north: 44.3334 }, // Campbellford
  beaverton: { west: -79.1746, south: 44.4084, east: -79.1246, north: 44.4584 }, // Beaverton
  capreol: { west: -80.9461, south: 46.6813, east: -80.8961, north: 46.7313 }, // Capreol
  stGeorge: { west: -80.2764, south: 43.22, east: -80.2264, north: 43.27 }, // St. George
  sydenham: { west: -80.8247, south: 44.5418, east: -80.7747, north: 44.5918 }, // Sydenham
  amethystHarbour: { west: -88.8979, south: 48.5177, east: -88.8479, north: 48.5677 }, // Amethyst Harbour
  haileybury: { west: -79.6623, south: 47.424, east: -79.6123, north: 47.474 }, // Haileybury
  shuniahTownship: { west: -89.1397, south: 48.4992, east: -89.0897, north: 48.5492 }, // Shuniah Township
  wellesley: { west: -80.7871, south: 43.4519, east: -80.7371, north: 43.5019 }, // Wellesley
  ballantrae: { west: -79.3246, south: 44.0084, east: -79.2746, north: 44.0584 }, // Ballantrae
  waterford: { west: -80.308, south: 42.9084, east: -80.258, north: 42.9584 }, // Waterford
  clinton: { west: -81.5581, south: 43.5918, east: -81.5081, north: 43.6418 }, // Clinton
  casselman: { west: -75.1076, south: 45.2918, east: -75.0576, north: 45.3418 }, // Casselman
  grandBend: { west: -81.7748, south: 43.2918, east: -81.7248, north: 43.3418 }, // Grand Bend
  morrisburg: { west: -75.2076, south: 44.8751, east: -75.1576, north: 44.9251 }, // Morrisburg
  ridgetown: { west: -81.9123, south: 42.4104, east: -81.8623, north: 42.4604 }, // Ridgetown
  tavistock: { west: -80.858, south: 43.2918, east: -80.808, north: 43.3418 }, // Tavistock
  siouxLookout2: { west: -92.0086, south: 50.0418, east: -91.9586, north: 50.0918 }, // Sioux Lookout
  virgil: { west: -79.1579, south: 43.1918, east: -79.1079, north: 43.2418 }, // Virgil
  wingham: { west: -81.3364, south: 43.8629, east: -81.2864, north: 43.9129 }, // Wingham
  alexandria: { west: -74.6617, south: 45.2882, east: -74.6116, north: 45.3382 }, // Alexandria
  wawa: { west: -84.7991, south: 47.9638, east: -84.7491, north: 48.0138 }, // Wawa
  dundalk: { west: -80.4186, south: 44.1429, east: -80.3686, north: 44.1929 }, // Dundalk
  atikokan: { west: -91.6491, south: 48.7317, east: -91.5991, north: 48.7817 }, // Atikokan
  lakefield: { west: -78.2912, south: 44.4084, east: -78.2412, north: 44.4584 }, // Lakefield
  seaforth: { west: -81.4248, south: 43.5251, east: -81.3748, north: 43.5751 }, // Seaforth
  elmvaleAcres: { west: -75.6571, south: 45.3715, east: -75.6071, north: 45.4215 }, // Elmvale Acres
  thamesford: { west: -81.0238, south: 43.0321, east: -80.9738, north: 43.0821 }, // Thamesford
  osgoode: { west: -75.6228, south: 45.1239, east: -75.5728, north: 45.1739 }, // Osgoode
  harrow: { west: -82.9415, south: 42.0084, east: -82.8915, north: 42.0584 }, // Harrow
  lucan: { west: -81.4248, south: 43.1584, east: -81.3748, north: 43.2084 }, // Lucan
  forest: { west: -82.0248, south: 43.0751, east: -81.9748, north: 43.1251 }, // Forest
  winchester: { west: -75.3743, south: 45.0584, east: -75.3243, north: 45.1084 }, // Winchester
  wyoming: { west: -82.1415, south: 42.9251, east: -82.0915, north: 42.9751 }, // Wyoming
  colchester: { west: -82.9581, south: 41.9584, east: -82.9081, north: 42.0084 }, // Colchester
  constanceBay: { west: -76.1077, south: 45.4751, east: -76.0577, north: 45.5251 }, // Constance Bay
  elmvale: { west: -79.8914, south: 44.5584, east: -79.8414, north: 44.6084 }, // Elmvale
  ilderton: { west: -81.4055, south: 43.0542, east: -81.3555, north: 43.1042 }, // Ilderton
  littleCurrent: { west: -81.9498, south: 45.9543, east: -81.8998, north: 46.0043 }, // Little Current
  portStanley: { west: -81.2414, south: 42.6418, east: -81.1914, north: 42.6918 }, // Port Stanley
  glencoe: { west: -81.7415, south: 42.7251, east: -81.6915, north: 42.7751 }, // Glencoe
  limoges: { west: -75.2743, south: 45.3084, east: -75.2243, north: 45.3584 }, // Limoges
  stirling: { west: -77.5745, south: 44.2751, east: -77.5245, north: 44.3251 }, // Stirling
  wiarton: { west: -81.1646, south: 44.7169, east: -81.1146, north: 44.7669 }, // Wiarton
  mattawa: { west: -78.7246, south: 46.2918, east: -78.6746, north: 46.3418 }, // Mattawa
  neebing: { west: -89.4418, south: 48.1418, east: -89.3918, north: 48.1918 }, // Neebing
  stJacobs: { west: -80.5822, south: 43.5066, east: -80.5322, north: 43.5566 }, // St. Jacobs
  chapleau: { west: -83.4284, south: 47.8155, east: -83.3784, north: 47.8655 }, // Chapleau
  fenelonFalls: { west: -78.7746, south: 44.5084, east: -78.7246, north: 44.5584 }, // Fenelon Falls
  deseronto: { west: -77.0744, south: 44.1751, east: -77.0244, north: 44.2251 }, // Deseronto
  rockcliffePark: { west: -75.7076, south: 45.4251, east: -75.6576, north: 45.4751 }, // Rockcliffe Park
  mooseFactory: { west: -80.6412, south: 51.2419, east: -80.5912, north: 51.2919 }, // Moose Factory
  harriston: { west: -80.897, south: 43.887, east: -80.847, north: 43.937 }, // Harriston
  metcalfe: { west: -75.491, south: 45.2084, east: -75.441, north: 45.2584 }, // Metcalfe
  geraldton: { west: -86.9734, south: 49.7017, east: -86.9234, north: 49.7517 }, // Geraldton
  parkhill: { west: -81.7096, south: 43.1349, east: -81.6596, north: 43.1849 }, // Parkhill
  manitouwadge: { west: -85.8653, south: 49.0965, east: -85.8153, north: 49.1465 }, // Manitouwadge
  tweed: { west: -77.3412, south: 44.4501, east: -77.2912, north: 44.5001 }, // Tweed
  millbrook: { west: -78.4745, south: 44.1251, east: -78.4245, north: 44.1751 }, // Millbrook
  burford: { west: -80.4537, south: 43.0779, east: -80.4037, north: 43.1279 }, // Burford
  amigoBeach: { west: -79.4182, south: 44.6669, east: -79.3682, north: 44.7169 }, // Amigo Beach
  mcGregor: { west: -82.9915, south: 42.1251, east: -82.9415, north: 42.1751 }, // McGregor
  watford: { west: -81.9081, south: 42.9251, east: -81.8581, north: 42.9751 }, // Watford
  madoc: { west: -77.4995, south: 44.4834, east: -77.4495, north: 44.5334 }, // Madoc
  terraceBay: { west: -87.125, south: 48.7584, east: -87.075, north: 48.8084 }, // Terrace Bay
  attawapiskat: { west: -82.4417, south: 52.9027, east: -82.3917, north: 52.9527 }, // Attawapiskat
  ohsweken: { west: -80.1413, south: 43.0418, east: -80.0913, north: 43.0918 }, // Ohsweken
  marmora: { west: -77.7078, south: 44.4584, east: -77.6578, north: 44.5084 }, // Marmora
  englehart: { west: -79.8989, south: 47.799, east: -79.8489, north: 47.849 }, // Englehart
  carp: { west: -76.0577, south: 45.3251, east: -76.0077, north: 45.3751 }, // Carp
  nipigon: { west: -88.2917, south: 48.9918, east: -88.2417, north: 49.0418 }, // Nipigon
  dowling: { west: -81.3642, south: 46.5661, east: -81.3142, north: 46.6161 }, // Dowling
  lOrignal: { west: -74.7165, south: 45.5948, east: -74.6665, north: 45.6448 }, // L'Orignal
  lappe: { west: -89.3751, south: 48.5418, east: -89.3251, north: 48.5918 }, // Lappe
  tobermory: { west: -81.6915, south: 45.2251, east: -81.6415, north: 45.2751 }, // Tobermory
  moosonee: { west: -80.6595, south: 51.2543, east: -80.6095, north: 51.3043 }, // Moosonee
  sharbotLake: { west: -76.7122, south: 44.7489, east: -76.6622, north: 44.7989 }, // Sharbot Lake
  norwood: { west: -78.0078, south: 44.3584, east: -77.9578, north: 44.4084 }, // Norwood
  plattsville: { west: -80.6412, south: 43.2829, east: -80.5912, north: 43.3329 }, // Plattsville
  westLorne: { west: -81.6248, south: 42.5751, east: -81.5748, north: 42.6251 }, // West Lorne
  smoothRockFalls: { west: -81.6581, south: 49.2585, east: -81.6081, north: 49.3085 }, // Smooth Rock Falls
  omemee: { west: -78.5849, south: 44.274, east: -78.5349, north: 44.324 }, // Omemee
  wendover: { west: -75.1526, south: 45.5478, east: -75.1026, north: 45.5978 }, // Wendover
  powassan: { west: -79.3746, south: 46.0084, east: -79.3246, north: 46.0584 }, // Powassan
  stClements: { west: -80.6747, south: 43.4918, east: -80.6247, north: 43.5418 }, // St. Clements
  mildmay: { west: -81.1439, south: 44.018, east: -81.0939, north: 44.068 }, // Mildmay
  markdale: { west: -80.6747, south: 44.2918, east: -80.6247, north: 44.3418 }, // Markdale
  cookstown: { west: -79.7246, south: 44.1584, east: -79.6746, north: 44.2084 }, // Cookstown
  ignace: { west: -91.684, south: 49.3913, east: -91.634, north: 49.4413 }, // Ignace
  emo: { west: -93.8586, south: 48.6082, east: -93.8086, north: 48.6582 }, // Emo
  vermilionBay: { west: -93.4128, south: 49.8355, east: -93.3628, north: 49.8855 }, // Vermilion Bay
  bath: { west: -76.8077, south: 44.1584, east: -76.7577, north: 44.2084 }, // Bath
  redLake2: { west: -93.7587, south: 51.0418, east: -93.7087, north: 51.0918 }, // Red Lake
  thessalon: { west: -83.5916, south: 46.2251, east: -83.5416, north: 46.2751 }, // Thessalon
  newDundee: { west: -80.5616, south: 43.326, east: -80.5116, north: 43.376 }, // New Dundee
  brussels: { west: -81.275, south: 43.7182, east: -81.225, north: 43.7682 }, // Brussels
  lucknow: { west: -81.5378, south: 43.9355, east: -81.4878, north: 43.9855 }, // Lucknow
  golden: { west: -93.7607, south: 51.0342, east: -93.7107, north: 51.0842 }, // Golden
  eganville: { west: -77.1245, south: 45.5084, east: -77.0744, north: 45.5584 }, // Eganville
  haliburtonVillage: { west: -78.5335, south: 45.0242, east: -78.4835, north: 45.0742 }, // Haliburton Village
  munster: { west: -75.9646, south: 45.1398, east: -75.9146, north: 45.1898 }, // Munster
  belmont: { west: -81.108, south: 42.8584, east: -81.058, north: 42.9084 }, // Belmont
  hensall: { west: -81.5248, south: 43.4084, east: -81.4748, north: 43.4584 }, // Hensall
  southRiver: { west: -79.4079, south: 45.8084, east: -79.3579, north: 45.8584 }, // South River
  portRowan: { west: -80.4914, south: 42.5918, east: -80.4414, north: 42.6418 }, // Port Rowan
  cobden: { west: -76.9077, south: 45.6084, east: -76.8577, north: 45.6584 }, // Cobden
  hornepayne: { west: -84.8012, south: 49.1895, east: -84.7512, north: 49.2395 }, // Hornepayne
  paisley: { west: -81.2976, south: 44.2814, east: -81.2476, north: 44.3314 }, // Paisley
  schreiber: { west: -87.2896, south: 48.7875, east: -87.2396, north: 48.8375 }, // Schreiber
  jarvis: { west: -80.1372, south: 42.8606, east: -80.0872, north: 42.9106 }, // Jarvis
  chalkRiver: { west: -77.4745, south: 45.9918, east: -77.4245, north: 46.0418 }, // Chalk River
  mannheim: { west: -80.5704, south: 43.3731, east: -80.5204, north: 43.4231 }, // Mannheim
};
