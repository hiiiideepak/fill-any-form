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

// The question a radio/checkbox answers usually lives on its fieldset legend,
// radiogroup label, or a heading right above the option list.
function groupLabel(el) {
  const group = el.closest('fieldset, [role=radiogroup], [role=group]');
  const legend = group?.querySelector("legend")?.innerText;
  const groupLabelled = group?.getAttribute("aria-labelledby");
  const groupAria = group?.getAttribute("aria-label") || (groupLabelled && document.getElementById(groupLabelled)?.innerText) || "";
  const text = legend || groupAria || questionAbove(el) || fieldLabel(el) || el.name || "";
  return String(text).replace(/\s+/g, " ").trim().slice(0, 160);
}

// All options that answer the same question. Radios normally share a name, but
// many ATS forms omit names (or render options as buttons / role=radio nodes),
// so fall back to every sibling option inside the nearest option container.
function optionContainer(el) {
  return el.closest('fieldset, [role=radiogroup], [role=group], [role=listbox]') || (() => {
    // Walk up until the ancestor holds more than one option-like control.
    let node = el.parentElement;
    for (let depth = 0; node && node !== document.body && depth < 5; depth++, node = node.parentElement) {
      if (node.querySelectorAll('input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]').length > 1) return node;
    }
    return null;
  })();
}
function groupMembers(el) {
  if (el.type === "radio" && el.name) {
    return [...document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`)];
  }
  const container = optionContainer(el);
  if (container) {
    const kind = el.getAttribute("role") || el.type;
    const members = [...container.querySelectorAll('input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]')]
      .filter(m => (m.getAttribute("role") || m.type) === kind);
    if (members.length > 1) return members;
  }
  return [el];
}
function commonAncestor(nodes) {
  if (!nodes.length) return null;
  let ancestor = nodes[0]?.parentElement || null;
  for (const node of nodes.slice(1)) {
    while (ancestor && !ancestor.contains(node)) ancestor = ancestor.parentElement;
  }
  return ancestor;
}
const nodeText = (el) => String(el?.innerText || el?.textContent || el?.getAttribute?.("aria-label") || el?.value || "").replace(/\s+/g, " ").trim();

// Some forms answer a question with a pair/row of plain buttons (Yes / No,
// segmented controls) instead of radios. Group those buttons per container.
function buttonGroups() {
  const groups = new Map();
  const candidates = [...document.querySelectorAll('button, [role=button]')].filter(el => {
    if (el.disabled || el.getAttribute("aria-disabled") === "true" || el.getAttribute("aria-haspopup")) return false;
    if (el.closest("nav, header, footer")) return false;
    if (["submit", "reset"].includes(el.type)) return false;
    const text = nodeText(el);
    return text.length >= 1 && text.length <= 40;
  });
  for (const button of candidates) {
    const container = button.parentElement;
    if (!container) continue;
    if (!groups.has(container)) groups.set(container, []);
    groups.get(container).push(button);
  }
  return [...groups.values()]
    .filter(buttons => buttons.length >= 2 && buttons.length <= 6)
    .map(buttons => ({ buttons }))
    .filter(({ buttons }) => !!questionAbove(buttons[0]));
}
// The question text usually sits just above the option list — as a heading,
// bold label, or plain paragraph that itself contains no form controls.
function questionAbove(el) {
  const members = groupMembers(el);
  let node = commonAncestor(members) || el.parentElement;
  const optionTexts = new Set(members.map(m => normalize(fieldLabel(m))).filter(Boolean));
  const usable = (candidate) => {
    if (!candidate) return "";
    if (candidate.querySelector("input, select, textarea")) return "";
    const text = String(candidate.innerText || "").replace(/\s+/g, " ").trim();
    if (!text || text.length < 3 || text.length > 400) return "";
    if (optionTexts.has(normalize(text))) return "";
    return text;
  };
  const start = node;
  for (let depth = 0; node && node !== document.body && depth < 8; depth++, node = node.parentElement) {
    const heading = [...node.children].find(child => usable(child) && /^(LEGEND|H1|H2|H3|H4|H5|H6|LABEL|P|STRONG|B|SPAN|DIV)$/.test(child.tagName));
    const inside = usable(heading);
    if (inside) return inside;
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      const text = usable(sib);
      if (text) return text;
    }
  }
  // Fallback: some forms wrap the question and its options in one block with no
  // dedicated heading element. Strip every control/option label out of the
  // block and keep the last remaining line of prose above the options.
  return questionFromBlock(start, optionTexts);
}
function questionFromBlock(start, optionTexts) {
  let node = start;
  for (let depth = 0; node && node !== document.body && depth < 6; depth++, node = node.parentElement) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('input, select, textarea, button, label, [role=radio], [role=checkbox], [role=button], legend').forEach(n => n.remove());
    const lines = String(clone.innerText || clone.textContent || "")
      .split("\n").map(line => line.replace(/\s+/g, " ").trim())
      .filter(line => line.length >= 8 && line.length <= 400 && !optionTexts.has(normalize(line)));
    const text = lines.at(-1);
    if (text) return text;
  }
  return "";
}

// Radio: pick the option in the group whose own label matches the saved value.
// Checkbox: treat the value as yes/no unless it names this specific option.
function toggleChoice(el, value) {
  const target = normalize(value);
  if (!target) return false;
  const click = (node) => {
    if (node.checked && node.type === "radio") return true;
    node.click();
    if (node.checked !== true && node.type !== "radio") { node.checked = true; }
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    highlight(node.closest("label") || node);
    return true;
  };
  if (el.type === "radio") {
    const group = el.name
      ? [...document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`)]
      : [el];
    if (group.some(r => r.checked)) return false;
    const match = bestMatch(group, r => fieldLabel(r) || r.value, target);
    return match ? click(match) : false;
  }
  const own = normalize(fieldLabel(el) || el.value);
  const wantsYes = YES.some(w => target === w || target.startsWith(w + " "));
  const wantsNo = NO.some(w => target === w || target.startsWith(w + " "));
  const optionMatch = own && scoreOption(own, target) > 0;
  if (wantsNo && !optionMatch) return false;
  if (!wantsYes && !optionMatch) return false;
  if (el.checked) return false;
  return click(el);
}

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
    const push = (label, options = []) => {
      const key = normalize(label);
      if (key && !seen.has(key)) {
        seen.add(key);
        fields.push({ label: String(label).replace(/\s+/g, " ").trim(), options: [...new Set(options.map(o => String(o).replace(/\s+/g, " ").trim()).filter(Boolean))] });
      }
    };
    document.querySelectorAll("input, textarea, select").forEach(el => {
      if (el.disabled || el.type === "hidden" || ["file", "submit", "reset", "password"].includes(el.type)) return;
      // Radios and checkboxes answer a question stated by their group/fieldset,
      // not by the individual option text — sync the question once, with its
      // options, so the user picks one answer instead of one field per option.
      if (el.type === "radio" || el.type === "checkbox") {
        const members = groupMembers(el);
        if (members[0] !== el) return;
        push(groupLabel(el), members.map(m => fieldLabel(m) || m.value).filter(Boolean));
        return;
      }
      if (el.type === "button") { push(fieldLabel(el) || el.value); return; }
      push(fieldLabel(el));
    });
    // Custom (non-native) toggles and dropdown buttons used by modern ATS forms.
    document.querySelectorAll('[role=radio], [role=checkbox], [role=switch]').forEach(el => {
      if (el.getAttribute("aria-disabled") === "true") return;
      const members = groupMembers(el);
      if (members[0] !== el) return;
      push(groupLabel(el), members.map(nodeText).filter(Boolean));
    });
    document.querySelectorAll('[role=radiogroup], button[aria-haspopup], [role=button][aria-haspopup]').forEach(el => {
      if (el.getAttribute("aria-disabled") === "true") return;
      push(groupLabel(el));
    });
    // Segmented answers rendered as plain buttons (e.g. a Yes / No pair).
    buttonGroups().forEach(({ buttons }) => push(groupLabel(buttons[0]), buttons.map(nodeText)));
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
      if (el.type === "radio" || el.type === "checkbox") {
        const value = safe(() => findValue(normalize(groupLabel(el)), profile), "");
        if (!value) continue;
        safe(() => toggleChoice(el, value)) ? filled++ : null;
        continue;
      }
      if (["submit", "button", "reset", "password"].includes(el.type)) continue;
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
    // Custom option widgets: role=radio/checkbox nodes and plain button pairs.
    const clickNode = (node) => {
      ["pointerdown", "mousedown", "mouseup", "click"].forEach(type =>
        node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
      );
      highlight(node);
    };
    const customGroups = safe(() => {
      const seen = new Set();
      const groups = [];
      document.querySelectorAll('[role=radio], [role=checkbox], [role=switch]').forEach(el => {
        if (el.getAttribute("aria-disabled") === "true" || seen.has(el)) return;
        const members = groupMembers(el);
        members.forEach(m => seen.add(m));
        groups.push(members.filter(m => !(m instanceof HTMLInputElement)));
      });
      buttonGroups().forEach(({ buttons }) => groups.push(buttons));
      return groups.filter(members => members.length > 1);
    }, []);
    for (const members of customGroups) {
      try {
        if (members.some(m => m.getAttribute("aria-checked") === "true" || m.getAttribute("aria-pressed") === "true")) continue;
        const value = safe(() => findValue(normalize(groupLabel(members[0])), profile), "");
        if (!value) continue;
        const match = bestMatch(members, nodeText, normalize(value));
        if (!match) { unmatchedDropdowns++; continue; }
        clickNode(match);
        filled++;
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
