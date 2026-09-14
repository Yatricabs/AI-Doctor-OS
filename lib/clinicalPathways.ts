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
      { id: "chest_radiation", match: ["radiat", "arm", "haath", "jabda", "jaw", "back", "peeth", "paseena", "sweating", "breathless", "saans phool"], signal: "Chest pain with radiation / sweating / breathlessness (possible cardiac)", urgency: "emergency" },
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

function isClinicalContext(value: ClinicalPathway | ClinicalContext | null): value is ClinicalContext {
  return Boolean(value && "route" in value && "chestSafety" in value);
}

function contextFromSubject(subject: ClinicalPathway | ClinicalContext | null): ClinicalContext {
  if (isClinicalContext(subject)) return subject;
  const chest = subject?.id === "chest_pain";
  return {
    pathway: subject,
    chestSafety: chest ? { relevant: true, confidence: "high", evidence: ["chest_pain pathway"], profileId: "chest_pain" } : { relevant: false, confidence: null, evidence: [], profileId: null },
    route: subject ? "curated_pathway" : "generic_fallback",
  };
}

function flagDefinitionsForContext(context: ClinicalContext): { flag: RedFlag; source: "pathway" | "general" }[] {
  const definitions: { flag: RedFlag; source: "pathway" | "general" }[] = [];
  const seen = new Set<string>();
  const add = (flags: RedFlag[], source: "pathway" | "general") => {
    for (const flag of flags) {
      if (!seen.has(flag.id)) { definitions.push({ flag, source }); seen.add(flag.id); }
    }
  };
  if (context.pathway) add(context.pathway.redFlags, "pathway");
  if (context.chestSafety.relevant && context.pathway?.id !== "chest_pain") add(chestSafetyPathway().redFlags, "pathway");
  add(GENERAL_RED_FLAGS, "general");
  return definitions;
}

function phraseOccursUnnegated(normalizedText: string, phrase: string): boolean {
  const textTokens = tokensFor(normalizedText);
  const wanted = phraseTokens(phrase);
  if (!wanted.length) return false;
  for (let i = 0; i <= textTokens.length - wanted.length; i += 1) {
    if (!wanted.every((part, offset) => textTokens[i + offset] === part)) continue;
    const before = textTokens.slice(Math.max(0, i - 3), i);
    const negated = before.some((token) => ["no", "nahi", "nahin", "not", "without", "koi"].includes(token));
    // In Hinglish, "saans nahi phoolti" is a negative answer, whereas
    // "saans nahi" by itself is the established positive danger phrase.
    const following = textTokens[i + wanted.length];
    if (wanted.join(" ") === "saans nahi" && ["phoolti", "phoolta", "phoolti", "hoti", "hota"].includes(following ?? "")) continue;
    if (!negated) return true;
  }
  return false;
}

function positiveSafetyFlags(context: ClinicalContext, text: string): DetectedRedFlag[] {
  const normalizedText = normalize(text);
  const hits: DetectedRedFlag[] = [];
  const seen = new Set<string>();
  for (const { flag, source } of flagDefinitionsForContext(context)) {
    if (seen.has(flag.id)) continue;
    if (flag.match.some((match) => phraseOccursUnnegated(normalizedText, match))) {
      hits.push({ signal: flag.signal, urgency: flag.urgency, source });
      seen.add(flag.id);
    }
  }
  return hits.sort((a, b) => (a.urgency === b.urgency ? 0 : a.urgency === "emergency" ? -1 : 1));
}

/** Detect explainable signals using the same resolved context. Complaint text
 * may raise a signal for clinician visibility, but this does not complete the
 * safety screen. */
export function detectRedFlagsForContext(context: ClinicalContext, patientText: string): DetectedRedFlag[] {
  const primary = detectRedFlags(context.pathway, patientText);
  const chest = context.chestSafety.relevant && context.pathway?.id !== "chest_pain"
    ? detectRedFlags(chestSafetyPathway(), patientText)
    : [];
  const merged = [...primary, ...chest];
  const seen = new Set<string>();
  return merged.filter((flag) => {
    const key = `${flag.source}:${flag.signal}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (a.urgency === b.urgency ? 0 : a.urgency === "emergency" ? -1 : 1));
}

function isEligibleSafetyEvidence(evidence: SafetyEvidence): boolean {
  if (evidence.source === "complaint") return false;
  return evidence.questionDimension === "red_flag_screen";
}

function hasClearNegativeAnswer(text: string): boolean {
  const normalized = normalize(text).trim();
  if (!normalized || /\b(pata nahi|nahi pata|shayad|maybe|not sure|unclear)\b/.test(normalized)) return false;
  // A bare no/nahin is a complete answer to a targeted safety question. A
  // phrase such as "No reports" is off-topic and must remain unresolved.
  return /^(no|nahi|nahin|none|nope)[.!]?$/.test(normalized)
    || /\b(no|nahi|nahin|none)\s+(red flag|danger|warning|other symptom|radiat|sweat|paseena|saans|breath|behosh|faint|arm|haath|jaw|back|peeth)/.test(normalized)
    || /\b(koi|kuch)\s+.+\s+(nahi|nahin)\b/.test(normalized)
    || /\b(aisa kuch nahi|no red flag|no warning|nothing like that|none of these)\b/.test(normalized)
    || (/\b(no|none)\b/.test(normalized) && /\b(danger|red flag|warning)\b/.test(normalized));
}

/** Evaluate only attributable, targeted safety answers. Complaint context and
 * off-topic/ambiguous answers remain unanswered or unresolved. */
export function evaluateSafetyEvidence(
  subject: ClinicalPathway | ClinicalContext | null,
  evidence: SafetyEvidence[],
): SafetyEvaluation {
  const context = contextFromSubject(subject);
  const eligible = evidence.filter(isEligibleSafetyEvidence).map((item) => ({ ...item }));
  const evaluated = eligible.map((item) => {
    const signals = positiveSafetyFlags(context, item.text);
    let state: SafetyScreenState = "uncertain";
    if (signals.length) state = "positive";
    else if (hasClearNegativeAnswer(item.text)) state = "negative";
    else if (!item.text.trim()) state = "unanswered";
    return { ...item, state, signals };
  });
  const signals = evaluated.flatMap((item) => item.signals ?? []);
  const uniqueSignals = signals.filter((signal, index, all) => all.findIndex((other) => other.signal === signal.signal && other.urgency === signal.urgency) === index);
  const hasPositive = evaluated.some((item) => item.state === "positive");
  const hasUncertain = evaluated.some((item) => item.state === "uncertain" || item.state === "unanswered");
  const hasNegative = evaluated.some((item) => item.state === "negative");
  const state: SafetyScreenState = hasPositive ? "positive" : hasUncertain ? "uncertain" : hasNegative ? "negative" : "unanswered";
  return {
    state,
    evidence: evaluated,
    signals: uniqueSignals,
    explicit: evaluated.length > 0,
    complete: state === "positive" || state === "negative",
    unresolved: state === "unanswered" || state === "uncertain",
  };
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

// ─────────────────────────────────────────────────────────────────────────────
// Chest-safety routing and source-aware evidence. This layer is deliberately
// additive: matchPathway() remains the legacy curated matcher, while the
// resolver can attach the existing chest pathway as a safety profile when
// natural language does not contain one of its contiguous synonyms.
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceSource = "complaint" | "patient_answer" | "structured_safety_answer" | "clinician_input";
export type SafetyScreenState = "unanswered" | "negative" | "positive" | "uncertain";
export type ChestConfidence = "high" | "possible";

export type ChestSafetyAssessment = {
  relevant: boolean;
  confidence: ChestConfidence | null;
  evidence: string[];
  profileId: "chest_pain" | null;
};

export type ClinicalContext = {
  pathway: ClinicalPathway | null;
  chestSafety: ChestSafetyAssessment;
  route: "curated_pathway" | "chest_safety_fallback" | "generic_fallback";
};

/** A source-attributed answer. Complaint context is never sufficient to
 * complete red_flag_screen; targeted answer metadata is required. */
export type SafetyEvidence = {
  source: EvidenceSource;
  text: string;
  questionDimension?: "red_flag_screen";
  state?: SafetyScreenState;
  signals?: DetectedRedFlag[];
};

export type SafetyEvaluation = {
  state: SafetyScreenState;
  evidence: SafetyEvidence[];
  signals: DetectedRedFlag[];
  explicit: boolean;
  complete: boolean;
  unresolved: boolean;
};

const CHEST_LOCATION_ANCHORS = [
  "chest", "seene", "seenein", "sine", "chhati", "chati", "heart", "dil", "सीने", "छाती", "हृदय",
  "left side", "left-sided", "baaye taraf", "baayi taraf", "baye taraf", "baen taraf", "baaye side", "baen side",
];
const CHEST_QUALITY_ANCHORS = [
  "pain", "dard", "pressure", "dabav", "dabao", "heaviness", "heavy", "bojh", "bojhal", "bhaari", "bhari", "bharipan", "bhaaripan", "bhaarpan",
  "burning", "jalan", "tightness", "tight", "jakdan", "jakanan", "chubhan", "ache", "aching", "discomfort",
  "takleef", "uneasiness", "bechaini", "दर्द", "दबाव", "जलन", "भारीपन", "भारी", "बोझ",
];
const CHEST_ACUITY_ANCHORS = ["sudden", "achanak", "abhi", "right now", "shuru hua", "started", "अचानक"];

function tokensFor(text: string): string[] {
  return normalize(text).trim().split(/\s+/).filter(Boolean);
}

function phraseTokens(phrase: string): string[] {
  return tokensFor(phrase);
}

function anchorPositions(tokens: string[], anchors: string[]): { anchor: string; index: number }[] {
  const hits: { anchor: string; index: number }[] = [];
  for (const anchor of anchors) {
    const wanted = phraseTokens(anchor);
    if (!wanted.length) continue;
    for (let i = 0; i <= tokens.length - wanted.length; i += 1) {
      if (wanted.every((part, offset) => tokens[i + offset] === part)) hits.push({ anchor, index: i });
    }
  }
  return hits;
}

/** Recognize a bounded location/quality combination, not a standalone keyword. */
export function assessChestSafety(complaint: string, extra = ""): ChestSafetyAssessment {
  const text = `${complaint || ""} ${extra || ""}`.trim();
  if (text.length < 2) return { relevant: false, confidence: null, evidence: [], profileId: null };
  const tokens = tokensFor(text);
  const locations = anchorPositions(tokens, CHEST_LOCATION_ANCHORS);
  const qualities = anchorPositions(tokens, CHEST_QUALITY_ANCHORS);
  const acuity = anchorPositions(tokens, CHEST_ACUITY_ANCHORS);
  const pairs = locations.flatMap((location) => qualities
    .map((quality) => ({ location, quality, distance: Math.abs(location.index - quality.index) }))
    .filter((pair) => pair.distance <= 8));
  if (!pairs.length) return { relevant: false, confidence: null, evidence: [], profileId: null };
  const best = pairs.sort((a, b) => a.distance - b.distance)[0];
  const evidence = Array.from(new Set([
    best.location.anchor,
    best.quality.anchor,
    ...acuity.filter((item) => Math.abs(item.index - best.location.index) <= 8).map((item) => item.anchor),
  ]));
  const directLocation = !/^(left side|left-sided|baaye taraf|baayi taraf|baye taraf|baen taraf|baaye side|baen side)$/.test(best.location.anchor);
  return {
    relevant: true,
    confidence: directLocation && best.distance <= 5 ? "high" : "possible",
    evidence,
    profileId: "chest_pain",
  };
}

/** Return the reviewed chest pathway used as the additive safety profile. */
export function chestSafetyPathway(): ClinicalPathway {
  return PATHWAYS.find((pathway) => pathway.id === "chest_pain") as ClinicalPathway;
}

/** Resolve a context once and reuse it throughout the intake. */
export function resolveClinicalContext(complaint: string, extra = ""): ClinicalContext {
  const pathway = matchPathway(complaint, extra);
  const chestSafety = assessChestSafety(complaint, extra);
  if (pathway?.id === "chest_pain") {
    return { pathway, chestSafety: chestSafety.relevant ? chestSafety : { relevant: true, confidence: "high", evidence: ["chest_pain pathway"], profileId: "chest_pain" }, route: "curated_pathway" };
  }
  if (chestSafety.relevant) {
    return { pathway, chestSafety, route: pathway ? "curated_pathway" : "chest_safety_fallback" };
  }
  return { pathway, chestSafety, route: pathway ? "curated_pathway" : "generic_fallback" };
}

/** Resolve the pathway used for questions/red-flag definitions. A null ordinary
 * match can still use the existing chest pathway without changing its route. */
export function pathwayForClinicalContext(context: ClinicalContext): ClinicalPathway | null {
  return context.pathway ?? (context.chestSafety.relevant ? chestSafetyPathway() : null);
}

// ─────────────────────────────────────────────────────────────────────────────
// History-COVERAGE model (spec §11 blueprint, §26 completeness) — pure &
// browser-safe. This is a COMPLETENESS/COVERAGE model, NOT a fixed
// questionnaire and NOT a fixed question count. It answers one question:
// "Given everything the patient has said so far, which clinically-relevant
// history DIMENSIONS have plausibly been addressed, and which are still
// MISSING?" The adaptive interview uses this to decide when it is safe to
// finalize (all required dimensions covered) versus keep asking — while the AI
// still chooses/phrases the actual next question dynamically.
//
// Detection is transparent and explainable (bilingual keyword/phrase presence
// in the patient's OWN words, same style as detectRedFlags). Keywords are used
// ONLY to detect whether a dimension has plausibly been touched — never to
// fabricate clinical meaning or to diagnose.
// ─────────────────────────────────────────────────────────────────────────────

/** The clinically-relevant history dimensions a clinician gathers (spec §11). */
export type HistoryDimension =
  | "onset_duration"      // when it started / how long
  | "severity_character"  // how bad / what it feels like
  | "associated_symptoms" // other symptoms accompanying the complaint
  | "prior_care"          // already seen a doctor / took medicine / prior tests
  | "relevant_history"    // relevant past/medical/exposure history
  | "red_flag_screen";    // danger-sign screen for this complaint

/** Human-readable label for a dimension (for logs / doctor-facing summaries). */
export function dimensionLabel(d: HistoryDimension): string {
  switch (d) {
    case "onset_duration": return "Onset / duration";
    case "severity_character": return "Severity / character";
    case "associated_symptoms": return "Associated symptoms";
    case "prior_care": return "Prior care / treatment";
    case "relevant_history": return "Relevant history";
    case "red_flag_screen": return "Danger-sign (red-flag) screen";
  }
}

// Bilingual (English + Hindi/Hinglish-Roman) cue words/phrases that indicate a
// patient's text has plausibly ADDRESSED a given dimension. Kept transparent
// and additive; matched as simple substring presence like detectRedFlags.
const DIMENSION_CUES: Record<HistoryDimension, string[]> = {
  onset_duration: [
    // time spans / onset — numbers with day/week/month markers + words
    "din", "dino", "hafte", "hafta", "hafte", "mahine", "mahina", "saal",
    "day", "days", "week", "weeks", "month", "months", "year", "years",
    "hour", "hours", "ghante", "ghanta", "since", "se ho", "se hai", "kab se",
    "kal se", "aaj se", "subah se", "raat se", "achanak", "sudden", "gradually",
    "dheere", "shuru hua", "started", "onset", "ago", "pehle se",
    "yesterday", "kal", "recently", "haal hi", "purana", "chronic",
  ],
  severity_character: [
    // severity
    "bahut", "tez", "severe", "mild", "halka", "thoda", "unbearable",
    "bardaasht", "0 se 10", "out of 10", "/10", "scale", "intense", "worst",
    "kam", "zyada",
    // character / quality
    "jalan", "burning", "marod", "cramp", "cramping", "dabav", "pressure",
    "jakdan", "tightness", "chubhan", "sharp", "dull", "throbbing", "dhak dhak",
    "stabbing", "aching", "kaisa", "kaise", "type of pain", "character",
    "paani jaisa", "watery", "dry", "sukhi", "sookhi",
  ],
  associated_symptoms: [
    // common accompanying symptoms (bilingual)
    "bukhar", "fever", "ulti", "vomit", "vomiting", "nausea", "jee michlana",
    "motion", "motions", "loose", "dast", "diarrhea", "khaansi", "khansi",
    "cough", "saans", "breathless", "sar dard", "headache", "chakkar", "dizzy",
    "kamzori", "weakness", "paseena", "sweating", "peshaab", "urine", "khoon",
    "blood", "rash", "chakatte", "soojan", "swelling", "dard bhi", "ke saath",
    "along with", "also have", "bhi ho", "chills", "thandi",
  ],
  prior_care: [
    "doctor", "dikhaya", "dikhaya", "seen", "consult", "hospital", "clinic",
    "dawa", "dawai", "medicine", "tablet", "goli", "syrup", "antibiotic",
    "self medicine", "khud dawa", "test", "report", "reports", "jaanch",
    "parchi", "prescription", "ilaaj", "treatment", "pehle liya", "already took",
    "no reports", "koi report nahi", "nahi dikhaya", "not seen", "no doctor",
    "no medicine", "koi dawa nahi",
  ],
  relevant_history: [
    "pehle se", "known", "history", "purani bimari", "bp", "blood pressure",
    "diabetes", "sugar", "shugar", "heart", "dil", "thyroid", "surgery",
    "operation", "allergy", "allergic", "smoking", "beedi", "cigarette",
    "tambakoo", "sharaab", "alcohol", "pregnan", "garbh", "family history",
    "ghar mein", "travel", "safar", "exposure", "sampark", "chronic",
    "recurrent", "baar baar hota",
  ],
  red_flag_screen: [
    // These cues identify a TARGETED safety question when examining a
    // deterministic question. They are intentionally not used to mark the
    // initial complaint as screened; coverageFor() consults SafetyEvidence.
    "danger sign", "red flag", "breathlessness", "breathless", "saans phool", "cannot breathe",
    "can't breathe", "radiat", "haath tak", "arm", "jaw", "jabda", "back", "peeth",
    "paseena", "sweating", "faint", "behosh", "unconscious", "convulsion", "daura", "jhatke",
    "gardan akdan", "neck stiff", "no urine", "peshaab nahi", "weight loss", "wazan kam",
    "night sweat", "raat paseena", "control nahi", "danger", "emergency", "no other symptom",
    "koi aur lakshan nahi", "aisa kuch nahi", "no red flag", "no warning",
  ],
};

/** The required dimensions for the GENERIC floor (no pathway matched). Minimal
 *  but non-empty so the flow can never finalize after only identity/date/
 *  complaint/duration + yes-no answers (spec §26 completeness). */
const GENERIC_REQUIRED_DIMENSIONS: HistoryDimension[] = [
  "onset_duration",
  "severity_character",
  "associated_symptoms",
  "prior_care",
];

/**
 * Derive the required history dimensions for a matched pathway from ITS OWN
 * data — this is what makes coverage ADAPTIVE (different complaints require
 * different dimensions), not one fixed questionnaire. Every pathway needs the
 * core four; pathways whose curated questions probe past/medical history add
 * `relevant_history`, and any pathway that carries red flags adds a
 * `red_flag_screen` requirement.
 */
export function requiredDimensions(subject: ClinicalPathway | ClinicalContext | null): HistoryDimension[] {
  const context = contextFromSubject(subject);
  const pathway = context.pathway ?? (context.chestSafety.relevant ? chestSafetyPathway() : null);
  if (!pathway) return [...GENERIC_REQUIRED_DIMENSIONS];
  const dims: HistoryDimension[] = [
    "onset_duration",
    "severity_character",
    "associated_symptoms",
    "prior_care",
  ];
  // Does the pathway explicitly probe relevant history? (heuristic over its own
  // curated questions — transparent and data-driven).
  const qText = pathway.coreQuestions
    .map((q) => `${q.english} ${q.hinglish}`.toLowerCase())
    .join(" ");
  const probesHistory = [
    "known", "pehle se", "history", "previous", "diabetes", "bp", "smok",
    "tambakoo", "beedi", "travel", "safar", "contact", "sampark", "family",
    "allerg", "surgery", "operation", "recurrent", "baar-baar", "baar baar",
    "pregnan",
  ].some((w) => qText.includes(w));
  if (probesHistory || context.chestSafety.relevant) dims.push("relevant_history");
  // A chest profile attached to an otherwise unrelated curated pathway still
  // receives the chest safety dimensions, while a normal generic fallback does
  // not acquire them.
  if (pathway.redFlags.length > 0 || context.chestSafety.relevant) dims.push("red_flag_screen");
  return dims;
}

/** Per-dimension coverage result: satisfied dimensions + source-aware safety
 * state. Complaint context can satisfy ordinary history dimensions, but never
 * red_flag_screen without explicit attributable evidence. */
export type CoverageResult = {
  required: HistoryDimension[];
  satisfied: HistoryDimension[];
  missing: HistoryDimension[];
  /** true when no required dimension is missing → interview may finalize. */
  complete: boolean;
  /** which cue or explicit state satisfied each dimension. */
  evidence: Partial<Record<HistoryDimension, string>>;
  safetyState: SafetyScreenState;
  safetyEvaluation: SafetyEvaluation;
};

/** Does the patient text plausibly address an ordinary dimension? For
 * red_flag_screen this helper is used only to classify targeted question
 * wording; coverageFor() uses SafetyEvaluation for patient evidence. */
function dimensionHit(
  d: HistoryDimension,
  normalizedText: string,
  pathway: ClinicalPathway | null,
): string | null {
  for (const cue of DIMENSION_CUES[d]) {
    if (normalizedText.includes(cue.toLowerCase())) return cue;
  }
  if (d === "red_flag_screen" && pathway) {
    for (const f of pathway.redFlags) {
      for (const m of f.match) {
        if (normalizedText.includes(m.toLowerCase())) return m;
      }
    }
  }
  // onset_duration: also satisfied by a bare "<number> <time-unit>" pattern that
  // the cue list might miss (e.g. "2 hafta", "5 din").
  if (d === "onset_duration") {
    if (/\b\d{1,3}\s*(din|dino|hafte|hafta|mahine|mahina|saal|day|days|week|weeks|month|months|year|years|hour|hours|ghante|ghanta)\b/.test(normalizedText)) {
      return "duration-number-pattern";
    }
  }
  // severity_character: also satisfied by a "<n>/10"-style rating.
  if (d === "severity_character") {
    if (/\b(\d{1,2})\s*(\/|out of)\s*10\b/.test(normalizedText)) return "severity-rating";
  }
  return null;
}

/**
 * COVERAGE MODEL — the core completeness gate (spec §26).
 *
 * Given the matched pathway (or null for the generic floor) and ALL text the
 * patient has provided so far (initial complaint + duration + seen-doctor/
 * self-medicine + every deep Q/A answer), returns which required dimensions are
 * ALREADY SATISFIED versus STILL MISSING, plus `complete` (no dimension
 * missing).
 *
 * IMPORTANT: dimensions already covered by the INITIAL complaint/duration are
 * treated as satisfied (e.g. "5 din se fever" satisfies onset_duration), so the
 * flow never blindly re-asks satisfied dimensions.
 *
 * This is pure, deterministic and unit-testable. It does NOT impose an order or
 * a fixed count — callers combine `missing` with their own MAX ceiling.
 *
 * @param pathway matched ClinicalPathway or null (generic floor)
 * @param patientTexts every patient-provided string so far (complaint,
 *        duration, prior-care answers, each deep answer, etc.)
 */
export type CoverageInput =
  | (string | undefined | null)[]
  | SafetyEvidence[]
  | { patientTexts?: (string | undefined | null)[]; safetyEvidence?: SafetyEvidence[]; evidence?: SafetyEvidence[] };

function isSafetyEvidenceArray(input: CoverageInput): input is SafetyEvidence[] {
  return Array.isArray(input) && input.every((item) => typeof item === "object" && item !== null && "source" in item);
}

/**
 * COVERAGE MODEL — the core completeness gate (spec §26). It accepts the old
 * string-array form for compatibility and a source-aware form for the fixed
 * safety boundary. The latter is required for red_flag_screen completion.
 */
export function coverageFor(
  subject: ClinicalPathway | ClinicalContext | null,
  input: CoverageInput,
  explicitSafetyEvidence: SafetyEvidence[] = [],
): CoverageResult {
  const context = contextFromSubject(subject);
  const evidenceArray = isSafetyEvidenceArray(input);
  const patientTexts = evidenceArray ? input.map((item) => item.text) : Array.isArray(input) ? input : (input.patientTexts ?? []);
  const suppliedSafety = evidenceArray
    ? [...input, ...explicitSafetyEvidence]
    : Array.isArray(input)
      ? explicitSafetyEvidence
      : [...(input.safetyEvidence ?? input.evidence ?? []), ...explicitSafetyEvidence];
  const safetyEvaluation = evaluateSafetyEvidence(context, suppliedSafety);
  const normalizedText = normalize([
    ...patientTexts.filter(Boolean),
    ...suppliedSafety.filter(isEligibleSafetyEvidence).map((item) => item.text),
  ].join(" . "));
  const required = requiredDimensions(context);
  const effectivePathway = pathwayForClinicalContext(context);
  const satisfied: HistoryDimension[] = [];
  const missing: HistoryDimension[] = [];
  const evidence: Partial<Record<HistoryDimension, string>> = {};
  for (const dimension of required) {
    if (dimension === "red_flag_screen") {
      if (safetyEvaluation.complete) {
        satisfied.push(dimension);
        evidence[dimension] = safetyEvaluation.state;
      } else {
        missing.push(dimension);
      }
      continue;
    }
    const hit = dimensionHit(dimension, normalizedText, effectivePathway);
    if (hit) { satisfied.push(dimension); evidence[dimension] = hit; }
    else missing.push(dimension);
  }
  return {
    required,
    satisfied,
    missing,
    complete: missing.length === 0,
    evidence,
    safetyState: safetyEvaluation.state,
    safetyEvaluation,
  };
}

/**
 * Pick a deterministic question that targets an uncovered dimension. Used when
 * the AI is unavailable OR the AI tries to STOP while a required dimension is
 * still missing. Prefers the matched pathway's curated coreQuestions relevant
 * to `dimension`; otherwise returns a generic bilingual dimension question.
 * `skip` lets the caller exclude topics already asked (dedupe/coverage), and
 * this returns null when it can find nothing new for the dimension.
 *
 * @returns a bilingual question object, or null if nothing suitable/new.
 */
export function questionForDimension(
  subject: ClinicalPathway | ClinicalContext | null,
  dimension: HistoryDimension,
  skip?: (text: string) => boolean,
): { hinglish: string; english: string } | null {
  const skipFn = skip ?? (() => false);
  const context = contextFromSubject(subject);
  const chest = context.chestSafety.relevant ? chestSafetyPathway() : null;
  const candidates = dimension === "red_flag_screen" && chest
    ? [chest, context.pathway].filter((pathway, index, all): pathway is ClinicalPathway => Boolean(pathway) && all.findIndex((other) => other?.id === pathway?.id) === index)
    : [context.pathway, chest].filter((pathway, index, all): pathway is ClinicalPathway => Boolean(pathway) && all.findIndex((other) => other?.id === pathway?.id) === index);
  for (const pathway of candidates) {
    // Match the pathway's own curated questions to the target dimension using
    // the same cue vocabulary, so phrasing stays complaint-specific and safe.
    for (const q of pathway.coreQuestions) {
      const probe = normalize(`${q.english} ${q.hinglish}`);
      const hit = dimensionHit(dimension, probe, pathway);
      if (hit && !skipFn(q.english) && !skipFn(q.hinglish)) return q;
    }
  }
  const generic = GENERIC_DIMENSION_QUESTIONS[dimension];
  if (generic && !skipFn(generic.english) && !skipFn(generic.hinglish)) return generic;
  return null;
}

// Generic bilingual questions per dimension — the safe deterministic fallback
// when no pathway matched (or the pathway had nothing new for the dimension).
const GENERIC_DIMENSION_QUESTIONS: Record<HistoryDimension, { hinglish: string; english: string }> = {
  onset_duration: { hinglish: "Yeh takleef aapko theek se kab se hai — kitne din/hafte se?", english: "Exactly how long have you had this — how many days or weeks?" },
  severity_character: { hinglish: "Takleef kitni tez hai (0 se 10 mein) aur kaisi mehsoos hoti hai?", english: "How severe is it (0–10) and what does it feel like?" },
  associated_symptoms: { hinglish: "Iske saath aur koi lakshan hai — bukhar, ulti, kamzori, ya kuch aur?", english: "Any other symptoms with it — fever, vomiting, weakness, or anything else?" },
  prior_care: { hinglish: "Iske liye pehle koi dawa li ya kisi doctor ko dikhaya hai?", english: "Have you taken any medicine or seen a doctor for this already?" },
  relevant_history: { hinglish: "Koi purani bimari (BP, sugar, dil, etc.) ya zaroori medical history hai?", english: "Any existing conditions (BP, sugar, heart, etc.) or relevant medical history?" },
  red_flag_screen: { hinglish: "Koi khatre ka lakshan to nahi — bahut tez dard, saans phoolna, behoshi, ya khoon?", english: "Any danger signs — very severe pain, breathlessness, fainting, or bleeding?" },
};
