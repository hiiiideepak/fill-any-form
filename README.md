# Application Assistant — Chrome extension MVP

A local-first helper for job application forms. Enter reusable details once in **My profile**, open a job form, then choose **Fill this page**. Filled inputs receive a purple outline so they are easy to review.

Use **Dynamic application fields** to create arbitrary labelled answers, including dates and long-form responses. The **Add my job prompts** button adds a starter set for experience, compensation, notice period, location, and similar screening questions.

When an application is open, choose **Sync missing fields from this page** in My profile. It brings in fields it can identify that are not already in your profile, as blank saved entries for you to complete. It filters out application-specific prompts, including detected company-name, referral, job/role, and interview questions.

## Install in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `extension` folder from this repo.
5. Pin **Application Assistant**, visit an application form, and use the extension.

After changing the extension files, press the refresh icon for it on `chrome://extensions`. The extension can now inject itself into an already-open normal webpage; reload the website if Chrome still shows a blocked-page notice.

## Intentional safety boundaries

- Data is stored only in Chrome's local extension storage; there is no server or account. It survives page reloads and browser restarts, and remains until you edit it, clear the extension's local data, or uninstall the extension.
- It fills only after you click the button, and it never submits forms.
- It does not fill checkboxes, radio buttons, password fields, or file uploads. Review all answers before submitting.
- Chrome itself prevents extensions from operating on `chrome://` pages, the Chrome Web Store, PDFs, and some cross-origin embedded frames. Ordinary HTTPS job sites, including Greenhouse pages, are supported.
- For unusual questions, add a custom answer using the wording of the form label.

## MVP notes

This supports ordinary inputs, textareas, native select menus, `<datalist>` inputs, and custom dropdowns (React Select, Greenhouse/Workday-style comboboxes). For dropdowns it never types raw text: it picks the closest matching option (exact, prefix, substring, yes/no, then keyword overlap) and, for custom widgets, opens the menu, filters, and clicks the option. Dropdowns with no acceptable option are left untouched and reported in the result line.
