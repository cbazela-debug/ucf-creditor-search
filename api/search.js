// api/search.js
// Vercel serverless function — proxies requests to ucf.uscourts.gov

const https = require("https");
const { parse } = require("url");

const UCF_HOST = "ucf.uscourts.gov";

function fetchUCF(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: UCF_HOST,
      path,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://ucf.uscourts.gov/",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end();
  });
}

function parseAmount(str) {
  const n = parseFloat((str || "0").replace(/[^0-9.]/g, "") || "0");
  return isNaN(n) ? 0 : n;
}

function parseResults(html, searchedName, minAmount) {
  const results = [];

  // Extract total count
  const countMatch = html.match(/Creditors\s*\|\s*(\d+)/);
  const totalCount = countMatch ? parseInt(countMatch[1]) : 0;

  // Extract last page number from pagination links
  let lastPage = 1;
  const pageMatches = [...html.matchAll(/page=(\d+)/g)];
  for (const m of pageMatches) {
    const p = parseInt(m[1]);
    if (p > lastPage) lastPage = p;
  }

  // Parse table rows — find all <tr> blocks inside tbody
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return { results, totalCount, lastPage };

  const rowMatches = [
    ...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi),
  ];

  for (const rowMatch of rowMatches) {
    const row = rowMatch[1];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim()
    );

    if (cells.length < 5) continue;

    const court = cells[1] || "";
    const caseNum = cells[2] || "";
    const creditor = cells[3] || "";
    const debtor = cells[4] || "";
    const amount = parseAmount(cells[5]);

    if (!creditor || !court) continue;
    if (amount < minAmount) continue;

    // Extract case link href
    const hrefMatch = row.match(/href="([^"]*\/search\?[^"]*)"/);
    const caseHref = hrefMatch
      ? "https://ucf.uscourts.gov" + hrefMatch[1].replace(/&amp;/g, "&")
      : "";

    results.push({
      searchedName,
      court,
      caseNum,
      caseHref,
      creditor,
      debtor,
      amount,
    });
  }

  return { results, totalCount, lastPage };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = async function handler(req, res) {
  // CORS headers so the frontend can call this from any origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { query } = parse(req.url, true);
  const name = (query.name || "").trim();
  const court = (query.court || "").trim();
  const minAmount = parseFloat(query.min_amount || "0") || 0;
  const allPages = query.all_pages === "true";
  const fastMode = query.fast_mode === "true";

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!fastMode && !court) {
    return res.status(400).json({ error: "court is required unless fast_mode=true" });
  }

  try {
    const encodedName = encodeURIComponent(" " + name);
    // Fast mode: omit SelectedCourts entirely — UCF searches all 87 courts at once
    const courtParam = fastMode ? "" : `&SelectedCourts=${court}`;
    const page1Path = `/search?CreditorName=${encodedName}${courtParam}&page=1&sort=Amount&sortdir=DESC`;

    const { status, body } = await fetchUCF(page1Path);
    if (status !== 200) {
      return res
        .status(502)
        .json({ error: `UCF returned HTTP ${status}` });
    }

    const { results, totalCount, lastPage } = parseResults(
      body,
      name,
      minAmount
    );

    // Optionally fetch additional pages
    if (allPages && lastPage > 1) {
      for (let p = 2; p <= Math.min(lastPage, 20); p++) {
        await sleep(150);
        const pagePath = `/search?CreditorName=${encodedName}${courtParam}&page=${p}&sort=Amount&sortdir=DESC`;
        try {
          const { body: pageBody } = await fetchUCF(pagePath);
          const { results: more } = parseResults(pageBody, name, minAmount);
          results.push(...more);
        } catch {
          break;
        }
      }
    }

    return res.status(200).json({
      results,
      totalCount,
      pages: lastPage,
      fetched: results.length,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
