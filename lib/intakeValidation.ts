/**
 * Intake input validation and gibberish / nonsensical text detection.
 * Designed for clinical intake in Hindi, Hinglish, and English.
 * Prevents garbage strings (e.g. "nnlknkn", "kjlnln", "nlknlnlkn") from being
 * accepted as valid complaints, durations, or clinical answers.
 */

export type IntakeValidationResult = {
  valid: boolean;
  message?: string;
  reason?: string;
};

// Known medical abbreviations that lack standard vowel patterns
const VALID_ACRONYMS = new Set([
  "bp", "tb", "ct", "mri", "ecg", "eeg", "usg", "cbc", "esr", "lft", "kft",
  "tsh", "ent", "icu", "opd", "dr", "mr", "mrs", "ms", "hiv", "pr", "rr",
  "spo2", "rx", "ot", "iv", "tmt", "pft", "hba1c", "fbs", "ppbs", "dlc", "tlc",
]);

// Common clinical / symptom terms in English, Hindi transliteration (Hinglish)
const CLINICAL_SYMPTOM_WORDS = new Set([
  // English
  "pain", "ache", "headache", "fever", "cough", "cold", "vomit", "vomiting", "nausea",
  "diarrhea", "motion", "motions", "constipation", "cramps", "swelling", "rash",
  "itching", "itch", "allergy", "infection", "injury", "wound", "fracture", "cut",
  "bleeding", "blood", "weakness", "fatigue", "dizziness", "giddiness", "vertigo",
  "faint", "unconscious", "breathless", "breathing", "asthma", "chest", "stomach",
  "abdomen", "back", "neck", "throat", "knee", "joint", "joints", "muscle", "bone",
  "eye", "eyes", "ear", "ears", "nose", "throat", "tongue", "tooth", "teeth", "gum",
  "skin", "hair", "urine", "urinary", "burning", "discharge", "period", "periods",
  "menstrual", "menstruation", "pregnancy", "pregnant", "sugar", "pressure", "heart",
  "palpitation", "chills", "shivering", "gas", "acidity", "indigestion", "piles",
  "stone", "calculus", "jaundice", "typhoid", "malaria", "dengue", "flu", "paralysis",
  "stroke", "seizure", "fits", "numbness", "tingling", "burn", "blister", "ulcer",
  // Hinglish / Hindi
  "dard", "sar", "sir", "bukhar", "khansi", "zukham", "jukham", "nazla", "ulti",
  "dast", "pet", "chhati", "seene", "seena", "gala", "kamar", "peeth", "gardan",
  "ghutna", "ghutne", "jod", "jodon", "hath", "haath", "pair", "ungli", "aankh",
  "aankhon", "kaan", "naak", "dant", "daant", "masuda", "muh", "munh", "jeebh",
  "chamdi", "twacha", "baal", "peshab", "mutra", "jalan", "sujan", "soojan", "khujli",
  "chakkar", "kamzori", "kamjori", "thakan", "thawat", "saans", "dum", "dam",
  "khoon", "chot", "ghav", "zakhm", "haddi", "toot", "behoshi", "behosh", "safed",
  "pani", "mahawari", "mahavari", "masik", "garbh", "baccha", "dhadkan", "thand",
  "kapkapi", "kabz", "pathri", "piliya", "bawasir", "lakwa", "mirgi", "daura",
  "sann", "sunn", "chhale", "chhala", "foda", "funsi", "tabiyat", "takleef", "pareshani",
  "bimari", "beemari", "rog", "lakshan", "aspatal", "dawa", "dawakhana", "ilaaj",
]);

// Everyday conversational, temporal, and negation terms in Hinglish / English
const COMMON_CONVERSATIONAL_WORDS = new Set([
  // Hinglish
  "hai", "hain", "ho", "hota", "hoti", "hote", "hua", "hui", "hue", "raha", "rahi", "rahe",
  "tha", "thi", "the", "me", "mein", "par", "se", "ko", "ka", "ki", "ke", "aur", "ya",
  "bhi", "bahut", "zyada", "jyada", "kam", "thoda", "thodi", "halka", "halki", "tez",
  "mujhe", "mera", "meri", "mere", "hum", "humein", "hamara", "hamari", "aap", "aapko",
  "kuch", "koi", "kaha", "kahan", "kaise", "kab", "kyu", "kyun", "kya", "theek", "kharab",
  "lag", "lagta", "lagti", "raat", "subah", "dopahar", "shaam", "din", "hafte", "mahina",
  "mahine", "saal", "kal", "aaj", "parso", "pehle", "baad", "abhi", "hamesha", "kabhi",
  "ghante", "ghanta", "baje", "samay", "waqt", "baar", "baarish",
  // English
  "i", "have", "had", "has", "am", "is", "are", "was", "were", "my", "me", "we", "our",
  "in", "on", "at", "to", "for", "with", "from", "by", "of", "and", "or", "but", "very",
  "much", "little", "mild", "severe", "moderate", "high", "low", "acute", "chronic",
  "since", "ago", "yesterday", "today", "morning", "afternoon", "evening", "night",
  "day", "days", "week", "weeks", "month", "months", "year", "years", "hour", "hours",
  "time", "feeling", "feel", "feels", "problem", "issue", "condition", "bad", "worse",
  // Negation (valid answers for medical history / reports)
  "nahi", "nahin", "na", "mat", "no", "not", "none", "never", "nothing", "nil",
  "available", "available nahi", "nahi hai",
  // Care & Reports
  "doctor", "dr", "parchi", "prescription", "report", "reports", "scan", "test",
  "tests", "medicine", "medicines", "tablet", "tablets", "capsule", "syrup", "dawa",
  "paracetamol", "antibiotic", "antibiotics",
]);

// Keyboard walks (consecutive characters across standard QWERTY rows)
const KEYBOARD_WALKS = [
  // Home row
  "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "jkl;",
  "lkjh", "kjhg", "jhgf", "hgfd", "gfds", "fdsa",
  // Top row
  "qwer", "wert", "erty", "rtyu", "tyui", "yuio", "uiop",
  "poiuy", "oiuy", "iuyt", "uytr", "ytre", "trew", "rewq",
  // Bottom row
  "zxcv", "xcvb", "cvbn", "vbnm",
  "mnbv", "nbvc", "bvcx", "vcxz",
  // 3-char high-confidence keyboard walks
  "lkj", "jkl", "qwe", "zxc", "xcv", "cvb", "vbn", "bnm", "mnb", "nbv", "bvc",
];

/**
 * Check if a token contains 3+ consecutive characters from a keyboard row walk.
 */
function hasKeyboardWalk(token: string): boolean {
  const lower = token.toLowerCase();
  for (const walk of KEYBOARD_WALKS) {
    if (lower.includes(walk)) return true;
  }
  return false;
}

/**
 * Check whether a Latin string looks like an unpronounceable consonant mash,
 * keyboard smash, or nonsense word.
 */
function isNonsenseToken(rawToken: string): { isNonsense: boolean; reason?: string } {
  // Strip non-alphabetic
  const token = rawToken.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (token.length < 2) return { isNonsense: false };

  // Allow known acronyms (bp, tb, mri, etc.)
  if (VALID_ACRONYMS.has(token)) return { isNonsense: false };

  // Allow known vocabulary words
  if (CLINICAL_SYMPTOM_WORDS.has(token) || COMMON_CONVERSATIONAL_WORDS.has(token)) {
    return { isNonsense: false };
  }

  // Check character repetition: 4+ identical characters in a row (e.g. "aaaa", "xxxx")
  if (/(.)\1{3,}/.test(token)) {
    return { isNonsense: true, reason: "Excessive character repetition" };
  }

  // Check repeating short n-gram (e.g. "ababab", "lkjlkj")
  if (/^(.{2,3})\1{2,}$/.test(token)) {
    return { isNonsense: true, reason: "Repeating pattern sequence" };
  }

  // Vowel analysis: any word >= 2 letters with zero vowels/y is unpronounceable gibberish
  const vowelCount = (token.match(/[aeiouy]/g) || []).length;
  if (vowelCount === 0) {
    return { isNonsense: true, reason: "No vowels in word" };
  }

  // Check keyboard walks (e.g. "asdfgh", "lkjon", "zxcvb")
  if (hasKeyboardWalk(token)) {
    return { isNonsense: true, reason: "Keyboard mash pattern" };
  }

  // Impossible word-initial consonant cluster in Hindi/English (e.g. "lkjon", "nlkn", "kjnl")
  if (/^(lk|nl|kj|zk|zx|qx|qk|qj|xq)/.test(token)) {
    return { isNonsense: true, reason: "Impossible word-initial consonant cluster" };
  }

  // Tokens of length >= 4
  if (token.length >= 4) {
    // Unpronounceable consecutive consonant sequence (5+ consecutive consonants)
    // E.g. "nnlknkn" has 7, "kjlnln" has 6, "nlknlnlkn" has 9
    if (/[^aeiouy]{5,}/.test(token)) {
      return { isNonsense: true, reason: "Unpronounceable consonant cluster" };
    }

    // For words of length >= 6, if vowel ratio is extremely low (< 15%) and length >= 6
    if (token.length >= 6 && vowelCount / token.length < 0.15) {
      return { isNonsense: true, reason: "Abnormally low vowel ratio" };
    }

    // Low unique character entropy (e.g. "ababa", "nnnnx")
    const uniqueChars = new Set(token.split("")).size;
    if (token.length >= 6 && uniqueChars <= 2) {
      return { isNonsense: true, reason: "Low character entropy" };
    }
  }

  return { isNonsense: false };
}

/**
 * Primary intelligibility / gibberish check for any patient input string.
 */
export function checkIntelligibility(text: string): { intelligible: boolean; reason?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { intelligible: false, reason: "Empty input" };
  }

  // Devanagari script detection: if the text contains recognizable Devanagari words
  const devanagariChars = trimmed.match(/[\u0900-\u097F]/g);
  if (devanagariChars && devanagariChars.length >= 2) {
    // If it contains repeating characters (e.g. "ककककक")
    if (/(.)\1{4,}/u.test(trimmed)) {
      return { intelligible: false, reason: "Repetitive Devanagari characters" };
    }
    return { intelligible: true };
  }

  // Only punctuation or special symbols (e.g. "...", "????", "!@#$%")
  if (/^[\p{P}\p{S}\s]+$/u.test(trimmed)) {
    return { intelligible: false, reason: "Only punctuation or symbols" };
  }

  // Extract alphabetic tokens
  const words = trimmed.split(/\s+/).filter(Boolean);
  const alphaWords = words.map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase()).filter((w) => w.length > 0);

  // If no alphabetic words exist (e.g. only numbers "12345")
  if (alphaWords.length === 0) {
    // Numbers might be valid for age, but on general text it is not a semantic medical statement
    return { intelligible: false, reason: "No words or recognizable characters" };
  }

  // Fast path: If ANY word is a known medical / symptom term or common conversational word
  const hasRecognizedWord = alphaWords.some((w) =>
    CLINICAL_SYMPTOM_WORDS.has(w) || COMMON_CONVERSATIONAL_WORDS.has(w) || VALID_ACRONYMS.has(w)
  );

  // Check every alpha word for nonsense
  let nonsenseCount = 0;
  let firstNonsenseReason: string | undefined;

  for (const w of alphaWords) {
    const check = isNonsenseToken(w);
    if (check.isNonsense) {
      nonsenseCount++;
      if (!firstNonsenseReason) firstNonsenseReason = check.reason;
    }
  }

  // If ALL words in the input are nonsense (e.g. "nnlknkn", "kjlnln nlknlnlkn", "asdfgh")
  if (nonsenseCount === alphaWords.length) {
    return {
      intelligible: false,
      reason: firstNonsenseReason ?? "Input consists entirely of unpronounceable gibberish",
    };
  }

  // If there are no recognized words at all AND majority of words are nonsense
  if (!hasRecognizedWord && nonsenseCount > 0 && nonsenseCount >= alphaWords.length / 2) {
    return {
      intelligible: false,
      reason: firstNonsenseReason ?? "Input contains mostly nonsensical words",
    };
  }

  // If a single word input of length >= 4 has zero recognized meaning and failed phonotactics
  if (alphaWords.length === 1 && !hasRecognizedWord) {
    const w = alphaWords[0];
    if (w.length >= 4) {
      const check = isNonsenseToken(w);
      if (check.isNonsense) {
        return { intelligible: false, reason: check.reason ?? "Single unpronounceable word" };
      }
    }
  }

  return { intelligible: true };
}

/**
 * Validate patient intake inputs by specific step.
 * Returns valid=true if acceptable, or valid=false with a compassionate Hinglish prompt.
 */
export function validateIntakeInput(
  step: string,
  value: string,
  lastBotQuestion?: string
): IntakeValidationResult {
  const trimmed = value.trim();

  // If empty
  if (!trimmed) {
    return { valid: false, message: "Kripya apna jawab type karein.", reason: "EMPTY" };
  }

  // 1. Existing or New / Sex (Button options)
  if (step === "existing-or-new" || step === "sex") {
    return { valid: true };
  }

  // 2. Phone validation
  if (step === "phone") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length !== 10) {
      return {
        valid: false,
        message: "Kripya 10 digit ka sahi mobile number likhiye.",
        reason: "INVALID_PHONE_LENGTH",
      };
    }
    return { valid: true };
  }

  // 3. Name validation
  if (step === "name") {
    // Must contain letters, no pure digits or punctuation
    const letters = trimmed.replace(/[^a-zA-Z\u0900-\u097F]/g, "");
    if (letters.length < 2) {
      return {
        valid: false,
        message: "Kripya apna sahi poora naam likhiye (jaise: Rahul Kumar ya Anita Sharma).",
        reason: "NAME_TOO_SHORT",
      };
    }
    if (/^\d+$/.test(trimmed)) {
      return {
        valid: false,
        message: "Naam mein number nahi ho sakte. Kripya apna poora naam likhiye.",
        reason: "NAME_NUMERIC",
      };
    }
    const intell = checkIntelligibility(trimmed);
    if (!intell.intelligible) {
      return {
        valid: false,
        message: "Kripya apna sahi naam spashth shabdon mein likhiye.",
        reason: intell.reason,
      };
    }
    return { valid: true };
  }

  // 4. Age validation
  if (step === "age") {
    if (/-\s*\d+/.test(trimmed)) {
      return {
        valid: false,
        message: "Umar negative nahi ho sakti. Kripya sahi umar likhiye (jaise: 25 ya 40).",
        reason: "AGE_NEGATIVE",
      };
    }
    // Check if numeric age can be extracted
    const match = trimmed.match(/\b(\d+(?:\.\d+)?)\b/);
    if (!match) {
      return {
        valid: false,
        message: "Kripya sahi umar saalon mein likhiye (jaise: 25 ya 40).",
        reason: "AGE_NO_NUMBER",
      };
    }
    const num = parseFloat(match[1]);
    if (num <= 0 || num > 120) {
      return {
        valid: false,
        message: "Kripya 1 se 120 ke beech sahi umar likhiye.",
        reason: "AGE_OUT_OF_RANGE",
      };
    }
    return { valid: true };
  }

  // 5. Location validation
  if (step === "location") {
    if (trimmed.length < 2 || /^\d+$/.test(trimmed)) {
      return {
        valid: false,
        message: "Kripya apne sheher ya ilaake ka naam likhiye (jaise: Lucknow, Delhi, Kanpur).",
        reason: "LOCATION_INVALID",
      };
    }
    const intell = checkIntelligibility(trimmed);
    if (!intell.intelligible) {
      return {
        valid: false,
        message: "Kripya apne sheher ka naam spashth likhiye.",
        reason: intell.reason,
      };
    }
    return { valid: true };
  }

  // 6. Preferred Date / Time
  if (step === "preferredDate" || step === "preferredTime") {
    return { valid: true };
  }

  // 7. Chief Complaint validation
  if (step === "chiefComplaint") {
    const intell = checkIntelligibility(trimmed);
    if (!intell.intelligible) {
      return {
        valid: false,
        message:
          "Maaf kijiye, hum aapki takleef samajh nahi paaye. Kripya thoda vistaar se bataiye ki aapko kya pareshani ya lakshan ho rahe hain (jaise: sar dard, bukhar, pet dard)?",
        reason: intell.reason,
      };
    }

    // Check for purely non-medical single words like "hi", "hello", "ok", "test"
    const lower = trimmed.toLowerCase().replace(/[^a-z]/g, "");
    if (["hi", "hello", "hey", "test", "ok", "okay", "yes", "ha", "haan"].includes(lower)) {
      return {
        valid: false,
        message:
          "Namaste! Kripya batayein ki aapko mukhya roop se kya takleef ya bimari ke lakshan hain, taaki doctor ko sahi summary mil sake.",
        reason: "GREETING_ONLY",
      };
    }

    if (trimmed.length < 2) {
      return {
        valid: false,
        message:
          "Kripya thoda vistaar se bataiye ki aapko kya takleef ho rahi hai (jaise: sar dard, bukhar, pet dard).",
        reason: "COMPLAINT_TOO_SHORT",
      };
    }

    return { valid: true };
  }

  // 8. Duration validation
  if (step === "duration") {
    // Check for gibberish
    const intell = checkIntelligibility(trimmed);
    if (!intell.intelligible) {
      return {
        valid: false,
        message:
          "Kripya bataiye ki yeh takleef kitne samay se hai (jaise: 2 din se, 1 hafte se, ya aaj subah se)?",
        reason: intell.reason,
      };
    }
    return { valid: true };
  }

  // 9. Prior Consultation / Prior Reports
  if (step === "priorConsultation" || step === "priorReports") {
    // Negation or "nahi hai" or "no" are valid answers!
    if (/^(nahi|nahin|no|not|none|never|kuch nahi|nahi hai|na)\b/i.test(trimmed)) {
      return { valid: true };
    }
    const intell = checkIntelligibility(trimmed);
    if (!intell.intelligible) {
      const isReport = step === "priorReports";
      return {
        valid: false,
        message: isReport
          ? "Kripya batayein ki kya koi puraani report/scan hai ya nahi (ya 'Nahi hai' likhein)."
          : "Kripya batayein ki kya pehle kisi doctor se salah ya dawa li hai (ya 'Nahi li' likhein).",
        reason: intell.reason,
      };
    }
    return { valid: true };
  }

  // 10. Adaptive QA & Follow-up Clinical Questions
  if (step === "adaptive-qa" || step === "clarification" || step === "reasoning") {
    // If last question was asking for severity (1 to 10 scale)
    const isSeverityQuestion = Boolean(
      lastBotQuestion &&
      /(1 se 10|teevrata|scale|severity|kitni hai)/i.test(lastBotQuestion)
    );

    if (isSeverityQuestion) {
      // Check if a number between 1 and 10 or descriptive word exists
      const hasNumber = /\b([1-9]|10)\b/.test(trimmed);
      const hasSeverityWord = /(mild|moderate|severe|halka|halki|tez|bahut|zyada|jyada|medium)/i.test(trimmed);
      const intell = checkIntelligibility(trimmed);
      if (!intell.intelligible && !hasNumber && !hasSeverityWord) {
        return {
          valid: false,
          message:
            "Kripya dard ya takleef ki teevrata 1 se 10 ke scale par bataiye (jaise: 5 ya 8), ya halka / tez likhein.",
          reason: intell.reason ?? "INVALID_SEVERITY",
        };
      }
      return { valid: true };
    }

    // General follow-up questions
    // Allow valid negative replies (e.g. "nahi", "kuch nahi", "no other symptom")
    if (/^(nahi|nahin|no|none|never|kuch nahi|aur kuch nahi|nahi hai)\b/i.test(trimmed)) {
      return { valid: true };
    }

    const intell = checkIntelligibility(trimmed);
    if (!intell.intelligible) {
      return {
        valid: false,
        message:
          "Kripya apna jawab thoda spasht shabdon mein likhiye taaki doctor ke liye sahi jaankari note ho sake.",
        reason: intell.reason,
      };
    }
    return { valid: true };
  }

  // Default fallback
  const intell = checkIntelligibility(trimmed);
  if (!intell.intelligible) {
    return {
      valid: false,
      message: "Kripya apna jawab thoda spasht shabdon mein likhiye.",
      reason: intell.reason,
    };
  }

  return { valid: true };
}
