import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Application Assistant — Chrome Extension" },
      {
        name: "description",
        content:
          "Install the Application Assistant Chrome extension to autofill job applications, select dropdown values and attach your resume.",
      },
      { property: "og:title", content: "Application Assistant — Chrome Extension" },
      {
        property: "og:description",
        content:
          "Autofill job applications, handle dropdowns and attach your saved resume automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">Application Assistant</h1>
      <p className="text-muted-foreground">
        This repository is the Chrome extension. The files in the project root
        (<code>manifest.json</code>, <code>popup.html</code>, <code>popup.js</code>,{" "}
        <code>popup.css</code>, <code>content.js</code>) are everything you need.
      </p>
      <ol className="list-decimal space-y-2 pl-6">
        <li>Open <code>chrome://extensions</code></li>
        <li>Enable Developer mode</li>
        <li>Click "Load unpacked" and select this project folder</li>
        <li>Open the extension popup, save your profile and upload your resume</li>
      </ol>
    </main>
  );
}
