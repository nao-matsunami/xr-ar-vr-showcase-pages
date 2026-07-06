import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const dataPath = path.join(rootDir, "data", "projects.json");
const indexPath = path.join(rootDir, "index.html");
const itemsDir = path.join(rootDir, "items");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badge(text) {
  return `<span class="badge">${escapeHtml(text)}</span>`;
}

function renderReferenceList(references) {
  if (!references?.length) return "";
  return `
    <section class="detail">
      <h2>References</h2>
      <ul class="refs">
        ${references
          .map((reference) => `<li><a href="${escapeHtml(reference.url)}" target="_blank" rel="noreferrer">${escapeHtml(reference.label)}</a></li>`)
          .join("")}
      </ul>
    </section>
  `;
}

function renderLayout({ title, body, extraHead = "" }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${extraHead}
  <style>
    :root {
      --bg0: #09111a;
      --bg1: #13273b;
      --panel: rgba(9, 18, 29, 0.82);
      --panel2: rgba(255, 255, 255, 0.04);
      --line: rgba(124, 228, 255, 0.12);
      --text: #ecf8ff;
      --muted: #97b6ca;
      --accent: #7ce4ff;
      --accent2: #ffd868;
      --shadow: rgba(0, 0, 0, 0.3);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: "Avenir Next", "Hiragino Sans", sans-serif;
      background:
        radial-gradient(circle at 14% 18%, rgba(124, 228, 255, 0.16), transparent 24%),
        radial-gradient(circle at 82% 12%, rgba(255, 216, 104, 0.12), transparent 20%),
        linear-gradient(180deg, var(--bg1), var(--bg0));
    }

    a { color: inherit; }

    .shell {
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 20px 56px;
    }

    .hero, .card, .detail, .sample-list {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow: 0 18px 42px var(--shadow);
      backdrop-filter: blur(14px);
    }

    .hero {
      padding: 28px;
    }

    .hero h1 {
      margin: 0 0 10px;
      font-size: clamp(2rem, 4vw, 3.4rem);
      line-height: 1.05;
    }

    .hero p {
      margin: 0;
      color: var(--muted);
      line-height: 1.7;
      max-width: 780px;
    }

    .hero .en {
      margin-top: 10px;
    }

    .meta, .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .meta {
      margin-top: 18px;
    }

    .meta span, .badge {
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--panel2);
      border: 1px solid rgba(255,255,255,0.06);
      color: var(--muted);
      font-size: 0.85rem;
    }

    .refs {
      margin: 14px 0 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
    }

    .refs a {
      color: var(--accent);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
      margin-top: 22px;
    }

    .card {
      padding: 18px;
      display: grid;
      gap: 14px;
    }

    .card h2, .detail h2 {
      margin: 0;
      font-size: 1.15rem;
      line-height: 1.3;
    }

    .sub, .en, .empty {
      color: var(--muted);
      line-height: 1.7;
    }

    .sub {
      font-size: 0.92rem;
    }

    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .button, .button-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 14px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
    }

    .button {
      background: linear-gradient(135deg, var(--accent), #8effc8);
      color: #062334;
    }

    .button-secondary {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
    }

    .detail, .sample-list {
      margin-top: 22px;
      padding: 22px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 18px;
      margin-top: 22px;
    }

    .sidebar {
      display: grid;
      gap: 18px;
    }

    .empty {
      margin-top: 22px;
      padding: 24px;
      background: var(--panel);
      border: 1px dashed rgba(124, 228, 255, 0.18);
      border-radius: 24px;
    }

    @media (max-width: 920px) {
      .detail-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    ${body}
  </main>
</body>
</html>`;
}

function renderIndex(site, projects) {
  const cards = projects.length
    ? projects
        .map((project) => {
          const badgesHtml = [
            project.platform,
            project.engine,
            ...(project.tags || [])
          ]
            .filter(Boolean)
            .map(badge)
            .join("");

          return `
            <article class="card">
              <div>
                <h2>${escapeHtml(project.title)}</h2>
                ${project.titleEn ? `<p class="sub">${escapeHtml(project.titleEn)}</p>` : ""}
              </div>
              <p>${escapeHtml(project.summary || "")}</p>
              ${project.summaryEn ? `<p class="en">${escapeHtml(project.summaryEn)}</p>` : ""}
              <div class="badges">${badgesHtml}</div>
              <div class="meta">
                ${project.creator ? `<span>creator: ${escapeHtml(project.creator)}</span>` : ""}
                ${project.year ? `<span>year: ${escapeHtml(project.year)}</span>` : ""}
                ${project.stage ? `<span>stage: ${escapeHtml(project.stage)}</span>` : ""}
                ${project.verificationStatus ? `<span>verified: ${escapeHtml(project.verificationStatus)}</span>` : ""}
                ${project.status ? `<span>status: ${escapeHtml(project.status)}</span>` : ""}
              </div>
              <div class="actions">
                <a class="button" href="items/${encodeURIComponent(project.id)}.html">詳細 / Detail</a>
                ${project.demoUrl ? `<a class="button-secondary" href="${escapeHtml(project.demoUrl)}" target="_blank" rel="noreferrer">デモ / Demo</a>` : ""}
              </div>
            </article>
          `;
        })
        .join("\n")
    : `
      <section class="empty">
        <h2>まだ作品がありません</h2>
        <p>まずは <code>data/projects.json</code> に 1 件追加してから <code>npm run build</code> を実行してください。</p>
        <p class="en">No projects yet. Add one entry to <code>data/projects.json</code> and run <code>npm run build</code>.</p>
      </section>
    `;

  return renderLayout({
    title: site.title || "XR / AR / VR Showcase",
    body: `
      <section class="hero">
        <h1>${escapeHtml(site.title || "XR / AR / VR Showcase")}</h1>
        <p>${escapeHtml(site.subtitle || "")}</p>
        ${site.subtitleEn ? `<p class="en">${escapeHtml(site.subtitleEn)}</p>` : ""}
        <div class="meta">
          <span>projects: ${projects.length}</span>
          <span>focus: XR / AR / VR / WebXR</span>
          <span>static-site ready</span>
        </div>
      </section>
      ${projects.length ? `<section class="grid">${cards}</section>` : cards}
    `
  });
}

function renderProjectPage(site, project) {
  const badgesHtml = [
    project.platform,
    project.engine,
    ...(project.tags || [])
  ]
    .filter(Boolean)
    .map(badge)
    .join("");

  return renderLayout({
    title: `${project.title} | ${site.title || "XR / AR / VR Showcase"}`,
    body: `
      <section class="hero">
        <h1>${escapeHtml(project.title)}</h1>
        ${project.titleEn ? `<p class="sub">${escapeHtml(project.titleEn)}</p>` : ""}
        <p>${escapeHtml(project.summary || "")}</p>
        ${project.summaryEn ? `<p class="en">${escapeHtml(project.summaryEn)}</p>` : ""}
        <div class="meta">
          ${project.creator ? `<span>creator: ${escapeHtml(project.creator)}</span>` : ""}
          ${project.year ? `<span>year: ${escapeHtml(project.year)}</span>` : ""}
          ${project.stage ? `<span>stage: ${escapeHtml(project.stage)}</span>` : ""}
          ${project.verificationStatus ? `<span>verified: ${escapeHtml(project.verificationStatus)}</span>` : ""}
          ${project.lastChecked ? `<span>last checked: ${escapeHtml(project.lastChecked)}</span>` : ""}
          ${project.status ? `<span>status: ${escapeHtml(project.status)}</span>` : ""}
        </div>
        <div class="actions">
          <a class="button" href="../index.html">一覧へ戻る / Back</a>
          ${project.demoUrl ? `<a class="button-secondary" href="${escapeHtml(project.demoUrl)}" target="_blank" rel="noreferrer">デモ / Demo</a>` : ""}
          ${project.sourceUrl ? `<a class="button-secondary" href="${escapeHtml(project.sourceUrl)}" target="_blank" rel="noreferrer">ソース / Source</a>` : ""}
        </div>
      </section>

      <section class="detail-grid">
          <section class="detail">
            <h2>Notes</h2>
            <div class="badges">${badgesHtml}</div>
            ${project.notes ? `<p style="margin-top:14px;">${escapeHtml(project.notes)}</p>` : ""}
            ${project.notesEn ? `<p class="en">${escapeHtml(project.notesEn)}</p>` : ""}
          </section>

          ${renderReferenceList(project.references)}

        <aside class="sidebar">
          <section class="sample-list">
            <h2>Metadata</h2>
            <div class="meta">
              ${project.platform ? `<span>platform: ${escapeHtml(project.platform)}</span>` : ""}
              ${project.engine ? `<span>engine: ${escapeHtml(project.engine)}</span>` : ""}
              ${project.id ? `<span>id: ${escapeHtml(project.id)}</span>` : ""}
            </div>
          </section>
        </aside>
      </section>
    `
  });
}

async function main() {
  const raw = JSON.parse(await fs.readFile(dataPath, "utf8"));
  const site = raw.site || {};
  const projects = Array.isArray(raw.projects) ? raw.projects : [];

  await fs.mkdir(itemsDir, { recursive: true });
  await fs.writeFile(indexPath, renderIndex(site, projects), "utf8");

  for (const project of projects) {
    if (!project.id) continue;
    const itemPath = path.join(itemsDir, `${project.id}.html`);
    await fs.writeFile(itemPath, renderProjectPage(site, project), "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
