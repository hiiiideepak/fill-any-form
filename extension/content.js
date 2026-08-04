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
const highlight = (el) => { if (!el) return; el.style.outline = "2px solid #7658ff"; el.style.outlineOffset = "1px"; };

// Resume upload: rebuild the stored file and hand it to the page's file input
// through a DataTransfer, which is the only way to set input.files.
const RESUME_HINT = /(resume|cv|curriculum vitae|attach|upload|document|file)/;
function dataUrlToFile(dataUrl, name, type) {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: type || "application/octet-stream" });
}
function attachResume(el, resume) {
  if (!resume?.dataUrl) return false;
  if (el.files?.length) return false;
  const text = fieldText(el);
  const accept = String(el.accept || "").toLowerCase();
  const wanted = !text || RESUME_HINT.test(text);
  if (!wanted) return false;
  if (accept && accept !== "*/*") {
    const extension = "." + String(resume.name).split(".").pop().toLowerCase();
    const tokens = accept.split(",").map(t => t.trim());
    const ok = tokens.some(t => t === extension || t === resume.type || (t.endsWith("/*") && resume.type.startsWith(t.slice(0, -1))));
    if (!ok) return false;
  }
  try {
    const transfer = new DataTransfer();
    transfer.items.add(dataUrlToFile(resume.dataUrl, resume.name, resume.type));
    el.files = transfer.files;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    highlight(el);
    return true;
  } catch { return false; }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Never let one slow/broken widget block the rest of the form.
function withTimeout(promise, ms, fallback = false) {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}
const safe = (fn, fallback = false) => { try { return fn(); } catch { return fallback; } };

const YES = ["yes", "true", "y", "i am", "authorized", "authorised", "eligible"];
const NO = ["no", "false", "n", "not authorized", "do not", "don t"];

// Rank how well an option text matches the desired value. -1 = no match.
function scoreOption(optionText, target) {
  const option = normalize(optionText);
  if (!option || option === "select" || option === "please select") return -1;
  if (option === target) return 100;
  if (option.startsWith(target) || target.startsWith(option)) return 80;
  if (option.includes(target) || target.includes(option)) return 60;
  const isYes = (t) => YES.some(w => t === w || t.startsWith(w + " "));
  const isNo = (t) => NO.some(w => t === w || t.startsWith(w + " "));
  if (isYes(target) && isYes(option)) return 50;
  if (isNo(target) && isNo(option)) return 50;
  const words = target.split(" ").filter(w => w.length > 2);
  const hits = words.filter(w => option.includes(w)).length;
  if (words.length && hits / words.length >= 0.6) return 30 + hits;
  return -1;
}

function bestMatch(items, getText, target) {
  let best = null, bestScore = 0;
  for (const item of items) {
    const score = scoreOption(getText(item), target);
    if (score > bestScore) { best = item; bestScore = score; }
  }
  return best;
}

// Native <select>: pick the closest option and fire the events frameworks listen for.
function chooseSelect(el, value) {
  const target = normalize(value);
  const option =
    bestMatch([...el.options], o => o.text, target) ||
    [...el.options].find(o => normalize(o.value) === target);
  if (!option) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter ? setter.call(el, option.value) : (el.value = option.value);
  el.selectedIndex = option.index;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  highlight(el);
  return true;
}

// Inputs backed by a <datalist> behave like a dropdown: snap to a listed option.
function chooseDatalist(el, value) {
  const list = el.list; if (!list) return false;
  const target = normalize(value);
  const option = bestMatch([...list.options], o => o.label || o.value, target);
  if (!option) return false;
  setValue(el, option.value);
  return true;
}

const COMBO_SELECTOR = [
  '[role="combobox"]', '[role="listbox"]', '[aria-haspopup="listbox"]', '[aria-haspopup="true"]',
  '.select__control', '.select-shell', '.chosen-container', '.select2-container', '[class*="Select__control"]'
].join(",");
const OPTION_SELECTOR = [
  '[role="option"]', '.select__option', '[class*="Select__option"]',
  '.select2-results__option', '.chosen-results li', 'ul[class*="menu"] li', 'li[id*="option"]'
].join(",");

function comboboxFor(el) {
  if (el.matches(COMBO_SELECTOR)) return el;
  const container = el.closest('[data-testid], .field, .select-shell, .select__control, [class*="Select"], div');
  return container?.querySelector(COMBO_SELECTOR) || null;
}

function visibleOptions() {
  return [...document.querySelectorAll(OPTION_SELECTOR)].filter(o => {
    const rect = o.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && o.getAttribute("aria-disabled") !== "true";
  });
}

// Custom widgets (React Select, Greenhouse/Workday, Select2...) need real interaction:
// open the menu, type to filter, then click the matching option.
async function chooseCustomDropdown(el, value) {
  const combo = comboboxFor(el);
  if (!combo) return false;
  const target = normalize(value);
  const typeable = combo.matches("input") ? combo : combo.querySelector("input:not([type=hidden])");

  combo.scrollIntoView({ block: "center" });
  (typeable || combo).focus();
  ["pointerdown", "mousedown", "mouseup", "click"].forEach(type =>
    combo.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
  );
  await sleep(150);

  if (typeable && !typeable.readOnly) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter ? setter.call(typeable, String(value)) : (typeable.value = String(value));
    typeable.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(250);
  }

  let options = visibleOptions();
  if (!options.length) { await sleep(300); options = visibleOptions(); }
  const option = bestMatch(options, o => o.innerText || o.textContent, target);
  if (!option) {
    (typeable || combo).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }

  ["pointerdown", "mousedown", "mouseup", "click"].forEach(type =>
    option.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
  );
  await sleep(120);
  highlight(combo);
  return true;
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
  (async () => {
    const { profile = {}, resume } = await chrome.storage.local
      .get(["profile", "resume"])
      .catch(() => ({ profile: {} }));
    let filled = 0, skippedFiles = 0, unmatchedDropdowns = 0, resumesAttached = 0;
    let errored = 0;
    const elements = safe(() => [...document.querySelectorAll("input, textarea, select, [role=combobox]")], []);
    for (const el of elements) {
      try {
      if (el.disabled || el.type === "hidden") continue;
      // Resume attach is synchronous and fire-and-forget: never await the page.
      if (el.type === "file") { safe(() => attachResume(el, resume)) ? resumesAttached++ : skippedFiles++; continue; }
      if (["checkbox", "radio", "submit", "button", "reset", "password"].includes(el.type)) continue;
      const isSelect = el.tagName === "SELECT";
      const isCombo = !isSelect && (el.getAttribute("role") === "combobox" || el.getAttribute("aria-haspopup") === "listbox" || !!el.list);
      if (!isSelect && !isCombo && (el.readOnly || el.value)) continue;
      if (isSelect && el.selectedIndex > 0 && el.value) continue;
      if (isCombo && el.value) continue;
      const value = safe(() => findValue(fieldText(el), profile), "");
      if (!value) continue;

      let done = false;
      if (isSelect) {
        done = safe(() => chooseSelect(el, value)) || await withTimeout(chooseCustomDropdown(el, value), 2500);
      } else if (isCombo) {
        done = (el.list ? safe(() => chooseDatalist(el, value)) : false) || await withTimeout(chooseCustomDropdown(el, value), 2500);
        if (!done && !el.readOnly) { done = safe(() => { setValue(el, value); return true; }); }
      } else {
        done = safe(() => { setValue(el, value); return true; });
      }
      done ? filled++ : unmatchedDropdowns++;
      } catch { errored++; }
    }
    sendResponse({
      message: `Filled ${filled} field${filled === 1 ? "" : "s"}.` +
        (resumesAttached ? ` Resume attached to ${resumesAttached} upload field${resumesAttached === 1 ? "" : "s"}.` : "") +
        (unmatchedDropdowns ? ` ${unmatchedDropdowns} dropdown${unmatchedDropdowns === 1 ? "" : "s"} had no matching option.` : "") +
        (errored ? ` ${errored} field${errored === 1 ? "" : "s"} were skipped after errors.` : "") +
        (skippedFiles ? ` ${skippedFiles} file upload${skippedFiles === 1 ? "" : "s"} still need${skippedFiles === 1 ? "s" : ""} to be selected manually.` : "")
    });
  })();
  return true;
});
