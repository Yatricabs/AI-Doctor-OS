# Workspace Navigation

**Last updated:** 2026-09-16

The GitHub workspace sidebar now mirrors the ZIP preview operations navigation:

1. Dashboard
2. Appointments
3. Patients
4. Reports & Documents
5. Inventory
6. Billing
7. Analytics
8. Settings

The shared workspace state keeps the selected section in the `screen` query parameter, so active navigation remains stable on refresh. Existing Dashboard, Appointments, Patients, Inventory and Billing screens are unchanged. Reports & Documents, Analytics and Settings are visible navigation states with a safe non-blank placeholder until their existing domain screens are connected; they do not alter any patient or appointment data.

The left sidebar retains the ZIP preview's compact/mobile width, desktop width, icon treatment, active dark-green state, AI UPCHAR brand mark, and `Patient & Operations · Demo V2` footer.

## Dashboard

The GitHub workspace Dashboard follows the ZIP preview dashboard structure: four operational metric cards, schedule breakdown, inventory attention, and open-attention alerts. Unlike the ZIP preview, it reads the integrated checkout's real appointments, patients, inventory, billing, and inbox APIs rather than its standalone demo store.

## Inventory

The GitHub Inventory workspace now carries the full ZIP catalogue into PostgreSQL: medicines, tests, scans, and procedures. ZIP procedure entries such as ECG are visible through their own filter, can be added through the normal inventory form, and can be billed through the existing controlled billing workflow. Medicine stock movement remains restricted to stock-tracked medicine items.

## Billing

The GitHub Billing workspace now follows the ZIP Billing view: total revenue plus consultation, medicine, test, scan, and procedure metric cards, followed by the complete transaction table. It derives those transaction rows from the integrated billing and bill-item tables, so it remains live and links each patient name to the existing Patient record screen.
