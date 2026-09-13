import assert from "node:assert/strict";
import { navigate, selectPatient, workspaceNavFromQuery, workspaceQuery, workspaceSelectors, workspaceStore } from "../lib/workspaceStore";

assert.equal(workspaceSelectors.activeNav(workspaceStore.getState()), "Dashboard");
assert.equal(workspaceSelectors.selectedPatientId(workspaceStore.getState()), null);

workspaceStore.dispatch(navigate({ nav: "Patients", patientId: "p-123" }));
assert.equal(workspaceSelectors.activeNav(workspaceStore.getState()), "Patients");
assert.equal(workspaceSelectors.selectedPatientId(workspaceStore.getState()), "p-123");
assert.equal(workspaceQuery("Patients", "p-123"), "screen=Patients&patientId=p-123");
assert.equal(workspaceNavFromQuery(new URLSearchParams("screen=Patients").get("screen")), "Patients");
assert.equal(workspaceNavFromQuery("not-a-screen"), "Dashboard");

workspaceStore.dispatch(selectPatient(null));
assert.equal(workspaceSelectors.activeNav(workspaceStore.getState()), "Patients");
assert.equal(workspaceSelectors.selectedPatientId(workspaceStore.getState()), null);
workspaceStore.dispatch(navigate({ nav: "Billing" }));
assert.equal(workspaceSelectors.selectedPatientId(workspaceStore.getState()), null);

console.log("Redux workspace smoke checks passed");
