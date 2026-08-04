const standardFields = ["firstName", "lastName", "fullName", "email", "phone", "address", "city", "state", "postalCode", "country", "linkedin", "website", "currentCompany", "currentTitle", "yearsExperience", "workAuthorization", "coverLetter"];
const standardFieldTerms = ["first name", "given name", "last name", "family name", "full name", "email", "phone", "telephone", "mobile", "address", "city", "state", "province", "region", "postal code", "zip", "country", "linkedin", "portfolio", "website", "current company", "employer", "current title", "job title", "years of experience", "work authorization", "authorized to work", "cover letter"];
const $ = (selector) => document.querySelector(selector);

const starterFields = [
  ["Total years of experience", "7+ years"], ["YoE in NodeJS, PostgreSQL/MySQL", "~7 years"], ["YoE in AWS", "~4 years"],
  ["Team Structure (team size and reporting structure)", "Led a team of 4-5 engineers at Payoneer"],
  ["Latest project scale/traffic metrics – DAU, MAU, Peak Concurrent Users, API Requests per Day", ""],
  ["Have you independently designed the architecture for a system or major feature that other engineers could implement based on your design?", "Yes — Payoneer security deposit system and Deel's MasterTax data pipeline"],
  ["Reason to Explore", ""], ["Current CTC (Fixed + Variable + ESOPs, if any)", ""], ["Expected CTC", ""], ["Notice Period", ""],
  ["Last Working Day (if serving notice or not working currently)", ""], ["Offers in Hand (if any)", ""], ["Current Location", "Gurugram, India"],
  ["Are you open to working from the Bangalore office (5 days WFO)?", ""]
];

function customRow(label = "", value = "", type = "text") {
  const row = document.createElement("div");
  row.className = "custom-row";
  row.innerHTML = `<input class="custom-label" placeholder="Field label" value="${escapeHtml(label)}"><select class="custom-type" aria-label="Answer type"><option value="text">Text</option><option value="date">Date</option><option value="longText">Long text</option></select><button class="remove" type="button" aria-label="Remove field">×</button>`;
  row.querySelector(".custom-type").value = type;
  const renderAnswer = () => {
    row.querySelector(".custom-value")?.remove();
    const answer = document.createElement(type === "longText" ? "textarea" : "input");
    answer.className = "custom-value"; answer.placeholder = "Answer"; answer.value = value;
    if (type === "date") answer.type = "date";
    row.insertBefore(answer, row.querySelector(".remove"));
  };
  renderAnswer();
  row.querySelector(".custom-type").addEventListener("change", (event) => { value = row.querySelector(".custom-value").value; type = event.target.value; renderAnswer(); });
  row.querySelector(".remove").addEventListener("click", () => row.remove());
  $("#customFields").append(row);
}
function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[c]); }
function normalizeLabel(value) { return String(value).toLowerCase().replace(/\s+/g, " ").trim(); }
function isReusableField(label, companyTerms = []) {
  const text = normalizeLabel(label);
  if (!text) return false;
  if (companyTerms.some(term => term.length > 2 && text.includes(normalizeLabel(term)))) return false;
  // These prompts are inherently about this application, not reusable profile data.
  return !/(how did you hear|referr|source of application|previously applied|employed by|worked for|candidate id|requisition|this (company|role|position|team)|the (company|role|position|team)|why .*?(company|role|position|team)|interview)/.test(text);
}

async function loadProfile() {
  const { profile = {} } = await chrome.storage.local.get("profile");
  standardFields.forEach((field) => { const input = document.querySelector(`[name="${field}"]`); if (input) input.value = profile[field] || ""; });
  (profile.custom || []).forEach(({ label, value, type }) => customRow(label, value, type));
}

// Resume: stored separately from the profile so a large file never bloats profile saves.
const MAX_RESUME_BYTES = 8 * 1024 * 1024;
function showResume(resume) {
  $("#resumeName").textContent = resume?.name ? `Saved: ${resume.name}` : "No resume saved yet.";
  $("#removeResume").hidden = !resume?.name;
}
async function loadResume() {
  const { resume } = await chrome.storage.local.get("resume");
  showResume(resume);
}
$("#resumeFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_RESUME_BYTES) { $("#saveStatus").textContent = "That file is larger than 8 MB. Please upload a smaller resume."; event.target.value = ""; return; }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const resume = { name: file.name, type: file.type || "application/octet-stream", dataUrl };
  await chrome.storage.local.set({ resume });
  showResume(resume);
  $("#saveStatus").textContent = "Resume saved locally.";
});
$("#removeResume").addEventListener("click", async () => {
  await chrome.storage.local.remove("resume");
  $("#resumeFile").value = "";
  showResume(null);
  $("#saveStatus").textContent = "Resume removed.";
});

$("#addCustom").addEventListener("click", () => customRow());
$("#addStarter").addEventListener("click", () => {
  const existing = new Set([...document.querySelectorAll(".custom-label")].map(el => normalizeLabel(el.value)));
  starterFields.forEach(([label, value]) => { if (!existing.has(normalizeLabel(label))) customRow(label, value, value.length > 90 ? "longText" : "text"); });
  $("#saveStatus").textContent = "Job prompts added. Review any blank answers, then save.";
});
$("#syncPageFields").addEventListener("click", async () => {
  const status = $("#saveStatus"); status.textContent = "Scanning this page…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let response;
    try { response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_FIELDS" }); }
    catch { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }); response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_FIELDS" }); }
    const existing = new Set([...document.querySelectorAll(".custom-label")].map(el => normalizeLabel(el.value)));
    const missing = (response?.fields || []).filter(label => {
      const normalized = normalizeLabel(label);
      return normalized && isReusableField(label, response?.companyTerms) && !existing.has(normalized) && !standardFieldTerms.some(term => normalized === term || normalized.includes(term));
    });
    missing.forEach(label => customRow(label));
    if (missing.length) await saveProfile(`Added and saved ${missing.length} new field${missing.length === 1 ? "" : "s"}. Enter answers whenever you're ready.`);
    else status.textContent = "No new fields found on this page.";
  } catch {
    status.textContent = "Chrome could not inspect this page. Try a normal website tab, then reopen the extension.";
  }
});
function profileFromForm() {
  const form = new FormData($("#profileForm"));
  const profile = Object.fromEntries(standardFields.map((field) => [field, String(form.get(field) || "").trim()]));
  profile.custom = [...document.querySelectorAll(".custom-row")].map(row => ({ label: row.querySelector(".custom-label").value.trim(), value: row.querySelector(".custom-value").value.trim(), type: row.querySelector(".custom-type").value })).filter(item => item.label);
  return profile;
}
async function saveProfile(message = "Profile saved locally.") {
  const profile = profileFromForm();
  await chrome.storage.local.set({ profile });
  $("#saveStatus").textContent = message;
}
$("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveProfile();
});

$("#fillPage").addEventListener("click", async () => {
  const result = $("#result"); result.textContent = "Filling fields…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Hard cap so the popup never sits on "Filling fields…" if the page stalls.
  const capped = (promise) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 30000)),
  ]);
  try {
    let response;
    try {
      response = await capped(chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM" }));
    } catch {
      // A tab already open when the extension was installed/reloaded has not
      // received its content script. Inject it once, then retry immediately.
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      response = await capped(chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM" }));
    }
    result.textContent = response?.message || "No fillable fields found.";
  } catch {
    result.textContent = "Chrome blocks extensions on browser settings, the Web Store, PDFs, and some embedded frames. This site should work after reloading it.";
  }
});

document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => { document.querySelectorAll(".tab, .panel").forEach(el => el.classList.remove("active")); tab.classList.add("active"); $(`#${tab.dataset.tab}`).classList.add("active"); }));
loadProfile();
loadResume();
