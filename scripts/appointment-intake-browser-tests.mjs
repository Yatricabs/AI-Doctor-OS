import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.INTAKE_BASE_URL || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });

async function send(page, value) {
  const editor = page.locator("textarea");
  await editor.fill(value);
  await page.getByRole("button", { name: "Send" }).click();
}

async function reachComplaint(page, sex) {
  await page.goto(`${baseURL}/patient/ai-intake`, { waitUntil: "domcontentloaded" });
  await page.setDefaultTimeout(8000);
  await page.waitForTimeout(1200);
  for (let attempt = 0; attempt < 5 && !(await page.getByLabel("10 digit mobile number").isVisible().catch(() => false)); attempt++) {
    await page.getByRole("button", { name: "New patient" }).click();
    await page.waitForTimeout(500);
  }
  await page.getByLabel("10 digit mobile number").fill("9111111111");
  await page.waitForTimeout(250);
  const newPatient = page.getByRole("button", { name: "No, new patient" });
  if (await newPatient.isVisible().catch(() => false)) await newPatient.click();
  await page.getByRole("button", { name: "Send" }).click();
  await send(page, "Browser Context Test");
  await send(page, "34");
  await page.getByRole("button", { name: sex, exact: true }).click();
  await send(page, "Lucknow");
  await page.locator('input[type="date"]').fill("2026-10-01");
  await page.getByRole("button", { name: "Send" }).click();
  await page.locator('input[type="time"]').fill("10:00");
  await page.getByRole("button", { name: "Send" }).click();
}

async function installDeterministicAi(page) {
  await page.route("**/api/ai/chat", async (route) => {
    const request = route.request();
    const body = JSON.parse(request.postData() || "{}");
    const system = String(body.messages?.[0]?.content || "");
    const content = system.includes("Choose ONE highest-value")
      ? JSON.stringify({ action: "ASK_QUESTION", key: "severity", question: "Is takleef ki teevrata 1 se 10 mein kitni hai?", reasonCode: "SEVERITY_MISSING", confidence: "MEDIUM" })
      : JSON.stringify({ status: "CONSISTENT", facts: [], explanation: "No additional conflict.", question: "", contradictions: [], safetyFlags: [], reasonCodes: ["MODEL_TEST"] });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content }) });
  });
}

async function runCase(name, sex, complaint, expected) {
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.log("PAGE_ERROR", error.message));
  page.on("console", (message) => { if (message.type() === "error") console.log("BROWSER_ERROR", message.text()); });
  await installDeterministicAi(page);
  await reachComplaint(page, sex);
  await send(page, complaint);
  await page.waitForTimeout(400);
  const text = await page.locator("main").nth(1).innerText();
  assert.match(text, new RegExp(expected.mustContain, "i"), `${name}: expected response not rendered`);
  if (expected.mustNotContain) assert.doesNotMatch(text, new RegExp(expected.mustNotContain, "i"), `${name}: stale routine question rendered`);
  await page.close();
  return { name, status: "passed" };
}

async function runExplicitCorrection() {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  await installDeterministicAi(page);
  await reachComplaint(page, "Man");
  await send(page, "Mere vagina se white discharge ho raha hai");
  await page.waitForTimeout(250);
  await send(page, "Galti se Man select ho gaya tha, main female hoon");
  await page.waitForTimeout(400);
  const text = await page.locator("main").nth(1).innerText();
  assert.match(text, /teevrata|kab se|lakshan|doctor|prescription/i, "explicit correction should resume clinical questioning");
  assert.ok((text.match(/Aapne sex mein/g) || []).length <= 1, "correction should not create a repeated contradiction loop");
  await page.close();
  return { name: "Explicit SEX correction re-evaluates complaint", status: "passed" };
}

async function runNegativeClarification() {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  await installDeterministicAi(page);
  await reachComplaint(page, "Man");
  await send(page, "Mere vagina se white discharge ho raha hai");
  await page.waitForTimeout(250);
  await send(page, "Nahi");
  await page.waitForTimeout(300);
  const text = await page.locator("main").nth(1).innerText();
  assert.match(text, /dobara|asli takleef|symptom/i, "negative clarification must recover to complaint entry");
  assert.doesNotMatch(text, /Yeh takleef aapko kab se hai/i, "negative clarification must not bypass the unresolved complaint");
  await page.close();
  return { name: "Negative clarification does not hang or bypass context", status: "passed" };
}

const results = [];
results.push(await runCase(
  "Man plus vaginal discharge: immediate clarification",
  "Man",
  "Mere vagina se white discharge ho raha hai",
  { mustContain: "sex mein.*Man|vaginal|reproductive", mustNotContain: "Yeh takleef aapko kab se hai" },
));
results.push(await runExplicitCorrection());
results.push(await runNegativeClarification());
results.push(await runCase(
  "Woman plus vaginal discharge: normal adaptive continuation",
  "Woman",
  "Mere vagina se white discharge ho raha hai",
  { mustContain: "teevrata|kab se|lakshan|doctor|prescription" },
));
results.push(await runCase(
  "Man plus penile discharge: distinct anatomy context",
  "Man",
  "Mere penis se white discharge ho raha hai",
  { mustContain: "teevrata|kab se|lakshan|doctor|prescription", mustNotContain: "sex mein.*Man.*vaginal" },
));
results.push(await runCase(
  "Safety information outranks routine duration",
  "Man",
  "Seene mein pressure aur saans ki dikkat hai",
  { mustContain: "safety|turant|emergency|warning", mustNotContain: "Yeh takleef aapko kab se hai" },
));

await browser.close();
console.log(JSON.stringify({ suite: "appointment-intake-browser", baseURL, status: "passed", results }, null, 2));
