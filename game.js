const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hud = {
  status: document.getElementById('status'),
  distance: document.getElementById('distanceValue'),
  speed: document.getElementById('speedValue'),
  score: document.getElementById('scoreValue'),
  health: document.getElementById('healthValue'),
};

const overlay = document.getElementById('overlay');
const startButton = document.getElementById('startButton');
const touchButtons = document.querySelectorAll('.touch-button');

const START_X = 170;
const GOAL_DISTANCE = 2600;
const WORLD_WIDTH = START_X + GOAL_DISTANCE + 140;
const BASE_GRAVITY = 0.48;
const MAX_SPEED = 18;
const FIXED_STEP = 1000 / 60;

const keys = {
  left: false,
  right: false,
  jump: false,
};

const state = {
  started: false,
  ended: false,
  time: 0,
  distance: 0,
  score: 0,
  health: 3,
  speed: 0,
  cameraX: 0,
  drag: 0,
  lastTimestamp: 0,
  invulnerable: 0,
};

let accumulator = 0;
let jumpWasDown = false;

const rider = {
  x: START_X,
  y: 240,
  width: 26,
  height: 36,
  vx: 0,
  vy: 0,
  grounded: false,
  facing: 1,
};

const pickups = [];
const obstacles = [];
const particles = [];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function getGroundY(worldX) {
  return Math.max(290, 330 + Math.sin(worldX * 0.008) * 52);
}

function createPickup(x, y, type = 'boost') {
  pickups.push({
    x,
    y,
    radius: 12,
    type,
    bob: rand(0, Math.PI * 2),
  });
}

function generateTrack() {
  pickups.length = 0;
  obstacles.length = 0;
  for (let i = 0; i < 26; i += 1) {
    const x = START_X + 100 + i * ((GOAL_DISTANCE - 200) / 25) + rand(-12, 12);
    const y = getGroundY(x) - 48 - rand(0, 18);
    createPickup(x, y, i % 5 === 0 ? 'boost' : 'coin');
  }
  for (let distance = 520; distance < GOAL_DISTANCE - 300; distance += 760) {
    const x = START_X + distance;
    obstacles.push({ x, y: getGroundY(x) - 9, radius: 15 });
  }
}

function resetGame() {
  state.started = false;
  state.ended = false;
  state.time = 0;
  state.distance = 0;
  state.score = 0;
  state.health = 3;
  state.speed = 0;
  state.cameraX = 0;
  state.drag = 0;
  state.invulnerable = 0;
  state.lastTimestamp = 0;
  accumulator = 0;
  jumpWasDown = false;
  keys.left = false;
  keys.right = false;
  keys.jump = false;
  rider.x = START_X;
  rider.y = 240;
  rider.vx = 0;
  rider.vy = 0;
  rider.grounded = false;
  rider.facing = 1;
  particles.length = 0;
  generateTrack();
  updateHud();
}

function updateHud() {
  hud.distance.textContent = `${Math.floor(state.distance)} m`;
  hud.speed.textContent = `${Math.round(state.speed * 18)} km/h`;
  hud.score.textContent = `${state.score}`;
  hud.health.textContent = `${state.health}`;
  hud.status.textContent = state.ended
    ? (state.distance >= GOAL_DISTANCE ? 'You survived the slope!' : 'Run ended')
    : state.started
      ? 'Descending'
      : 'Ready for the drop';
}

function startGame() {
  resetGame();
  state.started = true;
  overlay.classList.remove('visible');
  updateHud();
}

function endGame(message) {
  if (state.ended) return;
  state.ended = true;
  state.started = false;
  hud.status.textContent = message || 'Run ended';
  overlay.classList.add('visible');
  const cleared = state.distance >= GOAL_DISTANCE;
  overlay.querySelector('.panel').innerHTML = `
    <h1>${cleared ? 'Trail Cleared' : 'Run Over'}</h1>
    <p>${cleared ? 'You conquered the descent and reached the finish.' : 'The mountain won this run.'}</p>
    <p class="small">Distance: ${Math.floor(state.distance)} m • Score: ${state.score} • Speed: ${Math.round(state.speed * 18)} km/h</p>
    <button id="startButton" type="button">${cleared ? 'Ride Again' : 'Retry Run'}</button>
  `;
  document.getElementById('startButton').addEventListener('click', startGame);
}

function createParticles(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: rand(-1.6, 1.6),
      vy: rand(-2.2, 0.4),
      life: rand(14, 28),
      size: rand(2, 5),
      color,
    });
  }
}

function handleInput() {
  if (!state.started || state.ended) return;

  const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (move !== 0) {
    rider.vx += move * 0.38;
    rider.facing = move;
  }

  if (keys.jump && !jumpWasDown && rider.grounded) {
    rider.vy = -8.5;
    rider.grounded = false;
    createParticles(rider.x, rider.y + rider.height, '#b7edff', 7);
  }
  jumpWasDown = keys.jump;
}

function updateRider() {
  const groundY = getGroundY(rider.x);

  state.speed = clamp(state.speed + (keys.right ? 0.08 : 0.025), 0, MAX_SPEED);
  rider.vx *= 0.94;
  rider.vx = clamp(rider.vx, -5.4, 5.4);
  rider.vy += BASE_GRAVITY;
  rider.x += rider.vx + state.speed * 0.45;
  rider.y += rider.vy;

  if (rider.y + rider.height >= groundY) {
    rider.y = groundY - rider.height;
    rider.vy = 0;
    rider.grounded = true;
  } else {
    rider.grounded = false;
  }

  rider.x = clamp(rider.x, START_X, WORLD_WIDTH - 60);
  state.cameraX = clamp(rider.x - canvas.width * 0.4, 0, WORLD_WIDTH - canvas.width);
  state.distance = Math.max(state.distance, rider.x - START_X);
  state.drag = (state.speed * 0.3) + 0.45;
  if (state.invulnerable > 0) state.invulnerable -= 1;

  if (rider.y > canvas.height + 160) endGame('Run ended');
}

function checkObstacles() {
  if (state.invulnerable > 0) return;

  for (const obstacle of obstacles) {
    const closeX = Math.abs(obstacle.x - rider.x) < obstacle.radius + rider.width / 2;
    const nearGround = rider.y + rider.height > obstacle.y - 20;
    if (closeX && nearGround) {
      state.health -= 1;
      state.speed *= 0.55;
      state.invulnerable = 90;
      rider.vx = -2.5;
      rider.vy = -4;
      rider.grounded = false;
      createParticles(obstacle.x, obstacle.y, '#ff8b67', 16);
      if (state.health <= 0) endGame('You were wrecked');
      return;
    }
  }
}

function checkPickups() {
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pickup = pickups[i];
    const dx = Math.abs(pickup.x - rider.x);
    const dy = Math.abs(pickup.y - (rider.y + rider.height / 2));

    if (dx < 30 && dy < 36) {
      pickups.splice(i, 1);
      if (pickup.type === 'boost') {
        state.speed = clamp(state.speed + 2.2, 0, MAX_SPEED + 2);
        createParticles(pickup.x, pickup.y, '#74f0a8', 18);
      } else {
        state.score += 25;
        createParticles(pickup.x, pickup.y, '#ffe08a', 12);
      }
    }
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    p.vy += 0.08;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function updateGame() {
  if (!state.started || state.ended) return;

  state.time += 1;
  handleInput();
  updateRider();
  checkPickups();
  checkObstacles();
  updateParticles();

  if (state.distance >= GOAL_DISTANCE) {
    endGame('Trail Cleared');
  }

  updateHud();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#8ec6ff');
  sky.addColorStop(0.4, '#d7f0ff');
  sky.addColorStop(0.67, '#b8d7a6');
  sky.addColorStop(1, '#6a8d43');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 25; i += 1) {
    const x = (i * 120 - state.cameraX * 0.25) % (canvas.width + 100);
    const y = 40 + (i % 5) * 18;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x, y, 42, 10);
  }

  ctx.fillStyle = '#3a6a35';
  for (let i = 0; i < canvas.width + 100; i += 50) {
    const hillX = i - (state.cameraX * 0.7 % 50);
    ctx.beginPath();
    ctx.moveTo(hillX, canvas.height);
    ctx.quadraticCurveTo(hillX + 24, 100, hillX + 50, canvas.height);
    ctx.fill();
  }
}

function drawTrack() {
  const startX = -state.cameraX;
  ctx.beginPath();
  ctx.moveTo(startX, getGroundY(state.cameraX));
  for (let x = 0; x <= canvas.width + 100; x += 18) {
    ctx.lineTo(x, getGroundY(x + state.cameraX));
  }
  ctx.lineTo(canvas.width + 100, canvas.height);
  ctx.lineTo(-20, canvas.height);
  ctx.closePath();
  ctx.fillStyle = '#4f4d52';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(startX, getGroundY(state.cameraX));
  for (let x = 0; x <= canvas.width + 100; x += 18) {
    ctx.lineTo(x, getGroundY(x + state.cameraX));
  }
  ctx.strokeStyle = '#c2b9ae';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#7b6f47';
  for (let i = 0; i < 36; i += 1) {
    const x = (i * 26) - (state.cameraX * 2.1) % 26;
    const y = getGroundY(x + state.cameraX) + 8;
    ctx.fillRect(x, y, 10, 12);
  }

  const finishX = START_X + GOAL_DISTANCE - state.cameraX;
  if (finishX > -40 && finishX < canvas.width + 40) {
    const groundY = getGroundY(START_X + GOAL_DISTANCE);
    ctx.fillStyle = '#f5f2e8';
    ctx.fillRect(finishX - 3, groundY - 82, 6, 82);
    ctx.fillStyle = '#ff6b5f';
    ctx.beginPath();
    ctx.moveTo(finishX, groundY - 82);
    ctx.lineTo(finishX + 48, groundY - 66);
    ctx.lineTo(finishX, groundY - 50);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(10, 20, 30, 0.72)';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('FINISH', finishX - 25, groundY - 91);
  }
}

function drawObstacles() {
  for (const obstacle of obstacles) {
    const x = obstacle.x - state.cameraX;
    if (x < -40 || x > canvas.width + 40) continue;
    ctx.fillStyle = '#4a4145';
    ctx.beginPath();
    ctx.ellipse(x, obstacle.y + 8, obstacle.radius, 10, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#86736d';
    ctx.beginPath();
    ctx.ellipse(x - 4, obstacle.y + 5, obstacle.radius * 0.5, 4, -0.3, Math.PI, 0);
    ctx.fill();
  }
}

function drawPickups() {
  const cameraOffsetX = -state.cameraX;
  for (const pickup of pickups) {
    const screenX = pickup.x + cameraOffsetX;
    const screenY = pickup.y + Math.sin(state.time * 0.1 + pickup.bob) * 2.4;

    ctx.beginPath();
    ctx.arc(screenX, screenY, pickup.radius, 0, Math.PI * 2);
    ctx.fillStyle = pickup.type === 'boost' ? '#7dffb2' : '#f5d777';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(screenX, screenY, pickup.radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = pickup.type === 'boost' ? '#d2ffe7' : '#fff2b9';
    ctx.fill();
  }
}

function drawRider() {
  const px = rider.x - state.cameraX;
  const py = rider.y;

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(rider.facing, 1);

  ctx.fillStyle = '#1a2333';
  ctx.fillRect(-10, 0, 20, 22);
  ctx.fillStyle = '#ffdd99';
  ctx.fillRect(-8, 6, 16, 10);
  ctx.fillStyle = '#1c2f52';
  ctx.fillRect(-10, 22, 7, 14);
  ctx.fillRect(3, 22, 7, 14);

  ctx.fillStyle = '#dbe7ff';
  ctx.fillRect(-4, 1, 8, 5);
  ctx.fillStyle = '#1f1f25';
  ctx.fillRect(-5, 0, 3, 2);
  ctx.fillRect(2, 0, 3, 2);

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = p.color + 'aa';
    ctx.fillRect(p.x - state.cameraX, p.y, p.size, p.size);
  }
}

function drawHUDText() {
  ctx.fillStyle = 'rgba(10, 20, 30, 0.4)';
  ctx.fillRect(18, canvas.height - 52, 180, 28);
  ctx.fillStyle = '#edf6ff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`Goal 2600m`, 28, canvas.height - 32);
}

function render() {
  drawBackground();
  drawTrack();
  drawObstacles();
  drawPickups();
  drawParticles();
  drawRider();
  drawHUDText();
}

function loop(timestamp) {
  if (!state.lastTimestamp) state.lastTimestamp = timestamp;
  const delta = clamp(timestamp - state.lastTimestamp, 0, 100);
  state.lastTimestamp = timestamp;
  accumulator += delta;

  while (accumulator >= FIXED_STEP) {
    updateGame();
    accumulator -= FIXED_STEP;
  }

  render();
  requestAnimationFrame(loop);
}

startButton.addEventListener('click', startGame);
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'arrowleft') keys.left = true;
  if (key === 'd' || key === 'arrowright') keys.right = true;
  if (key === ' ' || key === 'spacebar') keys.jump = true;
  if (key === 'arrowleft' || key === 'arrowright' || key === ' ' || key === 'spacebar') {
    event.preventDefault();
  }
  if (key === 'enter' && !state.started) startGame();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'arrowleft') keys.left = false;
  if (key === 'd' || key === 'arrowright') keys.right = false;
  if (key === ' ' || key === 'spacebar') keys.jump = false;
});

const activePointers = new Map();
function releasePointer(event) {
  const control = activePointers.get(event.pointerId);
  if (!control) return;
  activePointers.delete(event.pointerId);
  keys[control] = Array.from(activePointers.values()).includes(control);
}

touchButtons.forEach((button) => {
  const control = button.dataset.control;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    activePointers.set(event.pointerId, control);
    keys[control] = true;
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointerup', releasePointer);
  button.addEventListener('pointercancel', releasePointer);
  button.addEventListener('lostpointercapture', releasePointer);
});

window.addEventListener('blur', () => {
  activePointers.clear();
  keys.left = false;
  keys.right = false;
  keys.jump = false;
});

resetGame();
render();
requestAnimationFrame(loop);
