// ─────────────────────────────────────────────────────────────────────────────
// AI UPCHAR — Clinical Question & Reasoning Library (Phase 1)
//
// Structured, typed clinical PATHWAYS derived from the "Clinical Question &
// Reasoning Library — Master Specification" (§4 Pathway Object, §10 complaint
// library, §11 question blueprint, §12–20 example pathways, §7 red-flag engine).
//
// Design principles enforced (spec §26, §28):
//   • This is NOT a fixed questionnaire. It is a *starting frame* the adaptive
//     AI uses: the AI picks the single next-best question, may skip covered
//     topics, and adapts wording to the patient. The pathway makes questioning
//     consistent, fast and SAFE (red-flag aware) without relying only on live
//     web research.
//   • AI assists, the clinician decides. Nothing here diagnoses or prescribes.
//   • Everything is browser-safe plain data + pure functions (no imports), so it
//     can run client-side inside the patient appointment flow.
// ─────────────────────────────────────────────────────────────────────────────

export type RedFlagUrgency = "urgent" | "emergency";

/** An explainable safety signal (spec §7). `match` words are checked against the
 *  patient's own words (complaint + all answers) in a simple, transparent way. */
export type RedFlag = {
  id: string;
  /** lowercase keywords/phrases (English + Hinglish/Hindi-Roman) that raise this flag */
  match: string[];
  /** short human-readable signal shown to the doctor ("what triggered it") */
  signal: string;
  urgency: RedFlagUrgency;
};

/** A clinical pathway = structured data for one common complaint (spec §4). */
export type ClinicalPathway = {
  id: string;
  displayName: string;
  /** synonyms/colloquial terms in English + Hindi/Hinglish (spec §3: recognize synonyms) */
  synonyms: string[];
  specialty: string;
  /** the focused history questions a clinician asks for THIS complaint (spec §11 blueprint,
   *  §12–20 example pathways). Bilingual so the flow never shows a blank/foreign line. */
  coreQuestions: { hinglish: string; english: string }[];
  /** pathway-specific danger signs (spec §7). */
  redFlags: RedFlag[];
  /** investigations a clinician may consider — presented as considerations, not orders (spec §12). */
  investigationConsiderations: string[];
  /** provenance/governance (spec §4, §23). */
  version: string;
  evidenceBasis: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// General acute-illness red flags (spec §7: general safety checks) — checked for
// EVERY pathway in addition to the pathway-specific ones.
// ─────────────────────────────────────────────────────────────────────────────
const GENERAL_RED_FLAGS: RedFlag[] = [
  { id: "gen_unconscious", match: ["unconscious", "behosh", "faint", "behoshi", "collapse", "gir gaya"], signal: "Loss of consciousness / fainting reported", urgency: "emergency" },
  { id: "gen_breathless", match: ["can't breathe", "cannot breathe", "saans nahi", "saans phool", "breathless", "gasping", "dum ghut"], signal: "Severe breathing difficulty reported", urgency: "emergency" },
  { id: "gen_severe_bleeding", match: ["heavy bleeding", "bahut khoon", "khoon band nahi", "profuse bleeding"], signal: "Significant/uncontrolled bleeding reported", urgency: "emergency" },
  { id: "gen_high_fever", match: ["104", "105", "very high fever", "tez bukhar 104", "convulsion", "daura", "jhatke"], signal: "Very high fever / seizure reported", urgency: "urgent" },
  { id: "gen_dehydration", match: ["not passing urine", "peshaab nahi", "no urine", "sunk eyes", "very weak", "bahut kamzor", "dizzy standing"], signal: "Possible significant dehydration reported", urgency: "urgent" },
];

// ─────────────────────────────────────────────────────────────────────────────
// PHASE-1 PATHWAYS (high-frequency primary-care), spec §10 + §12–20.
// Questions taken from the spec's example pathways and phrased bilingually.
// ─────────────────────────────────────────────────────────────────────────────
const PATHWAYS: ClinicalPathway[] = [
  // §12 Persistent / Acute Diarrhea
  {
    id: "diarrhea",
    displayName: "Diarrhea / loose motions",
    synonyms: ["diarrhea", "diarrhoea", "loose motion", "loose motions", "loose motin", "dast", "patla pakhana", "pet kharab", "motions", "toilet baar baar", "loose stool"],
    specialty: "Gastroenterology",
    coreQuestions: [
      { hinglish: "Din mein kitni baar motion ho raha hai?", english: "How many bowel movements per day?" },
      { hinglish: "Motion kaisa hai — paani jaisa, patla, ya normal?", english: "What is the stool like — watery, loose, or normal?" },
      { hinglish: "Motion mein khoon, kaala rang, ya aam (mucus) to nahi aa raha?", english: "Any blood, black stool, or mucus?" },
      { hinglish: "Bukhar ya thandi lag rahi hai?", english: "Any fever or chills?" },
      { hinglish: "Pet mein dard ya marod hai? Kahan hota hai?", english: "Any abdominal pain or cramping, and where?" },
      { hinglish: "Ulti ya jee-michlana ho raha hai?", english: "Any vomiting or nausea?" },
      { hinglish: "Peshaab kam ho gaya, zyada pyaas, muh sookhna, chakkar ya bahut kamzori?", english: "Reduced urine, thirst, dry mouth, dizziness or marked weakness?" },
      { hinglish: "Bina wajah wazan kam hua hai?", english: "Any unintentional weight loss?" },
      { hinglish: "Haal hi mein bahar ka khana, safar, ya kharab paani?", english: "Recent travel, outside food, or unsafe water?" },
      { hinglish: "Haal hi mein koi antibiotic ya nayi dawa li?", english: "Recent antibiotics or new medicines?" },
    ],
    redFlags: [
      { id: "diar_blood", match: ["blood", "khoon", "khun", "kaala", "black stool", "aam", "mucus"], signal: "Blood/black stool or mucus with diarrhea", urgency: "urgent" },
      { id: "diar_dehydration", match: ["no urine", "peshaab nahi", "peshaab kam", "chakkar", "bahut kamzor", "muh sookh", "dry mouth", "dizzy"], signal: "Dehydration features with diarrhea", urgency: "urgent" },
      { id: "diar_prolonged", match: ["mahine", "month", "weeks", "hafton", "20 din", "kai din"], signal: "Prolonged/persistent diarrhea (needs evaluation)", urgency: "urgent" },
    ],
    investigationConsiderations: ["Stool routine/microscopy", "Stool culture if inflammatory/prolonged", "CBC", "Serum electrolytes if dehydrated", "Consider colonoscopy if chronic/blood (clinician decision)"],
    version: "p1-2026-01",
    evidenceBasis: "Acute diarrhea assessment (onset, frequency, stool character, systemic features, exposures) — WHO/standard primary-care approach.",
  },

  // §13 Chest Pain
  {
    id: "chest_pain",
    displayName: "Chest pain",
    synonyms: ["chest pain", "seene me dard", "seene mein dard", "chhati me dard", "chati dard", "heart pain", "dil me dard", "chest me dard", "chest tightness", "seene me jakdan"],
    specialty: "Cardiology",
    coreQuestions: [
      { hinglish: "Dard kab shuru hua aur abhi bhi ho raha hai kya?", english: "When did it start, and is the pain there right now?" },
      { hinglish: "Dard seene mein kahan hota hai?", english: "Where in the chest is the pain?" },
      { hinglish: "Dard kaisa hai — dabav, jakdan, jalan, ya chubhan?", english: "Is it pressure, tightness, burning, or sharp?" },
      { hinglish: "Dard haath, jabde, ya peeth tak jaata hai?", english: "Does it radiate to the arm, jaw, or back?" },
      { hinglish: "Chalne ya mehnat karne par badhta hai?", english: "Does it get worse with exertion?" },
      { hinglish: "Saans phoolti hai?", english: "Any breathlessness?" },
      { hinglish: "Paseena ya ulti jaisa mehsoos hua?", english: "Any sweating or nausea?" },
      { hinglish: "Chakkar ya behoshi jaisa laga?", english: "Any dizziness or fainting?" },
      { hinglish: "Pehle se dil ki bimari, BP, diabetes ya cholesterol hai?", english: "Any known heart disease, BP, diabetes, or cholesterol?" },
    ],
    redFlags: [
      { id: "chest_radiation", match: ["arm", "haath", "jabda", "jaw", "back", "peeth", "paseena", "sweating", "breathless", "saans phool"], signal: "Chest pain with radiation / sweating / breathlessness (possible cardiac)", urgency: "emergency" },
      { id: "chest_exertion", match: ["chalne", "mehnat", "exertion", "walking", "seedhi", "stairs"], signal: "Exertional chest pain", urgency: "urgent" },
    ],
    investigationConsiderations: ["ECG (urgent)", "Troponin if cardiac suspicion", "Chest X-ray", "Vitals & BP", "Refer/emergency assessment per clinician"],
    version: "p1-2026-01",
    evidenceBasis: "Chest pain requires clinician-reviewed emergency rules (spec §13); acute assessment via ABCDE where appropriate.",
  },

  // §14 Headache
  {
    id: "headache",
    displayName: "Headache",
    synonyms: ["headache", "sar dard", "sir dard", "sardard", "head pain", "migraine", "aadha sar dard", "sar me dard"],
    specialty: "Neurology",
    coreQuestions: [
      { hinglish: "Pehli baar hua hai ya baar-baar hota hai?", english: "Is this the first time or recurrent?" },
      { hinglish: "Achanak shuru hua ya dheere-dheere?", english: "Did it start suddenly or gradually?" },
      { hinglish: "Sar mein kahan dard hota hai?", english: "Where is the pain located?" },
      { hinglish: "0 se 10 mein kitna tez hai?", english: "How severe is it on a 0–10 scale?" },
      { hinglish: "Roshni ya awaaz se badhta hai?", english: "Any light or sound sensitivity?" },
      { hinglish: "Ulti ya jee-michlana hota hai?", english: "Any nausea or vomiting?" },
      { hinglish: "Aankhon se dhundhla ya dikhne mein dikkat?", english: "Any vision changes?" },
      { hinglish: "Haath-pair mein kamzori ya sunnapan, ya bolne mein dikkat?", english: "Any weakness, numbness, or speech difficulty?" },
      { hinglish: "Bukhar ya gardan mein akdan hai?", english: "Any fever or neck stiffness?" },
    ],
    redFlags: [
      { id: "head_thunderclap", match: ["achanak", "sudden", "worst", "sabse tez", "thunderclap"], signal: "Sudden severe (thunderclap) headache", urgency: "emergency" },
      { id: "head_neuro", match: ["kamzori", "weakness", "sunnapan", "numb", "bolne", "speech", "confusion", "dhundhla", "vision", "gardan akdan", "neck stiff"], signal: "Headache with neurological / meningeal signs", urgency: "emergency" },
      { id: "head_injury", match: ["chot", "injury", "head injury", "gir gaya", "accident"], signal: "Headache after head injury", urgency: "urgent" },
    ],
    investigationConsiderations: ["Neuro exam & BP", "CT/MRI brain if red flags (clinician decision)", "Consider migraine vs tension per clinician"],
    version: "p1-2026-01",
    evidenceBasis: "Headache history (onset, pattern, associated neuro/meningeal features) — spec §14.",
  },

  // §15 Cough / Breathing
  {
    id: "cough_breathing",
    displayName: "Cough / breathing problem",
    synonyms: ["cough", "khaansi", "khansi", "breathless", "saans", "saans phoolna", "wheeze", "seeti", "balgam", "sputum", "breathing problem", "damma", "asthma", "saans lene me dikkat"],
    specialty: "Pulmonology",
    coreQuestions: [
      { hinglish: "Khaansi kab se hai?", english: "How long have you had the cough?" },
      { hinglish: "Sukhi khaansi hai ya balgam aata hai?", english: "Is it dry, or with sputum?" },
      { hinglish: "Balgam mein khoon to nahi aata?", english: "Any blood in the sputum?" },
      { hinglish: "Bukhar hai?", english: "Any fever?" },
      { hinglish: "Saans phoolti hai ya seene mein seeti (wheeze)?", english: "Any breathlessness or wheeze?" },
      { hinglish: "Seene mein dard hai?", english: "Any chest pain?" },
      { hinglish: "Raat mein lakshan badhte hain?", english: "Do symptoms worsen at night?" },
      { hinglish: "Beedi/cigarette/tambakoo ka sevan?", english: "Any smoking or tobacco use?" },
      { hinglish: "Wazan kam hua ya raat mein paseena aata hai? (TB sampark?)", english: "Weight loss or night sweats? (Any TB contact?)" },
    ],
    redFlags: [
      { id: "cough_breathless", match: ["saans nahi", "breathless", "saans phool", "gasping", "dum ghut", "can't breathe"], signal: "Significant breathlessness with cough", urgency: "emergency" },
      { id: "cough_hemoptysis", match: ["khoon", "blood", "balgam me khoon", "hemoptysis"], signal: "Blood in sputum", urgency: "urgent" },
      { id: "cough_tb", match: ["wazan kam", "weight loss", "raat paseena", "night sweat", "tb", "3 hafte", "3 weeks", "kai hafte"], signal: "Chronic cough with weight loss/night sweats (TB screen)", urgency: "urgent" },
    ],
    investigationConsiderations: ["Chest X-ray", "Sputum for AFB if TB suspicion", "CBC", "SpO2/vitals", "Consider spirometry per clinician"],
    version: "p1-2026-01",
    evidenceBasis: "Cough/breathing history + acute acuity (ABCDE) where appropriate — spec §15.",
  },

  // §16 Diabetes / High Glucose
  {
    id: "diabetes",
    displayName: "Diabetes / high blood sugar",
    synonyms: ["diabetes", "sugar", "blood sugar", "high glucose", "shakkar", "shugar", "madhumeh", "sugar zyada", "glucose high"],
    specialty: "Endocrinology",
    coreQuestions: [
      { hinglish: "Pehle se diabetes hai ya nayi baat pata chali?", english: "Known diabetes, or a new finding?" },
      { hinglish: "Haal ka sugar value kya tha — khaali pet, khane ke baad, ya kabhi bhi?", english: "Recent glucose value — fasting, post-meal, or random?" },
      { hinglish: "Kitne samay se sugar badha hua hai?", english: "How long has it been elevated?" },
      { hinglish: "Abhi kaunsi dawaiyan chal rahi hain?", english: "What medicines are you currently taking?" },
      { hinglish: "Zyada pyaas lagti hai?", english: "Any excessive thirst?" },
      { hinglish: "Baar-baar peshaab aata hai?", english: "Frequent urination?" },
      { hinglish: "Wazan mein badlav aaya?", english: "Any weight change?" },
      { hinglish: "Aankhon se dhundhla dikhta hai ya bahut kamzori?", english: "Blurred vision or marked weakness?" },
      { hinglish: "Kabhi sugar bahut kam (hypo) hone ke lakshan?", english: "Any low-sugar (hypoglycemia) episodes?" },
    ],
    redFlags: [
      { id: "dm_dka", match: ["ulti", "vomiting", "pet dard", "saans tej", "drowsy", "susti", "behoshi", "bahut pyaas", "confusion"], signal: "Possible acute metabolic crisis (DKA-like features)", urgency: "emergency" },
      { id: "dm_hypo", match: ["hypo", "sugar kam", "paseena kaamp", "shaking", "faint", "chakkar behosh"], signal: "Hypoglycemia symptoms", urgency: "urgent" },
    ],
    investigationConsiderations: ["Fasting/PP glucose", "HbA1c", "Urine ketones if unwell", "Lipid profile & KFT", "Review current medicines/adherence (clinician)"],
    version: "p1-2026-01",
    evidenceBasis: "Diabetes/high-glucose focused history — spec §16.",
  },

  // §17 Urinary Symptoms
  {
    id: "urinary",
    displayName: "Urinary symptoms (burning/UTI)",
    synonyms: ["urine", "peshaab", "burning urination", "peshaab me jalan", "uti", "urine infection", "baar baar peshaab", "peshaab me dard", "flank pain", "kidney stone", "pathri"],
    specialty: "Urology",
    coreQuestions: [
      { hinglish: "Kab se ho raha hai?", english: "When did it start?" },
      { hinglish: "Peshaab mein jalan hoti hai?", english: "Any burning during urination?" },
      { hinglish: "Baar-baar ya achanak zor se peshaab lagta hai?", english: "Any frequency or urgency?" },
      { hinglish: "Pet ke nichle hisse mein dard?", english: "Any lower abdominal pain?" },
      { hinglish: "Bukhar ya thandi lagti hai?", english: "Any fever or chills?" },
      { hinglish: "Kamar ya baju (flank) mein dard?", english: "Any flank or back pain?" },
      { hinglish: "Peshaab mein khoon aata hai?", english: "Any blood in the urine?" },
      { hinglish: "Peshaab ka rang/badboo alag hai?", english: "Any change in urine colour or odour?" },
      { hinglish: "Pehle UTI hua hai ya kidney/urinary problem?", english: "Any previous UTI or kidney/urinary problem?" },
    ],
    redFlags: [
      { id: "uti_pyelo", match: ["bukhar", "fever", "kamar dard", "flank", "baju dard", "kaamp", "chills", "ulti", "vomiting"], signal: "Fever + flank pain (possible kidney involvement)", urgency: "urgent" },
      { id: "uti_hematuria", match: ["khoon", "blood", "peshaab me khoon", "red urine"], signal: "Blood in urine", urgency: "urgent" },
    ],
    investigationConsiderations: ["Urine routine & microscopy", "Urine culture", "CBC if febrile", "USG KUB if stone/flank pain (clinician)", "Pregnancy test where relevant"],
    version: "p1-2026-01",
    evidenceBasis: "Urinary-symptom focused history — spec §17.",
  },

  // §18 Back Pain
  {
    id: "back_pain",
    displayName: "Back pain",
    synonyms: ["back pain", "kamar dard", "kamar me dard", "peeth dard", "lower back", "sciatica", "kamar me dard hota hai", "reedh dard"],
    specialty: "Orthopedics",
    coreQuestions: [
      { hinglish: "Dard kab shuru hua?", english: "When did the pain start?" },
      { hinglish: "Koi chot lagi ya bhaari cheez uthai?", english: "Any injury or heavy lifting?" },
      { hinglish: "Dard kamar mein kahan hai?", english: "Where exactly is the pain?" },
      { hinglish: "Dard pair tak jaata hai?", english: "Does the pain radiate down the leg?" },
      { hinglish: "Pair mein sunnapan ya jhanjhanahat?", english: "Any numbness or tingling in the leg?" },
      { hinglish: "Pair mein kamzori ya chalne mein dikkat?", english: "Any leg weakness or difficulty walking?" },
      { hinglish: "Peshaab ya latrine par control ka koi badlav?", english: "Any change in bladder or bowel control?" },
      { hinglish: "Bukhar ya bina wajah wazan kam hua?", english: "Any fever or unexplained weight loss?" },
    ],
    redFlags: [
      { id: "back_cauda", match: ["peshaab control", "latrine control", "bladder", "bowel", "control nahi", "incontinence", "dono pair kamzor"], signal: "Bladder/bowel changes with back pain (possible cauda equina)", urgency: "emergency" },
      { id: "back_systemic", match: ["bukhar", "fever", "wazan kam", "weight loss", "raat dard", "night pain", "cancer"], signal: "Back pain with fever/weight loss (infection/malignancy screen)", urgency: "urgent" },
      { id: "back_neuro", match: ["kamzori", "weakness", "sunnapan", "numb", "chalne me dikkat", "gait"], signal: "Back pain with leg weakness/numbness", urgency: "urgent" },
    ],
    investigationConsiderations: ["Clinical/neuro exam", "X-ray L-S spine if indicated", "MRI if red flags/neuro deficit (clinician)", "ESR/CRP if infection suspicion"],
    version: "p1-2026-01",
    evidenceBasis: "Back-pain focused history incl. red-flag screen — spec §18.",
  },

  // §19 Skin Rash
  {
    id: "skin_rash",
    displayName: "Skin rash / itching",
    synonyms: ["rash", "skin", "itching", "khujli", "daane", "chakatte", "chakatte pad gaye", "skin problem", "chamdi", "phunsi", "daad", "eczema", "allergy skin"],
    specialty: "Dermatology",
    coreQuestions: [
      { hinglish: "Kab shuru hua?", english: "When did it start?" },
      { hinglish: "Sharir mein kahan-kahan hai?", english: "Where on the body is it?" },
      { hinglish: "Failta ja raha hai?", english: "Is it spreading?" },
      { hinglish: "Khujli hoti hai?", english: "Is it itchy?" },
      { hinglish: "Dard ya jalan hai?", english: "Any pain or burning?" },
      { hinglish: "Chhale (blisters) hain?", english: "Any blisters?" },
      { hinglish: "Bukhar ya aur koi lakshan?", english: "Any fever or systemic symptoms?" },
      { hinglish: "Koi nayi dawa, khana, ya cosmetic shuru kiya?", english: "Any new medicine, food, or product?" },
      { hinglish: "Ghar mein kisi aur ko bhi hua hai?", english: "Is anyone else affected?" },
    ],
    redFlags: [
      { id: "rash_systemic", match: ["bukhar", "fever", "chhale", "blister", "muh me", "aankh", "hoth soojan", "saans", "swelling face", "chehra soojan"], signal: "Rash with fever/blisters/facial or airway swelling (severe reaction)", urgency: "emergency" },
      { id: "rash_spreading_fast", match: ["tezi se fail", "spreading fast", "poore sharir", "whole body"], signal: "Rapidly spreading rash", urgency: "urgent" },
    ],
    investigationConsiderations: ["Clinical exam / photo review", "KOH/skin scraping if fungal", "CBC if systemic", "Allergy review (clinician)"],
    version: "p1-2026-01",
    evidenceBasis: "Skin-rash focused history (onset, distribution, triggers, systemic features) — spec §19.",
  },

  // §20 Mental Health
  {
    id: "mental_health",
    displayName: "Mental health concern",
    synonyms: ["anxiety", "depression", "tension", "stress", "udaasi", "ghabrahat", "neend nahi", "sleep problem", "mann udaas", "panic", "chinta", "mood", "insomnia"],
    specialty: "Mental health",
    coreQuestions: [
      { hinglish: "Apni pareshani apne shabdon mein bataiye — mukhya baat kya hai?", english: "In your own words, what is the main concern?" },
      { hinglish: "Kab se ho raha hai?", english: "Since when has this been happening?" },
      { hinglish: "Rozmarra ke kaam par kitna asar padta hai?", english: "How much does it affect daily life?" },
      { hinglish: "Neend kaisi hai?", english: "How is your sleep?" },
      { hinglish: "Bhookh ya wazan mein badlav?", english: "Any change in appetite or weight?" },
      { hinglish: "Kaam mein mann lagta hai, dhyaan tikta hai?", english: "How is your energy and concentration?" },
      { hinglish: "Ghabrahat ya panic ke daure aate hain?", english: "Any anxiety or panic episodes?" },
      { hinglish: "Pehle kabhi mental-health ilaaj liya hai?", english: "Any previous mental-health treatment?" },
    ],
    redFlags: [
      { id: "mh_selfharm", match: ["khudkushi", "suicide", "khud ko khatam", "self harm", "marne ka", "jaan de", "end my life", "hurt myself", "hurt someone", "kisi ko nuksan"], signal: "Self-harm / harm-to-others expressed — needs immediate attention", urgency: "emergency" },
    ],
    investigationConsiderations: ["Validated screening (PHQ-9/GAD-7) per clinician", "Safety/self-harm assessment when indicated", "Rule out medical causes (thyroid, etc.)"],
    version: "p1-2026-01",
    evidenceBasis: "Mental-health assessment following validated, clinician-reviewed frameworks (WHO mhGAP) — spec §20.",
  },

  // §10 General symptoms — Fever (high-frequency addition)
  {
    id: "fever",
    displayName: "Fever",
    synonyms: ["fever", "bukhar", "tez bukhar", "temperature", "jvar", "body temperature", "bukhaar"],
    specialty: "General medicine",
    coreQuestions: [
      { hinglish: "Bukhar kab se hai?", english: "Since when do you have the fever?" },
      { hinglish: "Kitna tez hai — thermometer se napa kya?", english: "How high is it — measured with a thermometer?" },
      { hinglish: "Lagataar rehta hai ya aata-jaata hai? Thandi lagti hai?", english: "Is it continuous or intermittent? Any chills?" },
      { hinglish: "Iske saath aur kya lakshan hain — khaansi, dard, motions, peshaab me jalan?", english: "Any associated symptoms — cough, pain, loose motions, burning urine?" },
      { hinglish: "Sar dard, badan dard ya chakatte hain?", english: "Any headache, body ache, or rash?" },
      { hinglish: "Ulti ya jee-michlana?", english: "Any vomiting or nausea?" },
      { hinglish: "Haal hi mein safar kiya ya kisi bimar se sampark?", english: "Any recent travel or contact with a sick person?" },
    ],
    redFlags: [
      { id: "fever_neuro", match: ["gardan akdan", "neck stiff", "jhatke", "convulsion", "daura", "confusion", "behoshi", "rash chakatte"], signal: "Fever with neck stiffness / seizure / altered sensorium / rash", urgency: "emergency" },
      { id: "fever_persistent", match: ["hafte", "weeks", "kai din", "many days", "wazan kam", "night sweat", "raat paseena"], signal: "Prolonged fever with weight loss/night sweats", urgency: "urgent" },
    ],
    investigationConsiderations: ["CBC", "Malaria/dengue/typhoid tests per local context", "Urine routine", "Blood culture if persistent (clinician)"],
    version: "p1-2026-01",
    evidenceBasis: "General fever assessment (duration, pattern, associated/localizing and danger features) — spec §10.",
  },

  // §10 GI — Abdominal pain (high-frequency addition)
  {
    id: "abdominal_pain",
    displayName: "Abdominal pain",
    synonyms: ["abdominal pain", "pet dard", "pet me dard", "stomach pain", "pet mein dard", "tummy pain", "pet dard hota hai", "gastritis"],
    specialty: "Gastroenterology",
    coreQuestions: [
      { hinglish: "Dard kab shuru hua?", english: "When did the pain start?" },
      { hinglish: "Pet mein kahan dard hota hai?", english: "Where in the abdomen is the pain?" },
      { hinglish: "Dard kaisa hai — marod, jalan, ya lagataar?", english: "What is it like — cramping, burning, or constant?" },
      { hinglish: "0 se 10 mein kitna tez hai?", english: "How severe is it on 0–10?" },
      { hinglish: "Khane se badhta ya kam hota hai?", english: "Does eating make it better or worse?" },
      { hinglish: "Ulti, motions, ya bukhar ke saath hai?", english: "Any vomiting, loose motions, or fever with it?" },
      { hinglish: "Motion/peshaab mein khoon ya kaala rang?", english: "Any blood or black colour in stool/urine?" },
    ],
    redFlags: [
      { id: "abd_acute", match: ["bahut tez dard", "severe pain", "pet patthar", "rigid", "khoon ulti", "vomiting blood", "kaala motion", "black stool", "behoshi", "faint"], signal: "Severe/rigid abdomen or GI bleeding features", urgency: "emergency" },
      { id: "abd_rlq", match: ["dahine niche", "right lower", "appendix", "chalne par dard badh"], signal: "Localized RLQ pain worse on movement (appendicitis screen)", urgency: "urgent" },
    ],
    investigationConsiderations: ["CBC", "Urine routine", "USG abdomen", "LFT/amylase/lipase per site (clinician)", "Erect abdomen X-ray if obstruction suspicion"],
    version: "p1-2026-01",
    evidenceBasis: "Abdominal-pain focused history (site, character, severity, associated & danger features) — spec §10.",
  },

  // §10 GI — Vomiting (high-frequency addition)
  {
    id: "vomiting",
    displayName: "Vomiting",
    synonyms: ["vomiting", "ulti", "vomit", "ulti ho rahi", "jee michlana", "nausea", "ulti aa rahi"],
    specialty: "Gastroenterology",
    coreQuestions: [
      { hinglish: "Ulti kab se ho rahi hai?", english: "Since when have you been vomiting?" },
      { hinglish: "Din mein kitni baar?", english: "How many times a day?" },
      { hinglish: "Ulti mein khoon ya kaala/coffee jaisa rang?", english: "Any blood or coffee-coloured material in the vomit?" },
      { hinglish: "Pet dard, motions ya bukhar ke saath?", english: "With abdominal pain, loose motions, or fever?" },
      { hinglish: "Kuch bhi khaya-piya rok pa rahe hain?", english: "Are you able to keep any food/water down?" },
      { hinglish: "Peshaab kam, muh sookhna, chakkar (dehydration)?", english: "Reduced urine, dry mouth, dizziness (dehydration)?" },
      { hinglish: "Sar mein chot ya tez sar dard?", english: "Any head injury or severe headache?" },
    ],
    redFlags: [
      { id: "vom_blood", match: ["khoon", "blood", "coffee", "kaala ulti", "black vomit"], signal: "Blood/coffee-ground vomit (GI bleed)", urgency: "emergency" },
      { id: "vom_dehydration", match: ["peshaab nahi", "no urine", "chakkar", "bahut kamzor", "muh sookh", "kuch ruk nahi"], signal: "Vomiting with dehydration / unable to keep fluids", urgency: "urgent" },
      { id: "vom_head", match: ["sar chot", "head injury", "tez sar dard", "gardan akdan", "neck stiff"], signal: "Vomiting with head injury / severe headache / neck stiffness", urgency: "emergency" },
    ],
    investigationConsiderations: ["Serum electrolytes if persistent", "CBC", "Consider USG abdomen", "Blood sugar", "Rehydration assessment (clinician)"],
    version: "p1-2026-01",
    evidenceBasis: "Vomiting focused history (frequency, content, associated & dehydration features) — spec §10.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pathway matching & red-flag detection (pure functions, browser-safe).
// ─────────────────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return " " + s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim() + " ";
}

/** Score how strongly a complaint text matches a pathway via synonym hits. */
function scorePathway(p: ClinicalPathway, text: string): number {
  const t = normalize(text);
  let score = 0;
  for (const syn of p.synonyms) {
    const s = syn.toLowerCase().trim();
    if (!s) continue;
    // whole-word/phrase containment; longer synonyms weigh more (more specific)
    if (t.includes(" " + s + " ") || t.includes(" " + s) || t.includes(s + " ")) {
      score += Math.min(3, 1 + Math.floor(s.length / 6));
    }
  }
  return score;
}

/**
 * Match the patient's complaint (plus any extra text) to the best Phase-1
 * pathway. Returns null when nothing matches confidently — the flow then falls
 * back to live web research + the AI's own reasoning (spec: prefer review over
 * inventing a pathway).
 */
export function matchPathway(complaint: string, extra?: string): ClinicalPathway | null {
  const text = `${complaint || ""} ${extra || ""}`;
  if (text.trim().length < 2) return null;
  let best: ClinicalPathway | null = null;
  let bestScore = 0;
  for (const p of PATHWAYS) {
    const s = scorePathway(p, text);
    if (s > bestScore) { bestScore = s; best = p; }
  }
  return bestScore >= 2 ? best : null;
}

export type DetectedRedFlag = { signal: string; urgency: RedFlagUrgency; source: "pathway" | "general" };

/**
 * Scan the patient's own words (complaint + all answers) for explainable red
 * flags — pathway-specific plus general acute-illness checks (spec §7). Each
 * result carries the human-readable signal that triggered it.
 */
export function detectRedFlags(pathway: ClinicalPathway | null, patientText: string): DetectedRedFlag[] {
  const t = normalize(patientText);
  const hits: DetectedRedFlag[] = [];
  const seen = new Set<string>();
  const check = (flags: RedFlag[], source: "pathway" | "general") => {
    for (const f of flags) {
      if (seen.has(f.id)) continue;
      if (f.match.some((m) => t.includes(m.toLowerCase()))) {
        hits.push({ signal: f.signal, urgency: f.urgency, source });
        seen.add(f.id);
      }
    }
  };
  if (pathway) check(pathway.redFlags, "pathway");
  check(GENERAL_RED_FLAGS, "general");
  // emergencies first
  return hits.sort((a, b) => (a.urgency === b.urgency ? 0 : a.urgency === "emergency" ? -1 : 1));
}

/** Compact plain-text summary of a pathway for injecting into an AI prompt. */
export function pathwayGuidance(p: ClinicalPathway, lang: "hinglish" | "english"): string {
  const qs = p.coreQuestions.map((q, i) => `${i + 1}. ${lang === "english" ? q.english : q.hinglish}`).join("\n");
  const flags = p.redFlags.map((f) => `- ${f.signal} (${f.urgency})`).join("\n");
  return [
    `CLINICAL PATHWAY: ${p.displayName} (${p.specialty})`,
    `Focused questions a clinician asks for this complaint:`,
    qs,
    `Danger signs to watch for:`,
    flags,
  ].join("\n");
}

/** All pathways (for admin/reference/testing). */
export function allPathways(): ClinicalPathway[] {
  return PATHWAYS;
}
