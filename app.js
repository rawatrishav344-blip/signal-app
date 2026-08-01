const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ⚠️ CONFIG — bot ke backend URL se replace karna (Termux mein jab bot chalega,
// ngrok / cloudflared tunnel se ek public URL milega, wahi yahan daalna)
const API_BASE = "https://YOUR-TERMUX-TUNNEL-URL.trycloudflare.com";

const user = tg.initDataUnsafe?.user;
const initData = tg.initData;

let contentData = [];
let tasksData = [];

// ---------- INIT ----------
async function init() {
  animateFreq();

  if (!user) {
    document.getElementById("lockNote").textContent = "Telegram ke andar hi kholo yeh app.";
    return;
  }

  fillProfile();
  await checkAccess();
  bindNav();
}

function animateFreq() {
  const el = document.getElementById("freq");
  setInterval(() => {
    el.textContent = (Math.random() * 999).toFixed(1) + " MHz";
  }, 2500);
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

// ---------- ACCESS CHECK ----------
async function checkAccess() {
  try {
    const res = await fetch(`${API_BASE}/api/check-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    const data = await res.json();

    if (data.unlocked) {
      showMainApp();
    } else {
      showLockScreen(data.channelLink);
    }
  } catch (err) {
    document.getElementById("lockNote").textContent = "Connection error. Backend chal raha hai?";
  }
}

function showLockScreen(channelLink) {
  document.getElementById("joinBtn").href = channelLink || "#";
  document.getElementById("verifyBtn").onclick = async () => {
    document.getElementById("lockNote").textContent = "Checking...";
    await checkAccess();
  };
}

function showMainApp() {
  document.getElementById("lockScreen").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  document.getElementById("profileStatus").textContent = "Verified";
  loadContent();
  loadTasks();
}

// ---------- CONTENT ----------
async function loadContent() {
  try {
    const res = await fetch(`${API_BASE}/api/content`);
    contentData = await res.json();
    renderContent("all");
  } catch (err) {
    console.error(err);
  }
}

function renderContent(band) {
  const grid = document.getElementById("contentGrid");
  const empty = document.getElementById("emptyState");
  const filtered = band === "all" ? contentData : contentData.filter((c) => c.band === band);

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
          ${item.isNew ? '<span class="tag live">NEW</span>' : ""}
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${item.title}</div>
        <div class="card-actions">
          <button class="btn-watch" data-deeplink="${item.deeplink}">▸ Watch Now</button>
          <button class="btn-icon share-btn" data-title="${item.title}" data-link="${item.shareLink || ''}">↑</button>
        </div>
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
      <div class="task-dot"></div>
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

// ---------- NAV ----------
function bindNav() {
  const tabs = document.querySelectorAll(".tab");
  const home = document.getElementById("mainApp");
  const lock = document.getElementById("lockScreen");
  const profile = document.getElementById("profilePage");
  const tasks = document.getElementById("tasksPage");

  tabs.forEach((tab) => {
    tab.onclick = () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      [home, profile, tasks].forEach((p) => p.classList.add("hidden"));

      const page = tab.dataset.page;
      if (page === "home") home.classList.remove("hidden");
      if (page === "profile") profile.classList.remove("hidden");
      if (page === "tasks") tasks.classList.remove("hidden");
    };
  });
}

init();
