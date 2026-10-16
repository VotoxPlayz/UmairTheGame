// --- Game State Constants & Variables ---
const MAX_EITR = 30;
const INITIAL_EITR = 30;
const LETTERS = ['U', 'M', 'A', 'I', 'R'];

let gameState = {
    mode: 'ai', 
    round: 1,
    turn: 'p1', 
    p1: null,
    p2: null,
    selectedLetterP1: 'U',
    selectedLetterP2: 'U',
    actionsTakenTurn: 0,
    lastUsedAbilityP1: null,
    lastUsedAbilityP2: null,
    charSelectStep: 1,
    targetingState: null,
    lastDamageDealtByP1: 0,
    lastDamageDealtByP2: 0,
    lastDamageTakenByM_P1: 0,
    lastDamageTakenByM_P2: 0
};

// Ability definitions per Letter
const LETTER_ABILITIES = {
    'U': {
        a1: { name: "Resurrection", cost: 12, targetType: "resurrection_choice", bloodCost: 0, desc: "Revives a dead letter with 3.0 HP OR heals a live letter by 5.0 HP." },
        a2: { name: "Bastion", cost: 6, targetType: "friendly_multi", maxTargets: 2, bloodCost: 0, desc: "Protects up to 2 letters with Bastion (🛡️ 50% Def) until hit." }
    },
    'M': {
        a1: { name: "Copycat", cost: 12, targetType: "enemy_single", bloodCost: 0.10, desc: "Copies opponent's last move damage to a target letter. (Costs 10% Blood Magic on M)." },
        a2: { name: "Mind Swap", cost: 18, targetType: "enemy_single", bloodCost: 0, desc: "Swaps current HP percentage between your letter M and a selected enemy letter!" }
    },
    'A': {
        a1: { name: "Conical Happiness", cost: 15, targetType: "direct", bloodCost: 0, desc: "Heals surrounding letters by 50% of A's HP, decaying by 50% each step." },
        a2: { name: "Unity", cost: 16, targetType: "enemy_multi", maxTargets: 2, bloodCost: 0, desc: "Deals split damage equal to 15% of your total team HP across up to 2 letters." }
    },
    'I': {
        a1: { name: "Poison", cost: 15, targetType: "enemy_multi", maxTargets: 2, bloodCost: 0.15, desc: "Applies ☠️ Poison (+75% damage intake) for 2 rounds to up to 2 letters. (Costs 15% Blood Magic on I)." },
        a2: { name: "Staff of Embers", cost: 10, targetType: "enemy_multi", maxTargets: 2, bloodCost: 0.08, desc: "Applies 🔥 On Fire (-25% current HP/round) to up to 2 letters. Clears when letter uses an ability. (Costs 8% Blood Magic on I)." }
    },
    'R': {
        a1: { name: "Eitr Overload", cost: 10, targetType: "enemy_single", bloodCost: 0, desc: "Converts your current Eitr reserve into raw burst damage (25% of current Eitr)." },
        a2: { name: "Staff of Immunity", cost: 15, targetType: "friendly_multi", maxTargets: 2, bloodCost: 0, desc: "Grants 🛡️ +50% resistance & debuff immunity for 2 rounds to up to 2 letters." }
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
                statuses: {
                    fire: false,
                    poison: 0,
                    immunity: 0,
                    bastion: false
                }
            };
        });
    }

    getTotalHp() {
        return Object.values(this.letters).reduce((sum, l) => sum + Math.max(0, l.hp), 0);
    }

    getHighestHpLetter() {
        let maxL = 'U';
        LETTERS.forEach(l => {
            if (this.letters[l].hp > this.letters[maxL].hp) maxL = l;
        });
        return this.letters[maxL].hp;
    }

    getBastionCount() {
        return LETTERS.filter(l => this.letters[l].statuses.bastion).length;
    }
}

// Mode Selection
function setGameMode(mode) {
    gameState.mode = mode;
    document.getElementById('mode-select-screen').classList.add('hidden');
    document.getElementById('char-select-screen').classList.remove('hidden');
    document.getElementById('p2-header-title').innerText = (mode === 'ai') ? 'AI Opponent' : 'Player 2';
}

// Character Selection
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
function showBaseInfo() {
    document.getElementById('ability-tooltip').innerHTML = `<strong>⚔️ Basic Strike</strong> [Cost: 3 🔮] — Deals 2.5 damage to a selected enemy letter regardless of letter state.`;
}

function showAbilityInfo(slot) {
    const activeLetter = gameState.turn === 'p1' ? gameState.selectedLetterP1 : gameState.selectedLetterP2;
    const ability = slot === 1 ? LETTER_ABILITIES[activeLetter].a1 : LETTER_ABILITIES[activeLetter].a2;
    document.getElementById('ability-tooltip').innerHTML = `<strong>${ability.name}</strong> [Cost: ${ability.cost} 🔮] — ${ability.desc}`;
}

function showUltInfo() {
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    let ultName = "Ultimate Ability", ultDesc = "One-time powerful game-changing skill. Consumes entire turn!";
    if (p.char === 'K') { ultName = "Deflect"; ultDesc = "Reflects 100% attack damage & regains 100% damage as 🔮."; }
    else if (p.char === 'H') { ultName = "Absorb"; ultDesc = "Absorbs attack into health + 95% damage resistance for 2 turns."; }
    else if (p.char === 'A') { ultName = "Staff of Frost"; ultDesc = "Freeze 2 opponent letters for 1 round + deals 30% of highest HP letter damage."; }
    else if (p.char === 'N') { ultName = "Greydwarf Shaman"; ultDesc = "Heals all letters by 35% of highest HP letter + grants HP×10% resistance."; }
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

    document.getElementById('p1-side').classList.toggle('active-turn', gameState.turn === 'p1');
    document.getElementById('p2-side').classList.toggle('active-turn', gameState.turn === 'p2');

    document.getElementById('btn-skip').disabled = (gameState.actionsTakenTurn > 0);
    document.getElementById('btn-ultimate').disabled = (!activePlayer.ultAvailable || gameState.actionsTakenTurn > 0);

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
            
            let isTargetable = false;
            if (gameState.targetingState) {
                const ts = gameState.targetingState;
                if ((ts.targetSide === 'enemy' && ((gameState.turn === 'p1' && pid === 'p2') || (gameState.turn === 'p2' && pid === 'p1'))) ||
                    (ts.targetSide === 'friendly' && pid === gameState.turn) ||
                    (ts.targetSide === 'resurrection_any' && pid === gameState.turn)) {
                    if (!ts.chosenTargets.includes(l)) {
                        if (ts.targetSide === 'resurrection_any' || letterObj.hp > 0) {
                            isTargetable = true;
                        }
                    }
                }
            }

            const card = document.createElement('div');
            card.className = `letter-card ${letterObj.hp <= 0 ? 'dead' : ''} ${letterObj.frozen > 0 ? 'frozen' : ''} ${isSelected ? 'selected' : ''} ${isTargetable ? 'targetable' : ''}`;
            
            let statusHtml = '';
            if (letterObj.hp > 0) {
                if (letterObj.frozen > 0) statusHtml += `<div class="status-badge">❄️ Frozen</div>`;
                if (letterObj.statuses.fire) statusHtml += `<div class="status-badge">🔥 Fire</div>`;
                if (letterObj.statuses.poison > 0) statusHtml += `<div class="status-badge">☠️ Poison (${letterObj.statuses.poison}r)</div>`;
                if (letterObj.statuses.immunity > 0) statusHtml += `<div class="status-badge">🛡️ Immunity (${letterObj.statuses.immunity}r)</div>`;
                if (letterObj.statuses.bastion) statusHtml += `<div class="status-badge">🛡️ Bastion</div>`;
            }

            card.innerHTML = `<div>${l}</div><div style="font-size:0.75rem;">${letterObj.hp.toFixed(1)}</div><div class="status-badges">${statusHtml}</div>`;
            
            card.onclick = () => {
                if (gameState.targetingState) {
                    if (isTargetable) {
                        handleTargetSelection(l);
                    } else {
                        showPopup("Select a valid target letter!");
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

    // Update Action Button Labels
    document.getElementById('active-letter-tag').innerText = activeLetter;
    if (LETTER_ABILITIES[activeLetter]) {
        document.getElementById('btn-ability-1').innerText = `${LETTER_ABILITIES[activeLetter].a1.name} (${LETTER_ABILITIES[activeLetter].a1.cost} 🔮)`;
        document.getElementById('btn-ability-2').innerText = `${LETTER_ABILITIES[activeLetter].a2.name} (${LETTER_ABILITIES[activeLetter].a2.cost} 🔮)`;
    }

    const currentSkipGain = 3 * Math.pow(2, activePlayer.skipStreak);
    document.getElementById('skip-eitr-val').innerText = currentSkipGain;

    document.getElementById('controls-panel').style.opacity = (gameState.turn === 'p2' && gameState.mode === 'ai') ? '0.5' : '1';
}

// Universal Base Attack
function prepareBaseAttack() {
    if (gameState.turn === 'p2' && gameState.mode === 'ai') return;
    if (gameState.actionsTakenTurn >= 2) return showPopup("Maximum 2 actions allowed per turn!");

    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    if (p.eitr < 3) return showPopup("Not enough 🔮 Eitr! Basic Strike costs 3 Eitr.");

    setupTargeting("base_attack", null, { name: "Basic Strike", cost: 3 }, 'enemy', 1);
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

    if (ability.name === "Bastion" && p.getBastionCount() >= 2) {
        return showPopup("Bastion limit reached! Maximum 2 letters can have Bastion.");
    }

    if (ability.targetType === "resurrection_choice") {
        setupTargeting("ability", slot, ability, 'resurrection_any', 1);
    } else if (ability.targetType === "enemy_single") {
        setupTargeting("ability", slot, ability, 'enemy', 1);
    } else if (ability.targetType === "enemy_multi") {
        setupTargeting("ability", slot, ability, 'enemy', ability.maxTargets || 2);
    } else if (ability.targetType === "friendly_multi") {
        setupTargeting("ability", slot, ability, 'friendly', ability.maxTargets || 2);
    } else {
        executeDirectAbility(slot, ability);
    }
}

// Prepare Ultimate Click
function prepareUltimate() {
    if (gameState.turn === 'p2' && gameState.mode === 'ai') return;
    if (gameState.actionsTakenTurn > 0) {
        return showPopup("Ultimates take your entire turn! Cannot cast after using an ability.");
    }

    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    if (!p.ultAvailable) return showPopup("Ultimate already used!");

    if (p.char === 'A') {
        setupTargeting("ult", null, { name: "Staff of Frost" }, 'enemy', 2);
    } else {
        executeUltimateDirectly();
    }
}

// Setup Multi-Targeting Prompt
function setupTargeting(type, slot, ability, targetSide, maxTargets) {
    gameState.targetingState = {
        type,
        slot,
        ability,
        targetSide,
        maxTargets,
        chosenTargets: []
    };
    showPopup(`Select target ${targetSide} letter for ${ability.name}`);
    render();
}

// Handle Target Selection Click
function handleTargetSelection(selectedLetter) {
    const ts = gameState.targetingState;
    ts.chosenTargets.push(selectedLetter);

    if (ts.chosenTargets.length < ts.maxTargets) {
        const targetP = ts.targetSide === 'enemy' ? (gameState.turn === 'p1' ? gameState.p2 : gameState.p1) : gameState[gameState.turn];
        const liveCount = LETTERS.filter(l => targetP.letters[l].hp > 0).length;
        if (ts.chosenTargets.length < liveCount) {
            showPopup(`Select target ${ts.targetSide} letter ${ts.chosenTargets.length + 1} of ${ts.maxTargets}`);
            render();
            return;
        }
    }

    const targets = [...ts.chosenTargets];
    const type = ts.type;
    const slot = ts.slot;
    const ability = ts.ability;
    gameState.targetingState = null;

    if (type === "base_attack") {
        executeBaseAttack(targets[0]);
    } else if (type === "ability") {
        executeTargetedAbility(slot, ability, targets);
    } else if (type === "ult") {
        executeUltimateTargeted(targets);
    }
}

// Execute Universal Base Attack
function executeBaseAttack(targetLetter) {
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const opp = gameState.turn === 'p1' ? gameState.p2 : gameState.p1;
    const activeL = gameState.turn === 'p1' ? gameState.selectedLetterP1 : gameState.selectedLetterP2;

    p.eitr -= 3;
    p.skipStreak = 0;
    gameState.actionsTakenTurn++;

    applyDamageToLetter(opp, targetLetter, 2.5, activeL);
    triggerScreenShake();
    logCombat(`${gameState.turn.toUpperCase()} used Basic Strike ⚔️ on ${targetLetter} for 2.5 damage!`);
    showPopup(`Basic Strike dealt 2.5 dmg to ${targetLetter}!`);

    checkWinCondition();
    render();
}

// Execute Targeted Ability
function executeTargetedAbility(slot, ability, targets) {
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const opp = gameState.turn === 'p1' ? gameState.p2 : gameState.p1;
    const activeL = gameState.turn === 'p1' ? gameState.selectedLetterP1 : gameState.selectedLetterP2;

    p.eitr -= ability.cost;
    p.skipStreak = 0;
    if (gameState.turn === 'p1') gameState.lastUsedAbilityP1 = ability.name;
    else gameState.lastUsedAbilityP2 = ability.name;

    gameState.actionsTakenTurn++;

    if (p.letters[activeL].statuses.fire) {
        p.letters[activeL].statuses.fire = false;
        logCombat(`🔥 Fire extinguished on ${activeL} by casting an ability!`);
    }

    if (ability.bloodCost > 0) {
        const bloodSacrifice = 10.0 * ability.bloodCost;
        p.letters[activeL].hp = Math.max(0.1, p.letters[activeL].hp - bloodSacrifice);
        logCombat(`🩸 Blood Magic cost: ${activeL} sacrificed ${bloodSacrifice.toFixed(1)} HP.`);
    }

    if (ability.name === "Resurrection") {
        let tLetter = targets[0];
        if (p.letters[tLetter].hp <= 0) {
            p.letters[tLetter].hp = 3.0;
            p.letters[tLetter].statuses = { fire: false, poison: 0, immunity: 0, bastion: false };
            logCombat(`${gameState.turn.toUpperCase()} Resurrection revived letter ${tLetter} with 3.0 HP!`);
            showPopup(`Revived ${tLetter} with 3.0 HP!`);
        } else {
            p.letters[tLetter].hp = Math.min(10.0, p.letters[tLetter].hp + 5.0);
            logCombat(`${gameState.turn.toUpperCase()} Resurrection healed letter ${tLetter} by +5.0 HP!`);
            showPopup(`Healed ${tLetter} by +5.0 HP!`);
        }
    } else if (ability.name === "Copycat") {
        let lastDmg = gameState.turn === 'p1' ? gameState.lastDamageDealtByP2 : gameState.lastDamageDealtByP1;
        if (lastDmg === 0) lastDmg = 3.0;
        applyDamageToLetter(opp, targets[0], lastDmg, activeL);
        triggerScreenShake();
        logCombat(`${gameState.turn.toUpperCase()} Copycat dealt ${lastDmg.toFixed(1)} damage to ${targets[0]}!`);
    } else if (ability.name === "Mind Swap") {
        let targetHpPercent = opp.letters[targets[0]].hp / 10.0;
        let selfHpPercent = p.letters['M'].hp / 10.0;
        
        opp.letters[targets[0]].hp = selfHpPercent * 10.0;
        p.letters['M'].hp = targetHpPercent * 10.0;
        triggerScreenShake();
        logCombat(`${gameState.turn.toUpperCase()} Mind Swap swapped HP percentages between M and ${targets[0]}!`);
        showPopup(`Mind Swapped with ${targets[0]}!`);
    } else if (ability.name === "Eitr Overload") {
        let overloadDmg = p.eitr * 0.25;
        applyDamageToLetter(opp, targets[0], overloadDmg, activeL);
        triggerScreenShake();
        logCombat(`${gameState.turn.toUpperCase()} Eitr Overload converted energy into ${overloadDmg.toFixed(1)} damage on ${targets[0]}!`);
    } else if (ability.name === "Bastion") {
        targets.forEach(t => { 
            if (p.getBastionCount() < 2) p.letters[t].statuses.bastion = true; 
        });
        logCombat(`${gameState.turn.toUpperCase()} applied Bastion Shield 🛡️ to ${targets.join(', ')}.`);
    } else if (ability.name === "Unity") {
        let totalTeamHp = p.getTotalHp();
        let splitDmg = (totalTeamHp * 0.15) / targets.length;
        targets.forEach(t => { applyDamageToLetter(opp, t, splitDmg, activeL); });
        triggerScreenShake();
        logCombat(`${gameState.turn.toUpperCase()} Unity dealt ${splitDmg.toFixed(1)} split damage to ${targets.join(', ')}.`);
    } else if (ability.name === "Poison") {
        targets.forEach(t => { 
            if (opp.letters[t].statuses.immunity <= 0) opp.letters[t].statuses.poison = 2; 
        });
        logCombat(`${gameState.turn.toUpperCase()} applied ☠️ Poison (2 rounds) to ${targets.join(', ')}.`);
    } else if (ability.name === "Staff of Embers") {
        targets.forEach(t => { 
            if (opp.letters[t].statuses.immunity <= 0) opp.letters[t].statuses.fire = true; 
        });
        logCombat(`${gameState.turn.toUpperCase()} applied 🔥 On Fire (-25% HP/round) to ${targets.join(', ')}.`);
    } else if (ability.name === "Staff of Immunity") {
        targets.forEach(t => { p.letters[t].statuses.immunity = 2; });
        logCombat(`${gameState.turn.toUpperCase()} applied Staff of Immunity 🛡️ (2 rounds) to ${targets.join(', ')}.`);
    }

    checkWinCondition();
    render();
}

// Execute Direct Abilities
function executeDirectAbility(slot, ability) {
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const activeL = gameState.turn === 'p1' ? gameState.selectedLetterP1 : gameState.selectedLetterP2;

    p.eitr -= ability.cost;
    p.skipStreak = 0;
    if (gameState.turn === 'p1') gameState.lastUsedAbilityP1 = ability.name;
    else gameState.lastUsedAbilityP2 = ability.name;

    gameState.actionsTakenTurn++;

    if (p.letters[activeL].statuses.fire) {
        p.letters[activeL].statuses.fire = false;
        logCombat(`🔥 Fire extinguished on ${activeL} by casting an ability!`);
    }

    if (ability.name === "Conical Happiness") {
        let idx = LETTERS.indexOf(activeL);
        let baseHeal = p.letters[activeL].hp * 0.5;
        
        if (idx + 1 < LETTERS.length && p.letters[LETTERS[idx + 1]].hp > 0) {
            p.letters[LETTERS[idx + 1]].hp = Math.min(10.0, p.letters[LETTERS[idx + 1]].hp + baseHeal);
            if (idx + 2 < LETTERS.length && p.letters[LETTERS[idx + 2]].hp > 0) {
                p.letters[LETTERS[idx + 2]].hp = Math.min(10.0, p.letters[LETTERS[idx + 2]].hp + (baseHeal * 0.5));
            }
        }
        if (idx - 1 >= 0 && p.letters[LETTERS[idx - 1]].hp > 0) {
            p.letters[LETTERS[idx - 1]].hp = Math.min(10.0, p.letters[LETTERS[idx - 1]].hp + baseHeal);
            if (idx - 2 >= 0 && p.letters[LETTERS[idx - 2]].hp > 0) {
                p.letters[LETTERS[idx - 2]].hp = Math.min(10.0, p.letters[LETTERS[idx - 2]].hp + (baseHeal * 0.5));
            }
        }
        logCombat(`${gameState.turn.toUpperCase()} Conical Happiness healed surrounding letters of ${activeL}!`);
    }

    checkWinCondition();
    render();
}

// Execute Ultimate Abilities
function executeUltimateDirectly() {
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    p.ultAvailable = false;
    p.skipStreak = 0;
    gameState.actionsTakenTurn = 2;

    triggerScreenShake();

    if (p.char === 'K') {
        logCombat(`${gameState.turn.toUpperCase()} activated Deflect (Ult)! Reflects 100% damage & restores Eitr.`);
    } else if (p.char === 'H') {
        LETTERS.forEach(l => { if (p.letters[l].hp > 0) p.letters[l].statuses.immunity = 2; });
        logCombat(`${gameState.turn.toUpperCase()} activated Absorb (Ult)! 95% damage resistance for 2 turns.`);
    } else if (p.char === 'N') {
        let maxHp = p.getHighestHpLetter();
        LETTERS.forEach(l => {
            if (p.letters[l].hp > 0) {
                p.letters[l].hp = Math.min(10.0, p.letters[l].hp + (maxHp * 0.35)); // Rebalanced 35%
                p.letters[l].statuses.immunity = 2;
            }
        });
        logCombat(`${gameState.turn.toUpperCase()} activated Greydwarf Shaman (Ult)! Healed team by 35% of highest HP (${(maxHp * 0.35).toFixed(1)} HP).`);
    }

    checkWinCondition();
    render();
}

function executeUltimateTargeted(targets) {
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const opp = gameState.turn === 'p1' ? gameState.p2 : gameState.p1;
    const activeL = gameState.turn === 'p1' ? gameState.selectedLetterP1 : gameState.selectedLetterP2;
    p.ultAvailable = false;
    p.skipStreak = 0;
    gameState.actionsTakenTurn = 2;

    triggerScreenShake();

    if (p.char === 'A') {
        let maxHp = p.getHighestHpLetter();
        let dmg = maxHp * 0.3;
        targets.forEach(t => {
            if (opp.letters[t].statuses.immunity <= 0) opp.letters[t].frozen = 1;
            applyDamageToLetter(opp, t, dmg, activeL);
        });
        logCombat(`${gameState.turn.toUpperCase()} Staff of Frost (Ult) froze and dealt ${dmg.toFixed(1)} dmg to ${targets.join(', ')}!`);
    }

    checkWinCondition();
    render();
}

// Helper Damage Processor with K Thorns Fix & Visual Number Popups
function applyDamageToLetter(targetPlayer, letterKey, rawDamage, attackerLetter = 'U') {
    let finalDmg = rawDamage;

    if (targetPlayer.letters[letterKey].statuses.poison > 0) finalDmg *= 1.75;
    if (targetPlayer.letters[letterKey].statuses.immunity > 0) finalDmg *= 0.5;
    if (targetPlayer.letters[letterKey].statuses.bastion) {
        finalDmg *= 0.5;
        targetPlayer.letters[letterKey].statuses.bastion = false;
    }

    if (targetPlayer.char === 'H') finalDmg *= 0.85;

    targetPlayer.letters[letterKey].hp = Math.max(0, targetPlayer.letters[letterKey].hp - finalDmg);
    spawnFloatingNumber(targetPlayer.id, letterKey, `-${finalDmg.toFixed(1)}`);

    if (targetPlayer.id === 'p1') {
        gameState.lastDamageDealtByP2 = finalDmg;
        if (letterKey === 'M') gameState.lastDamageTakenByM_P1 = finalDmg;
    } else {
        gameState.lastDamageDealtByP1 = finalDmg;
        if (letterKey === 'M') gameState.lastDamageTakenByM_P2 = finalDmg;
    }

    // Fixed K Thorns: Reflects directly back to the exact attacking letter
    if (targetPlayer.char === 'K') {
        const attackerPlayer = targetPlayer.id === 'p1' ? gameState.p2 : gameState.p1;
        const thornReflect = finalDmg * 0.10;
        if (attackerPlayer.letters[attackerLetter] && attackerPlayer.letters[attackerLetter].hp > 0) {
            attackerPlayer.letters[attackerLetter].hp = Math.max(0, attackerPlayer.letters[attackerLetter].hp - thornReflect);
            spawnFloatingNumber(attackerPlayer.id, attackerLetter, `-${thornReflect.toFixed(1)}`);
            logCombat(`🌵 Thorns reflect dealt ${thornReflect.toFixed(1)} damage back to attacking letter ${attackerLetter}!`);
        }
    }
}

// Visual Effects Utilities
function triggerScreenShake() {
    const el = document.getElementById('game-container');
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 350);
}

function spawnFloatingNumber(playerId, letterKey, text) {
    const layer = document.getElementById('damage-float-layer');
    const floatEl = document.createElement('div');
    floatEl.className = 'float-num';
    floatEl.innerText = text;

    // Approximate positioning based on side and letter index
    const isP1 = playerId === 'p1';
    const lIndex = LETTERS.indexOf(letterKey);
    const xBase = isP1 ? 15 + (lIndex * 7) : 60 + (lIndex * 7);
    
    floatEl.style.left = `${xBase}%`;
    floatEl.style.top = `40%`;

    layer.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 800);
}

// Skip Turn Logic
function skipTurn() {
    if (gameState.turn === 'p2' && gameState.mode === 'ai') return;
    if (gameState.actionsTakenTurn > 0) return showPopup("Cannot skip turn after taking an action!");

    gameState.targetingState = null;
    const p = gameState.turn === 'p1' ? gameState.p1 : gameState.p2;
    const gain = 3 * Math.pow(2, p.skipStreak);
    p.eitr = Math.min(MAX_EITR, p.eitr + gain);
    p.skipStreak++;
    logCombat(`${gameState.turn.toUpperCase()} skipped turn and gained +${gain} 🔮 Eitr.`);
    endTurn();
}

// End Turn & Increment Round Counter
function endTurn() {
    if (gameState.turn === 'p2' && gameState.mode === 'ai') return;
    gameState.targetingState = null;

    gameState.actionsTakenTurn = 0;
    gameState.turn = gameState.turn === 'p1' ? 'p2' : 'p1';

    // Round increments when turn cycles back to Player 1
    if (gameState.turn === 'p1') {
        gameState.round++;
        document.getElementById('round-num').innerText = gameState.round;

        ['p1', 'p2'].forEach(pid => {
            const playerObj = gameState[pid];
            LETTERS.forEach(l => {
                const letter = playerObj.letters[l];
                if (letter.hp > 0) {
                    if (letter.statuses.fire) {
                        if (letter.hp < 1.0) {
                            letter.hp = 0;
                            logCombat(`🔥 Fire executed ${pid.toUpperCase()}'s letter ${l} (under 1.0 HP)!`);
                        } else {
                            const fireDmg = letter.hp * 0.25;
                            letter.hp = Math.max(0, letter.hp - fireDmg);
                            spawnFloatingNumber(pid, l, `-${fireDmg.toFixed(1)}`);
                            logCombat(`🔥 Fire DoT dealt ${fireDmg.toFixed(1)} damage (-25%) to ${pid.toUpperCase()}'s letter ${l}.`);
                        }
                    }
                    if (letter.statuses.poison > 0) letter.statuses.poison--;
                    if (letter.statuses.immunity > 0) letter.statuses.immunity--;
                    if (letter.frozen > 0) letter.frozen--;
                }
            });
        });
    }

    gameState.p1.eitr = Math.min(MAX_EITR, gameState.p1.eitr + 1);
    gameState.p2.eitr = Math.min(MAX_EITR, gameState.p2.eitr + 1);

    render();

    if (gameState.turn === 'p2' && gameState.mode === 'ai') {
        setTimeout(aiTurn, 800);
    }
}

// Smart AI Turn Engine
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
                if (ability.targetType === "enemy_single" || ability.targetType === "enemy_multi") {
                    let targets = [aliveOpponents[Math.floor(Math.random() * aliveOpponents.length)]];
                    executeTargetedAbility(1, ability, targets);
                } else if (ability.targetType === "friendly_multi" || ability.targetType === "resurrection_choice") {
                    let targets = [aliveLetters[Math.floor(Math.random() * aliveLetters.length)]];
                    executeTargetedAbility(1, ability, targets);
                } else {
                    executeDirectAbility(1, ability);
                }
            } else {
                let gain = 3 * Math.pow(2, aiPlayer.skipStreak);
                aiPlayer.eitr = Math.min(MAX_EITR, aiPlayer.eitr + gain);
                aiPlayer.skipStreak++;
                logCombat(`AI skipped turn and gained +${gain} 🔮 Eitr.`);
            }
        }

        checkWinCondition();
        
        gameState.actionsTakenTurn = 0;
        gameState.turn = 'p1';
        render();
    }, 1000);
}

// Check Win Condition & Trigger Victory Modal
function checkWinCondition() {
    const p1Hp = gameState.p1.getTotalHp();
    const p2Hp = gameState.p2.getTotalHp();

    if (p1Hp <= 0 || p2Hp <= 0) {
        const winner = p1Hp > 0 ? "Player 1" : (gameState.mode === 'ai' ? "AI Opponent" : "Player 2");
        document.getElementById('victory-title').innerText = `🎉 ${winner.toUpperCase()} WINS! 🎉`;
        document.getElementById('victory-msg').innerText = `Congratulations! ${winner} has wiped out all enemy letters and won the game!`;
        document.getElementById('victory-screen').classList.remove('hidden');
    }
}

function showPopup(text) {
    const pop = document.getElementById('action-popup');
    pop.innerText = text;
    pop.classList.remove('hidden');
    setTimeout(() => pop.classList.add('hidden'), 2200);
}

function logCombat(msg) {
    const log = document.getElementById('combat-log');
    log.innerHTML += `<div>> ${msg}</div>`;
    log.scrollTop = log.scrollHeight;
}
