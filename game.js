// --- Game State Constants & Variables ---
const MAX_EITR = 30;
const INITIAL_EITR = 30;
const LETTERS = ['U', 'M', 'A', 'I', 'R'];

let gameState = {
    mode: 'ai', // 'ai' or 'local'
    round: 1,
    turn: 'p1', // 'p1' or 'p2'
    p1: null,
    p2: null,
    selectedLetterP1: 'U',
    selectedLetterP2: 'U',
    actionsTakenTurn: 0,
    lastUsedAbilityP1: null,
    lastUsedAbilityP2: null,
    charSelectStep: 1,
    targetingState: null
};

// Ability definitions per Letter
const LETTER_ABILITIES = {
    'U': {
        a1: { name: "Resurrection", cost: 12, target: "friendly", desc: "Revives 1 dead letter with 3.0 HP or heals lowest HP letter by 5.0." },
        a2: { name: "Quarter Shield", cost: 6, target: "friendly", desc: "Reduces damage taken by 25% until hit." }
    },
    'M': {
        a1: { name: "Copycat", cost: 12, target: "self", desc: "Copies opponent's last move damage or heal." },
        a2: { name: "Reflect", cost: 8, target: "enemy_single", damage: 3.0, desc: "Deals 3.0 damage and reflects incoming pressure." }
    },
    'A': {
        a1: { name: "Conical Happiness", cost: 15, target: "friendly", desc: "Heals adjacent letters by 50% decaying." },
        a2: { name: "Unity", cost: 7, target: "enemy_single", damage: 4.0, desc: "Deals 4.0 direct damage to a selected opponent letter." }
    },
    'I': {
        a1: { name: "Poison", cost: 15, target: "enemy_single", damage: 3.5, status: "poison", desc: "Poisons target letter (☠️ Poison), dealing 3.5 damage." },
        a2: { name: "Staff of Embers", cost: 10, target: "enemy_single", damage: 4.5, status: "fire", desc: "Burns target opponent letter (🔥 On Fire) for 4.5 damage." }
    },
    'R': {
        a1: { name: "Eitr-Refined Happiness", cost: 12, target: "friendly", desc: "Heals your letters using Eitr energy." },
        a2: { name: "Staff of Immunity", cost: 15, target: "friendly", status: "shield", desc: "Grants target letter 🛡️ +50% resistance & debuff immunity for 2 rounds." }
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
            this.letters[l] = { 
                hp: 10.0, 
                frozen: 0, 
                resistance: 0,
                status: null, // 'fire', 'poison', 'shield', 'quarter_shield'
                statusTurns: 0 
            };
        });
    }

    getTotalHp() {
        return Object.values(this.letters).reduce((sum, l) => sum + Math.max(0, l.hp), 0);
    }
}

// Mode Selection
function setGameMode(mode) {
    gameState.mode = mode;
    document.getElementById('mode-select-screen').classList.add('hidden');
    document.getElementById('char-select-screen').classList.remove('hidden');
    document.getElementById('p2-header-title').innerText = (mode === 'ai') ? 'AI Opponent' : 'Player 2';
}

// Character Selection Logic
function selectCharacter(char) {
    if (gameState.charSelectStep === 1) {
        gameState.p1 = new Player('p1', char);
        if (gameState.mode === 'ai') {
            const remaining = ['K', 'H', 'A', 'N'].filter(c => c !== char);
            const p2Char = remaining[Math.floor(Math.random() * remaining.length)];
            gameState.p2 = new Player('p2', p2Char);
            startGameBattle();
        } else {
            gameState.charSelectStep = 2;
            document.getElementById('char-select-title').innerText = "PLAYER 2: SELECT CHARACTER";
        }
    } else {
        gameState.p2 = new Player('p2', char);
        startGameBattle();
    }
}

function startGameBattle() {
    document.getElementById('char-select-screen').classList.add('hidden');
    document.getElementById('battle-screen').classList.remove('hidden');

    document.getElementById('p1-char-badge').innerText = gameState.p1.char;
    document.getElementById('p2-char-badge').innerText = gameState.p2.char;

    render();
    logCombat(`Battle Started! P1 (${gameState.p1.char}) vs ${gameState.mode === 'ai' ? 'AI' : 'Player 2'} (${gameState.p2.char}).`);
}

// Hover Tooltip Handlers
function showAbilityInfo(slot) {
    const activeLetter = gameState.turn === 'p1' ? gameState.selectedLetterP1 : gameState.selectedLetterP2;
    const ability = slot === 1 ? LETTER_ABILITIES[activeLetter].a1 : LETTER_ABILITIES[activeLetter].a2;
    document.getElementById('ability-tooltip').innerHTML = `<strong>${ability.name}</strong> [Cost: ${ability.cost} 🔮] — ${ability.desc}`;
}

function showUltInfo() {
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    let ultName = "Ultimate Ability", ultDesc = "One-time powerful game-changing skill.";
    if (p.char === 'K') { ultName = "Deflect"; ultDesc = "Reflects 100% attack damage & regains 100% damage as 🔮."; }
    else if (p.char === 'H') { ultName = "Absorb"; ultDesc = "Absorbs attack into health + 95% damage resistance for 2 turns."; }
    else if (p.char === 'A') { ultName = "Staff of Frost"; ultDesc = "Freeze 2 opponent letters for 1 round + deals 30% of highest HP letter damage."; }
    else if (p.char === 'N') { ultName = "Greydwarf Shaman"; ultDesc = "Heals all letters by 50% of highest HP letter + grants HP×10% resistance."; }
    document.getElementById('ability-tooltip').innerHTML = `<strong>⚡ ${ultName} (Ultimate)</strong> — ${ultDesc}`;
}

function showSkipInfo() {
    const activePlayer = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const gain = 3 * Math.pow(2, activePlayer.skipStreak);
    document.getElementById('ability-tooltip').innerHTML = `<strong>Skip Turn</strong> — Forfeit actions to gain <strong>+${gain} 🔮</strong> (doubles on consecutive skips).`;
}

function clearAbilityInfo() {
    document.getElementById('ability-tooltip').innerText = "Hover over an ability to inspect its power.";
}

// UI Render Engine
function render() {
    const activePlayer = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const activeLetter = gameState.turn === 'p1' ? gameState.selectedLetterP1 : gameState.selectedLetterP2;

    document.getElementById('current-turn-label').innerText = gameState.turn === 'p1' ? 'Player 1' : (gameState.mode === 'ai' ? 'AI Opponent' : 'Player 2');
    document.getElementById('control-owner-tag').innerText = gameState.turn === 'p1' ? 'Player 1' : (gameState.mode === 'ai' ? 'AI' : 'Player 2');

    // Update Stats Bars
    ['p1', 'p2'].forEach(pid => {
        const p = gameState[pid];
        const totalHp = p.getTotalHp();
        document.getElementById(`${pid}-hp-fill`).style.width = `${(totalHp / 50) * 100}%`;
        document.getElementById(`${pid}-hp-text`).innerText = `❤️ ${totalHp.toFixed(1)}/50`;

        document.getElementById(`${pid}-eitr-fill`).style.width = `${(p.eitr / MAX_EITR) * 100}%`;
        document.getElementById(`${pid}-eitr-text`).innerText = `🔮 ${p.eitr}/${MAX_EITR}`;

        document.getElementById(`${pid}-ult-badge`).innerText = p.ultAvailable ? "Ult: Ready ⚡" : "Ult: Used ❌";

        // Render Letters
        const row = document.getElementById(`${pid}-letters`);
        row.innerHTML = '';
        LETTERS.forEach(l => {
            const letterObj = p.letters[l];
            const isSelected = (pid === 'p1' && gameState.selectedLetterP1 === l && gameState.turn === 'p1') ||
                               (pid === 'p2' && gameState.selectedLetterP2 === l && gameState.turn === 'p2');
            
            // Determine if card can be targeted by an active ability
            const isTargetable = gameState.targetingState && 
                                 (
                                   (gameState.targetingState.ability.target === "enemy_single" && ((gameState.turn === 'p1' && pid === 'p2') || (gameState.turn === 'p2' && pid === 'p1'))) ||
                                   (gameState.targetingState.ability.target === "friendly" && pid === gameState.turn)
                                 ) && letterObj.hp > 0;

            const card = document.createElement('div');
            card.className = `letter-card ${letterObj.hp <= 0 ? 'dead' : ''} ${letterObj.frozen > 0 ? 'frozen' : ''} ${isSelected ? 'selected' : ''} ${isTargetable ? 'targetable' : ''}`;
            
            // Build Status Badges HTML
            let statusHtml = '';
            if (letterObj.hp > 0) {
                if (letterObj.frozen > 0) statusHtml += `<span title="Frozen">❄️ Frozen</span>`;
                if (letterObj.status === 'fire') statusHtml += `<span title="Burning">🔥 On Fire</span>`;
                if (letterObj.status === 'poison') statusHtml += `<span title="Poisoned">☠️ Poison</span>`;
                if (letterObj.status === 'shield') statusHtml += `<span title="Resistance">🛡️ +50%</span>`;
                if (letterObj.status === 'quarter_shield') statusHtml += `<span title="Quarter Shield">🛡️ 25% Def</span>`;
            }

            card.innerHTML = `<div>${l}</div><div style="font-size:0.75rem;">${letterObj.hp.toFixed(1)}</div><div class="status-badges">${statusHtml}</div>`;
            
            card.onclick = () => {
                if (gameState.targetingState) {
                    if (isTargetable) {
                        executeTargetedAbility(pid, l);
                    } else {
                        showPopup("Please select a valid target letter!");
                    }
                } else {
                    if (letterObj.hp > 0 && pid === gameState.turn) {
                        if (pid === 'p1') gameState.selectedLetterP1 = l;
                        else gameState.selectedLetterP2 = l;
                        render();
                    }
                }
            };
            row.appendChild(card);
        });
    });

    // Update Action Button Labels based on active letter
    document.getElementById('active-letter-tag').innerText = activeLetter;
    if (LETTER_ABILITIES[activeLetter]) {
        document.getElementById('btn-ability-1').innerText = `${LETTER_ABILITIES[activeLetter].a1.name} (${LETTER_ABILITIES[activeLetter].a1.cost} 🔮)`;
        document.getElementById('btn-ability-2').innerText = `${LETTER_ABILITIES[activeLetter].a2.name} (${LETTER_ABILITIES[activeLetter].a2.cost} 🔮)`;
    }

    const currentSkipGain = 3 * Math.pow(2, activePlayer.skipStreak);
    document.getElementById('skip-eitr-val').innerText = currentSkipGain;

    document.getElementById('controls-panel').style.opacity = (gameState.turn === 'p2' && gameState.mode === 'ai') ? '0.5' : '1';
}

// Prepare Ability Click
function prepareAbility(slot) {
    if (gameState.turn === 'p2' && gameState.mode === 'ai') return;
    if (gameState.actionsTakenTurn >= 2) {
        showPopup("Maximum 2 actions allowed per turn!");
        return;
    }

    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const l = gameState.turn === 'p1' ? gameState.selectedLetterP1 : gameState.selectedLetterP2;
    const lastAbility = gameState.turn === 'p1' ? gameState.lastUsedAbilityP1 : gameState.lastUsedAbilityP2;

    if (p.letters[l].hp <= 0) return showPopup("Dead letters cannot cast abilities!");
    if (p.letters[l].frozen > 0) return showPopup("This letter is Frozen!");

    const ability = slot === 1 ? LETTER_ABILITIES[l].a1 : LETTER_ABILITIES[l].a2;

    if (lastAbility === ability.name) {
        return showPopup("Cannot use the exact same ability twice in a row!");
    }
    if (p.eitr < ability.cost) {
        return showPopup("Not enough 🔮 Eitr!");
    }

    if (ability.target === "enemy_single" || ability.target === "friendly") {
        gameState.targetingState = { slot, ability };
        showPopup(`Select a letter to target with ${ability.name}!`);
        render();
    } else {
        executeAbilityDirectly(slot, ability);
    }
}

// Execute Targeted Ability on Letter
function executeTargetedAbility(targetPlayerId, targetLetterKey) {
    const { slot, ability } = gameState.targetingState;
    gameState.targetingState = null;

    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const casterLetter = gameState.turn === 'p1' ? gameState.selectedLetterP1 : gameState.selectedLetterP2;
    const targetPlayer = gameState[targetPlayerId];

    p.eitr -= ability.cost;
    p.skipStreak = 0;
    if (gameState.turn === 'p1') gameState.lastUsedAbilityP1 = ability.name;
    else gameState.lastUsedAbilityP2 = ability.name;

    gameState.actionsTakenTurn++;

    if (ability.target === "enemy_single") {
        let dmg = ability.damage || 3.0;
        targetPlayer.letters[targetLetterKey].hp = Math.max(0, targetPlayer.letters[targetLetterKey].hp - dmg);
        if (ability.status) {
            targetPlayer.letters[targetLetterKey].status = ability.status;
        }
        logCombat(`${gameState.turn.toUpperCase()} used ${ability.name} on ${targetLetterKey}, dealing ${dmg} damage!`);
        showPopup(`Dealt ${dmg} damage to ${targetLetterKey}!`);
    } else if (ability.target === "friendly") {
        if (ability.status === "shield") {
            targetPlayer.letters[targetLetterKey].status = "shield";
            logCombat(`${gameState.turn.toUpperCase()} applied Staff of Immunity 🛡️ +50% to ${targetLetterKey}.`);
            showPopup(`Applied Shield to ${targetLetterKey}!`);
        } else if (ability.status === "quarter_shield") {
            targetPlayer.letters[targetLetterKey].status = "quarter_shield";
            logCombat(`${gameState.turn.toUpperCase()} applied Quarter Shield to ${targetLetterKey}.`);
            showPopup(`Applied Quarter Shield to ${targetLetterKey}!`);
        } else {
            targetPlayer.letters[targetLetterKey].hp = Math.min(10.0, targetPlayer.letters[targetLetterKey].hp + 4.0);
            logCombat(`${gameState.turn.toUpperCase()} healed ${targetLetterKey} for 4.0 HP.`);
            showPopup(`Healed ${targetLetterKey}!`);
        }
    }

    checkWinCondition();
    render();
}

// Execute Non-Targeted Abilities
function executeAbilityDirectly(slot, ability) {
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const l = gameState.turn === 'p1' ? gameState.selectedLetterP1 : gameState.selectedLetterP2;

    p.eitr -= ability.cost;
    p.skipStreak = 0;
    if (gameState.turn === 'p1') gameState.lastUsedAbilityP1 = ability.name;
    else gameState.lastUsedAbilityP2 = ability.name;

    gameState.actionsTakenTurn++;

    if (ability.name === "Resurrection") {
        let deadLetters = LETTERS.filter(letKey => p.letters[letKey].hp <= 0);
        if (deadLetters.length > 0) {
            let revKey = deadLetters[0];
            p.letters[revKey].hp = 3.0;
            p.letters[revKey].status = null;
            logCombat(`${gameState.turn.toUpperCase()} revived letter ${revKey} with 3.0 HP!`);
            showPopup(`Revived ${revKey}!`);
        } else {
            let lowestKey = LETTERS.reduce((minKey, k) => p.letters[k].hp < p.letters[minKey].hp ? k : minKey, 'U');
            p.letters[lowestKey].hp = Math.min(10.0, p.letters[lowestKey].hp + 5.0);
            logCombat(`${gameState.turn.toUpperCase()} healed letter ${lowestKey} by 5.0 HP.`);
            showPopup(`Healed ${lowestKey}!`);
        }
    } else {
        logCombat(`${gameState.turn.toUpperCase()} used ${ability.name} on letter ${l}!`);
        showPopup(`Used ${ability.name}!`);
    }

    checkWinCondition();
    render();
}

// Ultimate Ability Execution
function triggerUltimate() {
    if (gameState.turn === 'p2' && gameState.mode === 'ai') return;
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    if (!p.ultAvailable) return showPopup("Ultimate already used!");

    p.ultAvailable = false;
    p.skipStreak = 0;
    gameState.actionsTakenTurn++;

    logCombat(`${gameState.turn.toUpperCase()} activated Ultimate Ability for Character ${p.char}!`);
    showPopup(`Ultimate Activated!`);
    
    checkWinCondition();
    render();
}

// Skip Turn Logic
function skipTurn() {
    if (gameState.turn === 'p2' && gameState.mode === 'ai') return;
    gameState.targetingState = null;
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const gain = 3 * Math.pow(2, p.skipStreak);
    p.eitr = Math.min(MAX_EITR, p.eitr + gain);
    p.skipStreak++;
    logCombat(`${gameState.turn.toUpperCase()} skipped turn and gained +${gain} 🔮 Eitr.`);
    endTurn();
}

// End Turn & Pass to Next Player / AI
function endTurn() {
    if (gameState.turn === 'p2' && gameState.mode === 'ai') return;
    gameState.targetingState = null;

    gameState.actionsTakenTurn = 0;
    gameState.turn = gameState.turn === 'p1' ? 'p2' : 'p1';

    if (gameState.turn === 'p1') {
        gameState.round++;
        document.getElementById('round-num').innerText = gameState.round;
    }

    gameState.p1.eitr = Math.min(MAX_EITR, gameState.p1.eitr + 1);
    gameState.p2.eitr = Math.min(MAX_EITR, gameState.p2.eitr + 1);

    render();

    if (gameState.turn === 'p2' && gameState.mode === 'ai') {
        setTimeout(aiTurn, 800);
    }
}

// AI Turn Logic
function aiTurn() {
    const aiPlayer = gameState.p2;
    const targetPlayer = gameState.p1;
    logCombat(`AI is thinking...`);

    setTimeout(() => {
        let aliveLetters = LETTERS.filter(l => aiPlayer.letters[l].hp > 0);
        let aliveOpponents = LETTERS.filter(l => targetPlayer.letters[l].hp > 0);

        if (aliveLetters.length > 0 && aliveOpponents.length > 0) {
            let chosenLetter = aliveLetters[Math.floor(Math.random() * aliveLetters.length)];
            gameState.selectedLetterP2 = chosenLetter;
            
            let abilityKey = Math.random() > 0.5 ? 'a1' : 'a2';
            let ability = LETTER_ABILITIES[chosenLetter][abilityKey];

            if (aiPlayer.eitr >= ability.cost && gameState.lastUsedAbilityP2 !== ability.name) {
                aiPlayer.eitr -= ability.cost;
                aiPlayer.skipStreak = 0;
                gameState.lastUsedAbilityP2 = ability.name;

                if (ability.target === "enemy_single") {
                    let targetLetter = aliveOpponents[Math.floor(Math.random() * aliveOpponents.length)];
                    let dmg = ability.damage || 3.0;
                    targetPlayer.letters[targetLetter].hp = Math.max(0, targetPlayer.letters[targetLetter].hp - dmg);
                    if (ability.status) targetPlayer.letters[targetLetter].status = ability.status;
                    logCombat(`AI used ${ability.name} on your letter ${targetLetter}, dealing ${dmg} damage!`);
                    showPopup(`AI attacked your ${targetLetter} for ${dmg} dmg!`);
                } else {
                    logCombat(`AI used ${ability.name} on letter ${chosenLetter}!`);
                    showPopup(`AI used ${ability.name}!`);
                }
            } else {
                let gain = 3 * Math.pow(2, aiPlayer.skipStreak);
                aiPlayer.eitr = Math.min(MAX_EITR, aiPlayer.eitr + gain);
                aiPlayer.skipStreak++;
                logCombat(`AI skipped turn and gained +${gain} 🔮 Eitr.`);
                showPopup(`AI skipped turn!`);
            }
        }

        checkWinCondition();
        
        gameState.actionsTakenTurn = 0;
        gameState.turn = 'p1';
        render();
    }, 1000);
}

// Check Win Condition
function checkWinCondition() {
    const p1Hp = gameState.p1.getTotalHp();
    const p2Hp = gameState.p2.getTotalHp();

    if (p1Hp <= 0) {
        logCombat(`Player 2 / AI wins the game!`);
        showPopup(`Game Over! ${gameState.mode === 'ai' ? 'AI' : 'Player 2'} Wins!`);
        setTimeout(() => location.reload(), 4000);
    } else if (p2Hp <= 0) {
        logCombat(`Player 1 wins the game!`);
        showPopup(`Game Over! Player 1 Wins!`);
        setTimeout(() => location.reload(), 4000);
    }
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
