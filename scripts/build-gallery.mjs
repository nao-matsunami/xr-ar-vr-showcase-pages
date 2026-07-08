import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const outputDir = path.join(rootDir, "outputs");
const reportsDir = path.join(rootDir, "reports");
const pagesDir = path.join(rootDir, "pages");
const daysDir = path.join(rootDir, "days");
const indexPath = path.join(rootDir, "index.html");
const pageSize = 12;

function parseTitle(html, fallback) {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  return titleMatch?.[1]?.trim() || fallback;
}

function parseDescription(html) {
  const pMatch = html.match(/<p>([\s\S]*?)<\/p>/i);
  if (!pMatch) return "";
  return pMatch[1]
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateLabel(date) {
  const [year, month, day] = date.split("-");
  return `${year}.${month}.${day}`;
}

function deriveTags(fileName, title, description, report) {
  const source = `${fileName} ${title} ${description} ${report?.headline || ""}`.toLowerCase();
  const tags = [];

  if (source.includes("audio")) tags.push("audio");
  if (source.includes("particle")) tags.push("particles");
  if (source.includes("field")) tags.push("field");
  if (source.includes("shader")) tags.push("shader");
  if (source.includes("xr")) tags.push("xr");
  if (source.includes("reactive")) tags.push("reactive");
  if (source.includes("band")) tags.push("frequency-bands");
  if (source.includes("html")) tags.push("html-surface");
  if (source.includes("focus")) tags.push("focus");

  return tags.length ? tags : ["prototype"];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBilingual(primary, secondary, primaryTag = "span", secondaryTag = "span", className = "bilingual") {
  const primaryHtml = primary ? `<${primaryTag} class="${className}-primary">${escapeHtml(primary)}</${primaryTag}>` : "";
  const secondaryHtml = secondary ? `<${secondaryTag} class="${className}-secondary">${escapeHtml(secondary)}</${secondaryTag}>` : "";
  return `<span class="${className}">${primaryHtml}${secondaryHtml}</span>`;
}

function renderLinks(links) {
  if (!links?.length) return "";
  return `
    <ul class="link-list">
      ${links
        .map(
          (link) => `
            <li><a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a></li>
          `
        )
        .join("")}
    </ul>
  `;
}

function renderKeyTopics(report) {
  if (!report?.keyTopics?.length) return "";
  return `
      <section class="detail-block">
        <h2>${renderBilingual("今日の重要トピック", "Key topics today", "span", "span", "heading-pair")}</h2>
        <ol class="topic-list">
          ${report.keyTopics
            .map((topic, index) => {
              const topicEn = report.keyTopicsEn?.[index];
              return `
            <li>
              <span>${escapeHtml(topic)}</span>
              ${topicEn ? `<span class="en-copy">${escapeHtml(topicEn)}</span>` : ""}
            </li>
          `;
            })
            .join("")}
        </ol>
      </section>
  `;
}

function renderReportSections(report) {
  if (!report?.sections?.length) {
    return `
      <section class="detail-block">
        <h2>${renderBilingual("この日の情報", "About this day", "span", "span", "heading-pair")}</h2>
        <p>
          この日のレポート本文はまだファイルとして保存されていません。
          現在はサンプル情報と概要のみを表示しています。
          今後は <code>reports/YYYY-MM-DD.json</code> を追加すると、この欄に日次レポートをそのまま載せられます。
        </p>
        <p>
          The full daily report has not been saved as a file yet.
          For now this page shows the sample and a short summary only.
          Add <code>reports/YYYY-MM-DD.json</code> to publish the daily report here as well.
        </p>
      </section>
    `;
  }

  return report.sections
    .map(
      (section) => `
        <section class="detail-block">
          <h2>${renderBilingual(section.title, section.titleEn, "span", "span", "heading-pair")}</h2>
          ${section.body ? `<p>${escapeHtml(section.body)}</p>` : ""}
          ${section.bodyEn ? `<p class="en-copy">${escapeHtml(section.bodyEn)}</p>` : ""}
          ${renderLinks(section.links)}
        </section>
      `
    )
    .join("\n");
}

function renderPagination(currentPage, totalPages, basePath) {
  if (totalPages <= 1) return "";

  const links = [];
  for (let page = 1; page <= totalPages; page += 1) {
    const href = page === 1 ? `${basePath}index.html` : `${basePath}pages/${page}.html`;
    links.push(`
      <a class="pager-link${page === currentPage ? " is-current" : ""}" href="${href}">
        ${page}
      </a>
    `);
  }

  const prevHref =
    currentPage <= 1 ? null : currentPage - 1 === 1 ? `${basePath}index.html` : `${basePath}pages/${currentPage - 1}.html`;
  const nextHref = currentPage >= totalPages ? null : `${basePath}pages/${currentPage + 1}.html`;

  return `
    <nav class="pager" aria-label="ページ送り">
      ${
        prevHref
          ? `<a class="pager-nav" href="${prevHref}">前のページ / Previous</a>`
          : `<span class="pager-nav is-disabled">前のページ / Previous</span>`
      }
      <div class="pager-links">${links.join("")}</div>
      ${
        nextHref
          ? `<a class="pager-nav" href="${nextHref}">次のページ / Next</a>`
          : `<span class="pager-nav is-disabled">次のページ / Next</span>`
      }
    </nav>
  `;
}

function renderListPage(days, currentPage, totalPages, basePath, totalItems) {
  const cards = days
    .map((day) => {
      const primarySample = day.samples[0];
      const tags = day.tags
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");

      return `
        <article class="card" data-slug="${escapeHtml(day.date)}">
          <div class="card-top">
            <div>
              <p class="date">${escapeHtml(formatDateLabel(day.date))}</p>
              <h2>${escapeHtml(day.report?.headline || primarySample.title)}</h2>
              ${
                day.report?.headlineEn
                  ? `<p class="card-subtitle">${escapeHtml(day.report.headlineEn)}</p>`
                  : ""
              }
            </div>
            <button class="like-button" type="button" data-slug="${escapeHtml(day.date)}" aria-pressed="false">
              <span class="heart">♡</span>
              <span class="label">好き / Like</span>
            </button>
          </div>
          <p class="description">${escapeHtml(day.report?.summary || primarySample.description || "日次レポートから生成されたサンプルです。")}</p>
          ${
            day.report?.summaryEn
              ? `<p class="description en-copy">${escapeHtml(day.report.summaryEn)}</p>`
              : ""
          }
          <p class="card-subtitle">samples: ${day.samples.length}</p>
          <div class="tags">${tags}</div>
          <div class="actions">
            <a class="primary" href="${basePath}days/${escapeHtml(day.date)}.html">その日のページ / Day</a>
            <a class="secondary-link" href="${basePath}outputs/${encodeURIComponent(primarySample.fileName)}">代表サンプル / Sample</a>
          </div>
        </article>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>XR / AR / VR Daily Samples</title>
  <style>
    :root {
      --bg0: #07111a;
      --bg1: #102338;
      --panel: rgba(9, 20, 31, 0.84);
      --panel-2: rgba(255, 255, 255, 0.04);
      --line: rgba(126, 228, 255, 0.12);
      --text: #ebf8ff;
      --muted: #9ab6c8;
      --accent: #7ce4ff;
      --accent2: #ffd868;
      --shadow: rgba(0, 0, 0, 0.32);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Avenir Next", "Hiragino Sans", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 16% 18%, rgba(124, 228, 255, 0.16), transparent 24%),
        radial-gradient(circle at 84% 10%, rgba(255, 216, 104, 0.12), transparent 20%),
        linear-gradient(180deg, var(--bg1), var(--bg0));
    }

    .shell {
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 20px 48px;
    }

    .hero {
      padding: 28px;
      border-radius: 26px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: 0 18px 42px var(--shadow);
      backdrop-filter: blur(14px);
    }

    .hero h1 {
      margin: 0 0 10px;
      font-size: clamp(1.9rem, 4vw, 3.2rem);
      line-height: 1.1;
    }

    .hero p {
      margin: 0;
      max-width: 780px;
      color: var(--muted);
      line-height: 1.7;
    }

    .card-subtitle,
    .en-copy,
    .bilingual-secondary,
    .heading-pair-secondary {
      margin: 6px 0 0;
      color: var(--muted);
      line-height: 1.65;
    }

    .card-subtitle,
    .heading-pair-secondary {
      font-size: 0.9rem;
    }

    .description.en-copy {
      min-height: 0;
      margin-top: -4px;
      font-size: 0.92rem;
    }

    .heading-pair {
      display: grid;
      gap: 4px;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 18px;
    }

    .meta span {
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--muted);
      font-size: 0.88rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
      margin-top: 22px;
    }

    .card {
      display: grid;
      gap: 14px;
      padding: 18px;
      border-radius: 22px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: 0 18px 42px var(--shadow);
      backdrop-filter: blur(14px);
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
    }

    .date {
      margin: 0 0 6px;
      color: var(--accent2);
      font-size: 0.82rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .card h2 {
      margin: 0;
      font-size: 1.15rem;
      line-height: 1.3;
    }

    .description {
      margin: 0;
      color: var(--muted);
      line-height: 1.7;
      min-height: 4.6em;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tag {
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 0.78rem;
      color: var(--muted);
      background: var(--panel-2);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .primary,
    .secondary-link,
    .pager-link,
    .pager-nav {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 14px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
    }

    .primary {
      background: linear-gradient(135deg, var(--accent), #8effc8);
      color: #062334;
    }

    .secondary-link,
    .pager-link,
    .pager-nav {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 24px;
      padding: 18px;
      border-radius: 22px;
      background: var(--panel);
      border: 1px solid var(--line);
    }

    .pager-links {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pager-link.is-current {
      background: linear-gradient(135deg, var(--accent), #8effc8);
      color: #062334;
      border-color: transparent;
    }

    .pager-nav.is-disabled {
      opacity: 0.4;
    }

    .like-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      white-space: nowrap;
    }

    .like-button.is-liked {
      border-color: rgba(255, 216, 104, 0.32);
      background: rgba(255, 216, 104, 0.12);
      color: #fff2c8;
    }

    .heart {
      font-size: 1rem;
      line-height: 1;
    }

    .footer-note {
      margin-top: 20px;
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <h1>XR / AR / VR Daily Samples</h1>
      <p>
        各日付のカードから、その日の内容ページへ進める構成に変えています。
        サンプル単体ではなく、日ごとのまとまりを見やすくし、件数が増えたらページ送りで辿れるようにしています。
      </p>
      <p class="en-copy">
        Each card opens a page for that specific day. The site is organized around daily entries rather than only standalone samples, and it paginates automatically as the archive grows.
      </p>
      <div class="meta">
        <span>days: ${totalItems}</span>
        <span>page: ${currentPage} / ${totalPages}</span>
        <span>storage: localStorage likes</span>
      </div>
    </section>

    ${renderPagination(currentPage, totalPages, basePath)}

    <section class="grid">
      ${cards}
    </section>

    ${renderPagination(currentPage, totalPages, basePath)}

    <p class="footer-note">
      補足: 現在の「好き」はブラウザごとのローカル保存です。全ユーザー共通のいいね数にしたい場合は、
      GitHub Pages 単体ではなく外部の保存先や API が必要です。
    </p>
  </main>

  <script>
    const storageKey = "xr-ar-vr-daily-samples-likes";
    const liked = JSON.parse(localStorage.getItem(storageKey) || "{}");

    function syncButtons() {
      document.querySelectorAll(".like-button").forEach((button) => {
        const slug = button.dataset.slug;
        const isLiked = Boolean(liked[slug]);
        button.classList.toggle("is-liked", isLiked);
        button.setAttribute("aria-pressed", String(isLiked));
        button.querySelector(".heart").textContent = isLiked ? "♥" : "♡";
        button.querySelector(".label").textContent = isLiked ? "好き済み / Liked" : "好き / Like";
      });
    }

    document.querySelectorAll(".like-button").forEach((button) => {
      button.addEventListener("click", () => {
        const slug = button.dataset.slug;
        liked[slug] = !liked[slug];
        localStorage.setItem(storageKey, JSON.stringify(liked));
        syncButtons();
      });
    });

    syncButtons();
  </script>
</body>
</html>`;
}

function renderDetailPage(day, allDays, pageNumberMap) {
  const currentIndex = allDays.findIndex((entry) => entry.date === day.date);
  const prevDay = currentIndex < allDays.length - 1 ? allDays[currentIndex + 1] : null;
  const nextDay = currentIndex > 0 ? allDays[currentIndex - 1] : null;
  const listHref = pageNumberMap.get(day.date) === 1 ? "../index.html" : `../pages/${pageNumberMap.get(day.date)}.html`;
  const primarySample = day.samples[0];
  const reportHeadline = day.report?.headline || primarySample.title;
  const reportHeadlineEn = day.report?.headlineEn || "";
  const reportSummary = day.report?.summary || primarySample.description;
  const reportSummaryEn = day.report?.summaryEn || "";
  const reportSections = `${renderKeyTopics(day.report)}${renderReportSections(day.report)}`;
  const extraLinks = [];

  if (day.report?.links?.length) {
    extraLinks.push(...day.report.links);
  }

  const sampleList = day.samples
    .map((sample) => {
      return `
        <article class="sample-item">
          <div class="sample-item-head">
            <div>
              <h3>${escapeHtml(sample.title)}</h3>
              <p>${escapeHtml(sample.description || "")}</p>
            </div>
            <a class="secondary-link" href="../outputs/${encodeURIComponent(sample.fileName)}">開く / Open</a>
          </div>
        </article>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(reportHeadline)} | ${escapeHtml(day.date)}</title>
  <style>
    :root {
      --bg0: #07111a;
      --bg1: #102338;
      --panel: rgba(9, 20, 31, 0.84);
      --panel-2: rgba(255, 255, 255, 0.04);
      --line: rgba(126, 228, 255, 0.12);
      --text: #ebf8ff;
      --muted: #9ab6c8;
      --accent: #7ce4ff;
      --accent2: #ffd868;
      --shadow: rgba(0, 0, 0, 0.32);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Avenir Next", "Hiragino Sans", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 16% 18%, rgba(124, 228, 255, 0.16), transparent 24%),
        radial-gradient(circle at 84% 10%, rgba(255, 216, 104, 0.12), transparent 20%),
        linear-gradient(180deg, var(--bg1), var(--bg0));
    }

    .shell {
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 20px 48px;
    }

    .hero,
    .detail-block,
    .preview,
    .day-nav {
      border-radius: 24px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: 0 18px 42px var(--shadow);
      backdrop-filter: blur(14px);
    }

    .hero {
      padding: 28px;
    }

    .hero h1 {
      margin: 0 0 10px;
      font-size: clamp(1.8rem, 4vw, 3rem);
      line-height: 1.15;
    }

    .hero p,
    .detail-block p,
    .detail-block li {
      color: var(--muted);
      line-height: 1.7;
    }

    .en-copy,
    .heading-pair-secondary,
    .hero-subtitle {
      color: var(--muted);
      line-height: 1.7;
    }

    .heading-pair {
      display: grid;
      gap: 4px;
    }

    .hero-subtitle {
      margin: 0 0 12px;
      font-size: 1rem;
    }

    .date {
      margin: 0 0 10px;
      color: var(--accent2);
      font-size: 0.9rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .actions,
    .day-nav {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .actions {
      margin-top: 18px;
    }

    .primary,
    .secondary-link,
    .day-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 14px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
    }

    .primary {
      background: linear-gradient(135deg, var(--accent), #8effc8);
      color: #062334;
    }

    .secondary-link,
    .day-link {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .day-nav {
      justify-content: space-between;
      margin-top: 18px;
      padding: 18px;
    }

    .content {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 18px;
      margin-top: 22px;
    }

    .stack {
      display: grid;
      gap: 18px;
    }

    .detail-block {
      padding: 22px;
    }

    .detail-block h2 {
      margin: 0 0 12px;
      font-size: 1.05rem;
    }

    .link-list {
      display: grid;
      gap: 8px;
      padding-left: 18px;
      margin: 12px 0 0;
    }

    .link-list a {
      color: var(--accent);
    }

    .topic-list {
      display: grid;
      gap: 12px;
      padding-left: 22px;
      margin: 12px 0 0;
    }

    .topic-list li span {
      display: block;
    }

    .sample-list {
      display: grid;
      gap: 12px;
    }

    .sample-item {
      padding: 16px;
      border-radius: 18px;
      background: var(--panel-2);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .sample-item-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .sample-item h3 {
      margin: 0 0 8px;
      font-size: 1rem;
    }

    .sample-item p {
      margin: 0;
    }

    .preview {
      padding: 18px;
      position: sticky;
      top: 20px;
      height: fit-content;
    }

    .preview h2 {
      margin: 0 0 12px;
      font-size: 1.05rem;
    }

    iframe {
      width: 100%;
      height: 520px;
      border: 0;
      border-radius: 16px;
      background: rgba(0, 0, 0, 0.25);
    }

    @media (max-width: 960px) {
      .content {
        grid-template-columns: 1fr;
      }

      .preview {
        position: static;
      }

      iframe {
        height: 420px;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <p class="date">${escapeHtml(formatDateLabel(day.date))}</p>
      <h1>${escapeHtml(reportHeadline)}</h1>
      ${reportHeadlineEn ? `<p class="hero-subtitle">${escapeHtml(reportHeadlineEn)}</p>` : ""}
      <p>${escapeHtml(reportSummary)}</p>
      ${reportSummaryEn ? `<p class="en-copy">${escapeHtml(reportSummaryEn)}</p>` : ""}
      <div class="actions">
        <a class="primary" href="../outputs/${encodeURIComponent(primarySample.fileName)}">代表サンプルを開く / Open sample</a>
        <a class="secondary-link" href="${listHref}">一覧へ戻る / Back to archive</a>
      </div>
    </section>

    <nav class="day-nav" aria-label="日付移動">
      ${
        prevDay
          ? `<a class="day-link" href="../days/${escapeHtml(prevDay.date)}.html">← ${escapeHtml(formatDateLabel(prevDay.date))}</a>`
          : `<span class="day-link">最初の日 / First day</span>`
      }
      ${
        nextDay
          ? `<a class="day-link" href="../days/${escapeHtml(nextDay.date)}.html">${escapeHtml(formatDateLabel(nextDay.date))} →</a>`
          : `<span class="day-link">最新日 / Latest</span>`
      }
    </nav>

    <section class="content">
      <div class="stack">
        <section class="detail-block">
          <h2>${renderBilingual("この日のサンプル", "Samples for this day", "span", "span", "heading-pair")}</h2>
          <div class="sample-list">
            ${sampleList}
          </div>
        </section>
        ${reportSections}
        ${
          extraLinks.length
            ? `
              <section class="detail-block">
                <h2>${renderBilingual("参考リンク", "Reference links", "span", "span", "heading-pair")}</h2>
                ${renderLinks(extraLinks)}
              </section>
            `
            : ""
        }
      </div>

      <aside class="preview">
        <h2>${renderBilingual("サンプルプレビュー", "Sample preview", "span", "span", "heading-pair")}</h2>
        <iframe src="../outputs/${encodeURIComponent(primarySample.fileName)}" loading="lazy" title="${escapeHtml(primarySample.title)}"></iframe>
      </aside>
    </section>
  </main>
</body>
</html>`;
}

async function loadReports() {
  try {
    const files = (await fs.readdir(reportsDir))
      .filter((file) => file.endsWith(".json"))
      .sort();

    const map = new Map();
    for (const file of files) {
      const fullPath = path.join(reportsDir, file);
      const parsed = JSON.parse(await fs.readFile(fullPath, "utf8"));
      if (parsed?.date) map.set(parsed.date, parsed);
    }
    return map;
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

async function ensureCleanDir(targetDir) {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
}

async function main() {
  const reportMap = await loadReports();
  const files = (await fs.readdir(outputDir))
    .filter((file) => file.endsWith(".html"))
    .sort()
    .reverse();

  const items = [];
  for (const fileName of files) {
    const fullPath = path.join(outputDir, fileName);
    const html = await fs.readFile(fullPath, "utf8");
    const date = fileName.match(/^(\d{4}-\d{2}-\d{2})_/)?.[1] || fileName;
    const report = reportMap.get(date) || null;
    const title = parseTitle(html, fileName);
    const description = parseDescription(html);
    items.push({
      slug: fileName.replace(/\.html$/, ""),
      fileName,
      title,
      description,
      date,
      report,
      tags: deriveTags(fileName, title, description, report)
    });
  }

  const dayMap = new Map();
  for (const item of items) {
    const existing = dayMap.get(item.date);
    if (existing) {
      existing.samples.push(item);
      existing.tags = Array.from(new Set([...existing.tags, ...item.tags]));
      if (!existing.report && item.report) existing.report = item.report;
    } else {
      dayMap.set(item.date, {
        date: item.date,
        report: item.report,
        samples: [item],
        tags: [...item.tags]
      });
    }
  }

  const days = Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));

  const totalPages = Math.max(1, Math.ceil(days.length / pageSize));
  const pageNumberMap = new Map();

  for (let page = 1; page <= totalPages; page += 1) {
    const pageDays = days.slice((page - 1) * pageSize, page * pageSize);
    for (const day of pageDays) pageNumberMap.set(day.date, page);
  }

  await ensureCleanDir(pagesDir);
  await ensureCleanDir(daysDir);

  await fs.writeFile(indexPath, renderListPage(days.slice(0, pageSize), 1, totalPages, "", days.length), "utf8");

  for (let page = 2; page <= totalPages; page += 1) {
    const pageItems = days.slice((page - 1) * pageSize, page * pageSize);
    const pagePath = path.join(pagesDir, `${page}.html`);
    await fs.writeFile(pagePath, renderListPage(pageItems, page, totalPages, "../", days.length), "utf8");
  }

  for (const day of days) {
    const dayPath = path.join(daysDir, `${day.date}.html`);
    await fs.writeFile(dayPath, renderDetailPage(day, days, pageNumberMap), "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
