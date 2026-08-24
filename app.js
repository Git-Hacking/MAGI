/**
 * MAGI — frontend
 * ------------------------------------------------------
 * This file listens for the user's question, sends it to our server,
 * and then listens for a STREAM of events (Server-Sent Events / SSE)
 * coming back — three DIFFERENT event types now:
 *
 *   unit_start    -> a unit just started thinking (light up its panel)
 *   unit_token    -> a few more words of that unit's response just arrived
 *                     (append them live, so it reads like real-time thought)
 *   turn_complete -> that unit finished its full statement for this round
 *   verdict       -> final vote tally
 *
 * Because the server now runs all three units AT THE SAME TIME (see the
 * server.js comments on Promise.all), you'll see unit_start fire for all
 * three at once, then unit_token events interleaved from all three as
 * they each stream in — genuinely simultaneous, not three separate turns.
 */

const UNIT_META = {
  MELCHIOR: { color: "#5B8DEF", role: "The Scientist", model: "GPT-4o" },
  BALTHASAR: { color: "#E85D75", role: "The Mother", model: "Claude Sonnet" },
  CASPER: { color: "#F5A623", role: "The Woman", model: "DeepSeek" },
};
const UNIT_NAMES = ["MELCHIOR", "BALTHASAR", "CASPER"];

const form = document.getElementById("questionForm");
const input = document.getElementById("questionInput");
const submitBtn = document.getElementById("submitBtn");
const intro = document.getElementById("intro");
const councilRoom = document.getElementById("councilRoom");
const unitsGrid = document.getElementById("unitsGrid");
const roundLabel = document.getElementById("roundLabel");
const transcriptEl = document.getElementById("transcript");
const verdictBox = document.getElementById("verdictBox");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");

document.querySelectorAll(".example-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    input.value = chip.dataset.q;
    input.focus();
  });
});

resetBtn.addEventListener("click", () => location.reload());

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  startDeliberation(question);
});

// ---------------------------------------------------------------------------
// Build the three persistent unit panels. Unlike v1, these DON'T disappear
// after each round — they're always visible, and their content updates
// live as each round's response streams in. This is what makes it feel
// like a dashboard watching three machines think, rather than a chat log.
// ---------------------------------------------------------------------------
function buildUnitPanels() {
  unitsGrid.innerHTML = "";
  UNIT_NAMES.forEach((name) => {
    const meta = UNIT_META[name];
    const panel = document.createElement("div");
    panel.className = "unit-panel";
    panel.id = `panel-${name}`;
    panel.style.setProperty("--unit-color", meta.color);
    panel.innerHTML = `
      <div class="unit-hex">
        <div class="unit-hex-inner">
          <div class="unit-name">${name}</div>
          <div class="unit-number">${UNIT_NAMES.indexOf(name) + 1}</div>
          <div class="unit-state" id="state-${name}">STANDBY</div>
        </div>
      </div>
      <div class="unit-role">${meta.role}</div>
      <div class="unit-model">${meta.model}</div>
      <div class="unit-live-text" id="live-${name}"></div>
      <div class="unit-vote" id="vote-${name}"></div>
    `;
    unitsGrid.appendChild(panel);
  });
}

function setUnitState(name, state) {
  const panel = document.getElementById(`panel-${name}`);
  const stateEl = document.getElementById(`state-${name}`);
  if (!panel || !stateEl) return;
  panel.classList.remove("state-standby", "state-processing", "state-complete");
  panel.classList.add(`state-${state}`);
  stateEl.textContent = state === "processing" ? "PROCESSING" : state === "complete" ? "COMPLETE" : "STANDBY";
}

function appendLiveText(name, fullSoFar) {
  const liveEl = document.getElementById(`live-${name}`);
  if (liveEl) liveEl.textContent = fullSoFar;
}

function clearLiveText(name) {
  const liveEl = document.getElementById(`live-${name}`);
  if (liveEl) liveEl.textContent = "";
  const voteEl = document.getElementById(`vote-${name}`);
  if (voteEl) voteEl.innerHTML = "";
}

// ---------------------------------------------------------------------------
// The scrolling history log below the live panels — a permanent record of
// every round, so you can scroll back through the whole deliberation even
// after the live panels have moved on to the next round.
// ---------------------------------------------------------------------------
function appendToHistory(turn) {
  const color = UNIT_META[turn.name]?.color || "#7C8494";
  const el = document.createElement("div");
  el.className = "turn";
  el.style.setProperty("--turn-color", color);

  const label = turn.vote ? "FINAL VOTE" : `ROUND ${turn.round}`;
  const votePill = turn.vote ? `<span class="vote-pill ${turn.vote.toLowerCase()}">${turn.vote}</span>` : "";

  el.innerHTML = `
    <div class="turn-header">
      <span class="turn-name">${turn.name}</span>
      <span class="turn-round">${label}</span>
      ${votePill}
    </div>
    <div class="turn-text"></div>
  `;
  el.querySelector(".turn-text").textContent = turn.text;
  transcriptEl.appendChild(el);
}

async function startDeliberation(question) {
  intro.style.display = "none";
  councilRoom.style.display = "block";
  buildUnitPanels();
  transcriptEl.innerHTML = "";
  verdictBox.style.display = "none";
  resetBtn.style.display = "none";
  submitBtn.disabled = true;

  statusEl.classList.add("live");
  statusText.textContent = "MAGI ACTIVE";
  roundLabel.textContent = "ROUND 1 / 3";

  let currentRound = 1;
  const TOTAL_ROUNDS = 3; // 2 deliberation rounds + 1 final vote round

  try {
    const response = await fetch("/api/deliberate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop();

      for (const chunk of chunks) {
        const eventMatch = chunk.match(/^event: (.+)$/m);
        const dataMatch = chunk.match(/^data: (.+)$/m);
        if (!eventMatch || !dataMatch) continue;
        handleEvent(eventMatch[1], JSON.parse(dataMatch[1]));
      }
    }
  } catch (err) {
    const el = document.createElement("div");
    el.className = "turn";
    el.style.setProperty("--turn-color", "#E85D75");
    el.innerHTML = `<div class="turn-text">Connection error: ${err.message}. Is the server running?</div>`;
    transcriptEl.appendChild(el);
  } finally {
    submitBtn.disabled = false;
    statusEl.classList.remove("live");
    statusText.textContent = "STANDBY";
  }

  function handleEvent(eventType, data) {
    if (eventType === "unit_start") {
      // A unit just began processing — light up its hexagon immediately,
      // even though no text exists yet. This is the "machine just woke up
      // and started working" moment.
      if (data.round !== currentRound) {
        currentRound = data.round;
        roundLabel.textContent = data.round > 2 ? "FINAL VOTE" : `ROUND ${data.round} / 3`;
        UNIT_NAMES.forEach(clearLiveText);
      }
      setUnitState(data.name, "processing");
    } else if (eventType === "unit_token") {
      // New text arrived for this unit — update its live panel immediately.
      appendLiveText(data.name, data.fullSoFar);
    } else if (eventType === "turn_complete") {
      setUnitState(data.name, "complete");
      if (data.vote) {
        const voteEl = document.getElementById(`vote-${data.name}`);
        if (voteEl) {
          voteEl.innerHTML = `<span class="vote-pill ${data.vote.toLowerCase()}">${data.vote}</span>`;
        }
      }
      appendToHistory(data);
    } else if (eventType === "status") {
      statusText.textContent = data.message.toUpperCase();
    } else if (eventType === "verdict") {
      renderVerdict(data);
    } else if (eventType === "done") {
      resetBtn.style.display = "block";
    } else if (eventType === "error") {
      const el = document.createElement("div");
      el.className = "turn";
      el.style.setProperty("--turn-color", "#E85D75");
      el.innerHTML = `<div class="turn-text">${data.message}</div>`;
      transcriptEl.appendChild(el);
      resetBtn.style.display = "block";
    }
  }
}

function renderVerdict(data) {
  const voteTally = document.getElementById("voteTally");
  voteTally.innerHTML = data.votes
    .map(
      (v) => `
      <div class="vote-unit">
        <div class="vote-unit-name" style="color:${UNIT_META[v.name]?.color}">${v.name}</div>
        <span class="vote-pill ${v.vote.toLowerCase()}">${v.vote}</span>
      </div>
    `
    )
    .join("");

  const resultEl = document.getElementById("verdictResult");
  resultEl.className = `verdict-result ${data.result.toLowerCase()}`;
  const tallyLine = data.unanimous
    ? `Unanimous ${data.approveCount === 3 ? "3–0" : "0–3"}`
    : `${data.approveCount}–${data.rejectCount} split decision`;
  resultEl.innerHTML = `${data.result}<span class="tally-note">${tallyLine}</span>`;

  verdictBox.style.display = "block";
  verdictBox.scrollIntoView({ behavior: "smooth", block: "end" });
}
