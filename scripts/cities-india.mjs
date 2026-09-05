/**
 * The Indian city dataset, and the seed migration generated from it.
 *
 * Held as data in this file rather than as SQL so it can be extended by editing
 * a list, not by hand-writing inserts. Regenerate the migration after changing
 * it:
 *
 *   node scripts/cities-india.mjs > supabase/migrations/<timestamp>_seed_cities_india.sql
 *
 * Each entry is [name, stateCode, alternatives?, latitude?, longitude?].
 *
 * `alternatives` carries the spellings people actually type — the pre-rename
 * names especially, since someone who has said "Bangalore" for forty years will
 * not type "Bengaluru". They are folded into search_terms, never displayed.
 *
 * Coordinates are present only where verified. A guessed coordinate is worse
 * than a null one: a wrong distance looks exactly like a right one, and
 * discovery would quietly mis-rank people. Null is honest and fillable later.
 */

export const STATES = {
  AN: "Andaman & Nicobar Islands",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CH: "Chandigarh",
  CG: "Chhattisgarh",
  DN: "Dadra & Nagar Haveli and Daman & Diu",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JK: "Jammu & Kashmir",
  JH: "Jharkhand",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MP: "Madhya Pradesh",
  MH: "Maharashtra",
  MN: "Manipur",
  ML: "Meghalaya",
  MZ: "Mizoram",
  NL: "Nagaland",
  OD: "Odisha",
  PY: "Puducherry",
  PB: "Punjab",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TS: "Telangana",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UK: "Uttarakhand",
  WB: "West Bengal",
};

/**
 * Cities Eraya is concentrating on first. This is marketing and community
 * density — it has no bearing on who may register.
 */
export const FOCUS_CITIES = [
  "Hyderabad",
  "Delhi",
  "Kolkata",
  "Mumbai",
  "Pune",
  "Aizawl",
  "Chennai",
];

export const CITIES = [
  // --- Metros and million-plus, coordinates verified -----------------------
  ["Mumbai", "MH", ["bombay"], 19.076, 72.8777],
  ["Delhi", "DL", ["new delhi", "dilli"], 28.6139, 77.209],
  ["Bengaluru", "KA", ["bangalore", "bengaluru city"], 12.9716, 77.5946],
  ["Hyderabad", "TS", ["haidarabad"], 17.385, 78.4867],
  ["Chennai", "TN", ["madras"], 13.0827, 80.2707],
  ["Kolkata", "WB", ["calcutta"], 22.5726, 88.3639],
  ["Pune", "MH", ["poona"], 18.5204, 73.8567],
  ["Ahmedabad", "GJ", ["amdavad"], 23.0225, 72.5714],
  ["Jaipur", "RJ", [], 26.9124, 75.7873],
  ["Surat", "GJ", [], 21.1702, 72.8311],
  ["Lucknow", "UP", [], 26.8467, 80.9462],
  ["Kanpur", "UP", ["cawnpore"], 26.4499, 80.3319],
  ["Nagpur", "MH", [], 21.1458, 79.0882],
  ["Indore", "MP", [], 22.7196, 75.8577],
  ["Thane", "MH", [], 19.2183, 72.9781],
  ["Bhopal", "MP", [], 23.2599, 77.4126],
  ["Visakhapatnam", "AP", ["vizag", "vishakhapatnam"], 17.6868, 83.2185],
  ["Patna", "BR", [], 25.5941, 85.1376],
  ["Vadodara", "GJ", ["baroda"], 22.3072, 73.1812],
  ["Ghaziabad", "UP", [], 28.6692, 77.4538],
  ["Ludhiana", "PB", [], 30.901, 75.8573],
  ["Agra", "UP", [], 27.1767, 78.0081],
  ["Nashik", "MH", ["nasik"], 19.9975, 73.7898],
  ["Faridabad", "HR", [], 28.4089, 77.3178],
  ["Meerut", "UP", [], 28.9845, 77.7064],
  ["Rajkot", "GJ", [], 22.3039, 70.8022],
  ["Varanasi", "UP", ["banaras", "benares", "kashi"], 25.3176, 82.9739],
  ["Srinagar", "JK", [], 34.0837, 74.7973],
  ["Aurangabad", "MH", ["chhatrapati sambhajinagar"], 19.8762, 75.3433],
  ["Dhanbad", "JH", [], 23.7957, 86.4304],
  ["Amritsar", "PB", [], 31.634, 74.8723],
  ["Navi Mumbai", "MH", ["new bombay"], 19.033, 73.0297],
  ["Allahabad", "UP", ["prayagraj"], 25.4358, 81.8463],
  ["Ranchi", "JH", [], 23.3441, 85.3096],
  ["Howrah", "WB", [], 22.5958, 88.2636],
  ["Coimbatore", "TN", ["kovai"], 11.0168, 76.9558],
  ["Jabalpur", "MP", [], 23.1815, 79.9864],
  ["Gwalior", "MP", [], 26.2183, 78.1828],
  ["Vijayawada", "AP", ["bezawada"], 16.5062, 80.648],
  ["Jodhpur", "RJ", [], 26.2389, 73.0243],
  ["Madurai", "TN", [], 9.9252, 78.1198],
  ["Raipur", "CG", [], 21.2514, 81.6296],
  ["Kota", "RJ", [], 25.2138, 75.8648],
  ["Chandigarh", "CH", [], 30.7333, 76.7794],
  ["Guwahati", "AS", ["gauhati"], 26.1445, 91.7362],
  ["Solapur", "MH", ["sholapur"], 17.6599, 75.9064],
  ["Bareilly", "UP", [], 28.367, 79.4304],
  ["Mysuru", "KA", ["mysore"], 12.2958, 76.6394],
  ["Gurugram", "HR", ["gurgaon"], 28.4595, 77.0266],
  ["Noida", "UP", [], 28.5355, 77.391],
  ["Aizawl", "MZ", [], 23.7271, 92.7176],
  ["Bhubaneswar", "OD", [], 20.2961, 85.8245],
  ["Thiruvananthapuram", "KL", ["trivandrum"], 8.5241, 76.9366],
  ["Kochi", "KL", ["cochin", "ernakulam"], 9.9312, 76.2673],
  ["Dehradun", "UK", [], 30.3165, 78.0322],
  ["Shimla", "HP", ["simla"], 31.1048, 77.1734],
  ["Panaji", "GA", ["panjim"], 15.4909, 73.8278],
  ["Imphal", "MN", [], 24.817, 93.9368],
  ["Shillong", "ML", [], 25.5788, 91.8933],
  ["Agartala", "TR", [], 23.8315, 91.2868],
  ["Itanagar", "AR", [], 27.0844, 93.6053],
  ["Kohima", "NL", [], 25.6751, 94.1086],
  ["Gangtok", "SK", [], 27.3389, 88.6065],
  ["Puducherry", "PY", ["pondicherry", "pondy"], 11.9416, 79.8083],
  ["Jammu", "JK", [], 32.7266, 74.857],
  ["Leh", "LA", [], 34.1526, 77.5771],
  ["Port Blair", "AN", [], 11.6234, 92.7265],
  ["Kavaratti", "LD", [], 10.5669, 72.6417],
  ["Daman", "DN", [], 20.3974, 72.8328],
  ["Gandhinagar", "GJ", [], 23.2156, 72.6369],

  // --- Andhra Pradesh -------------------------------------------------------
  ["Guntur", "AP"], ["Nellore", "AP"], ["Kurnool", "AP"], ["Rajahmundry", "AP", ["rajamahendravaram"]],
  ["Tirupati", "AP"], ["Kakinada", "AP"], ["Kadapa", "AP", ["cuddapah"]], ["Anantapur", "AP"],
  ["Eluru", "AP"], ["Ongole", "AP"], ["Vizianagaram", "AP"], ["Chittoor", "AP"],
  ["Machilipatnam", "AP"], ["Srikakulam", "AP"], ["Adoni", "AP"], ["Proddatur", "AP"],
  ["Bhimavaram", "AP"], ["Madanapalle", "AP"], ["Tenali", "AP"], ["Narasaraopet", "AP"],
  ["Amaravati", "AP"], ["Hindupur", "AP"], ["Dharmavaram", "AP"], ["Gudivada", "AP"],

  // --- Arunachal Pradesh ----------------------------------------------------
  ["Naharlagun", "AR"], ["Pasighat", "AR"], ["Tawang", "AR"], ["Ziro", "AR"], ["Bomdila", "AR"],
  ["Tezu", "AR"], ["Along", "AR"], ["Roing", "AR"],

  // --- Assam ----------------------------------------------------------------
  ["Silchar", "AS"], ["Dibrugarh", "AS"], ["Jorhat", "AS"], ["Nagaon", "AS"], ["Tinsukia", "AS"],
  ["Tezpur", "AS"], ["Bongaigaon", "AS"], ["Dhubri", "AS"], ["Diphu", "AS"], ["Goalpara", "AS"],
  ["Sivasagar", "AS"], ["Karimganj", "AS"], ["North Lakhimpur", "AS"], ["Barpeta", "AS"],

  // --- Bihar ----------------------------------------------------------------
  ["Gaya", "BR"], ["Bhagalpur", "BR"], ["Muzaffarpur", "BR"], ["Darbhanga", "BR"],
  ["Purnia", "BR", ["purnea"]], ["Arrah", "BR", ["ara"]], ["Begusarai", "BR"], ["Katihar", "BR"],
  ["Munger", "BR", ["monghyr"]], ["Chhapra", "BR"], ["Bettiah", "BR"], ["Saharsa", "BR"],
  ["Sasaram", "BR"], ["Hajipur", "BR"], ["Dehri", "BR"], ["Siwan", "BR"], ["Motihari", "BR"],
  ["Nawada", "BR"], ["Bagaha", "BR"], ["Buxar", "BR"], ["Kishanganj", "BR"], ["Jamui", "BR"],

  // --- Chhattisgarh ---------------------------------------------------------
  ["Bhilai", "CG"], ["Bilaspur", "CG"], ["Korba", "CG"], ["Durg", "CG"], ["Rajnandgaon", "CG"],
  ["Jagdalpur", "CG"], ["Raigarh", "CG"], ["Ambikapur", "CG"], ["Dhamtari", "CG"], ["Mahasamund", "CG"],

  // --- Goa ------------------------------------------------------------------
  ["Margao", "GA", ["madgaon"]], ["Vasco da Gama", "GA", ["vasco"]], ["Mapusa", "GA"],
  ["Ponda", "GA"], ["Calangute", "GA"],

  // --- Gujarat --------------------------------------------------------------
  ["Bhavnagar", "GJ"], ["Jamnagar", "GJ"], ["Junagadh", "GJ"], ["Anand", "GJ"], ["Nadiad", "GJ"],
  ["Bharuch", "GJ"], ["Navsari", "GJ"], ["Vapi", "GJ"], ["Mehsana", "GJ"], ["Morbi", "GJ"],
  ["Surendranagar", "GJ"], ["Porbandar", "GJ"], ["Gandhidham", "GJ"], ["Valsad", "GJ"],
  ["Veraval", "GJ"], ["Godhra", "GJ"], ["Patan", "GJ"], ["Palanpur", "GJ"], ["Bhuj", "GJ"],
  ["Amreli", "GJ"], ["Dahod", "GJ"], ["Botad", "GJ"],

  // --- Haryana --------------------------------------------------------------
  ["Panipat", "HR"], ["Ambala", "HR"], ["Yamunanagar", "HR"], ["Rohtak", "HR"], ["Hisar", "HR"],
  ["Karnal", "HR"], ["Sonipat", "HR"], ["Panchkula", "HR"], ["Bhiwani", "HR"], ["Sirsa", "HR"],
  ["Bahadurgarh", "HR"], ["Jind", "HR"], ["Thanesar", "HR", ["kurukshetra"]], ["Kaithal", "HR"],
  ["Rewari", "HR"], ["Palwal", "HR"], ["Narnaul", "HR"], ["Fatehabad", "HR"],

  // --- Himachal Pradesh -----------------------------------------------------
  ["Solan", "HP"], ["Mandi", "HP"], ["Dharamshala", "HP", ["dharamsala"]], ["Kullu", "HP"],
  ["Manali", "HP"], ["Bilaspur", "HP"], ["Hamirpur", "HP"], ["Una", "HP"], ["Chamba", "HP"],
  ["Palampur", "HP"], ["Nahan", "HP"],

  // --- Jammu & Kashmir / Ladakh ---------------------------------------------
  ["Anantnag", "JK"], ["Baramulla", "JK"], ["Udhampur", "JK"], ["Kathua", "JK"], ["Sopore", "JK"],
  ["Kupwara", "JK"], ["Pulwama", "JK"], ["Poonch", "JK"], ["Rajouri", "JK"], ["Kargil", "LA"],

  // --- Jharkhand ------------------------------------------------------------
  ["Jamshedpur", "JH", ["tatanagar"]], ["Bokaro Steel City", "JH", ["bokaro"]], ["Deoghar", "JH"],
  ["Hazaribagh", "JH"], ["Giridih", "JH"], ["Ramgarh", "JH"], ["Medininagar", "JH", ["daltonganj"]],
  ["Chaibasa", "JH"], ["Dumka", "JH"], ["Phusro", "JH"],

  // --- Karnataka ------------------------------------------------------------
  ["Hubballi", "KA", ["hubli"]], ["Dharwad", "KA"], ["Mangaluru", "KA", ["mangalore"]],
  ["Belagavi", "KA", ["belgaum"]], ["Kalaburagi", "KA", ["gulbarga"]], ["Davanagere", "KA"],
  ["Ballari", "KA", ["bellary"]], ["Vijayapura", "KA", ["bijapur"]], ["Shivamogga", "KA", ["shimoga"]],
  ["Tumakuru", "KA", ["tumkur"]], ["Raichur", "KA"], ["Bidar", "KA"], ["Hassan", "KA"],
  ["Udupi", "KA"], ["Hospet", "KA", ["hosapete"]], ["Gadag", "KA"], ["Chitradurga", "KA"],
  ["Kolar", "KA"], ["Mandya", "KA"], ["Chikkamagaluru", "KA", ["chikmagalur"]],

  // --- Kerala ---------------------------------------------------------------
  ["Kozhikode", "KL", ["calicut"]], ["Thrissur", "KL", ["trichur"]], ["Kollam", "KL", ["quilon"]],
  ["Alappuzha", "KL", ["alleppey"]], ["Palakkad", "KL", ["palghat"]], ["Kannur", "KL", ["cannanore"]],
  ["Kottayam", "KL"], ["Malappuram", "KL"], ["Pathanamthitta", "KL"], ["Idukki", "KL"],
  ["Kasaragod", "KL"], ["Wayanad", "KL"], ["Guruvayur", "KL"], ["Munnar", "KL"],

  // --- Madhya Pradesh -------------------------------------------------------
  ["Ujjain", "MP"], ["Sagar", "MP"], ["Dewas", "MP"], ["Satna", "MP"], ["Ratlam", "MP"],
  ["Rewa", "MP"], ["Katni", "MP"], ["Singrauli", "MP"], ["Burhanpur", "MP"], ["Khandwa", "MP"],
  ["Morena", "MP"], ["Bhind", "MP"], ["Chhindwara", "MP"], ["Guna", "MP"], ["Shivpuri", "MP"],
  ["Vidisha", "MP"], ["Chhatarpur", "MP"], ["Damoh", "MP"], ["Mandsaur", "MP"], ["Khargone", "MP"],
  ["Neemuch", "MP"], ["Hoshangabad", "MP", ["narmadapuram"]],

  // --- Maharashtra ----------------------------------------------------------
  ["Kalyan", "MH"], ["Dombivli", "MH"], ["Vasai", "MH"], ["Virar", "MH"], ["Amravati", "MH"],
  ["Kolhapur", "MH"], ["Sangli", "MH"], ["Malegaon", "MH"], ["Jalgaon", "MH"], ["Akola", "MH"],
  ["Latur", "MH"], ["Ahmednagar", "MH", ["ahilyanagar"]], ["Chandrapur", "MH"], ["Parbhani", "MH"],
  ["Nanded", "MH"], ["Ichalkaranji", "MH"], ["Jalna", "MH"], ["Bhusawal", "MH"], ["Panvel", "MH"],
  ["Satara", "MH"], ["Beed", "MH"], ["Yavatmal", "MH"], ["Osmanabad", "MH", ["dharashiv"]],
  ["Nandurbar", "MH"], ["Wardha", "MH"], ["Ratnagiri", "MH"], ["Gondia", "MH"], ["Baramati", "MH"],
  ["Pimpri-Chinchwad", "MH", ["pimpri", "chinchwad"]], ["Mira-Bhayandar", "MH", ["mira road"]],

  // --- Manipur / Meghalaya / Mizoram / Nagaland / Sikkim / Tripura ----------
  ["Thoubal", "MN"], ["Bishnupur", "MN"], ["Churachandpur", "MN"], ["Ukhrul", "MN"],
  ["Tura", "ML"], ["Jowai", "ML"], ["Nongstoin", "ML"], ["Baghmara", "ML"],
  ["Lunglei", "MZ"], ["Champhai", "MZ"], ["Serchhip", "MZ"], ["Kolasib", "MZ"], ["Saiha", "MZ"],
  ["Dimapur", "NL"], ["Mokokchung", "NL"], ["Tuensang", "NL"], ["Wokha", "NL"], ["Zunheboto", "NL"],
  ["Namchi", "SK"], ["Gyalshing", "SK"], ["Mangan", "SK"],
  ["Udaipur", "TR"], ["Dharmanagar", "TR"], ["Kailashahar", "TR"], ["Belonia", "TR"],

  // --- Odisha ---------------------------------------------------------------
  ["Cuttack", "OD"], ["Rourkela", "OD"], ["Berhampur", "OD", ["brahmapur"]], ["Sambalpur", "OD"],
  ["Puri", "OD"], ["Balasore", "OD", ["baleswar"]], ["Bhadrak", "OD"], ["Baripada", "OD"],
  ["Jharsuguda", "OD"], ["Jeypore", "OD"], ["Angul", "OD"], ["Dhenkanal", "OD"],

  // --- Punjab ---------------------------------------------------------------
  ["Jalandhar", "PB"], ["Patiala", "PB"], ["Bathinda", "PB"], ["Mohali", "PB", ["sahibzada ajit singh nagar"]],
  ["Hoshiarpur", "PB"], ["Pathankot", "PB"], ["Moga", "PB"], ["Batala", "PB"], ["Firozpur", "PB"],
  ["Kapurthala", "PB"], ["Phagwara", "PB"], ["Muktsar", "PB"], ["Barnala", "PB"], ["Sangrur", "PB"],
  ["Rajpura", "PB"], ["Khanna", "PB"],

  // --- Rajasthan ------------------------------------------------------------
  ["Udaipur", "RJ"], ["Ajmer", "RJ"], ["Bikaner", "RJ"], ["Bhilwara", "RJ"], ["Alwar", "RJ"],
  ["Sikar", "RJ"], ["Pali", "RJ"], ["Sri Ganganagar", "RJ", ["ganganagar"]], ["Bharatpur", "RJ"],
  ["Jhunjhunu", "RJ"], ["Barmer", "RJ"], ["Tonk", "RJ"], ["Beawar", "RJ"], ["Hanumangarh", "RJ"],
  ["Chittorgarh", "RJ"], ["Jaisalmer", "RJ"], ["Banswara", "RJ"], ["Nagaur", "RJ"], ["Dausa", "RJ"],
  ["Mount Abu", "RJ"],

  // --- Tamil Nadu -----------------------------------------------------------
  ["Tiruchirappalli", "TN", ["trichy", "tiruchi"]], ["Salem", "TN"], ["Tirunelveli", "TN"],
  ["Tiruppur", "TN", ["tirupur"]], ["Erode", "TN"], ["Vellore", "TN"], ["Thoothukudi", "TN", ["tuticorin"]],
  ["Dindigul", "TN"], ["Thanjavur", "TN", ["tanjore"]], ["Kanchipuram", "TN"], ["Cuddalore", "TN"],
  ["Nagercoil", "TN"], ["Karur", "TN"], ["Hosur", "TN"], ["Namakkal", "TN"], ["Ooty", "TN", ["udhagamandalam"]],
  ["Sivakasi", "TN"], ["Pudukkottai", "TN"], ["Rajapalayam", "TN"], ["Kumbakonam", "TN"],
  ["Ambur", "TN"], ["Villupuram", "TN"], ["Krishnagiri", "TN"], ["Ramanathapuram", "TN"],
  ["Chengalpattu", "TN"], ["Tambaram", "TN"], ["Avadi", "TN"],

  // --- Telangana ------------------------------------------------------------
  ["Warangal", "TS"], ["Nizamabad", "TS"], ["Karimnagar", "TS"], ["Khammam", "TS"],
  ["Ramagundam", "TS"], ["Mahbubnagar", "TS"], ["Nalgonda", "TS"], ["Adilabad", "TS"],
  ["Suryapet", "TS"], ["Siddipet", "TS"], ["Miryalaguda", "TS"], ["Jagtial", "TS"],
  ["Secunderabad", "TS"],

  // --- Uttar Pradesh --------------------------------------------------------
  ["Aligarh", "UP"], ["Moradabad", "UP"], ["Saharanpur", "UP"], ["Gorakhpur", "UP"],
  ["Firozabad", "UP"], ["Jhansi", "UP"], ["Muzaffarnagar", "UP"], ["Mathura", "UP"],
  ["Rampur", "UP"], ["Shahjahanpur", "UP"], ["Farrukhabad", "UP"], ["Ayodhya", "UP", ["faizabad"]],
  ["Hapur", "UP"], ["Etawah", "UP"], ["Mirzapur", "UP"], ["Bulandshahr", "UP"], ["Sambhal", "UP"],
  ["Amroha", "UP"], ["Hardoi", "UP"], ["Fatehpur", "UP"], ["Raebareli", "UP"], ["Orai", "UP"],
  ["Sitapur", "UP"], ["Bahraich", "UP"], ["Modinagar", "UP"], ["Unnao", "UP"], ["Jaunpur", "UP"],
  ["Lakhimpur", "UP"], ["Banda", "UP"], ["Basti", "UP"], ["Ballia", "UP"], ["Azamgarh", "UP"],
  ["Deoria", "UP"], ["Ghazipur", "UP"], ["Sultanpur", "UP"], ["Pilibhit", "UP"], ["Greater Noida", "UP"],

  // --- Uttarakhand ----------------------------------------------------------
  ["Haridwar", "UK"], ["Roorkee", "UK"], ["Haldwani", "UK"], ["Rudrapur", "UK"], ["Kashipur", "UK"],
  ["Rishikesh", "UK"], ["Nainital", "UK"], ["Mussoorie", "UK"], ["Almora", "UK"], ["Pithoragarh", "UK"],

  // --- West Bengal ----------------------------------------------------------
  ["Asansol", "WB"], ["Siliguri", "WB"], ["Durgapur", "WB"], ["Bardhaman", "WB", ["burdwan"]],
  ["Malda", "WB"], ["Baharampur", "WB", ["berhampore"]], ["Habra", "WB"], ["Kharagpur", "WB"],
  ["Shantipur", "WB"], ["Darjeeling", "WB"], ["Krishnanagar", "WB"], ["Medinipur", "WB", ["midnapore"]],
  ["Jalpaiguri", "WB"], ["Balurghat", "WB"], ["Bankura", "WB"], ["Purulia", "WB"],
  ["Cooch Behar", "WB"], ["Raiganj", "WB"], ["Barasat", "WB"], ["Serampore", "WB"],
  ["Chandannagar", "WB"], ["Haldia", "WB"], ["Bidhannagar", "WB", ["salt lake"]],
];

/** Lowercase, strip accents and punctuation. What search compares against. */
export function normalise(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Slugs must be unique, and several names legitimately repeat across states —
 * Udaipur in Rajasthan and Tripura, Bilaspur in Chhattisgarh and Himachal.
 * The state code disambiguates them.
 */
export function slugFor(name, stateCode) {
  return `${normalise(name).replace(/ /g, "-")}-${stateCode.toLowerCase()}`;
}

function sqlString(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toRow([name, stateCode, alternatives = [], lat, lon]) {
  const state = STATES[stateCode];
  if (!state) throw new Error(`Unknown state code ${stateCode} for ${name}`);

  // Name, state and alternatives all go in, so "kol" finds Kolkata and
  // "bangalore" finds Bengaluru without either being displayed.
  const terms = [normalise(name), normalise(state), stateCode.toLowerCase(), ...alternatives.map(normalise)];
  const searchTerms = [...new Set(terms)].join(" ");

  const isFocus = FOCUS_CITIES.includes(name);

  return `  (${sqlString(name)}, ${sqlString(slugFor(name, stateCode))}, ${sqlString(state)}, ${sqlString(stateCode)}, ${sqlString(searchTerms)}, ${isFocus}, ${lat ?? "null"}, ${lon ?? "null"})`;
}

// Guard against a duplicate slug slipping in as the list grows.
const seen = new Map();
for (const entry of CITIES) {
  const slug = slugFor(entry[0], entry[1]);
  if (seen.has(slug)) {
    throw new Error(`Duplicate slug ${slug}: "${entry[0]}" appears twice for ${entry[1]}`);
  }
  seen.set(slug, entry);
}

const preamble = `-- Every city Eraya offers at signup, across India.
--
-- Generated by scripts/cities-india.mjs — edit the dataset there and regenerate
-- rather than hand-editing this file.
--
-- Idempotent on the slug, which includes the state code so the names that repeat
-- across states (Udaipur, Bilaspur, Bhilwara) do not collide.
--
-- is_launch_city marks the cities Eraya is concentrating on first. It is
-- marketing metadata and gates nothing: every row here is equally registerable.
`;

const insert = `insert into public.cities
  (name, slug, state, state_code, search_terms, is_launch_city, latitude, longitude)
values
${CITIES.map(toRow).join(",\n")}
on conflict (slug) do update
  set name         = excluded.name,
      state        = excluded.state,
      state_code   = excluded.state_code,
      search_terms = excluded.search_terms,
      latitude     = coalesce(excluded.latitude, public.cities.latitude),
      longitude    = coalesce(excluded.longitude, public.cities.longitude),
      is_active    = true;

`;

/**
 * The original seven were seeded before states existed, under bare slugs like
 * 'kolkata'. Their slugs are migrated to the new scheme BEFORE the upsert, so it
 * updates those existing rows instead of inserting duplicates beside them.
 *
 * This matters for referential integrity: profiles.city_id points at those rows.
 * Inserting a second Kolkata would leave existing members attached to a stale
 * one, and deactivating the old row would make a member's own city vanish from
 * their profile. Renaming keeps one row per city and every foreign key intact.
 */
const LEGACY_SLUGS = [
  ["hyderabad", "hyderabad-ts"],
  ["delhi", "delhi-dl"],
  ["kolkata", "kolkata-wb"],
  ["mumbai", "mumbai-mh"],
  ["pune", "pune-mh"],
  ["aizawl", "aizawl-mz"],
  ["chennai", "chennai-tn"],
];

const legacyRename = [
  "-- Migrate the legacy slugs first, so the upsert below updates these rows",
  "-- rather than inserting a second copy of each city beside them.",
  ...LEGACY_SLUGS.map(
    ([from, to]) =>
      `update public.cities set slug = ${sqlString(to)} where slug = ${sqlString(from)};`,
  ),
].join("\n");

console.log([preamble, legacyRename, "", insert].join("\n"));
