/* =========================================================
   TOURNAMENT ARENA — ROGUELIKE FOOTBALL CLASH ENGINE
   ========================================================= */

const ROGUELIKE_CARDS_POOL = [
    { id: "thunder_strike", name: "⚡ Thunder Strike", icon: "⚡", desc: "Shots pierce keeper saves on open zones and deal 2.5x score!", pointMult: 2.5, pierce: true },
    { id: "golden_boot", name: "👟 Golden Boot", icon: "👟", desc: "Upper 90 corner goals grant +500 bonus points!", cornerBonus: 500, pointMult: 1.5 },
    { id: "iron_wall", name: "🛡️ Iron Wall", icon: "🛡️", desc: "Grants +1 extra Heart life and blocks 1 goal.", extraLife: 1, pointMult: 1.2 },
    { id: "shadow_feint", name: "👻 Shadow Feint", icon: "👻", desc: "King Jeff's dive speed is slowed down by 50%.", slowKeeper: true, pointMult: 1.3 },
    { id: "overcharge", name: "🔋 Overcharge", icon: "🔋", desc: "Double all scored points (+100%), but keeper dives faster.", pointMult: 2.0, fastKeeper: true },
    { id: "curse_greed", name: "💀 Curse of Greed", icon: "💀", desc: "Massive 4.0x Score Multiplier, but missing a kick costs 2 lives!", cursed: true, pointMult: 4.0, doubleDamage: true },
    { id: "cosmic_rift", name: "💎 Cosmic Rift", icon: "💎", desc: "Guaranteed critical goal on your next 3 shots!", critShots: 3, pointMult: 1.8 },
    { id: "speed_demon", name: "💨 Speed Demon", icon: "💨", desc: "Ball travel velocity is instant with +80% score bonus.", pointMult: 1.8, instantBall: true },
    { id: "gold_rush", name: "🪙 Gold Rush", icon: "🪙", desc: "Earn +200 Gold coins on every successful goal scored!", coinBonus: 200, pointMult: 1.2 }
];

const STAGES = [
    { stage: 1, name: "STAGE 1: QUARTER-FINALS", opponent: "KING JEFF (OVR 90)", targetWins: 3 },
    { stage: 2, name: "STAGE 2: SEMI-FINALS", opponent: "KING JEFF (OVR 95)", targetWins: 3 },
    { stage: 3, name: "STAGE 3: GRAND FINALS", opponent: "SUPREME JEFF (OVR 99)", targetWins: 4 }
];

const gameState = {
    stageIdx: 0,
    playerScore: 0,
    jeffScore: 0,
    runScore: 0,
    lives: 3,
    coins: 100,
    activeCards: [],
    turn: "player_shoot",
    isKicking: false,
    audioEnabled: true,
    jeffStance: "center",
    jeffGuardedZones: [1, 4]
};

// Web Audio API Synthesizer
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTone(freq, duration, type = "sine") {
    if (!gameState.audioEnabled) return;
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

function playGoalSound() {
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.25, "triangle"), i * 80);
    });
}

function playSaveSound() {
    playTone(180, 0.35, "sawtooth");
}

function toggleAudio() {
    gameState.audioEnabled = !gameState.audioEnabled;
    const btn = document.getElementById("soundToggleBtn");
    if (btn) btn.textContent = gameState.audioEnabled ? "🔊 Sound ON" : "🔇 Sound OFF";
    toast(gameState.audioEnabled ? "Sound Enabled" : "Sound Muted");
}

function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
}

// Power Meter Animation
let meterPos = 0;
let meterDir = 1;
function updateMeter() {
    meterPos += 2.5 * meterDir;
    if (meterPos >= 92) { meterPos = 92; meterDir = -1; }
    if (meterPos <= 0) { meterPos = 0; meterDir = 1; }
    const ind = document.getElementById("meterIndicator");
    if (ind) ind.style.left = meterPos + "%";
    requestAnimationFrame(updateMeter);
}

// Telegraph Stance Setup
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

    const stances = [
        { name: "Leaning Left (Guards Left Side)", guarded: [0, 3], icon: "⬅️", css: "stance-left" },
        { name: "Holding Center (Guards Center)", guarded: [1, 4], icon: "⏺️", css: "stance-center" },
        { name: "Leaning Right (Guards Right Side)", guarded: [2, 5], icon: "➡️", css: "stance-right" }
    ];

    const chosen = stances[Math.floor(Math.random() * stances.length)];
    gameState.jeffStance = chosen.css;
    gameState.jeffGuardedZones = chosen.guarded;

    const tTitle = document.getElementById("telegraphTitle");
    const tSub = document.getElementById("telegraphSub");
    if (tTitle) tTitle.textContent = `King Jeff is ${chosen.name} ${chosen.icon}`;
    if (tSub) tSub.textContent = "Aim for the OPEN unguarded zones for a 100% Guaranteed Goal!";

    if (keeper) {
        setTimeout(() => {
            keeper.style.transition = "transform 0.4s ease";
            keeper.classList.add(chosen.css);
        }, 100);
    }
}

// Player Strike Logic (Zero RNG - Pure Skill & Observation)
const ZONE_COORDS = [
    { x: -160, y: -160 }, { x: 0, y: -160 }, { x: 160, y: -160 },
    { x: -160, y: -60 },  { x: 0, y: -60 },  { x: 160, y: -60 }
];

function playerStrike(zoneIdx) {
    if (gameState.isKicking || gameState.lives <= 0) return;
    gameState.isKicking = true;

    const isGuarded = gameState.jeffGuardedZones.includes(zoneIdx);
    const hasPierce = gameState.activeCards.some(c => c.pierce);
    const isGoal = !isGuarded || hasPierce;

    const ball = document.getElementById("footballActor");
    const coord = ZONE_COORDS[zoneIdx] || ZONE_COORDS[1];

    if (ball) {
        ball.style.transition = "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)";
        ball.style.transform = `translate(${coord.x}px, ${coord.y}px) scale(0.65)`;
    }

    playTone(320, 0.15, "square");

    // Timing bonus from meter
    const inSweetSpot = meterPos >= 42 && meterPos <= 72;
    let timingMult = inSweetSpot ? 1.5 : 1.0;

    let netMult = 1.0;
    gameState.activeCards.forEach(c => {
        if (c.pointMult) netMult *= c.pointMult;
    });

    setTimeout(() => {
        if (isGoal) {
            playGoalSound();
            gameState.playerScore++;
            let pts = 200;
            if (inSweetSpot) pts += 100;
            if (gameState.activeCards.some(c => c.cornerBonus) && [0, 2, 3, 5].includes(zoneIdx)) pts += 500;
            const awarded = Math.round(pts * netMult * timingMult);
            gameState.runScore += awarded;
            gameState.coins += 50;

            toast(`⚽ GOAL! +${awarded.toLocaleString()} PTS! ${inSweetSpot ? '★ PERFECT TIMING! ★' : ''}`);
        } else {
            playSaveSound();
            gameState.jeffScore++;
            const doubleDmg = gameState.activeCards.some(c => c.doubleDamage);
            gameState.lives -= (doubleDmg ? 2 : 1);
            toast(`🧤 SAVED! King Jeff blocked the shot! (-${doubleDmg ? 2 : 1} ❤️)`);
        }

        updateHUD();

        if (gameState.lives <= 0) {
            endRun(false);
            return;
        }

        const stage = STAGES[gameState.stageIdx];
        if (gameState.playerScore >= stage.targetWins) {
            // Stage Won -> Trigger Card Draft
            triggerCardDraft();
        } else {
            setTimeout(prepareTurn, 1200);
        }
    }, 450);
}

function triggerCardDraft() {
    const modal = document.getElementById("cardDraftModal");
    const grid = document.getElementById("draftCardsGrid");
    if (!modal || !grid) return;

    // Pick 3 random cards
    const shuffled = [...ROGUELIKE_CARDS_POOL].sort(() => 0.5 - Math.random());
    const draft3 = shuffled.slice(0, 3);

    grid.innerHTML = draft3.map(c => `
        <div class="draft-card-item ${c.cursed ? 'cursed' : ''}" onclick="selectDraftCard('${c.id}')">
            <div class="draft-card-icon">${c.icon}</div>
            <div class="draft-card-title">${c.name}</div>
            <div class="draft-card-desc">${c.desc}</div>
            <div class="draft-card-mult">Multiplier: +${Math.round((c.pointMult - 1) * 100)}% PTS</div>
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

    // Advance Stage
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
    gameState.activeCards.forEach(c => { if (c.pointMult) mult *= c.pointMult; });
    const multEl = document.getElementById("activeMultiplier");
    if (multEl) multEl.textContent = `${mult.toFixed(1)}x`;

    const livesEl = document.getElementById("livesContainer");
    if (livesEl) {
        livesEl.textContent = "❤️".repeat(Math.max(0, gameState.lives)) + "🖤".repeat(Math.max(0, 3 - gameState.lives));
    }

    const coinsEl = document.getElementById("hudCoins");
    if (coinsEl) coinsEl.textContent = `${gameState.coins.toLocaleString()} Gold`;

    // Render active tray
    const tray = document.getElementById("activeCardsTray");
    if (tray) {
        if (gameState.activeCards.length === 0) {
            tray.innerHTML = `<span class="no-cards-hint">No cards drafted yet. Win rounds to draft power cards!</span>`;
        } else {
            tray.innerHTML = gameState.activeCards.map(c => `
                <span class="buff-mini-card ${c.cursed ? 'cursed' : ''}">${c.icon} ${c.name}</span>
            `).join("");
        }
    }
}

function endRun(isWin) {
    const modal = document.getElementById("gameOverModal");
    const title = document.getElementById("gameOverTitle");
    const finalScore = document.getElementById("finalScoreVal");
    const finalGold = document.getElementById("finalGoldVal");
    const finalCards = document.getElementById("finalCardsVal");

    if (title) title.textContent = isWin ? "👑 GRAND CHAMPION — RUN WON!" : "💀 KNOCKED OUT!";
    if (finalScore) finalScore.textContent = gameState.runScore.toLocaleString();
    if (finalGold) finalGold.textContent = `+${gameState.coins} 🪙`;
    if (finalCards) finalCards.textContent = gameState.activeCards.length;

    // Save best score
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
