const aliases = {
  firstName: ["first name", "given name", "forename"], lastName: ["last name", "family name", "surname"], fullName: ["full name", "name"],
  email: ["email", "e-mail", "email address"], phone: ["phone", "telephone", "mobile", "phone number"], address: ["address", "street address", "address line 1"],
  city: ["city", "town"], state: ["state", "province", "region"], postalCode: ["zip", "zip code", "postal code", "postcode"], country: ["country"],
  linkedin: ["linkedin", "linkedin url", "linkedin profile"], website: ["website", "portfolio", "personal site", "github"], currentCompany: ["current company", "employer", "company"],
  currentTitle: ["current title", "job title", "current role", "occupation"], yearsExperience: ["years of experience", "years experience", "experience years"],
  workAuthorization: ["authorized to work", "work authorization", "eligible to work", "sponsorship"], coverLetter: ["cover letter", "why are you interested", "why do you want to work"]
};
const normalize = (text) => String(text || "").toLowerCase().replace(/[_\-]+/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function fieldText(el) {
  const label = el.labels?.[0]?.innerText || "";
  const labelled = el.getAttribute("aria-labelledby");
  const aria = el.getAttribute("aria-label") || (labelled && document.getElementById(labelled)?.innerText) || "";
  const nearby = el.closest("label")?.innerText || "";
  return normalize([label, aria, nearby, el.placeholder, el.name, el.id, el.autocomplete].filter(Boolean).join(" "));
}
function fieldLabel(el) {
  const label = el.labels?.[0]?.innerText || el.closest("label")?.innerText || "";
  const labelled = el.getAttribute("aria-labelledby");
  const aria = el.getAttribute("aria-label") || (labelled && document.getElementById(labelled)?.innerText) || "";
  return String(label || aria || el.placeholder || el.name || el.id || "").replace(/\s+/g, " ").trim();
}
function companyTerms() {
  const terms = new Set();
  const add = (value) => {
    const term = String(value || "").replace(/\s+/g, " ").trim();
    if (term.length >= 3 && term.length <= 60) terms.add(term);
  };
  const title = document.title || "";
  // Common career-site titles: "Job Application for X at Acme" and "Careers | Acme".
  const atMatch = title.match(/\bat\s+([^|–—]+)$/i); if (atMatch) add(atMatch[1]);
  const separatorParts = title.split(/[|–—]/).map(part => part.trim()); if (separatorParts.length > 1) add(separatorParts.at(-1));
  add(document.querySelector('meta[property="og:site_name"]')?.content);
  document.querySelectorAll(".company-name, [class*='company-name'], [data-qa*='company']").forEach(el => add(el.textContent));
  return [...terms];
}
function findValue(text, profile) {
  for (const [key, terms] of Object.entries(aliases)) if (profile[key] && terms.some(term => text.includes(term))) return profile[key];
  for (const entry of profile.custom || []) if (normalize(entry.label) && text.includes(normalize(entry.label))) return entry.value;
  return "";
}
function setValue(el, value) {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter ? setter.call(el, value) : (el.value = value);
  el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  el.style.outline = "2px solid #7658ff"; el.style.outlineOffset = "1px";
}
function chooseSelect(el, value) {
  const target = normalize(value);
  const option = [...el.options].find(o => normalize(o.text).includes(target) || target.includes(normalize(o.text)) || normalize(o.value) === target);
  if (!option) return false; el.value = option.value; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); el.style.outline = "2px solid #7658ff"; return true;
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_FIELDS") {
    const seen = new Set();
    const fields = [];
    document.querySelectorAll("input, textarea, select").forEach(el => {
      if (el.disabled || el.type === "hidden" || ["file", "checkbox", "radio", "submit", "button", "reset", "password"].includes(el.type)) return;
      const label = fieldLabel(el), key = normalize(label);
      if (key && !seen.has(key)) { seen.add(key); fields.push(label); }
    });
    sendResponse({ fields, companyTerms: companyTerms() });
    return;
  }
  if (message.type !== "FILL_FORM") return;
  chrome.storage.local.get("profile").then(({ profile = {} }) => {
    let filled = 0, skippedFiles = 0;
    document.querySelectorAll("input, textarea, select").forEach(el => {
      if (el.disabled || el.readOnly || el.value || el.type === "hidden") return;
      if (el.type === "file") { skippedFiles++; return; }
      if (["checkbox", "radio", "submit", "button", "reset", "password"].includes(el.type)) return;
      const value = findValue(fieldText(el), profile); if (!value) return;
      if (el.tagName === "SELECT" ? chooseSelect(el, value) : (setValue(el, value), true)) filled++;
    });
    sendResponse({ message: `Filled ${filled} field${filled === 1 ? "" : "s"}.${skippedFiles ? " File uploads still need to be selected manually." : ""}` });
  });
  return true;
});
