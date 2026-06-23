(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const ui = {
    startScreen: document.getElementById("startScreen"),
    startButton: document.getElementById("startButton"),
    settingsButton: document.getElementById("settingsButton"),
    settingsPanel: document.getElementById("settingsPanel"),
    settingsHint: document.getElementById("settingsHint"),
    closeSettingsButton: document.getElementById("closeSettingsButton"),
    resetMappingsButton: document.getElementById("resetMappingsButton"),
    mapButtons: [...document.querySelectorAll(".map-button")],
    mapLabels: {
      up: document.getElementById("mapUp"),
      left: document.getElementById("mapLeft"),
      right: document.getElementById("mapRight"),
      down: document.getElementById("mapDown"),
    },
    messagePanel: document.getElementById("messagePanel"),
    messageTitle: document.getElementById("messageTitle"),
    messageText: document.getElementById("messageText"),
    restartButton: document.getElementById("restartButton"),
    score: document.getElementById("score"),
    lives: document.getElementById("lives"),
    round: document.getElementById("round"),
    prompt: document.getElementById("prompt"),
    gamepadStatus: document.getElementById("gamepadStatus"),
  };

  const directions = ["up", "left", "right", "down"];
  const directionLabels = {
    up: "верхний островок",
    left: "левый островок",
    right: "правый островок",
    down: "нижний островок",
  };
  const digitWords = [
    "ноль",
    "один",
    "два",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
    "десять",
  ];
  const praisePhrases = ["Молодец", "Умничка", "Так держать"];
  const defaultButtonMap = { up: 12, down: 13, left: 14, right: 15 };
  const directionNames = { up: "Вверх", left: "Влево", right: "Вправо", down: "Вниз" };
  const savedButtonMap = (() => {
    try {
      return JSON.parse(localStorage.getItem("catIslandButtonMap") || "null");
    } catch {
      return null;
    }
  })();

  const state = {
    w: 1,
    h: 1,
    dpr: 1,
    score: 0,
    lives: 3,
    solved: 0,
    streak: 0,
    mode: "menu",
    roundKind: "number",
    target: null,
    choices: [],
    cat: { x: 0, y: 0, homeX: 0, homeY: 0, mood: "idle", blink: 0 },
    motion: null,
    particles: [],
    fireworks: [],
    grassTop: 0,
    time: 0,
    lastInputAt: 0,
    gamepadName: "",
    settingsOpen: false,
    captureDir: null,
    buttonMap: { ...defaultButtonMap, ...(savedButtonMap || {}) },
    previousButtons: [],
  };

  let audio = null;

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = Math.floor(window.innerWidth);
    state.h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(state.w * state.dpr);
    canvas.height = Math.floor(state.h * state.dpr);
    canvas.style.width = `${state.w}px`;
    canvas.style.height = `${state.h}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    state.grassTop = state.h * 0.72;
    state.cat.homeX = state.w * 0.38;
    state.cat.homeY = state.grassTop - Math.min(72, state.h * 0.09);
    if (!state.motion) {
      state.cat.x = state.cat.homeX;
      state.cat.y = state.cat.homeY;
    }
    layoutChoices();
  }

  function layoutChoices() {
    const platformW = clamp(state.w * 0.18, 150, 250);
    const platformH = clamp(state.h * 0.052, 34, 48);
    const positions = {
      up: [0.5, 0.23],
      left: [0.31, 0.4],
      right: [0.69, 0.4],
      down: [0.5, 0.56],
    };

    for (const choice of state.choices) {
      const [px, py] = positions[choice.dir];
      choice.x = state.w * px;
      choice.y = state.h * py;
      choice.w = platformW;
      choice.h = platformH;
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startGame() {
    ui.startScreen.classList.add("hidden");
    ui.messagePanel.classList.add("hidden");
    state.score = 0;
    state.lives = 3;
    state.solved = 0;
    state.streak = 0;
    state.mode = "playing";
    state.motion = null;
    state.particles = [];
    state.fireworks = [];
    state.cat.x = state.cat.homeX;
    state.cat.y = state.cat.homeY;
    state.cat.mood = "ready";
    updateHud();
    startAudio();
    enterFullscreen();
    setTimeout(nextRound, 350);
  }

  function enterFullscreen() {
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    }
  }

  function updateHud() {
    ui.score.textContent = String(state.score);
    ui.lives.textContent = "♥".repeat(state.lives) || "0";
    ui.round.textContent = String(state.solved);
  }

  function nextRound() {
    if (state.solved >= 20) {
      winGame();
      return;
    }

    state.mode = "playing";
    state.roundKind = Math.random() < 0.23 && state.solved > 1 ? "food" : "number";
    state.choices = directions.map((dir) => ({ dir, x: 0, y: 0, w: 0, h: 0, value: null, food: null }));
    layoutChoices();

    if (state.roundKind === "food") {
      state.target = randomItem(state.choices);
      state.target.food = randomItem(["apple", "donut"]);
      const numbers = shuffle([...Array(11).keys()]).slice(0, 3);
      let numberIndex = 0;
      for (const choice of state.choices) {
        if (choice !== state.target) {
          choice.value = numbers[numberIndex];
          numberIndex += 1;
        }
      }
      const foodName = state.target.food === "apple" ? "яблоко" : "пончик";
      ui.prompt.textContent = `Съешь ${foodName}: ${directionLabels[state.target.dir]}`;
      speak(`Съешь ${foodName}`);
    } else {
      const numbers = shuffle([...Array(11).keys()]).slice(0, 4);
      state.choices.forEach((choice, index) => {
        choice.value = numbers[index];
      });
      state.target = randomItem(state.choices);
      ui.prompt.textContent = `Голос сказал: цифра ${digitWords[state.target.value]}`;
      speak(`Цифра ${digitWords[state.target.value]}`);
    }
  }

  function speak(text) {
    if (!window.speechSynthesis) return;

    const say = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.volume = 1;
      utterance.rate = 0.9;
      utterance.pitch = 1.16;
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith("ru")) || null;
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      setTimeout(say, 180);
      return;
    }
    say();
  }

  function startAudio() {
    if (audio) {
      audio.ctx.resume().then(() => {
        startBackgroundMusic();
        playStartJingle();
      }).catch(() => {});
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const audioCtx = new AudioContext();
    const master = audioCtx.createGain();
    master.gain.value = 0.11;
    master.connect(audioCtx.destination);
    audio = {
      ctx: audioCtx,
      master,
      music: new Audio("vavan-rossija.mp3"),
    };
    audio.music.loop = true;
    audio.music.volume = 0.07;

    audio.ctx.resume().then(() => {
      startBackgroundMusic();
      playStartJingle();
    }).catch(() => {});
  }

  function startBackgroundMusic() {
    if (!audio?.music) return;
    audio.music.play().catch(() => {
      ui.prompt.textContent = "Нажми «Начать игру» ещё раз, чтобы включить музыку";
    });
  }

  function playStartJingle() {
    playTone(659.25, 0.12, "triangle", 0.95);
    setTimeout(() => playTone(880, 0.14, "triangle", 0.85), 110);
    setTimeout(() => playTone(1046.5, 0.18, "triangle", 0.75), 220);
  }

  function playTone(frequency, length, type, volume) {
    if (!audio) return;
    const now = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(now);
    osc.stop(now + length + 0.04);
  }

  function handleDirection(dir) {
    if (state.mode !== "playing" || state.motion) return;
    const now = performance.now();
    if (now - state.lastInputAt < 180) return;
    state.lastInputAt = now;

    const chosen = state.choices.find((choice) => choice.dir === dir);
    if (!chosen) return;
    const correct = chosen === state.target;
    state.cat.mood = correct ? "happy" : "sad";
    state.motion = makeMotion(chosen, correct);

    if (correct) {
      state.score += state.roundKind === "food" ? 25 : 10;
      state.solved += 1;
      state.streak += 1;
      const praise = getPraisePhrase();
      ui.prompt.textContent = praise;
      speak(praise);
      playTone(1046.5, 0.16, "triangle", 0.8);
      playTone(1318.5, 0.2, "triangle", 0.45);
      burst(chosen.x, chosen.y - chosen.h * 0.9, ["#fff176", "#69f0ae", "#40c4ff"]);
    } else {
      state.lives -= 1;
      state.streak = 0;
      ui.prompt.textContent = `Мимо! Нужно было: ${directionLabels[state.target.dir]}`;
      playTone(164.81, 0.24, "sawtooth", 0.45);
      burst(chosen.x, chosen.y - chosen.h * 0.9, ["#ff5252", "#ffab40"]);
    }

    updateHud();
  }

  function getPraisePhrase() {
    if (state.streak > 0 && state.streak % 3 === 0) {
      return "Три подряд!!! Ты мегамозг!!";
    }
    return randomItem(praisePhrases);
  }

  function openSettings() {
    state.settingsOpen = true;
    state.captureDir = null;
    ui.settingsPanel.classList.remove("hidden");
    ui.settingsHint.textContent = "Выбери направление, потом нажми нужную кнопку на джойстике.";
    updateMappingUi();
  }

  function closeSettings() {
    state.settingsOpen = false;
    state.captureDir = null;
    ui.settingsPanel.classList.add("hidden");
    updateMappingUi();
  }

  function resetMappings() {
    state.buttonMap = { ...defaultButtonMap };
    localStorage.setItem("catIslandButtonMap", JSON.stringify(state.buttonMap));
    ui.settingsHint.textContent = "Настройки сброшены на D-pad.";
    updateMappingUi();
  }

  function startCapture(dir) {
    state.captureDir = dir;
    ui.settingsHint.textContent = `Нажми кнопку джойстика для направления «${directionNames[dir]}».`;
    state.previousButtons = getPressedButtonIndexes();
    updateMappingUi();
  }

  function setMapping(dir, buttonIndex) {
    state.buttonMap[dir] = buttonIndex;
    state.captureDir = null;
    localStorage.setItem("catIslandButtonMap", JSON.stringify(state.buttonMap));
    ui.settingsHint.textContent = `${directionNames[dir]}: назначена кнопка ${buttonIndex}.`;
    updateMappingUi();
  }

  function updateMappingUi() {
    for (const dir of directions) {
      ui.mapLabels[dir].textContent = `Кнопка ${state.buttonMap[dir]}`;
    }
    for (const button of ui.mapButtons) {
      button.classList.toggle("is-listening", button.dataset.dir === state.captureDir);
    }
  }

  function getPressedButtonIndexes(buttons) {
    const source = buttons || [...(navigator.getGamepads?.() || [])].find(Boolean)?.buttons || [];
    return source.reduce((pressed, button, index) => {
      if (button?.pressed) pressed.push(index);
      return pressed;
    }, []);
  }

  function makeMotion(platform, correct) {
    return {
      phase: "jump",
      correct,
      platform,
      startedAt: performance.now(),
      fromX: state.cat.x,
      fromY: state.cat.y,
      toX: platform.x,
      toY: platform.y - platform.h - 42,
      holdMs: 500,
    };
  }

  function updateMotion(now) {
    if (!state.motion) return;
    const motion = state.motion;

    if (motion.phase === "jump") {
      const t = clamp((now - motion.startedAt) / 520, 0, 1);
      const ease = easeOutCubic(t);
      const arc = Math.sin(t * Math.PI) * Math.min(150, state.h * 0.17);
      state.cat.x = lerp(motion.fromX, motion.toX, ease);
      state.cat.y = lerp(motion.fromY, motion.toY, ease) - arc;
      if (t >= 1) {
        motion.phase = "hold";
        motion.startedAt = now;
        state.cat.x = motion.toX;
        state.cat.y = motion.toY;
      }
      return;
    }

    if (motion.phase === "hold") {
      if (now - motion.startedAt >= motion.holdMs) {
        motion.phase = "return";
        motion.startedAt = now;
        motion.fromX = state.cat.x;
        motion.fromY = state.cat.y;
        motion.toX = state.cat.homeX;
        motion.toY = state.cat.homeY;
      }
      return;
    }

    const t = clamp((now - motion.startedAt) / 430, 0, 1);
    const ease = easeInOutCubic(t);
    const arc = Math.sin(t * Math.PI) * Math.min(80, state.h * 0.1);
    state.cat.x = lerp(motion.fromX, motion.toX, ease);
    state.cat.y = lerp(motion.fromY, motion.toY, ease) - arc;
    if (t >= 1) {
      const wasCorrect = motion.correct;
      state.motion = null;
      state.cat.x = state.cat.homeX;
      state.cat.y = state.cat.homeY;
      state.cat.mood = "ready";
      if (state.lives <= 0) {
        loseGame();
      } else if (wasCorrect && state.solved >= 20) {
        winGame();
      } else {
        nextRound();
      }
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function loseGame() {
    state.mode = "lose";
    ui.prompt.textContent = "Игра окончена";
    ui.messageTitle.textContent = "Попробуй ещё!";
    ui.messageText.textContent = `Ты набрал ${state.score} очков. Кот готов потренироваться снова.`;
    ui.messagePanel.classList.remove("hidden");
    speak("Игра окончена");
  }

  function winGame() {
    state.mode = "win";
    ui.prompt.textContent = "Вы выиграли!";
    ui.messageTitle.textContent = "Вы выиграли!";
    ui.messageText.textContent = `20 островков пройдены. Очки: ${state.score}.`;
    ui.messagePanel.classList.remove("hidden");
    speak("Вы выиграли");
    for (let i = 0; i < 9; i += 1) {
      setTimeout(() => spawnFirework(), i * 260);
    }
  }

  function burst(x, y, colors) {
    for (let i = 0; i < 22; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 4.2;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 42 + Math.random() * 18,
        color: randomItem(colors),
        size: 3 + Math.random() * 4,
      });
    }
  }

  function spawnFirework() {
    const x = state.w * (0.16 + Math.random() * 0.68);
    const y = state.h * (0.12 + Math.random() * 0.36);
    const colors = ["#ff3d7f", "#fff176", "#40c4ff", "#69f0ae", "#ffab40", "#b388ff"];
    for (let i = 0; i < 76; i += 1) {
      const angle = (Math.PI * 2 * i) / 76;
      const speed = 2 + Math.random() * 5.4;
      state.fireworks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 78 + Math.random() * 24,
        color: randomItem(colors),
        size: 2.4 + Math.random() * 3.4,
      });
    }
    playTone(784 + Math.random() * 220, 0.18, "triangle", 0.45);
  }

  function updateParticles() {
    for (const group of [state.particles, state.fireworks]) {
      for (let i = group.length - 1; i >= 0; i -= 1) {
        const p = group[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.vx *= 0.99;
        p.life -= 1;
        if (p.life <= 0) group.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, state.w, state.h);
    drawSky();
    drawIslands();
    drawCat(state.cat.x, state.cat.y);
    drawParticles(state.particles);
    drawParticles(state.fireworks);
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, state.h);
    sky.addColorStop(0, "#45baff");
    sky.addColorStop(0.52, "#c7f2ff");
    sky.addColorStop(0.73, "#7ddc61");
    sky.addColorStop(1, "#2e9e39");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, state.w, state.h);

    const sunX = state.w * 0.82;
    const sunY = state.h * 0.13;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, state.w * 0.18);
    sunGlow.addColorStop(0, "rgba(255, 247, 143, 0.95)");
    sunGlow.addColorStop(1, "rgba(255, 247, 143, 0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, state.w * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff176";
    ctx.beginPath();
    ctx.arc(sunX, sunY, Math.min(54, state.w * 0.05), 0, Math.PI * 2);
    ctx.fill();

    drawCloud(state.w * 0.16, state.h * 0.18, 1.05);
    drawCloud(state.w * 0.42, state.h * 0.11, 0.72);
    drawCloud(state.w * 0.72, state.h * 0.27, 0.92);
    drawBirds();
    drawHills();
    drawGrass();
  }

  function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y + Math.sin(state.time * 0.001 + x) * 3);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
    ctx.shadowColor = "rgba(70, 130, 180, 0.16)";
    ctx.shadowBlur = 18;
    blob(-52, 4, 42, 24);
    blob(-18, -10, 48, 33);
    blob(25, 0, 48, 27);
    blob(64, 8, 34, 20);
    ctx.restore();
  }

  function blob(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBirds() {
    ctx.strokeStyle = "rgba(41, 80, 120, 0.48)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const x = state.w * (0.08 + i * 0.11) + Math.sin(state.time * 0.0008 + i) * 18;
      const y = state.h * (0.08 + (i % 2) * 0.08);
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.quadraticCurveTo(x, y - 7, x + 8, y);
      ctx.moveTo(x + 8, y);
      ctx.quadraticCurveTo(x + 16, y - 7, x + 24, y);
      ctx.stroke();
    }
  }

  function drawHills() {
    ctx.fillStyle = "rgba(65, 157, 88, 0.5)";
    ctx.beginPath();
    ctx.moveTo(0, state.grassTop + 12);
    for (let x = 0; x <= state.w; x += 80) {
      const y = state.grassTop - 64 - Math.sin(x * 0.012) * 28;
      ctx.quadraticCurveTo(x + 40, y, x + 80, state.grassTop + 8);
    }
    ctx.lineTo(state.w, state.h);
    ctx.lineTo(0, state.h);
    ctx.fill();
  }

  function drawGrass() {
    const grad = ctx.createLinearGradient(0, state.grassTop, 0, state.h);
    grad.addColorStop(0, "#74d85f");
    grad.addColorStop(1, "#239537");
    ctx.fillStyle = grad;
    ctx.fillRect(0, state.grassTop, state.w, state.h - state.grassTop);

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    for (let i = 0; i < 160; i += 1) {
      const x = (i * 47) % state.w;
      const y = state.grassTop + ((i * 29) % Math.max(1, state.h - state.grassTop));
      const blade = 9 + (i % 9);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 4, y - blade, x + 1, y - blade * 1.6);
      ctx.strokeStyle = i % 3 === 0 ? "#e1ff9f" : "#287f32";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    for (let i = 0; i < 22; i += 1) {
      const x = (i * 97 + 35) % state.w;
      const y = state.grassTop + 24 + ((i * 43) % Math.max(40, state.h - state.grassTop - 28));
      drawFlower(x, y, i % 2 ? "#ff6ea6" : "#fff176");
    }
  }

  function drawFlower(x, y, color) {
    ctx.strokeStyle = "#237b33";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x, y - 7);
    ctx.stroke();
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i += 1) {
      const angle = (Math.PI * 2 * i) / 5;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 5, y - 9 + Math.sin(angle) * 5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffab40";
    ctx.beginPath();
    ctx.arc(x, y - 9, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawIslands() {
    for (const choice of state.choices) {
      drawPlatform(choice);
      if (choice.food) {
        drawFood(choice.food, choice.x, choice.y - choice.h * 1.15);
      } else if (choice.value !== null) {
        drawNumber(choice.value, choice.x, choice.y - choice.h * 1.16);
      }
    }
  }

  function drawPlatform(choice) {
    const { x, y, w, h } = choice;
    const bob = Math.sin(state.time * 0.0014 + directions.indexOf(choice.dir)) * 4;
    const px = x - w / 2;
    const py = y + bob;

    ctx.save();
    ctx.shadowColor = "rgba(42, 52, 73, 0.32)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 12;
    roundRect(px, py, w, h, 10, "#bd622e");
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const rows = 2;
    const cols = 8;
    const brickW = w / cols;
    const brickH = h / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const bx = px + col * brickW + (row % 2 ? brickW * 0.5 : 0);
        ctx.fillStyle = row % 2 ? "#d87332" : "#e5833b";
        ctx.fillRect(bx, py + row * brickH, brickW - 2, brickH - 2);
        ctx.fillStyle = "rgba(255, 223, 151, 0.32)";
        ctx.fillRect(bx + 4, py + row * brickH + 3, brickW * 0.45, 4);
      }
    }

    ctx.strokeStyle = "#7c351c";
    ctx.lineWidth = 3;
    roundStroke(px, py, w, h, 10);
    ctx.fillStyle = "#55b447";
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.ellipse(px + i * (w / 8), py - 1, 14, 6 + (i % 3), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    roundedPath(x, y, w, h, r);
    ctx.fill();
  }

  function roundStroke(x, y, w, h, r) {
    roundedPath(x, y, w, h, r);
    ctx.stroke();
  }

  function roundedPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawNumber(value, x, y) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${clamp(state.w * 0.072, 74, 124)}px Trebuchet MS, Arial`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(35, 37, 63, 0.34)";
    ctx.strokeText(String(value), x, y + 4);
    ctx.fillStyle = "#fffdf0";
    ctx.strokeStyle = "#ff5d45";
    ctx.lineWidth = 5;
    ctx.strokeText(String(value), x, y);
    ctx.fillText(String(value), x, y);
    ctx.restore();
  }

  function drawFood(kind, x, y) {
    ctx.save();
    ctx.translate(x, y + Math.sin(state.time * 0.006) * 4);
    ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 8;
    if (kind === "apple") {
      ctx.fillStyle = "#ff3d3d";
      ctx.beginPath();
      ctx.arc(-14, 7, 23, 0, Math.PI * 2);
      ctx.arc(14, 7, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d92d2d";
      ctx.beginPath();
      ctx.arc(0, 13, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#6b3a19";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.quadraticCurveTo(4, -36, 16, -43);
      ctx.stroke();
      ctx.fillStyle = "#52bd4e";
      ctx.beginPath();
      ctx.ellipse(25, -30, 18, 9, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.48)";
      ctx.beginPath();
      ctx.ellipse(-13, 1, 8, 13, -0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#c47b3b";
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff9bd3";
      ctx.beginPath();
      ctx.arc(0, 0, 31, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8f5c37";
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      const sprinkles = ["#fff176", "#40c4ff", "#69f0ae", "#ff5252", "#ffffff"];
      for (let i = 0; i < 18; i += 1) {
        const a = i * 1.7;
        const r = 16 + (i % 3) * 5;
        ctx.save();
        ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
        ctx.rotate(a);
        ctx.fillStyle = sprinkles[i % sprinkles.length];
        ctx.fillRect(-5, -1.5, 10, 3);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawCat(x, y) {
    const size = clamp(state.w * 0.055, 54, 82);
    const bounce = Math.sin(state.time * 0.006) * (state.motion ? 1 : 2.6);
    const blink = Math.sin(state.time * 0.0025) > 0.97;

    ctx.save();
    ctx.translate(x, y + bounce);

    ctx.fillStyle = "rgba(37, 52, 39, 0.22)";
    ctx.beginPath();
    ctx.ellipse(0, size * 0.82, size * 0.72, size * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#d77930";
    ctx.lineWidth = size * 0.16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(size * 0.38, size * 0.42);
    ctx.quadraticCurveTo(size * 0.9, size * 0.06, size * 0.7, -size * 0.36);
    ctx.stroke();

    ctx.fillStyle = "#f59a3d";
    ctx.beginPath();
    ctx.ellipse(0, size * 0.34, size * 0.56, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    stripe(-size * 0.24, size * 0.05, -0.4, size);
    stripe(0, -size * 0.02, 0, size);
    stripe(size * 0.24, size * 0.05, 0.4, size);

    ctx.fillStyle = "#f7a84b";
    ctx.beginPath();
    ctx.arc(0, -size * 0.2, size * 0.46, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f59a3d";
    ctx.beginPath();
    ctx.moveTo(-size * 0.36, -size * 0.48);
    ctx.lineTo(-size * 0.18, -size * 0.9);
    ctx.lineTo(-size * 0.02, -size * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.36, -size * 0.48);
    ctx.lineTo(size * 0.18, -size * 0.9);
    ctx.lineTo(size * 0.02, -size * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffcad5";
    ctx.beginPath();
    ctx.moveTo(-size * 0.28, -size * 0.5);
    ctx.lineTo(-size * 0.18, -size * 0.73);
    ctx.lineTo(-size * 0.09, -size * 0.49);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.28, -size * 0.5);
    ctx.lineTo(size * 0.18, -size * 0.73);
    ctx.lineTo(size * 0.09, -size * 0.49);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#21304d";
    if (blink) {
      ctx.fillRect(-size * 0.22, -size * 0.22, size * 0.14, 3);
      ctx.fillRect(size * 0.1, -size * 0.22, size * 0.14, 3);
    } else {
      eye(-size * 0.16, -size * 0.23, size);
      eye(size * 0.16, -size * 0.23, size);
    }

    ctx.fillStyle = "#ec667c";
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.08);
    ctx.lineTo(-size * 0.055, -size * 0.01);
    ctx.lineTo(size * 0.055, -size * 0.01);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#563019";
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * size * 0.09, -size * 0.02);
      ctx.lineTo(side * size * 0.42, -size * 0.1);
      ctx.moveTo(side * size * 0.09, size * 0.03);
      ctx.lineTo(side * size * 0.42, size * 0.02);
      ctx.moveTo(side * size * 0.09, size * 0.08);
      ctx.lineTo(side * size * 0.39, size * 0.15);
      ctx.stroke();
    }

    ctx.strokeStyle = state.cat.mood === "sad" ? "#563019" : "#6b351c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (state.cat.mood === "sad") {
      ctx.arc(0, size * 0.17, size * 0.13, Math.PI * 1.1, Math.PI * 1.9);
    } else {
      ctx.arc(0, size * 0.02, size * 0.16, 0.1, Math.PI - 0.1);
    }
    ctx.stroke();

    ctx.fillStyle = "#fff3dc";
    ctx.beginPath();
    ctx.ellipse(0, size * 0.42, size * 0.28, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function stripe(x, y, rotate, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotate);
    ctx.fillStyle = "rgba(132, 70, 30, 0.34)";
    ctx.fillRect(-size * 0.035, -size * 0.2, size * 0.07, size * 0.32);
    ctx.restore();
  }

  function eye(x, y, size) {
    ctx.fillStyle = "#f5ff88";
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.09, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#21304d";
    ctx.beginPath();
    ctx.ellipse(x + size * 0.012, y + size * 0.008, size * 0.03, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles(group) {
    for (const p of group) {
      ctx.globalAlpha = clamp(p.life / 60, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function pollGamepad(now) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (!pad) {
      if (state.gamepadName) {
        state.gamepadName = "";
        ui.gamepadStatus.textContent = "Джойстик: ожидание";
      }
      return;
    }

    if (state.gamepadName !== pad.id) {
      state.gamepadName = pad.id;
      ui.gamepadStatus.textContent = "Джойстик: подключен";
    }

    const pressedButtons = getPressedButtonIndexes(pad.buttons);
    const justPressed = pressedButtons.find((index) => !state.previousButtons.includes(index));
    state.previousButtons = pressedButtons;

    if (state.captureDir !== null) {
      if (justPressed !== undefined) setMapping(state.captureDir, justPressed);
      return;
    }

    if (state.settingsOpen || now - state.lastInputAt < 180) return;
    const xAxis = pad.axes[0] || 0;
    const yAxis = pad.axes[1] || 0;
    const buttons = pad.buttons;
    const mappedDirection = directions.find((dir) => buttons[state.buttonMap[dir]]?.pressed);

    if (mappedDirection) handleDirection(mappedDirection);
    else if (yAxis < -0.58) handleDirection("up");
    else if (yAxis > 0.58) handleDirection("down");
    else if (xAxis < -0.58) handleDirection("left");
    else if (xAxis > 0.58) handleDirection("right");
  }

  function loop(now) {
    state.time = now;
    updateMotion(now);
    updateParticles();
    pollGamepad(now);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    const keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const dir = keyMap[event.key];
    if (!dir || state.settingsOpen) return;
    event.preventDefault();
    handleDirection(dir);
  });
  window.addEventListener("gamepadconnected", (event) => {
    state.gamepadName = event.gamepad.id;
    ui.gamepadStatus.textContent = "Джойстик: подключен";
  });
  window.addEventListener("gamepaddisconnected", () => {
    state.gamepadName = "";
    ui.gamepadStatus.textContent = "Джойстик: ожидание";
  });
  window.speechSynthesis?.addEventListener?.("voiceschanged", () => {});

  ui.startButton.addEventListener("click", startGame);
  ui.restartButton.addEventListener("click", startGame);
  ui.settingsButton.addEventListener("click", openSettings);
  ui.closeSettingsButton.addEventListener("click", closeSettings);
  ui.resetMappingsButton.addEventListener("click", resetMappings);
  ui.mapButtons.forEach((button) => {
    button.addEventListener("click", () => startCapture(button.dataset.dir));
  });

  updateMappingUi();
  resize();
  requestAnimationFrame(loop);
})();
