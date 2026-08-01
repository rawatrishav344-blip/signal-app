const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ⚠️ CONFIG — bot ke backend URL se replace karna (Termux mein jab bot chalega,
// cloudflared tunnel se ek public URL milega, wahi yahan daalna)
const API_BASE = "https://reynolds-toll-jesse-totals.trycloudflare.com";

const user = tg.initDataUnsafe?.user;
const initData = tg.initData;

let contentData = [];
let tasksData = [];
let darkData = [];
let darkUnlocked = false;

// ---------- INIT ----------
async function init() {
  if (!user) {
    return; // Telegram ke bahar khula hai, kuch nahi hoga
  }

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

// ---------- CONTENT ----------
function getFlagEmoji(region) {
  const flags = {
    indian: "🇮🇳",
    india: "🇮🇳",
    global: "🌐",
    usa: "🇺🇸",
    us: "🇺🇸",
    korean: "🇰🇷",
    japanese: "🇯🇵",
  };
  return flags[region.toLowerCase()] || "🏳️";
}
async function loadContent() {
  try {
    const res = await fetch(`${API_BASE}/api/content`);
    contentData = await res.json();
    renderContent("all");
  } catch (err) {
    console.error(err);
  }
}

let activeBand = "all";

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
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-thumb" style="background-image:url('${item.thumbnail}')">
        <div class="card-tags">
          <span class="tag">Ep ${item.episode}</span>
          ${item.duration ? `<span class="tag">${item.duration}</span>` : ""}
          ${item.region ? `<span class="tag flag">${getFlagEmoji(item.region)} ${item.region}</span>` : ""}
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-watch" data-deeplink="${item.deeplink}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Watch Now
        </button>
        <button class="btn-icon share-btn" data-title="${item.title}">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 6l-4-4-4 4M12 2v14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  document.querySelectorAll(".btn-watch").forEach((btn) => {
    btn.onclick = () => tg.openTelegramLink(btn.dataset.deeplink);
  });
  document.querySelectorAll(".share-btn").forEach((btn) => {
    btn.onclick = () => {
      tg.switchInlineQuery ? tg.switchInlineQuery(btn.dataset.title) : null;
    };
  });
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

// ---------- TASKS (channel list) ----------
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

  document.getElementById("darkBtn").onclick = () => {
    if (darkUnlocked) {
      openDarkPage();
      return;
    }
    errorEl.classList.add("hidden");
    input.value = "";
    modal.classList.remove("hidden");
  };

  document.getElementById("darkModalCancel").onclick = () => {
    modal.classList.add("hidden");
  };

  document.getElementById("darkModalSubmit").onclick = async () => {
    const code = input.value.trim();
    if (!code) return;

    try {
      const res = await fetch(`${API_BASE}/api/verify-dark-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, initData }),
      });
      const data = await res.json();

      if (data.valid) {
        darkUnlocked = true;
        modal.classList.add("hidden");
        loadDarkContent();
        openDarkPage();
      } else {
        errorEl.classList.remove("hidden");
      }
    } catch (err) {
      errorEl.textContent = "Connection error. Try again.";
      errorEl.classList.remove("hidden");
    }
  };
}

function openDarkPage() {
  const tabs = document.querySelectorAll(".tab");
  const pages = [
    document.getElementById("mainApp"),
    document.getElementById("profilePage"),
    document.getElementById("tasksPage"),
    document.getElementById("darkPage"),
  ];
  tabs.forEach((t) => t.classList.remove("active"));
  pages.forEach((p) => p.classList.add("hidden"));
  document.getElementById("darkPage").classList.remove("hidden");
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
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-thumb" style="background-image:url('${item.thumbnail}')">
        <div class="card-tags">
          <span class="tag">Ep ${item.episode}</span>
          ${item.duration ? `<span class="tag">${item.duration}</span>` : ""}
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-watch dark-watch" data-deeplink="${item.deeplink}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Watch Now
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  document.querySelectorAll(".dark-watch").forEach((btn) => {
    btn.onclick = () => tg.openTelegramLink(btn.dataset.deeplink);
  });
}

// ---------- NAV ----------
function bindNav() {
  const tabs = document.querySelectorAll(".tab");
  const home = document.getElementById("mainApp");
  const profile = document.getElementById("profilePage");
  const tasks = document.getElementById("tasksPage");
  const dark = document.getElementById("darkPage");

  tabs.forEach((tab) => {
    tab.onclick = () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      [home, profile, tasks, dark].forEach((p) => p.classList.add("hidden"));

      const page = tab.dataset.page;
      if (page === "home") home.classList.remove("hidden");
      if (page === "profile") profile.classList.remove("hidden");
      if (page === "tasks") tasks.classList.remove("hidden");
    };
  });
}

init();
                    
