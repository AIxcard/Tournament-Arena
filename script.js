/* =========================================================
   TOURNAMENT ARENA — ROGUELIKE FOOTBALL CLASH ENGINE v2.0
   Rebalanced Tactical Cards (Zero Buff Multipliers, Pure Multipliers on Curses)
   Dynamic Goalkeeper Diving & Skill-Based Golden Critical Zone Shooting
   Pause & Leave Match Management & Anime Vanguards OST
   ========================================================= */

// Tactical Modifiers: Buffs have pointMult: 1.0 (mechanics only). Cursed cards have high point multipliers at high risk!
const ROGUELIKE_CARDS_POOL = [
    { id: "thunder_strike", name: "⚡ Thunder Strike", icon: "⚡", desc: "Shots pierce keeper saves even if King Jeff dives to that side!", pointMult: 1.0, pierce: true },
    { id: "golden_boot", name: "👟 Golden Boot", icon: "👟", desc: "Upper 90 corner goals grant +350 bonus score!", pointMult: 1.0, cornerBonus: 350 },
    { id: "iron_wall", name: "🛡️ Iron Wall", icon: "🛡️", desc: "Grants +1 extra Heart life.", pointMult: 1.0, extraLife: 1 },
    { id: "shadow_feint", name: "👻 Shadow Feint", icon: "👻", desc: "King Jeff's reaction time and dive agility are reduced by 40%.", pointMult: 1.0, slowKeeper: true },
    { id: "speed_demon", name: "💨 Speed Demon", icon: "💨", desc: "Rocket ball travel velocity with instant impact.", pointMult: 1.0, instantBall: true },
    { id: "gold_rush", name: "🪙 Gold Rush", icon: "🪙", desc: "Earn +150 Gold coins on every successful goal scored!", pointMult: 1.0, coinBonus: 150 },
    { id: "cosmic_rift", name: "💎 Cosmic Rift", icon: "💎", desc: "Guaranteed critical goal on your next 3 shots!", pointMult: 1.0, critShots: 3 },
    { id: "curse_greed", name: "💀 Curse of Greed", icon: "💀", desc: "Massive 3.5x Score Multiplier, but missing a kick costs 2 lives!", cursed: true, pointMult: 3.5, doubleDamage: true },
    { id: "high_stakes", name: "🔥 High Stakes Gamble", icon: "🔥", desc: "Huge 4.0x Score Multiplier, but accuracy golden zone is 40% narrower!", cursed: true, pointMult: 4.0, narrowMeter: true }
];

const STAGES = [
    { stage: 1, name: "STAGE 1: QUARTER-FINALS", opponent: "KING JEFF (OVR 90)", targetWins: 3, keeperSpeed: 1.0 },
    { stage: 2, name: "STAGE 2: SEMI-FINALS", opponent: "KING JEFF (OVR 95)", targetWins: 3, keeperSpeed: 1.25 },
    { stage: 3, name: "STAGE 3: GRAND FINALS", opponent: "SUPREME JEFF (OVR 99)", targetWins: 4, keeperSpeed: 1.5 }
];

const ZONE_DIVE_CLASSES = [
    "dive-top-left", "dive-top-center", "dive-top-right",
    "dive-low-left", "dive-low-center", "dive-low-right"
];

const ZONE_COORDS = [
    { x: -160, y: -160 }, { x: 0, y: -160 }, { x: 160, y: -160 },
    { x: -160, y: -60 },  { x: 0, y: -60 },  { x: 160, y: -60 }
];

const gameState = {
    stageIdx: 0,
    playerScore: 0,
    jeffScore: 0,
    runScore: 0,
    lives: 3,
    coins: 100,
    activeCards: [],
    isKicking: false,
    isPaused: false,
    audioEnabled: true
};

// ================= ANIME VANGUARDS OST ENGINE =================
const ANIME_SOUNDTRACKS = [
    { id: "vanguards_ignition", name: "⚡ Vanguards Ignition", bpm: 142, rootFreq: 130.81, scale: [0, 3, 5, 7, 10, 12, 15] },
    { id: "shinjuku_showdown", name: "🔥 Shinjuku Showdown", bpm: 148, rootFreq: 146.83, scale: [0, 2, 3, 7, 8, 12, 14] },
    { id: "domain_synth", name: "🌌 Domain Expansion Synth", bpm: 136, rootFreq: 110.00, scale: [0, 3, 7, 10, 12, 15, 19] },
    { id: "monarchs_wrath", name: "⚔️ Monarch's Wrath", bpm: 140, rootFreq: 123.47, scale: [0, 2, 5, 7, 9, 12, 14] },
    { id: "king_of_curses", name: "👑 King of Curses", bpm: 150, rootFreq: 98.00, scale: [0, 1, 5, 7, 8, 12, 13] }
];

let audioCtx = null;
let bgmInterval = null;
let currentTrackIdx = 0;
let bgmStep = 0;
let isOstPlaying = false;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTone(freq, duration, type = "sine", gainVal = 0.15) {
    if (!gameState.audioEnabled || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

function playKickDrum() {
    if (!gameState.audioEnabled || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(130, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } catch(e) {}
}

function stepBgm() {
    if (!isOstPlaying || gameState.isPaused) return;
    const track = ANIME_SOUNDTRACKS[currentTrackIdx];
    const step = bgmStep % 16;
    bgmStep++;

    if (step % 4 === 0) playKickDrum();

    const bassIdx = [0, 0, 3, 5, 0, 0, 7, 5][Math.floor(step / 2) % 8];
    const bassFreq = track.rootFreq * Math.pow(2, (track.scale[bassIdx % track.scale.length] || 0) / 12);
    playTone(bassFreq * 0.5, 0.14, "triangle", 0.25);

    const arpIdx = (step * 2) % track.scale.length;
    const arpFreq = track.rootFreq * 2 * Math.pow(2, (track.scale[arpIdx] || 0) / 12);
    if (step % 2 === 0) playTone(arpFreq, 0.1, "sawtooth", 0.1);
}

function toggleAnimeOst() {
    initAudio();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    isOstPlaying = !isOstPlaying;
    const btn = document.getElementById("animeOstToggleBtn");

    if (isOstPlaying) {
        if (bgmInterval) clearInterval(bgmInterval);
        const track = ANIME_SOUNDTRACKS[currentTrackIdx];
        const stepMs = (60 / track.bpm) * 250;
        bgmInterval = setInterval(stepBgm, stepMs);
        if (btn) btn.textContent = "⏸️ Pause OST";
        toast(`🎵 Playing: ${track.name}`);
    } else {
        if (bgmInterval) clearInterval(bgmInterval);
        if (btn) btn.textContent = "🎵 Anime OST";
        toast("🔇 Music Paused");
    }
}

function nextAnimeOstTrack() {
    currentTrackIdx = (currentTrackIdx + 1) % ANIME_SOUNDTRACKS.length;
    bgmStep = 0;
    const track = ANIME_SOUNDTRACKS[currentTrackIdx];
    const label = document.getElementById("pauseSongLabel");
    if (label) label.textContent = track.name;

    if (isOstPlaying) {
        if (bgmInterval) clearInterval(bgmInterval);
        const stepMs = (60 / track.bpm) * 250;
        bgmInterval = setInterval(stepBgm, stepMs);
        toast(`🎵 Next Track: ${track.name}`);
    }
}

function playGoalSound() {
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.25, "triangle", 0.2), i * 70);
    });
}

function playSaveSound() {
    playTone(170, 0.35, "sawtooth", 0.25);
}

function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
}

// ================= POWER METER =================
let meterPos = 0;
let meterDir = 1;

function updateMeter() {
    if (!gameState.isPaused) {
        meterPos += 2.8 * meterDir;
        if (meterPos >= 92) { meterPos = 92; meterDir = -1; }
        if (meterPos <= 0) { meterPos = 0; meterDir = 1; }
        const ind = document.getElementById("meterIndicator");
        if (ind) ind.style.left = meterPos + "%";
    }
    requestAnimationFrame(updateMeter);
}

// ================= TURN & GAMEPLAY ENGINE =================
function prepareTurn() {
    gameState.isKicking = false;
    const ball = document.getElementById("footballActor");
    const keeper = document.getElementById("keeperActor");
    if (ball) {
        ball.style.transition = "none";
        ball.style.transform = "translate(0px, 0px) scale(1)";
    }
    if (keeper) {
        keeper.style.transition = "none";
        keeper.className = "keeper-actor";
    }

    // Adjust sweet spot if cursed card
    const hasNarrow = gameState.activeCards.some(c => c.narrowMeter);
    const spot = document.getElementById("meterSweetSpot");
    if (spot) {
        spot.style.left = hasNarrow ? "48%" : "44%";
        spot.style.width = hasNarrow ? "14%" : "22%";
    }
}

function playerStrike(zoneIdx) {
    if (gameState.isKicking || gameState.lives <= 0 || gameState.isPaused) return;
    gameState.isKicking = true;

    initAudio();
    const stage = STAGES[Math.min(STAGES.length - 1, gameState.stageIdx)];

    // Timing check: Is the indicator in the Golden Critical Zone?
    const hasNarrow = gameState.activeCards.some(c => c.narrowMeter);
    const minSweet = hasNarrow ? 48 : 44;
    const maxSweet = hasNarrow ? 62 : 66;
    const isCriticalHit = (meterPos >= minSweet && meterPos <= maxSweet);

    // Dynamic Goalkeeper Dive Decision
    // In Stage 1: Jeff dives to a random zone with 60% chance of guessing close
    // In Stage 3: Jeff has higher chance to react towards player's targeted side
    let jeffDivedZone = Math.floor(Math.random() * 6);
    if (Math.random() < (0.45 * stage.keeperSpeed)) {
        jeffDivedZone = zoneIdx; // Jeff guessed correctly!
    }

    const keeper = document.getElementById("keeperActor");
    if (keeper) {
        const diveClass = ZONE_DIVE_CLASSES[jeffDivedZone] || "dive-low-center";
        const isSlowed = gameState.activeCards.some(c => c.slowKeeper);
        keeper.style.transition = `transform ${isSlowed ? '0.45s' : '0.28s'} cubic-bezier(0.2, 0.8, 0.2, 1)`;
        keeper.className = `keeper-actor ${diveClass}`;
    }

    const hasPierce = gameState.activeCards.some(c => c.pierce);
    const hasCritCard = gameState.activeCards.some(c => c.critShots && c.critShots > 0);

    // GOAL LOGIC:
    // 1. Critical Golden Zone Strike = 100% UNSTOPPABLE GOAL (beats keeper dive)
    // 2. Piercing Card = 100% GOAL
    // 3. Normal Strike = GOAL if keeper dived to a different zone; BLOCKED if keeper guessed this zone
    const isGuaranteed = isCriticalHit || hasPierce || hasCritCard;
    const isGoal = isGuaranteed || (jeffDivedZone !== zoneIdx);

    const ball = document.getElementById("footballActor");
    const coord = ZONE_COORDS[zoneIdx] || ZONE_COORDS[1];

    if (ball) {
        const isInstant = gameState.activeCards.some(c => c.instantBall);
        ball.style.transition = `transform ${isInstant ? '0.2s' : '0.38s'} cubic-bezier(0.2, 0.8, 0.2, 1)`;
        ball.style.transform = `translate(${coord.x}px, ${coord.y}px) scale(0.65)`;
    }

    playTone(isCriticalHit ? 520 : 320, 0.15, isCriticalHit ? "sawtooth" : "square", 0.2);

    // Multiplier strictly from Cursed cards
    let netMultiplier = 1.0;
    gameState.activeCards.forEach(c => {
        if (c.pointMult && c.cursed) netMultiplier *= c.pointMult;
    });

    setTimeout(() => {
        if (isGoal) {
            playGoalSound();
            gameState.playerScore++;
            let basePts = [300, 180, 300, 220, 150, 220][zoneIdx] || 200;

            if (isCriticalHit) basePts += 150;
            if (gameState.activeCards.some(c => c.cornerBonus) && [0, 2, 3, 5].includes(zoneIdx)) basePts += 350;

            const totalAwarded = Math.round(basePts * netMultiplier);
            gameState.runScore += totalAwarded;

            const coinBonus = gameState.activeCards.some(c => c.coinBonus) ? 150 : 50;
            gameState.coins += coinBonus;

            toast(`⚽ GOAL! +${totalAwarded.toLocaleString()} PTS! ${isCriticalHit ? '★ UNSTOPPABLE GOLD STRIKE! ★' : ''}`);
        } else {
            playSaveSound();
            gameState.jeffScore++;
            const doubleDmg = gameState.activeCards.some(c => c.doubleDamage);
            const livesLost = doubleDmg ? 2 : 1;
            gameState.lives -= livesLost;
            toast(`🧤 SAVED! King Jeff blocked the shot! (-${livesLost} ❤️)`);
        }

        updateHUD();

        if (gameState.lives <= 0) {
            endRun(false);
            return;
        }

        if (gameState.playerScore >= stage.targetWins) {
            triggerCardDraft();
        } else {
            setTimeout(prepareTurn, 1100);
        }
    }, 400);
}

function triggerCardDraft() {
    const modal = document.getElementById("cardDraftModal");
    const grid = document.getElementById("draftCardsGrid");
    if (!modal || !grid) return;

    const shuffled = [...ROGUELIKE_CARDS_POOL].sort(() => 0.5 - Math.random());
    const draft3 = shuffled.slice(0, 3);

    grid.innerHTML = draft3.map(c => `
        <div class="draft-card-item ${c.cursed ? 'cursed' : ''}" onclick="selectDraftCard('${c.id}')">
            <div class="draft-card-icon">${c.icon}</div>
            <div class="draft-card-title">${c.name}</div>
            <div class="draft-card-desc">${c.desc}</div>
            <div class="draft-card-mult" style="color:${c.cursed ? 'var(--red)' : 'var(--gold)'};">
                ${c.cursed ? `⚠️ Multiplier: +${Math.round((c.pointMult - 1) * 100)}% PTS` : '✨ Mechanical Perk'}
            </div>
        </div>
    `).join("");

    modal.classList.remove("hidden");
}

function selectDraftCard(cardId) {
    const card = ROGUELIKE_CARDS_POOL.find(c => c.id === cardId);
    if (card) {
        gameState.activeCards.push(card);
        if (card.extraLife) gameState.lives += card.extraLife;
        toast(`🎴 Drafted ${card.name}!`);
    }

    const modal = document.getElementById("cardDraftModal");
    if (modal) modal.classList.add("hidden");

    gameState.stageIdx++;
    gameState.playerScore = 0;
    gameState.jeffScore = 0;

    if (gameState.stageIdx >= STAGES.length) {
        endRun(true);
    } else {
        updateHUD();
        setTimeout(prepareTurn, 1000);
    }
}

// ================= PAUSE & LEAVE SYSTEM =================
function pauseGame() {
    gameState.isPaused = true;
    const modal = document.getElementById("pauseModal");
    const label = document.getElementById("pauseSongLabel");
    if (label) label.textContent = ANIME_SOUNDTRACKS[currentTrackIdx].name;
    if (modal) modal.classList.remove("hidden");
}

function resumeGame() {
    gameState.isPaused = false;
    const modal = document.getElementById("pauseModal");
    if (modal) modal.classList.add("hidden");
    toast("▶️ Match Resumed");
}

function confirmLeaveRun() {
    const leaveScore = document.getElementById("leaveScoreVal");
    if (leaveScore) leaveScore.textContent = gameState.runScore.toLocaleString();
    const modal = document.getElementById("leaveModal");
    if (modal) modal.classList.remove("hidden");
}

function cancelLeaveRun() {
    const modal = document.getElementById("leaveModal");
    if (modal) modal.classList.add("hidden");
}

function executeLeaveRun() {
    const leaveModal = document.getElementById("leaveModal");
    if (leaveModal) leaveModal.classList.add("hidden");
    const pauseModal = document.getElementById("pauseModal");
    if (pauseModal) pauseModal.classList.add("hidden");
    endRun(false);
}

function updateHUD() {
    const stage = STAGES[Math.min(STAGES.length - 1, gameState.stageIdx)];
    const sTitle = document.getElementById("arenaStageTitle");
    const sOpp = document.getElementById("arenaOpponentName");
    if (sTitle) sTitle.textContent = stage.name;
    if (sOpp) sOpp.textContent = `VS ${stage.opponent}`;

    const pScore = document.getElementById("playerMatchScore");
    const jScore = document.getElementById("jeffMatchScore");
    if (pScore) pScore.textContent = gameState.playerScore;
    if (jScore) jScore.textContent = gameState.jeffScore;

    const runPts = document.getElementById("currentRunPoints");
    if (runPts) runPts.textContent = gameState.runScore.toLocaleString();

    let mult = 1.0;
    gameState.activeCards.forEach(c => { if (c.pointMult && c.cursed) mult *= c.pointMult; });
    const multEl = document.getElementById("activeMultiplier");
    if (multEl) multEl.textContent = `${mult.toFixed(1)}x`;

    const livesEl = document.getElementById("livesContainer");
    if (livesEl) {
        livesEl.textContent = "❤️".repeat(Math.max(0, gameState.lives)) + "🖤".repeat(Math.max(0, 3 - gameState.lives));
    }

    const coinsEl = document.getElementById("hudCoins");
    if (coinsEl) coinsEl.textContent = `${gameState.coins.toLocaleString()} Gold`;

    const tray = document.getElementById("activeCardsTray");
    if (tray) {
        if (gameState.activeCards.length === 0) {
            tray.innerHTML = `<span class="no-cards-hint">No cards drafted yet. Win stages to draft tactical modifier cards!</span>`;
        } else {
            tray.innerHTML = gameState.activeCards.map(c => `
                <span class="buff-mini-card ${c.cursed ? 'cursed' : ''}">${c.icon} ${c.name}</span>
            `).join("");
        }
    }
}

function endRun(isWin) {
    gameState.isPaused = false;
    const modal = document.getElementById("gameOverModal");
    const title = document.getElementById("gameOverTitle");
    const finalScore = document.getElementById("finalScoreVal");
    const finalGold = document.getElementById("finalGoldVal");
    const finalCards = document.getElementById("finalCardsVal");

    if (title) title.textContent = isWin ? "👑 GRAND CHAMPION — RUN WON!" : "💀 KNOCKED OUT!";
    if (finalScore) finalScore.textContent = gameState.runScore.toLocaleString();
    if (finalGold) finalGold.textContent = `+${gameState.coins} 🪙`;
    if (finalCards) finalCards.textContent = gameState.activeCards.length;

    const best = Number(localStorage.getItem("tournament_arena_best") || 0);
    if (gameState.runScore > best) {
        localStorage.setItem("tournament_arena_best", gameState.runScore);
    }
    const hudBest = document.getElementById("hudBestScore");
    if (hudBest) hudBest.textContent = `High Score: ${Math.max(best, gameState.runScore).toLocaleString()}`;

    if (modal) modal.classList.remove("hidden");
}

function startNewRun() {
    gameState.stageIdx = 0;
    gameState.playerScore = 0;
    gameState.jeffScore = 0;
    gameState.runScore = 0;
    gameState.lives = 3;
    gameState.activeCards = [];
    gameState.isKicking = false;
    gameState.isPaused = false;

    const modal = document.getElementById("gameOverModal");
    if (modal) modal.classList.add("hidden");

    updateHUD();
    prepareTurn();
}

window.addEventListener("DOMContentLoaded", () => {
    const best = Number(localStorage.getItem("tournament_arena_best") || 0);
    const hudBest = document.getElementById("hudBestScore");
    if (hudBest) hudBest.textContent = `High Score: ${best.toLocaleString()}`;
    updateHUD();
    prepareTurn();
    updateMeter();
});
