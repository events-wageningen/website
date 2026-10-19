#!/usr/bin/env node

/**
 * Import music events from uitinwageningen.nl/agenda/muziek/ into Supabase.
 * - Extracts security nonce from the page
 * - Fetches all music events via WordPress admin-ajax get_events_calendar
 * - Maps metadata to Supabase 'events' schema
 * - Detects and skips duplicate events
 * - Downloads event photos to public/images/{id}.jpg
 * - Upserts new events into Supabase
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(REPO_ROOT, "public", "images");

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Helper to load .env variables if not provided in environment
function loadEnvFile(envPath, override = false) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (override || !process.env[key]) {
      process.env[key] = val;
    }
  }
}

// Try loading local .env or tbot/.env if running locally
loadEnvFile(path.join(REPO_ROOT, ".env"));
loadEnvFile(path.join(REPO_ROOT, "tbot", ".env"), true);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided in environment."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Dutch month abbreviation map for multi-day parsing
const DUTCH_MONTHS = {
  jan: "01",
  feb: "02",
  mrt: "03",
  apr: "04",
  mei: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  okt: "10",
  nov: "11",
  dec: "12",
};

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#038;/g, "&")
    .replace(/&hellip;/g, "…")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html) {
  if (!html) return "";
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Convert event title and year into URL-safe event ID */
function toEventId(name, year) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    year
  );
}

/** Normalize URL for duplicate matching */
function normalizeUrl(url) {
  if (!url) return "";
  return url.trim().toLowerCase().replace(/\/$/, "");
}

/** Normalize name string for fuzzy matching */
function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Format two-digit number */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Download image and save to disk */
async function downloadImage(imageUrl, targetPath) {
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Events Wageningen Bot)" },
    });
    if (!res.ok) {
      console.warn(`  ⚠️ Failed to download image from ${imageUrl}: HTTP ${res.status}`);
      return false;
    }
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
    return true;
  } catch (err) {
    console.warn(`  ⚠️ Image download error (${imageUrl}): ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("🎵 Starting UIT in Wageningen music events importer...");

  // 1. Check if DB constraint accepts 'unknown' price
  let supportsUnknownPrice = true;
  const probeId = "probe-price-test-" + Date.now();
  const probeTest = await supabase.from("events").insert({
    id: probeId,
    name: "Probe Test",
    slug: probeId,
    start_date: "2099-01-01T12:00:00",
    end_date: "2099-01-01T14:00:00",
    price: "unknown",
  });
  if (probeTest.error) {
    supportsUnknownPrice = false;
    console.log(
      "ℹ️ Note: Supabase check constraint does not yet allow 'unknown' price. Fallback to 'paid' active until migration is run."
    );
  } else {
    // Clean up probe row
    await supabase.from("events").delete().eq("id", probeId);
    console.log("✅ Supabase supports 'unknown' price directly.");
  }

  // 2. Fetch preset locations from Supabase
  console.log("📍 Fetching location presets from Supabase...");
  const { data: locations, error: locErr } = await supabase
    .from("locations")
    .select("id, name, city, lat, lon");
  if (locErr) {
    console.warn("⚠️ Could not fetch locations from Supabase:", locErr.message);
  }
  const locationPresets = locations || [];
  console.log(`  Found ${locationPresets.length} location presets.`);

  // 3. Fetch existing events from Supabase to prevent duplicates
  console.log("📋 Fetching existing events from Supabase for duplicate prevention...");
  const { data: existingEvents, error: evErr } = await supabase
    .from("events")
    .select("id, name, start_date, url, location_name");
  if (evErr) {
    throw new Error(`Failed to fetch existing events: ${evErr.message}`);
  }
  console.log(`  Found ${existingEvents.length} existing events.`);

  const existingById = new Set(existingEvents.map((e) => e.id));
  const existingByUrl = new Map();
  const existingByNameDate = new Map();

  for (const e of existingEvents) {
    if (e.url) {
      existingByUrl.set(normalizeUrl(e.url), e);
    }
    const dateStr = (e.start_date || "").split("T")[0];
    const normName = normalizeName(e.name);
    if (normName && dateStr) {
      existingByNameDate.set(`${normName}_${dateStr}`, e);
    }
  }

  // 4. Fetch security nonce from uitinwageningen.nl/agenda/muziek/
  console.log("🌐 Fetching uitinwageningen.nl/agenda/muziek/ to get security nonce...");
  const pageRes = await fetch("https://uitinwageningen.nl/agenda/muziek/", {
    headers: { "User-Agent": "Mozilla/5.0 (Events Wageningen Importer)" },
  });
  if (!pageRes.ok) {
    throw new Error(`Failed to load page: HTTP ${pageRes.status}`);
  }
  const pageHtml = await pageRes.text();
  const nonceMatch = pageHtml.match(/data-nonce="([^"]+)"/);
  if (!nonceMatch) {
    throw new Error("Could not find data-nonce in page HTML");
  }
  const nonce = nonceMatch[1];
  console.log(`  Found nonce: ${nonce}`);

  // 5. Query events calendar AJAX endpoint
  console.log("📥 Fetching music events from WordPress calendar API...");
  const rawEvents = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const ajaxRes = await fetch("https://uitinwageningen.nl/wp-admin/admin-ajax.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Events Wageningen Importer)",
      },
      body: new URLSearchParams({
        action: "get_events_calendar",
        nonce: nonce,
        categories: "2", // 2 = Muziek
        catset: "true",
        timeframe: "all",
        page: String(page),
        per_page: "60",
      }),
    });

    if (!ajaxRes.ok) {
      throw new Error(`AJAX request failed: HTTP ${ajaxRes.status}`);
    }

    const json = await ajaxRes.json();
    if (!json.success || !json.data || !json.data.events) {
      console.warn("  No more events or unexpected response structure.");
      break;
    }

    let pageCount = 0;
    for (const monthKey of Object.keys(json.data.events)) {
      const monthData = json.data.events[monthKey];
      if (monthData && Array.isArray(monthData.events)) {
        rawEvents.push(...monthData.events);
        pageCount += monthData.events.length;
      }
    }

    hasMore = Boolean(json.data.has_more);
    console.log(`  Page ${page}: received ${pageCount} events (has_more: ${hasMore})`);
    page++;
    if (page > 10) break; // safety guard
  }

  console.log(`  Total raw music events fetched: ${rawEvents.length}`);

  // 6. Process and map events
  let insertedCount = 0;
  let skippedCount = 0;
  let downloadedImagesCount = 0;
  const batchSeenIds = new Set();

  for (const ev of rawEvents) {
    // Title
    const titleRawMatch = ev.title ? ev.title.match(/<h3[^>]*>(.*?)<\/h3>/i) : null;
    const title = stripHtml(titleRawMatch ? titleRawMatch[1] : ev.title);
    if (!title) continue;

    // Date
    const startDateYMD = ev.date; // YYYY-MM-DD
    if (!startDateYMD) continue;
    const year = parseInt(startDateYMD.split("-")[0]) || new Date().getFullYear();

    // Event URL
    const linkMatch = ev.content_link ? ev.content_link.match(/href="([^"]+)"/i) : null;
    const eventUrl = linkMatch ? linkMatch[1] : ev.permalink || "";
    const normUrl = normalizeUrl(eventUrl);

    // Duplicate Check
    let baseId = toEventId(title, year);
    const normTitle = normalizeName(title);
    const nameDateKey = `${normTitle}_${startDateYMD}`;

    let duplicateMatch = null;
    if (existingById.has(baseId)) {
      duplicateMatch = `ID "${baseId}"`;
    } else if (normUrl && existingByUrl.has(normUrl)) {
      duplicateMatch = `URL "${eventUrl}" (matches ${existingByUrl.get(normUrl).id})`;
    } else if (existingByNameDate.has(nameDateKey)) {
      duplicateMatch = `Name & Date "${title}" on ${startDateYMD}`;
    }

    if (duplicateMatch) {
      console.log(`⏩ [SKIP] "${title}" (${startDateYMD}) — already exists (${duplicateMatch})`);
      skippedCount++;
      continue;
    }

    // Ensure unique ID within current batch (e.g. multiple sessions on same day)
    let eventId = baseId;
    let counter = 2;
    while (batchSeenIds.has(eventId) || existingById.has(eventId)) {
      eventId = `${baseId}-${counter++}`;
    }
    batchSeenIds.add(eventId);

    // Location
    const locMatch = ev.content_details ? ev.content_details.match(/Locatie:<\/strong>\s*([^<]+)/i) : null;
    const locationName = locMatch ? stripHtml(locMatch[1]) : "Wageningen";

    // Match location with presets
    let matchedLocation = null;
    const locLower = locationName.toLowerCase();
    for (const preset of locationPresets) {
      const pName = preset.name.toLowerCase();
      if (locLower.includes(pName) || pName.includes(locLower)) {
        matchedLocation = preset;
        break;
      }
    }

    // Extra specific venue synonyms
    if (!matchedLocation) {
      if (locLower.includes("loburg")) {
        matchedLocation = locationPresets.find((p) => p.id === "loburg");
      } else if (locLower.includes("bblthk")) {
        matchedLocation = locationPresets.find((p) => p.id.includes("bblthk"));
      } else if (locLower.includes("junushoff")) {
        matchedLocation = locationPresets.find((p) => p.id === "theater-junushoff");
      } else if (locLower.includes("superette")) {
        matchedLocation = locationPresets.find((p) => p.id === "de-superette");
      } else if (locLower.includes("unitas")) {
        matchedLocation = locationPresets.find((p) => p.id === "unitas");
      }
    }

    const locationCity = matchedLocation?.city || "Wageningen";
    const lat = matchedLocation?.lat ?? null;
    const lon = matchedLocation?.lon ?? null;

    // Time parsing
    const timeMatch = ev.content_details ? ev.content_details.match(/Tijd:<\/strong>\s*([^<]+)/i) : null;
    let startTimeStr = "20:00:00";
    let endTimeStr = "22:30:00";
    let endDateYMD = startDateYMD;

    if (timeMatch) {
      const rawTime = stripHtml(timeMatch[1]).replace(/–/g, "-");
      const parts = rawTime.split("-").map((s) => s.trim());
      const t1Match = parts[0]?.match(/(\d{1,2}):(\d{2})/);
      if (t1Match) {
        const h = parseInt(t1Match[1]);
        const m = parseInt(t1Match[2]);
        startTimeStr = `${pad2(h)}:${pad2(m)}:00`;

        if (parts[1]) {
          const t2Match = parts[1].match(/(\d{1,2}):(\d{2})/);
          if (t2Match) {
            const h2 = parseInt(t2Match[1]);
            const m2 = parseInt(t2Match[2]);
            endTimeStr = `${pad2(h2)}:${pad2(m2)}:00`;
            // If end time hour is less than start time hour, event ends next morning
            if (h2 < h || (h2 === h && m2 < m)) {
              const nextDay = new Date(startDateYMD);
              nextDay.setDate(nextDay.getDate() + 1);
              endDateYMD = nextDay.toISOString().split("T")[0];
            }
          } else {
            const endH = (h + 3) % 24;
            endTimeStr = `${pad2(endH)}:${pad2(m)}:00`;
            if (endH < h) {
              const nextDay = new Date(startDateYMD);
              nextDay.setDate(nextDay.getDate() + 1);
              endDateYMD = nextDay.toISOString().split("T")[0];
            }
          }
        } else {
          // Default to +2.5 hours
          const endH = (h + 3) % 24;
          endTimeStr = `${pad2(endH)}:${pad2(m)}:00`;
          if (endH < h) {
            const nextDay = new Date(startDateYMD);
            nextDay.setDate(nextDay.getDate() + 1);
            endDateYMD = nextDay.toISOString().split("T")[0];
          }
        }
      }
    }

    // Multi-day handling
    if (ev.multiple_days === 1 && ev.date_display) {
      const endMatch = ev.date_display.match(
        /class="event-end"[\s\S]*?class="event-day-number">(\d+)<\/div>[\s\S]*?class="event-day-month">([^<]+)<\/div>/i
      );
      if (endMatch) {
        const endDay = parseInt(endMatch[1]);
        const endMonthStr = endMatch[2].toLowerCase().trim().slice(0, 3);
        const endMonth = DUTCH_MONTHS[endMonthStr];
        if (endMonth) {
          const startMonth = parseInt(startDateYMD.split("-")[1]);
          let endYear = year;
          if (parseInt(endMonth) < startMonth) {
            endYear = year + 1;
          }
          endDateYMD = `${endYear}-${endMonth}-${pad2(endDay)}`;
        }
      }
    }

    const startDate = `${startDateYMD}T${startTimeStr}`;
    const endDate = `${endDateYMD}T${endTimeStr}`;

    // Price parsing
    const priceMatch = ev.content_details ? ev.content_details.match(/Prijs:<\/strong>\s*([^<]+)/i) : null;
    let price = "unknown";
    if (priceMatch) {
      const pStr = priceMatch[1].toLowerCase();
      if (pStr.includes("gratis") || pStr.includes("free")) {
        price = "free";
      } else if (pStr.includes("donat") || pStr.includes("bijdrage")) {
        price = "donation";
      } else if (pStr.includes("€") || /\d/.test(pStr)) {
        price = "paid";
      }
    }

    // Fallback if DB doesn't yet support 'unknown'
    const dbPrice = price === "unknown" && !supportsUnknownPrice ? "paid" : price;

    // Categories
    const categories = ["music"];
    const catsStr = (ev.content_categories || "").toLowerCase();
    if (catsStr.includes("theater") && !categories.includes("art")) categories.push("art");
    if (catsStr.includes("expo") && !categories.includes("art")) categories.push("art");
    if (catsStr.includes("lezing") && !categories.includes("talks")) categories.push("talks");
    if (catsStr.includes("workshop") && !categories.includes("workshops")) categories.push("workshops");
    if (catsStr.includes("film") && !categories.includes("movies")) categories.push("movies");
    if (catsStr.includes("dans") && !categories.includes("dance")) categories.push("dance");

    // Tags
    const tags = ["uitinwageningen"];
    if (ev.content_tags) {
      const tagMatches = ev.content_tags.matchAll(/#([a-zA-Z0-9_\-]+)/g);
      for (const tm of tagMatches) {
        const t = tm[1].toLowerCase();
        if (!tags.includes(t)) tags.push(t);
      }
    }

    // Description
    const rawDesc = ev.full_content || ev.content || "";
    const description = stripHtml(rawDesc);

    // Image handling
    const imgMatch = ev.content_image ? ev.content_image.match(/src="([^"]+)"/i) : null;
    if (imgMatch) {
      const imgUrl = imgMatch[1];
      const targetImgPath = path.join(IMAGES_DIR, `${eventId}.jpg`);
      if (!fs.existsSync(targetImgPath)) {
        console.log(`  📷 Downloading image for ${eventId}...`);
        const downloaded = await downloadImage(imgUrl, targetImgPath);
        if (downloaded) downloadedImagesCount++;
      }
    }

    // Insert into Supabase
    console.log(`✨ [INSERT] "${title}" (${startDateYMD}) -> ID: ${eventId}`);
    const { error: insertErr } = await supabase.from("events").insert({
      id: eventId,
      name: title,
      slug: eventId,
      description,
      start_date: startDate,
      end_date: endDate,
      location_name: locationName,
      location_city: locationCity,
      category: categories,
      tags,
      url: eventUrl,
      price: dbPrice,
      status: "scheduled",
      lat,
      lon,
      creator_telegram_id: 50375278,
    });

    if (insertErr) {
      console.error(`  ❌ Database error inserting ${eventId}:`, insertErr.message);
    } else {
      insertedCount++;
      // Record in indices to prevent collision within subsequent items
      existingById.add(eventId);
      if (normUrl) existingByUrl.set(normUrl, { id: eventId });
      existingByNameDate.set(nameDateKey, { id: eventId });
    }
  }

  console.log("\n==========================================");
  console.log(`✅ Import finished!`);
  console.log(`   - New events inserted:    ${insertedCount}`);
  console.log(`   - Duplicates skipped:     ${skippedCount}`);
  console.log(`   - New images downloaded:  ${downloadedImagesCount}`);
  console.log("==========================================");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
