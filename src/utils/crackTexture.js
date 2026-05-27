import * as THREE from 'three';

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Fixed crack geometry — same for all stages, arms just grow longer
const CX = 7.8, CY = 7.2; // fixed impact center

const ARMS = [
  { angle: 0.40, fullSteps: 7, appearStage: 0 },
  { angle: 1.90, fullSteps: 6, appearStage: 0 },
  { angle: 3.30, fullSteps: 7, appearStage: 0 },
  { angle: 4.80, fullSteps: 6, appearStage: 3 },
  { angle: 5.60, fullSteps: 5, appearStage: 6 },
];

// Branches: arm index, step along parent at which branch starts, angle, length
const BRANCHES = [
  { arm: 0, parentStep: 4, angle: 0.40 + 1.0, fullSteps: 3 },
  { arm: 1, parentStep: 3, angle: 1.90 - 0.9, fullSteps: 3 },
  { arm: 2, parentStep: 4, angle: 3.30 + 1.1, fullSteps: 4 },
  { arm: 3, parentStep: 3, angle: 4.80 - 0.8, fullSteps: 3 },
];

// Walk an arm step-by-step with consistent jitter (same path every stage)
function walkArm(startX, startY, baseAngle, numSteps, seed) {
  const pts = [{ x: startX, y: startY }];
  let x = startX, y = startY;
  for (let s = 0; s < numSteps; s++) {
    const jitter = (hash(seed * 17 + s * 37) - 0.5) * 0.28;
    x += Math.cos(baseAngle + jitter);
    y += Math.sin(baseAngle + jitter);
    pts.push({ x: Math.max(0.5, Math.min(15.5, x)), y: Math.max(0.5, Math.min(15.5, y)) });
  }
  return pts;
}

function strokePath(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function buildStageCanvas(stage) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d');

  // Very subtle darkening — barely noticeable until late stages
  ctx.fillStyle = `rgba(0,0,0,${stage * 0.012})`;
  ctx.fillRect(0, 0, 16, 16);

  ctx.strokeStyle = 'rgba(0,0,0,0.88)';
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';

  // Pre-walk all arms to their full length (consistent geometry)
  const armPaths = ARMS.map((arm, ai) =>
    walkArm(CX, CY, arm.angle, arm.fullSteps, ai * 100)
  );

  for (let ai = 0; ai < ARMS.length; ai++) {
    const arm = ARMS[ai];
    if (stage < arm.appearStage) continue;

    // How many steps to show: grow linearly from 1 to fullSteps
    const stagesActive = stage - arm.appearStage; // 0 on first stage visible
    const totalActiveStages = 9 - arm.appearStage + 1;
    const frac = (stagesActive + 1) / totalActiveStages;
    const steps = Math.max(1, Math.round(arm.fullSteps * frac));

    strokePath(ctx, armPaths[ai].slice(0, steps + 1));
  }

  // Branches grow once their parent arm has reached their branch point
  for (const br of BRANCHES) {
    const arm = ARMS[br.arm];
    if (stage < arm.appearStage) continue;

    const stagesActive = stage - arm.appearStage;
    const totalActiveStages = 9 - arm.appearStage + 1;
    const frac = (stagesActive + 1) / totalActiveStages;
    const parentStepsShown = Math.max(1, Math.round(arm.fullSteps * frac));

    if (parentStepsShown < br.parentStep) continue;

    // Branch origin = point on parent path
    const origin = armPaths[br.arm][br.parentStep];
    // How much of the branch to show (branch grows after parent passes it)
    const branchFrac = Math.min((parentStepsShown - br.parentStep + 1) / (arm.fullSteps - br.parentStep + 1), 1);
    const branchSteps = Math.max(1, Math.round(br.fullSteps * branchFrac));
    const brPts = walkArm(origin.x, origin.y, br.angle, branchSteps, br.arm * 200 + br.parentStep);
    strokePath(ctx, brPts);
  }

  return canvas;
}

export function buildCrackTextures() {
  return Array.from({ length: 10 }, (_, stage) => {
    const tex = new THREE.CanvasTexture(buildStageCanvas(stage));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  });
}
