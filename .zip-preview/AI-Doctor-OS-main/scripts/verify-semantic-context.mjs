import { chromium } from "playwright";

const baseUrl = "http://localhost:3001/test-phone-lookup";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];

function check(condition, label) {
  if (!condition) throw new Error(label);
  results.push(label);
}

async function body() {
  return page.locator("body").innerText();
}

async function submitText(value) {
  await page.locator("textarea").fill(value);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

async function beginToSex(sex) {
  await page.goto(baseUrl);
  await page.getByRole("button", { name: "New patient", exact: true }).click();
  await page.getByLabel("10 digit mobile number").fill("9999999999");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await submitText("Semantic Test Patient");
  await submitText("35");
  await page.getByRole("button", { name: sex, exact: true }).click();
}

async function finishStructuredIntake() {
  await submitText("Lucknow");
  await page.getByLabel("Appointment date").fill("2026-10-01");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByLabel("Appointment time").fill("10:30");
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

async function beginClinical(sex) {
  await beginToSex(sex);
  await finishStructuredIntake();
  check((await body()).includes("Aapko mukhya roop se kya takleef hai?"), `${sex}: chief complaint step reached`);
}

async function testAnatomyCases() {
  await beginClinical("Man");
  await submitText("mere vagina me white discharge ho raha hai");
  let text = await body();
  check(text.includes("vagina mein white discharge"), "Man + vaginal complaint: semantic clarification rendered");
  check(!text.includes("Yeh takleef aapko kab se hai?"), "Man + vaginal complaint: duration did not bypass semantic conflict");

  await beginClinical("Woman");
  await submitText("mere vagina me white discharge ho raha hai");
  text = await body();
  check(!text.includes("Main is baat ko sahi tarah samajhna chahta hoon"), "Woman + vaginal complaint: no false semantic conflict");
  check(text.includes("Is takleef ki teevrata 1 se 10 mein kitni hai?"), "Woman + vaginal complaint: normal adaptive question rendered");

  await beginClinical("Man");
  await submitText("mere penis se white discharge ho raha hai");
  text = await body();
  check(!text.includes("Main is baat ko sahi tarah samajhna chahta hoon"), "Man + penile complaint: no false vaginal classification");
  check(text.includes("Is takleef ki teevrata 1 se 10 mein kitni hai?"), "Man + penile complaint: normal adaptive question rendered");
}

async function testSemanticReplay() {
  await beginClinical("Man");
  await submitText("mere vagina me white discharge ho raha hai");
  const sexBubble = page.getByText("Man", { exact: true }).locator("xpath=..");
  await sexBubble.getByRole("button", { name: "Edit message" }).click();
  await page.locator("textarea").fill("Woman");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  check((await body()).includes("Aap kis sheher/ilaake se hain?"), "SEX edit clears downstream semantic conflict and rebuilds deterministic intake");
  await finishStructuredIntake();
  await submitText("mere vagina me white discharge ho raha hai");
  const text = await body();
  check(!text.includes("Main is baat ko sahi tarah samajhna chahta hoon"), "SEX edit Man to Woman removes stale semantic conflict");
  check(text.includes("Is takleef ki teevrata 1 se 10 mein kitni hai?"), "SEX edit recalculates next clinical question from corrected context");
}

async function testPhaseOneAndClinicalReplay() {
  await beginClinical("Man");
  await submitText("mujhe periods ho rahe hain");
  let text = await body();
  check(text.includes("periods hone ki baat"), "Phase 1 periods contradiction remains higher priority");
  check(!text.includes("Yeh takleef aapko kab se hai?"), "Phase 1 contradiction blocks duration fallback");

  await beginClinical("Woman");
  await submitText("Pet mein bahut dard hai");
  await page.getByLabel("Edit message").last().click();
  await page.locator("textarea").fill("Seene mein pressure ho raha hai");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  text = await body();
  check(text.includes("saans phoolna"), "Clinical edit rebuilds downstream decision using corrected complaint");

  await beginClinical("Woman");
  await submitText("Mujhe achanak bahut tez chest pain aur saans ki dikkat hai");
  text = await body();
  check(text.includes("turant") || text.includes("emergency") || text.includes("Emergency"), "Deterministic red-flag flow remains higher priority");
}

async function testClassificationEditAndPhone() {
  await page.goto(baseUrl);
  await page.getByRole("button", { name: "New patient", exact: true }).click();
  await page.getByText("New patient", { exact: true }).locator("xpath=..").getByRole("button", { name: "Edit message" }).click();
  await page.locator("textarea").fill("Existing patient");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  check((await body()).includes("Kripya apna 10-digit mobile number"), "New to Existing edit replay reaches phone branch");

  await page.goto(baseUrl);
  await page.getByRole("button", { name: "Existing patient", exact: true }).click();
  await page.getByText("Existing patient", { exact: true }).locator("xpath=..").getByRole("button", { name: "Edit message" }).click();
  await page.locator("textarea").fill("New patient");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  check((await body()).includes("Kripya apna 10-digit mobile number"), "Existing to New edit replay reaches new-patient branch");

  await page.goto(baseUrl);
  await page.getByRole("button", { name: "New patient", exact: true }).click();
  const phone = page.getByLabel("10 digit mobile number");
  await phone.fill("982001102");
  await page.waitForTimeout(350);
  check(!(await body()).includes("Rohan Mehta"), "Nine digits do not trigger lookup");
  await phone.fill("9820011021");
  await page.getByText("Rohan Mehta", { exact: false }).waitFor({ timeout: 5000 });
  const text = await body();
  check(text.includes("Rohan Mehta"), "Ten digits use the real lookup API and return Rohan Mehta");
  check(text.includes("Yes, follow-up") && text.includes("No, new patient"), "Existing patient lookup choices rendered without Send or Enter");
}

try {
  await testAnatomyCases();
  await testSemanticReplay();
  await testPhaseOneAndClinicalReplay();
  await testClassificationEditAndPhone();
  console.log(`BROWSER PASS\n${results.map((result) => `- ${result}`).join("\n")}`);
} finally {
  await browser.close();
}
