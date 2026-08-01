const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ⚠️ CONFIG — Termux tunnel URL yahan daalo, har restart par badalta hai
const API_BASE = "https://drops-shame-sea-substantial.trycloudflare.com";

const user = tg.initDataUnsafe?.user;
const initData = tg.initData;

let contentData = [];
let tasksData = [];
let darkData = [];
let darkUnlocked = false;
let activeBand = "all";
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
  return flags[region.toLowerCase()] || ""; // pehchana na jaye to koi flag nahi, sirf text
}

// ---------- CONTENT ----------
async function loadContent() {
  try {
    const res = await fetch(`${API_BASE}/api/content`);
    contentData = await res.json();
    renderContent();
  } catch (err) {
    console.error(err);
  }
}

function renderContent(band) {
  if (band) activeBand = band;
  const grid = document.getElementById("contentGrid");
  const empty = document.getElementById("emptyState");
  const searchTerm = (document.getElementById("searchInput").value || "").trim().toLowerCase();

  let filtered = activeBand === "all" ? contentData : contentData.filter((c) => c.band === activeBand);
  if (searchTerm) {
    filtered = filtered.filter((c) => c.title.toLowerCase().includes(searchTerm));
  }

  grid.innerHTML = "";
  if (filtered.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  filtered.forEach((item) => {
    grid.appendChild(buildContentCard(item, false));
  });

  document.querySelectorAll(".btn-watch[data-scope='content']").forEach((btn) => {
    btn.onclick = () => tg.openTelegramLink(btn.dataset.deeplink);
  });
  document.querySelectorAll(".share-btn").forEach((btn) => {
    btn.onclick = () => shareContent(btn.dataset.title, btn.dataset.link);
  });
}

function buildContentCard(item, isDark) {
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
      <button class="btn-watch" data-scope="${isDark ? "dark" : "content"}" data-deeplink="${item.deeplink}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Watch Now
      </button>
      ${
        isDark
          ? ""
          : `<button class="btn-icon share-btn" data-title="${item.title}" data-link="${item.deeplink}">
        <svg viewBox="0 0 24 24" fill="none"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 6l-4-4-4 4M12 2v14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`
      }
    </div>
  `;
  return card;
}

function shareContent(title, link) {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title)}`;
  tg.openTelegramLink(shareUrl);
}

document.getElementById("bandSelect").addEventListener("click", (e) => {
  if (!e.target.classList.contains("band")) return;
  document.querySelectorAll(".band").forEach((b) => b.classList.remove("active"));
  e.target.classList.add("active");
  renderContent(e.target.dataset.band);
});

function bindSearch() {
  document.getElementById("searchInput").addEventListener("input", () => renderContent());
}

// ---------- TASKS (channels list) ----------
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
  const list = document.getElementById("tasksList");
  list.innerHTML = "";
  tasksData.forEach((ch) => {
    const item = document.createElement("div");
    item.className = "task-item";
    item.innerHTML = `
      <div class="task-avatar">${(ch.name[0] || "?").toUpperCase()}</div>
      <div class="task-info">
        <div class="task-name">${ch.name}</div>
        <div class="task-sub">${ch.subtitle || "Channel"}</div>
      </div>
      <div class="task-arrow">›</div>
    `;
    item.onclick = () => tg.openTelegramLink(ch.link);
    list.appendChild(item);
  });
}

// ---------- DARK (exclusive content) ----------
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

  cancelBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

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

  grid.innerHTML = "";
  if (darkData.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  darkData.forEach((item) => {
    grid.appendChild(buildContentCard(item, true));
  });

  document.querySelectorAll(".btn-watch[data-scope='dark']").forEach((btn) => {
    btn.onclick = () => tg.openTelegramLink(btn.dataset.deeplink);
  });
}

// ---------- NAV + SMART REFRESH ----------
// Home par ruke rehte waqt refresh nahi hota (scroll disturb na ho).
// Jab user kisi doosre tab pe jaake wapas Home aata hai, tabhi naya content check hota hai.
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
  
