import { error, generateId, insert, json, nowIso, query, queryOne, readObject, requiredString, safeRoute, update } from "../_lib/demo";

export const dynamic = "force-dynamic";

// Adaptive intake question engine — questions adapt based on visit type
const INTAKE_QUESTIONS: Record<string, { key: string; text: string; type: string; required: boolean }[]> = {
  new_complaint: [
    { key: "chief_complaint", text: "What is the main reason for your visit today?", type: "text", required: true },
    { key: "duration", text: "How long have you had this problem?", type: "text", required: true },
    { key: "severity", text: "On a scale of 1-10, how severe is your discomfort?", type: "scale", required: true },
    { key: "associated_symptoms", text: "Do you have any other symptoms? (e.g. fever, nausea, pain)", type: "text", required: false },
    { key: "prior_treatment", text: "Have you tried any medication or treatment for this? If yes, what?", type: "text", required: false },
    { key: "allergies", text: "Do you have any known drug allergies?", type: "text", required: true },
    { key: "current_medications", text: "List any medications you are currently taking.", type: "text", required: false },
    { key: "documents", text: "Do you have any recent reports or prescriptions to share?", type: "document_prompt", required: false },
  ],
  follow_up: [
    { key: "how_are_you", text: "How have you been feeling since your last visit?", type: "text", required: true },
    { key: "medication_adherence", text: "Have you been taking your prescribed medications as instructed?", type: "yesno", required: true },
    { key: "side_effects", text: "Have you noticed any side effects from your medications?", type: "text", required: false },
    { key: "new_symptoms", text: "Any new symptoms or concerns since your last visit?", type: "text", required: false },
    { key: "test_results", text: "Did you complete any tests that were recommended? Do you have the results?", type: "text", required: false },
    { key: "documents", text: "Please upload any new reports or test results.", type: "document_prompt", required: false },
  ],
  wellness: [
    { key: "general_health", text: "How would you describe your overall health in the last few months?", type: "text", required: true },
    { key: "exercise", text: "How often do you exercise in a week?", type: "text", required: false },
    { key: "diet", text: "Any significant changes in diet or weight recently?", type: "text", required: false },
    { key: "chronic_conditions", text: "Do you have any known chronic conditions?", type: "text", required: false },
    { key: "family_history", text: "Any new illnesses in your immediate family?", type: "text", required: false },
    { key: "vaccines", text: "Are you up to date on your vaccinations?", type: "yesno", required: false },
    { key: "documents", text: "Please bring or upload any previous reports or health records.", type: "document_prompt", required: false },
  ],
  report_review: [
    { key: "reports_brought", text: "Please upload the reports you would like the doctor to review.", type: "document_prompt", required: true },
    { key: "questions", text: "Do you have specific questions about your results?", type: "text", required: false },
    { key: "symptoms", text: "Are you experiencing any symptoms related to these results?", type: "text", required: false },
  ],
};

function getQuestionsForVisitType(visitType: string) {
  return INTAKE_QUESTIONS[visitType] ?? INTAKE_QUESTIONS.new_complaint;
}

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const patientId = searchParams.get("patientId");

  if (sessionId) {
    const session = await queryOne<Record<string, unknown>>("SELECT * FROM intake_sessions WHERE id = ?", [sessionId]);
    if (!session) return error("Intake session not found", 404);
    const responses = await query<Record<string, unknown>>("SELECT * FROM intake_responses WHERE intake_session_id = ? ORDER BY created_at ASC", [sessionId]);
    const questions = getQuestionsForVisitType(String(session.visitType ?? "new_complaint"));
    const answeredKeys = responses.map((r) => r.questionKey);
    const nextQuestion = questions.find((q) => !answeredKeys.includes(q.key));
    const progress = Math.round((responses.length / questions.length) * 100);
    return json({ session, responses, questions, nextQuestion: nextQuestion ?? null, progress, isComplete: !nextQuestion });
  }

  if (patientId) {
    const sessions = await query<Record<string, unknown>>("SELECT * FROM intake_sessions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5", [patientId]);
    return json({ sessions });
  }

  return error("sessionId or patientId required");
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body");

  const action = requiredString(body.action, "action") ?? "start";

  // ── Start intake session ──
  if (action === "start") {
    const patientId = requiredString(body.patientId, "patientId");
    if (!patientId) return error("patientId is required");
    const visitType = requiredString(body.visitType, "visitType") ?? "new_complaint";
    const questions = getQuestionsForVisitType(visitType);
    const session = {
      id: generateId("intake"),
      patientId,
      appointmentId: typeof body.appointmentId === "string" ? body.appointmentId : null,
      visitType,
      channel: typeof body.channel === "string" ? body.channel : "web",
      status: "in_progress",
      currentStep: 0,
      totalSteps: questions.length,
      completedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await insert("intake_sessions", session);
    return json({ session, firstQuestion: questions[0], totalQuestions: questions.length }, 201);
  }

  // ── Answer a question ──
  if (action === "answer") {
    const sessionId = requiredString(body.sessionId, "sessionId");
    const questionKey = requiredString(body.questionKey, "questionKey");
    const responseValue = requiredString(body.responseValue, "responseValue");
    if (!sessionId || !questionKey || !responseValue) return error("sessionId, questionKey, and responseValue are required");

    const session = await queryOne<Record<string, unknown>>("SELECT * FROM intake_sessions WHERE id = ?", [sessionId]);
    if (!session) return error("Intake session not found", 404);

    const questions = getQuestionsForVisitType(String(session.visitType ?? "new_complaint"));
    const question = questions.find((q) => q.key === questionKey);
    if (!question) return error("Question not found for this intake session");

    // Check if already answered — update if so
    const existing = await queryOne<Record<string, unknown>>(
      "SELECT * FROM intake_responses WHERE intake_session_id = ? AND question_key = ?",
      [sessionId, questionKey]
    );
    if (existing) {
      await query("UPDATE intake_responses SET response_value = ? WHERE id = ?", [responseValue, existing.id]);
    } else {
      await insert("intake_responses", {
        id: generateId("ir"),
        intakeSessionId: sessionId,
        questionKey,
        questionText: question.text,
        responseValue,
        responseType: question.type,
        createdAt: nowIso(),
      });
    }

    // Determine next question
    const responses = await query<Record<string, unknown>>("SELECT * FROM intake_responses WHERE intake_session_id = ?", [sessionId]);
    const answeredKeys = responses.map((r) => r.questionKey);
    const nextQuestion = questions.find((q) => !answeredKeys.includes(q.key));
    const newStep = responses.length;
    const isComplete = !nextQuestion;

    await update("intake_sessions", sessionId, {
      currentStep: newStep,
      status: isComplete ? "completed" : "in_progress",
      completedAt: isComplete ? nowIso() : null,
      updatedAt: nowIso(),
    });

    // If completed, update appointment status
    if (isComplete && session.appointmentId) {
      await update("appointments", String(session.appointmentId), { status: "intake_complete", updatedAt: nowIso() });
    }

    const progress = Math.round((newStep / questions.length) * 100);
    return json({ nextQuestion: nextQuestion ?? null, progress, isComplete, totalAnswered: newStep, totalQuestions: questions.length });
  }

  // ── Skip a question ──
  if (action === "skip") {
    const sessionId = requiredString(body.sessionId, "sessionId");
    const questionKey = requiredString(body.questionKey, "questionKey");
    if (!sessionId || !questionKey) return error("sessionId and questionKey are required");

    await insert("intake_responses", {
      id: generateId("ir"),
      intakeSessionId: sessionId,
      questionKey,
      questionText: "",
      responseValue: "__skipped__",
      responseType: "skipped",
      createdAt: nowIso(),
    });

    const session = await queryOne<Record<string, unknown>>("SELECT * FROM intake_sessions WHERE id = ?", [sessionId]);
    const questions = getQuestionsForVisitType(String(session?.visitType ?? "new_complaint"));
    const responses = await query<Record<string, unknown>>("SELECT * FROM intake_responses WHERE intake_session_id = ?", [sessionId]);
    const answeredKeys = responses.map((r) => r.questionKey);
    const nextQuestion = questions.find((q) => !answeredKeys.includes(q.key));
    await update("intake_sessions", sessionId, { currentStep: responses.length, updatedAt: nowIso() });

    return json({ nextQuestion: nextQuestion ?? null, skipped: questionKey });
  }

  // ── Log a free-form conversational turn (for the AI-driven chat intake) ──
  // Unlike "answer", this does NOT validate against the fixed question bank, so it
  // can store the running chat transcript and the generated pre-visit brief.
  if (action === "log_turn") {
    const sessionId = requiredString(body.sessionId, "sessionId");
    const questionKey = requiredString(body.questionKey, "questionKey", 120);
    const responseValue = requiredString(body.responseValue, "responseValue", 8000);
    if (!sessionId || !questionKey || !responseValue) return error("sessionId, questionKey, and responseValue are required");

    const session = await queryOne<Record<string, unknown>>("SELECT * FROM intake_sessions WHERE id = ?", [sessionId]);
    if (!session) return error("Intake session not found", 404);

    await insert("intake_responses", {
      id: generateId("ir"),
      intakeSessionId: sessionId,
      questionKey,
      questionText: "",
      responseValue,
      responseType: questionKey === "pre_visit_brief" ? "brief" : "chat",
      createdAt: nowIso(),
    });

    // The pre_visit_brief turn signals the interview is finished.
    if (questionKey === "pre_visit_brief") {
      await update("intake_sessions", sessionId, { status: "completed", completedAt: nowIso(), updatedAt: nowIso() });
      if (session.appointmentId) {
        await update("appointments", String(session.appointmentId), { status: "intake_complete", updatedAt: nowIso() });
      }
    } else {
      await update("intake_sessions", sessionId, { updatedAt: nowIso() });
    }

    return json({ logged: true });
  }

  return error("Unknown action. Use: start, answer, skip, log_turn");
});
