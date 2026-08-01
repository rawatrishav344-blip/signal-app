const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ⚠️ CONFIG — Termux tunnel URL yahan daalo, har restart par badalta hai
const API_BASE = "https://YOUR-TERMUX-TUNNEL-URL.trycloudflare.com";

const user = tg.initDataUnsafe?.user;
const initData = tg.initData;

let contentData = [];
let tasksData = [];
let darkData = [];
let darkUnlocked = false;
let activeBand = "all";
let darkActiveBand = "all";
let currentPage = "home";

// ---------- INIT ----------
async function init() {
  if (!user) return;

  fillProfile();
  document.getElementById("profileStatus").textContent = "Verified";
  loadContent();
  loadTasks();
  bindNav();
  bindSearch();
  bindDarkModal();
}

// ---------- PROFILE ----------
function fillProfile() {
  const nameEl = document.getElementById("profileName");
  const userEl = document.getElementById("profileUsername");
  const idEl = document.getElementById("profileId");
  const avatarEl = document.getElementById("profileAvatar");

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  nameEl.textContent = fullName || "Unknown";
  userEl.textContent = user.username ? "@" + user.username : "no username";
  idEl.textContent = user.id;

  if (user.photo_url) {
    avatarEl.style.backgroundImage = `url(${user.photo_url})`;
    avatarEl.textContent = "";
  } else {
    avatarEl.textContent = (fullName[0] || "?").toUpperCase();
  }
}

// ---------- FLAGS ----------
function getFlagEmoji(region) {
  const flags = {
    indian: "🇮🇳",
    india: "🇮🇳",
    global: "🌐",
    usa: "🇺🇸",
    us: "🇺🇸",
    korean: "🇰🇷",
    japanese: "🇯🇵",
    pakistan: "🇵🇰",
    pakistani: "🇵🇰",
    iran: "🇮🇷",
    iranian: "🇮🇷",
  };
  return flags[region.toLowerCase()] || "";
}

// ---------- HOME CONTENT (unchanged design) ----------
async function loadContent() {
  try {
    const res = await fetch(`${API_BASE}/api/content`);
    contentData = await res.json();
    renderContent();
  } catch (err) {
    console.error(err);
  }
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function renderContent(band) {
  if (band) activeBand = band;
  const grid = document.getElementById("contentGrid");
  const empty = document.getElementById("emptyState");
  const searchTerm = (document.getElementById("searchInput").value || "").trim().toLowerCase();

  let filtered = contentData;
  if (activeBand === "new") {
    filtered = filtered.filter((c) => c.uploadDate === todayString());
  } else if (activeBand === "trending") {
    filtered = filtered.filter((c) => c.band === "trending");
  }
  if (searchTerm) {
    filtered = filtered.filter(
      (c) => c.title.toLowerCase().includes(searchTerm) || String(c.episode).toLowerCase().includes(searchTerm)
    );
  }

  grid.innerHTML = "";
  if (filtered.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  filtered.forEach((item) => grid.appendChild(buildContentCard(item, "content")));

  document.querySelectorAll("#contentGrid .btn-watch").forEach((btn) => {
    btn.onclick = () => tg.openTelegramLink(btn.dataset.deeplink);
  });
}

function buildContentCard(item, scope) {
  const flag = item.region ? getFlagEmoji(item.region) : "";
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-thumb" style="background-image:url('${item.thumbnail}')">
      <div class="card-title-overlay">${item.title}</div>
      <div class="card-tags">
        <span class="tag">Episode ${item.episode}</span>
        ${item.duration ? `<span class="tag">${item.duration}</span>` : ""}
        ${item.region ? `<span class="tag flag">${flag ? flag + " " : ""}${item.region}</span>` : ""}
      </div>
    </div>
    <div class="card-actions">
      <button class="btn-watch" data-scope="${scope}" data-deeplink="${item.deeplink}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Watch Now
      </button>
    </div>
  `;
  return card;
}

document.getElementById("bandSelect").addEventListener("click", (e) => {
  if (!e.target.classList.contains("band")) return;
  document.querySelectorAll("#bandSelect .band").forEach((b) => b.classList.remove("active"));
  e.target.classList.add("active");
  renderContent(e.target.dataset.band);
});

function bindSearch() {
  document.getElementById("searchInput").addEventListener("input", () => renderContent());
  document.getElementById("darkSearchInput").addEventListener("input", () => renderDarkContent());
}

// ---------- CHANNELS (Earning Channels grid) ----------
async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/api/channels`);
    tasksData = await res.json();
    renderTasks();
  } catch (err) {
    console.error(err);
  }
}

function renderTasks() {
  const grid = document.getElementById("tasksList");
  const empty = document.getElementById("tasksEmptyState");
  grid.innerHTML = "";

  if (tasksData.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  tasksData.forEach((ch) => {
    const box = document.createElement("div");
    box.className = "channel-box";
    if (ch.photo) {
      box.style.backgroundImage = `url('${ch.photo}')`;
    }
    box.innerHTML = `<div class="channel-box-name">${ch.name}</div>`;
    box.onclick = () => tg.openTelegramLink(ch.link);
    grid.appendChild(box);
  });
}

// ---------- DARK (exclusive content) — Home jaisa layout ----------
function bindDarkModal() {
  const modal = document.getElementById("darkModal");
  const input = document.getElementById("darkCodeInput");
  const errorEl = document.getElementById("darkModalError");
  const submitBtn = document.getElementById("darkModalSubmit");
  const cancelBtn = document.getElementById("darkModalCancel");
  const darkBtn = document.getElementById("darkBtn");

  darkBtn.addEventListener("click", () => {
    if (darkUnlocked) {
      openDarkPage();
      return;
    }
    errorEl.classList.add("hidden");
    input.value = "";
    modal.classList.remove("hidden");
  });

  cancelBtn.addEventListener("click", () => modal.classList.add("hidden"));
  submitBtn.addEventListener("click", handleDarkSubmit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleDarkSubmit();
  });

  async function handleDarkSubmit() {
    const code = input.value.trim();
    if (!code) return;

    submitBtn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/verify-dark-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, initData }),
      });
      const data = await res.json();

      if (data.valid) {
        darkUnlocked = true;
        errorEl.classList.add("hidden");
        modal.classList.add("hidden");
        await loadDarkContent();
        openDarkPage();
      } else {
        errorEl.textContent = "Galat code, dobara try karo.";
        errorEl.classList.remove("hidden");
      }
    } catch (err) {
      errorEl.textContent = "Connection error. Backend chal raha hai?";
      errorEl.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
    }
  }

  document.getElementById("darkBandSelect").addEventListener("click", (e) => {
    if (!e.target.classList.contains("band")) return;
    document.querySelectorAll("#darkBandSelect .band").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    darkActiveBand = e.target.dataset.band;
    renderDarkContent();
  });
}

function openDarkPage() {
  setActivePage("dark");
}

async function loadDarkContent() {
  try {
    const res = await fetch(`${API_BASE}/api/dark-content`);
    darkData = await res.json();
    renderDarkContent();
  } catch (err) {
    console.error(err);
  }
}

function renderDarkContent() {
  const grid = document.getElementById("darkGrid");
  const empty = document.getElementById("darkEmptyState");
  const searchTerm = (document.getElementById("darkSearchInput").value || "").trim().toLowerCase();

  // "dark" category matlab sab kuch (yeh page hi exclusive hai), baaki (today/indian/world)
  // normal date/region ki tarah filter karte hain
  let filtered = darkData;
  if (darkActiveBand !== "all" && darkActiveBand !== "dark") {
    filtered = filtered.filter((c) => {
      if (darkActiveBand === "today") return c.uploadDate === todayString();
      if (darkActiveBand === "indian") return (c.region || "").toLowerCase() === "indian";
      if (darkActiveBand === "world") return c.region && c.region.toLowerCase() !== "indian";
      return true;
    });
  }
  if (searchTerm) {
    filtered = filtered.filter(
      (c) => c.title.toLowerCase().includes(searchTerm) || String(c.episode).toLowerCase().includes(searchTerm)
    );
  }

  grid.innerHTML = "";
  if (filtered.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  filtered.forEach((item) => grid.appendChild(buildContentCard(item, "dark")));

  document.querySelectorAll("#darkGrid .btn-watch").forEach((btn) => {
    btn.onclick = () => tg.openTelegramLink(btn.dataset.deeplink);
  });
}

// ---------- NAV + SMART REFRESH ----------
function setActivePage(pageKey) {
  const tabs = document.querySelectorAll(".tab");
  const pageEls = {
    home: document.getElementById("mainApp"),
    profile: document.getElementById("profilePage"),
    tasks: document.getElementById("tasksPage"),
    dark: document.getElementById("darkPage"),
  };

  tabs.forEach((t) => t.classList.remove("active"));
  Object.values(pageEls).forEach((p) => p.classList.add("hidden"));

  const matchingTab = document.querySelector(`.tab[data-page="${pageKey}"]`);
  if (matchingTab) matchingTab.classList.add("active");
  if (pageEls[pageKey]) pageEls[pageKey].classList.remove("hidden");

  const cameBackToHome = pageKey === "home" && currentPage !== "home";
  currentPage = pageKey;

  if (cameBackToHome) {
    loadContent();
    loadTasks();
  }
}

function bindNav() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setActivePage(tab.dataset.page));
  });
}

init();
  
