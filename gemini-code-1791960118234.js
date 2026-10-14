// --- Game State Constants & Variables ---
const MAX_EITR = 30;
const INITIAL_EITR = 30;
const LETTERS = ['U', 'M', 'A', 'I', 'R'];

let gameState = {
    round: 1,
    turn: 'p1', // 'p1' or 'p2'
    p1: null,
    p2: null,
    selectedLetter: 'U',
    actionsTakenTurn: 0,
    lastUsedAbility: null
};

// Ability definitions per Letter
const LETTER_ABILITIES = {
    'U': {
        a1: { name: "Resurrection", cost: 12, desc: "Revives 1 dead letter with 3.0 HP or heals lowest HP letter by 5.0." },
        a2: { name: "Quarter Shield", cost: 6, desc: "Reduces damage taken by 25% until hit." }
    },
    'M': {
        a1: { name: "Copycat", cost: 12, desc: "Copies opponent's last move damage or heal." },
        a2: { name: "Reflect", cost: 8, desc: "Reflects 75% of last damage received back." }
    },
    'A': {
        a1: { name: "Conical Happiness", cost: 15, desc: "Heals adjacent letters by 50% decaying." },
        a2: { name: "Unity", cost: 7, desc: "Deals 15% of your total team HP split between 2 letters." }
    },
    'I': {
        a1: { name: "Poison", cost: 15, desc: "Applies Poison (+75% damage intake) for 2 rounds." },
        a2: { name: "Staff of Embers", cost: 10, desc: "Burns 2 opponent letters for 2.5 HP/round." }
    },
    'R': {
        a1: { name: "Eitr-Refined Happiness", cost: 12, desc: "Heals 30% of total Eitr across 2 letters." },
        a2: { name: "Staff of Immunity", cost: 15, desc: "Grants 50% damage resistance & debuff immunity for 2 rounds." }
    }
};

// Player Class Prototype
class Player {
    constructor(id, charChoice) {
        this.id = id;
        this.char = charChoice;
        this.eitr = INITIAL_EITR;
        this.skipStreak = 0;
        this.ultAvailable = true;
        this.letters = {};
        LETTERS.forEach(l => {
            this.letters[l] = { hp: 10.0, frozen: 0, resistance: 0 };
        });
    }

    getTotalHp() {
        return Object.values(this.letters).reduce((sum, l) => sum + Math.max(0, l.hp), 0);
    }
}

// Select Character & Initialize Game
function selectCharacter(char) {
    gameState.p1 = new Player('p1', char);
    // AI or Player 2 chooses a random distinct character
    const remaining = ['K', 'H', 'A', 'N'].filter(c => c !== char);
    const p2Char = remaining[Math.floor(Math.random() * remaining.length)];
    gameState.p2 = new Player('p2', p2Char);

    document.getElementById('char-select-screen').classList.add('hidden');
    document.getElementById('battle-screen').classList.remove('hidden');

    document.getElementById('p1-char-badge').innerText = gameState.p1.char;
    document.getElementById('p2-char-badge').innerText = gameState.p2.char;

    render();
    logCombat(`Battle Started! P1 selected ${char}, P2 selected ${p2Char}.`);
}

// UI Render Engine
function render() {
    // Update Stats Bars
    ['p1', 'p2'].forEach(pid => {
        const p = gameState[pid];
        const totalHp = p.getTotalHp();
        document.getElementById(`${pid}-hp-fill`).style.width = `${(totalHp / 50) * 100}%`;
        document.getElementById(`${pid}-hp-text`).innerText = `${totalHp.toFixed(1)}/50`;

        document.getElementById(`${pid}-eitr-fill`).style.width = `${(p.eitr / MAX_EITR) * 100}%`;
        document.getElementById(`${pid}-eitr-text`).innerText = `${p.eitr}/${MAX_EITR}`;

        document.getElementById(`${pid}-ult-badge`).innerText = p.ultAvailable ? "Ult: Ready ⚡" : "Ult: Used ❌";

        // Render Letters
        const row = document.getElementById(`${pid}-letters`);
        row.innerHTML = '';
        LETTERS.forEach(l => {
            const letterObj = p.letters[l];
            const card = document.createElement('div');
            card.className = `letter-card ${letterObj.hp <= 0 ? 'dead' : ''} ${letterObj.frozen > 0 ? 'frozen' : ''} ${gameState.selectedLetter === l && pid === 'p1' ? 'selected' : ''}`;
            card.innerText = `${l} (${letterObj.hp.toFixed(1)})`;
            if (pid === 'p1') {
                card.onclick = () => { if (letterObj.hp > 0) { gameState.selectedLetter = l; render(); } };
            }
            row.appendChild(card);
        });
    });

    // Update Action Button Labels based on selected letter
    const sel = gameState.selectedLetter;
    document.getElementById('active-letter-tag').innerText = sel;
    if (LETTER_ABILITIES[sel]) {
        document.getElementById('btn-ability-1').innerText = `${LETTER_ABILITIES[sel].a1.name} (${LETTER_ABILITIES[sel].a1.cost} Eitr)`;
        document.getElementById('btn-ability-2').innerText = `${LETTER_ABILITIES[sel].a2.name} (${LETTER_ABILITIES[sel].a2.cost} Eitr)`;
    }

    // Skip Eitr calculation
    const currentSkipGain = 3 * Math.pow(2, gameState.p1.skipStreak);
    document.getElementById('skip-eitr-val').innerText = currentSkipGain;
}

// Ability Triggers
function triggerAbility(slot) {
    if (gameState.actionsTakenTurn >= 2) {
        showPopup("Maximum 2 actions allowed per turn!");
        return;
    }

    const p = gameState.p1;
    const l = gameState.selectedLetter;
    if (p.letters[l].hp <= 0) return showPopup("Dead letters cannot cast abilities!");
    if (p.letters[l].frozen > 0) return showPopup("This letter is Frozen!");

    const ability = slot === 1 ? LETTER_ABILITIES[l].a1 : LETTER_ABILITIES[l].a2;

    if (gameState.lastUsedAbility === ability.name) {
        return showPopup("Cannot use the exact same ability twice in a row!");
    }
    if (p.eitr < ability.cost) {
        return showPopup("Not enough Eitr!");
    }

    // Deduct Eitr & Reset Skip Streak
    p.eitr -= ability.cost;
    p.skipStreak = 0;
    gameState.lastUsedAbility = ability.name;
    gameState.actionsTakenTurn++;

    // Execute Ability Logic
    logCombat(`P1 used ${ability.name} on letter ${l}!`);
    showPopup(`Used ${ability.name}!`);

    render();
}

// Ultimate Ability Execution
function triggerUltimate() {
    const p = gameState.p1;
    if (!p.ultAvailable) return showPopup("Ultimate already used!");

    p.ultAvailable = false;
    p.skipStreak = 0;
    gameState.actionsTakenTurn++;

    logCombat(`P1 activated Ultimate Ability for Character ${p.char}!`);
    showPopup(`Ultimate Activated!`);
    
    render();
}

// Skip Turn Logic
function skipTurn() {
    const p = gameState.p1;
    const gain = 3 * Math.pow(2, p.skipStreak);
    p.eitr = Math.min(MAX_EITR, p.eitr + gain);
    p.skipStreak++;
    logCombat(`P1 skipped turn and gained +${gain} Eitr.`);
    endTurn();
}

// End Turn & Pass to Next Player / AI
function endTurn() {
    gameState.actionsTakenTurn = 0;
    gameState.turn = gameState.turn === 'p1' ? 'p2' : 'p1';

    if (gameState.turn === 'p2') {
        // Increment round & passive Eitr gains
        gameState.round++;
        gameState.p1.eitr = Math.min(MAX_EITR, gameState.p1.eitr + 1);
        gameState.p2.eitr = Math.min(MAX_EITR, gameState.p2.eitr + 1);
        
        // Simple AI Turn
        setTimeout(aiTurn, 600);
    }

    document.getElementById('round-num').innerText = gameState.round;
    render();
}

// Basic AI Player
function aiTurn() {
    const p2 = gameState.p2;
    p2.eitr = Math.min(MAX_EITR, p2.eitr + 2);
    logCombat(`P2 completed turn.`);
    endTurn();
}

function showPopup(text) {
    const pop = document.getElementById('action-popup');
    pop.innerText = text;
    pop.classList.remove('hidden');
    setTimeout(() => pop.classList.add('hidden'), 2000);
}

function logCombat(msg) {
    const log = document.getElementById('combat-log');
    log.innerHTML += `<div>> ${msg}</div>`;
    log.scrollTop = log.scrollHeight;
}