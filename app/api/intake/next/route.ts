// Hybrid intake engine. The decision tree (server-side) guarantees the ORDER and
// coverage of questions; the AI only phrases each fixed question and, at the end,
// summarizes into a pre-visit brief. Deterministic flow + natural wording.
import { error, generateId, insert, json, nowIso, query, queryOne, readObject, requiredString, safeRoute, update } from "../../_lib/demo";
import { aiComplete, aiConfigured, AiNotConfiguredError, MODELS } from "../../_lib/ai";
import {
  INTAKE_FIRST_STEP,
  INTAKE_STEPS,
  buildIntakePhraseMessages,
  buildIntakeSummaryMessages,
  isEmergencyReply,
  type IntakeLanguage,
} from "../../_lib/prompts";

export const dynamic = "force-dynamic";

function langOf(v: unknown): IntakeLanguage {
  return v === "english" ? "english" : "hinglish";
}

// Phrase a step's question via AI; fall back to a plain phrasing if AI is off/down.
async function phrase(stepId: string, lastAnswer: string | null, language: IntakeLanguage) {
  const step = INTAKE_STEPS[stepId];
  const fallback = fallbackPhrase(stepId, language);
  if (!aiConfigured()) return { text: fallback, emergency: false, emergencyMessage: "" };
  try {
    const raw = await aiComplete(buildIntakePhraseMessages(step, lastAnswer, language), {
      model: MODELS.intake,
      temperature: 0.4,
      maxTokens: 120,
    });
    const { emergency, message } = isEmergencyReply(raw);
    if (emergency) return { text: message, emergency: true, emergencyMessage: message };
    return { text: message || fallback, emergency: false, emergencyMessage: "" };
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return { text: fallback, emergency: false, emergencyMessage: "" };
    // Any upstream hiccup: still keep the flow moving with the plain question.
    return { text: fallback, emergency: false, emergencyMessage: "" };
  }
}

// Deterministic plain-language phrasing used when AI is unavailable.
function fallbackPhrase(stepId: string, language: IntakeLanguage): string {
  const en: Record<string, string> = {
    identity: "Is this your first visit here, or have you visited before?",
    new_complaint: "What is the main problem troubling you today?",
    new_duration: "Since when have you had this problem?",
    new_seen_doctor: "Have you already seen another doctor for this before coming here?",
    new_prev_helped: "Did that treatment help? Please bring the old prescription or report to the reception.",
    new_self_medicine: "Did you take any medicine on your own for this?",
    ret_reason: "Are you here for the same earlier problem, or a new problem?",
    ret_progress: "Since your last visit, do you feel better, same, or worse?",
    ret_adherence: "Did you take all the prescribed medicines on time?",
    ret_sideeffects: "Did you notice any new problem after the medicine (e.g. vomiting, dizziness)?",
    ret_reports: "Do you have any pending lab report? Please bring it to the reception.",
    chronic: "Do you have any long-term illness on regular medicine (BP, sugar, thyroid, asthma)?",
  };
  const hi: Record<string, string> = {
    identity: "Aap yahan pehli baar aa rahe hain, ya pehle bhi aa chuke hain?",
    new_complaint: "Aapko mukhya roop se kya takleef hai?",
    new_duration: "Yeh takleef aapko kab se hai?",
    new_seen_doctor: "Yahan aane se pehle aapne is takleef ke liye kisi aur doctor ko dikhaya tha?",
    new_prev_helped: "Us ilaaj se aaram mila? Kripya purani parchi/report reception par de dein.",
    new_self_medicine: "Kya aapne apne man se koi dawai li thi is takleef ke liye?",
    ret_reason: "Aap purani takleef ke follow-up ke liye aaye hain, ya koi nayi takleef hai?",
    ret_progress: "Pichli baar ke baad ab kaisa lag raha hai — behtar, waisa hi, ya zyada?",
    ret_adherence: "Kya aapne saari dawaiyan samay par li, ya koi chhut gayi?",
    ret_sideeffects: "Dawai ke baad koi nayi pareshani hui (jaise ulti, chakkar)?",
    ret_reports: "Koi test/report pending hai? Kripya reception par le aayein.",
    chronic: "Kya aapko koi lambi bimari hai jiski dawai chalti hai (BP, sugar, thyroid, asthma)?",
  };
  return (language === "english" ? en : hi)[stepId] ?? "Please tell me a little more.";
}

// ── Start a session and return the first (phrased) question ──
export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body");
  const action = requiredString(body.action, "action") ?? "start";
  const language = langOf(body.language);

  if (action === "start") {
    const patientId = typeof body.patientId === "string" ? body.patientId : null;
    const sessionId = generateId("intake");
    await insert("intake_sessions", {
      id: sessionId,
      patientId: patientId ?? "unknown",
      appointmentId: null,
      visitType: "new_complaint",
      channel: "web",
      status: "in_progress",
      currentStep: 0,
      totalSteps: 0,
      completedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const first = await phrase(INTAKE_FIRST_STEP, null, language);
    return json({
      sessionId,
      stepId: INTAKE_FIRST_STEP,
      question: first.text,
      options: INTAKE_STEPS[INTAKE_FIRST_STEP].options ?? [],
      emergency: first.emergency,
      done: false,
    });
  }

  // ── Answer the current step, advance the tree, return the next question ──
  if (action === "answer") {
    const sessionId = requiredString(body.sessionId, "sessionId", 120);
    const stepId = requiredString(body.stepId, "stepId", 60);
    const answer = requiredString(body.answer, "answer", 2000);
    if (!sessionId || !stepId || !answer) return error("sessionId, stepId and answer are required");

    const step = INTAKE_STEPS[stepId];
    if (!step) return error("Unknown step");

    // Store the Q/A turn (question intent + answer) for the transcript/brief.
    await insert("intake_responses", {
      id: generateId("ir"),
      intakeSessionId: sessionId,
      questionKey: stepId,
      questionText: step.intent,
      responseValue: answer,
      responseType: "chat",
      createdAt: nowIso(),
    });

    const nextId = step.next(answer.toLowerCase());

    if (nextId === "complete") {
      await finishSession(sessionId);
      return json({ sessionId, done: true, closing: closingMessage(language) });
    }

    const next = await phrase(nextId, answer, language);
    // If the patient's last answer triggered an emergency, surface it but keep the flow.
    return json({
      sessionId,
      stepId: nextId,
      question: next.text,
      options: INTAKE_STEPS[nextId].options ?? [],
      emergency: next.emergency,
      done: false,
    });
  }

  return error("Unknown action. Use: start, answer");
});

function closingMessage(language: IntakeLanguage): string {
  return language === "english"
    ? "Thank you. Your history has been sent to the doctor's screen so your treatment can start quickly. Please keep any old prescriptions or reports ready at the reception."
    : "Dhanyawad. Aapki jaankari doctor ki screen par bhej di gayi hai taaki ilaaj turant shuru ho sake. Kripya purani parchi/reports reception par taiyaar rakhein.";
}

// Build the pre-visit brief from the transcript and mark the session complete.
async function finishSession(sessionId: string) {
  const rows = await query<{ questionText: string; responseValue: string }>(
    "SELECT question_text, response_value FROM intake_responses WHERE intake_session_id = ? ORDER BY created_at ASC",
    [sessionId]
  );
  const qa = rows.map((r) => ({ question: r.questionText, answer: r.responseValue }));

  if (aiConfigured() && qa.length) {
    try {
      const brief = await aiComplete(buildIntakeSummaryMessages(qa), { model: MODELS.intake, temperature: 0.2, maxTokens: 500 });
      await insert("intake_responses", {
        id: generateId("ir"),
        intakeSessionId: sessionId,
        questionKey: "pre_visit_brief",
        questionText: "",
        responseValue: brief,
        responseType: "brief",
        createdAt: nowIso(),
      });
    } catch {
      /* brief is best-effort */
    }
  }

  const session = await queryOne<Record<string, unknown>>("SELECT * FROM intake_sessions WHERE id = ?", [sessionId]);
  if (session) {
    await update("intake_sessions", sessionId, { status: "completed", completedAt: nowIso(), updatedAt: nowIso() });
  }
}
