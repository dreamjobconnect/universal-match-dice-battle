/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Trophy, 
  RefreshCw, 
  Upload, 
  User, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Award, 
  History, 
  HelpCircle,
  Camera,
  Trash2,
  Check,
  Edit3,
  Settings,
  PartyPopper,
  Clock,
  Infinity,
  Square,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as THREE from 'three';

interface PlayerState {
  id: string;
  name: string;
  photo: string | null;
  score: number;
  rollsCount: number;
}

interface HistoryItem {
  id: string;
  rollNumber: number;
  playerId: string;
  playerName: string;
  value: number;
  comment: string;
  timestamp: string;
}

type GameMode = 'tournament' | 'unlimited' | 'timed';

const STORAGE_KEY = 'universal_match_dice_battle_v20_nodev';
const MAX_FILE_SIZE_MB = 2; // 2MB limit

const PLAYER_COLORS = [
  { border: 'border-indigo-500/80', bg: 'from-indigo-950/70', text: 'text-indigo-400', badge: 'bg-indigo-600', ring: 'ring-indigo-500/50' },
  { border: 'border-pink-500/80', bg: 'from-pink-950/70', text: 'text-pink-400', badge: 'bg-pink-600', ring: 'ring-pink-500/50' },
  { border: 'border-emerald-500/80', bg: 'from-emerald-950/70', text: 'text-emerald-400', badge: 'bg-emerald-600', ring: 'ring-emerald-500/50' },
  { border: 'border-amber-500/80', bg: 'from-amber-950/70', text: 'text-amber-400', badge: 'bg-amber-600', ring: 'ring-amber-500/50' },
  { border: 'border-purple-500/80', bg: 'from-purple-950/70', text: 'text-purple-400', badge: 'bg-purple-600', ring: 'ring-purple-500/50' },
  { border: 'border-cyan-500/80', bg: 'from-cyan-950/70', text: 'text-cyan-400', badge: 'bg-cyan-600', ring: 'ring-cyan-500/50' },
];

const COMMENTARIES: Record<number, string[]> = {
  6: ["Massive hit! Incredible maximum score of 6!", "Sensational roll! Top of the board 6!", "Brilliant! Maximum impact 6!"],
  5: ["Splendid roll! Racing ahead with 5 points!", "Superb timing and precision for 5!"],
  4: ["Cracking roll! Solid 4 points added!", "Classic move! 4 strong points!"],
  3: ["Smart and steady! 3 points secured!", "Quick tactical move for 3 points!"],
  2: ["Solid defense and steady progress! 2 points!", "Well judged, 2 points added."],
  1: ["Careful single taken! 1 point."]
};

const createDefaultPlayers = (count: number): PlayerState[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `player_${i + 1}`,
    name: `Player ${i + 1}`,
    photo: null,
    score: 0,
    rollsCount: 0,
  }));
};

export default function App() {
  const [matchTitle, setMatchTitle] = useState<string>('Epic Match');
  const [gameMode, setGameMode] = useState<GameMode>('tournament');
  const [timedDurationSeconds, setTimedDurationSeconds] = useState<number>(300);
  const [playerCount, setPlayerCount] = useState<number>(2);

  const [players, setPlayers] = useState<PlayerState[]>(() => createDefaultPlayers(2));
  const [displayedScores, setDisplayedScores] = useState<Record<string, number>>({ player_1: 0, player_2: 0 });
  const [isScoreAnimating, setIsScoreAnimating] = useState<boolean>(false);

  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [totalRolls, setTotalRolls] = useState<number>(0);
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(300);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);

  const [lastRoll, setLastRoll] = useState<{ playerName: string; value: number; comment: string; colorIdx: number } | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [displayDiceValue, setDisplayDiceValue] = useState<number>(6);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [winners, setWinners] = useState<PlayerState[] | null>(null);
  const [showCelebrationModal, setShowCelebrationModal] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [editingTitleInline, setEditingTitleInline] = useState<boolean>(false);
  const [tempMatchTitle, setTempMatchTitle] = useState<string>('Epic Match');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Config modal temporary state
  const [configTitle, setConfigTitle] = useState<string>('Epic Match');
  const [configMode, setConfigMode] = useState<GameMode>('tournament');
  const [configDurationMin, setConfigDurationMin] = useState<number>(5);
  const [configCustomMin, setConfigCustomMin] = useState<number>(10);
  const [configPlayerCount, setConfigPlayerCount] = useState<number>(2);
  const [configPlayers, setConfigPlayers] = useState<PlayerState[]>(() => createDefaultPlayers(2));

  const mountRef = useRef<HTMLDivElement>(null);
  const fireworksCanvasRef = useRef<HTMLCanvasElement>(null);
  const threeDiceRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    diceMesh: THREE.Mesh;
    animating: boolean;
    targetQuaternion: THREE.Quaternion;
    startQuaternion: THREE.Quaternion;
    startTime: number;
    duration: number;
    finalValue: number;
    onComplete?: () => void;
  } | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.matchTitle) setMatchTitle(data.matchTitle);
        if (data.gameMode) setGameMode(data.gameMode);
        if (typeof data.timedDurationSeconds === 'number') {
          setTimedDurationSeconds(data.timedDurationSeconds);
          setTimeRemaining(data.timedDurationSeconds);
        }
        if (typeof data.playerCount === 'number') setPlayerCount(data.playerCount);
        if (data.players && Array.isArray(data.players)) {
          setPlayers(data.players);
          const scoresMap: Record<string, number> = {};
          data.players.forEach((p: PlayerState) => { scoresMap[p.id] = p.score; });
          setDisplayedScores(scoresMap);
        }
        if (typeof data.currentTurnIndex === 'number') setCurrentTurnIndex(data.currentTurnIndex);
        if (typeof data.totalRolls === 'number') setTotalRolls(data.totalRolls);
        if (data.history) setHistory(data.history);
        if (data.winners !== undefined && data.winners !== null) {
          setWinners(data.winners);
          setShowCelebrationModal(true);
        }
      }
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }
  }, []);

  // Save to localStorage on state change
  useEffect(() => {
    try {
      const stateToSave = {
        matchTitle,
        gameMode,
        timedDurationSeconds,
        playerCount,
        players,
        currentTurnIndex,
        totalRolls,
        history,
        winners,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }, [matchTitle, gameMode, timedDurationSeconds, playerCount, players, currentTurnIndex, totalRolls, history, winners]);

  // Timed Mode Countdown & Elapsed Timer loop
  useEffect(() => {
    if (gameMode !== 'timed' || !isTimerActive || winners !== null) return;

    const interval = setInterval(() => {
      if (!matchStartTime) return;
      const now = Date.now();
      const elapsed = Math.floor((now - matchStartTime) / 1000);
      setElapsedSeconds(elapsed);
      const remaining = Math.max(0, timedDurationSeconds - elapsed);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setIsTimerActive(false);
        concludeMatch();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [gameMode, isTimerActive, matchStartTime, timedDurationSeconds, winners]);

  // Three.js 3D Dice Initialization & Gentle Rotation Animation Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 4.0, 4.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.3);
    directionalLight.position.set(5, 9, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x818cf8, 1.2, 10);
    pointLight.position.set(-3, -2, 3);
    scene.add(pointLight);

    const planeGeo = new THREE.PlaneGeometry(10, 10);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -1.8;
    plane.receiveShadow = true;
    scene.add(plane);

    const createFaceTexture = (num: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.CanvasTexture(canvas);

      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#f1f5f9');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, 242, 242);

      ctx.fillStyle = '#09090b';
      const drawPip = (x: number, y: number) => {
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();
      };

      const c = 128, t = 68, b = 188;
      switch (num) {
        case 1: drawPip(c, c); break;
        case 2: drawPip(t, t); drawPip(b, b); break;
        case 3: drawPip(t, t); drawPip(c, c); drawPip(b, b); break;
        case 4: drawPip(t, t); drawPip(t, b); drawPip(b, t); drawPip(b, b); break;
        case 5: drawPip(t, t); drawPip(t, b); drawPip(c, c); drawPip(b, t); drawPip(b, b); break;
        case 6: drawPip(t, t); drawPip(t, c); drawPip(t, b); drawPip(b, t); drawPip(b, c); drawPip(b, b); break;
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    const geometry = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4);
    const materials = [
      new THREE.MeshStandardMaterial({ map: createFaceTexture(3), roughness: 0.2, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ map: createFaceTexture(4), roughness: 0.2, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ map: createFaceTexture(1), roughness: 0.2, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ map: createFaceTexture(6), roughness: 0.2, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ map: createFaceTexture(2), roughness: 0.2, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ map: createFaceTexture(5), roughness: 0.2, metalness: 0.1 }),
    ];

    const diceMesh = new THREE.Mesh(geometry, materials);
    diceMesh.castShadow = true;
    scene.add(diceMesh);

    threeDiceRef.current = {
      scene,
      camera,
      renderer,
      diceMesh,
      animating: false,
      targetQuaternion: new THREE.Quaternion(),
      startQuaternion: new THREE.Quaternion(),
      startTime: 0,
      duration: 700,
      finalValue: 1
    };

    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const state = threeDiceRef.current;
      if (state && state.animating) {
        const elapsed = Date.now() - state.startTime;
        const progress = Math.min(elapsed / state.duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const currentQuat = new THREE.Quaternion().copy(state.startQuaternion).slerp(state.targetQuaternion, easeProgress);
        diceMesh.quaternion.copy(currentQuat);

        if (progress >= 1) {
          state.animating = false;
          diceMesh.quaternion.copy(state.targetQuaternion);
          if (state.onComplete) state.onComplete();
        }
      } else {
        // Dice remains completely still when idle
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(reqId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Canvas Fireworks & Confetti Animation Loop
  useEffect(() => {
    if (!showCelebrationModal) return;

    const canvas = fireworksCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const confettiColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#f97316'];
    const confetti = Array.from({ length: 150 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height - height,
      size: Math.random() * 8 + 4,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      vx: Math.random() * 4 - 2,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * 360,
      vrot: Math.random() * 10 - 5
    }));

    interface FireworkParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      color: string;
      size: number;
    }

    interface FireworkRocket {
      x: number;
      y: number;
      targetY: number;
      vx: number;
      vy: number;
      color: string;
      exploded: boolean;
    }

    let rockets: FireworkRocket[] = [];
    let particles: FireworkParticle[] = [];

    const spawnRocket = () => {
      const startX = Math.random() * (width * 0.8) + width * 0.1;
      const targetY = Math.random() * (height * 0.5) + 50;
      const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      rockets.push({
        x: startX,
        y: height,
        targetY,
        vx: (Math.random() - 0.5) * 4,
        vy: -1 * (Math.random() * 4 + 10),
        color,
        exploded: false
      });
    };

    let frameCount = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      frameCount++;
      if (frameCount % 35 === 0) {
        spawnRocket();
      }

      confetti.forEach(c => {
        c.x += c.vx;
        c.y += c.vy;
        c.rot += c.vrot;
        if (c.y > height) {
          c.y = -10;
          c.x = Math.random() * width;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate((c.rot * Math.PI) / 180);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
        ctx.restore();
      });

      rockets.forEach((r, idx) => {
        r.x += r.vx;
        r.y += r.vy;
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x, r.y, 3, 10);

        if (r.y <= r.targetY && !r.exploded) {
          r.exploded = true;
          const sparkColor = r.color;
          for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            particles.push({
              x: r.x,
              y: r.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              alpha: 1,
              color: sparkColor,
              size: Math.random() * 3 + 2
            });
          }
          rockets.splice(idx, 1);
        }
      });

      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.alpha -= 0.015;

        if (p.alpha <= 0) {
          particles.splice(idx, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [showCelebrationModal]);

  // Audio helpers with Web Audio API
  const playLandingSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  const playVictoryAndFireworksSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const notes = [440, 554, 659, 880, 1108];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + idx * 0.15 + 0.4);
      });
    } catch (e) {}
  };

  // Image compression utility
  const processImageFile = (file: File, callback: (dataUrl: string) => void) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Please upload a valid JPG, PNG, or WEBP image.');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`Image is too large. Max allowed size is ${MAX_FILE_SIZE_MB}MB.`);
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgResult = event.target?.result as string;
      const img = new Image();
      img.src = imgResult;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 300;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          callback(compressedDataUrl);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (playerId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file, (dataUrl) => {
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, photo: dataUrl } : p));
    });
    e.target.value = '';
  };

  const removePhoto = (playerId: string) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, photo: null } : p));
  };

  // Authoritative Quaternion Mapping for Results 1 through 6
  const getThreeTargetQuaternion = (val: number) => {
    const q = new THREE.Quaternion();
    const euler = new THREE.Euler(0, 0, 0, 'XYZ');
    switch (val) {
      case 1: euler.set(0, 0, 0); break;           // Face 1 on Top (+Y)
      case 2: euler.set(-Math.PI / 2, 0, 0); break; // Face 2 (Front +Z) -> Top (+Y)
      case 3: euler.set(0, 0, -Math.PI / 2); break; // Face 3 (Right +X) -> Top (+Y)
      case 4: euler.set(0, 0, Math.PI / 2); break;  // Face 4 (Left -X) -> Top (+Y)
      case 5: euler.set(Math.PI / 2, 0, 0); break;  // Face 5 (Back -Z) -> Top (+Y)
      case 6: euler.set(Math.PI, 0, 0); break;      // Face 6 (Bottom -Y) -> Top (+Y)
    }
    q.setFromEuler(euler);
    return q;
  };

  // Smooth 3D Dice Rotation & Score Animation Sequence
  const handleRollDice = () => {
    if (isRolling || isScoreAnimating || winners !== null) return;
    if (gameMode === 'tournament' && totalRolls >= 20) return;
    if (gameMode === 'timed' && timeRemaining <= 0) return;
    if (!threeDiceRef.current) return;

    if (gameMode === 'timed' && !isTimerActive && totalRolls === 0) {
      setMatchStartTime(Date.now());
      setIsTimerActive(true);
    }

    // 1. Generate one random result from 1 to 6
    const rollResult = Math.floor(Math.random() * 6) + 1;
    setDisplayDiceValue(rollResult);

    // 2 & 3. Rotate the dice smoothly in 3D, gradually slowing down to settle on final orientation
    const diceState = threeDiceRef.current;
    diceState.startQuaternion.copy(diceState.diceMesh.quaternion);
    diceState.targetQuaternion = getThreeTargetQuaternion(rollResult);
    diceState.startTime = Date.now();
    diceState.duration = 750; // Smooth rotation duration
    diceState.animating = true;

    // 5 & 7. Prevent double clicks and overlapping rotations
    setIsRolling(true);

    diceState.onComplete = () => {
      // 4. When rotation finishes, stop ALL rotation completely and play landing sound
      setIsRolling(false);
      if (soundEnabled) {
        playLandingSound();
      }

      // 3 & 4. Add the result to active player's score and animate score counter through every intermediate number
      const activePlayer = players[currentTurnIndex];
      const oldScore = activePlayer.score;
      const newScore = oldScore + rollResult;
      const newRollsCount = activePlayer.rollsCount + 1;
      const nextTotalRolls = totalRolls + 1;

      setIsScoreAnimating(true);

      animateScoreCounter(activePlayer.id, oldScore, newScore, () => {
        // 6. Only after the score animation completes:
        // - Finalize player's score and rollsCount
        const updatedPlayers = players.map((p, idx) => 
          idx === currentTurnIndex ? { ...p, score: newScore, rollsCount: newRollsCount } : p
        );
        setPlayers(updatedPlayers);

        // - Add roll to history
        const possibleComments = COMMENTARIES[rollResult] || ["Great roll!"];
        const comment = possibleComments[Math.floor(Math.random() * possibleComments.length)];
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newHistoryItem: HistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          rollNumber: nextTotalRolls,
          playerId: activePlayer.id,
          playerName: activePlayer.name,
          value: rollResult,
          comment,
          timestamp: nowStr,
        };

        setHistory(prev => [newHistoryItem, ...prev]);
        setLastRoll({ playerName: activePlayer.name, value: rollResult, comment, colorIdx: currentTurnIndex % PLAYER_COLORS.length });
        setTotalRolls(nextTotalRolls);
        setIsScoreAnimating(false);

        // 8. If match reaches roll limit or timer expires during roll, finish score animation first, then end match.
        const isTournamentEnd = gameMode === 'tournament' && nextTotalRolls >= 20;
        const isTimedEnd = gameMode === 'timed' && timeRemaining <= 0;

        if (isTournamentEnd || isTimedEnd) {
          determineAndShowWinners(updatedPlayers);
        } else {
          // - Switch to next player
          setCurrentTurnIndex((currentTurnIndex + 1) % players.length);
        }
      });
    };
  };

  const animateScoreCounter = (playerId: string, startScore: number, targetScore: number, onComplete: () => void) => {
    if (startScore === targetScore) {
      onComplete();
      return;
    }
    setIsScoreAnimating(true);
    let current = startScore;
    const diff = targetScore - startScore;
    const stepTime = Math.max(50, Math.min(120, 400 / Math.abs(diff)));

    const interval = setInterval(() => {
      current += 1;
      setDisplayedScores(prev => ({ ...prev, [playerId]: current }));

      if (soundEnabled) {
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(400 + (current * 20), ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.05);
        } catch (e) {}
      }

      if (current >= targetScore) {
        clearInterval(interval);
        setIsScoreAnimating(false);
        onComplete();
      }
    }, stepTime);
  };

  const handleStopMatch = () => {
    if (winners !== null || isScoreAnimating || isRolling) return;
    determineAndShowWinners(players);
  };

  const concludeMatch = () => {
    if (winners !== null) return;
    determineAndShowWinners(players);
  };

  const determineAndShowWinners = (currentPlayers: PlayerState[]) => {
    if (currentPlayers.length === 0) return;
    let maxScore = -1;
    let topPlayers: PlayerState[] = [];

    currentPlayers.forEach(p => {
      if (p.score > maxScore) {
        maxScore = p.score;
        topPlayers = [p];
      } else if (p.score === maxScore) {
        topPlayers.push(p);
      }
    });

    setWinners(topPlayers);
    setShowCelebrationModal(true);
    setIsTimerActive(false);
    playVictoryAndFireworksSound();
  };

  const openNewMatchModal = () => {
    setConfigTitle(matchTitle);
    setConfigMode(gameMode);
    setConfigDurationMin(Math.round(timedDurationSeconds / 60));
    setConfigPlayerCount(playerCount);
    setConfigPlayers(JSON.parse(JSON.stringify(players)));
    setShowConfigModal(true);
  };

  const handlePlayerCountChange = (newCount: number) => {
    setConfigPlayerCount(newCount);
    setConfigPlayers(prev => {
      if (newCount > prev.length) {
        const added = Array.from({ length: newCount - prev.length }, (_, i) => ({
          id: `player_${prev.length + i + 1}`,
          name: `Player ${prev.length + i + 1}`,
          photo: null,
          score: 0,
          rollsCount: 0,
        }));
        return [...prev, ...added];
      } else {
        return prev.slice(0, newCount);
      }
    });
  };

  const handleStartConfiguredMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configTitle.trim() || configPlayers.some(p => !p.name.trim())) return;

    let targetDurationSec = configDurationMin * 60;
    if (configMode === 'timed') {
      targetDurationSec = Math.max(30, configCustomMin * 60);
    }

    setMatchTitle(configTitle.trim().slice(0, 40));
    setGameMode(configMode);
    setTimedDurationSeconds(targetDurationSec);
    setTimeRemaining(targetDurationSec);
    setElapsedSeconds(0);
    setMatchStartTime(null);
    setIsTimerActive(false);

    setPlayerCount(configPlayerCount);
    const sanitizedPlayers = configPlayers.map(p => ({ ...p, name: p.name.trim().slice(0, 15), score: 0, rollsCount: 0 }));
    setPlayers(sanitizedPlayers);

    const scoresMap: Record<string, number> = {};
    sanitizedPlayers.forEach(p => { scoresMap[p.id] = 0; });
    setDisplayedScores(scoresMap);

    setCurrentTurnIndex(0);
    setTotalRolls(0);
    setLastRoll(null);
    setHistory([]);
    setWinners(null);
    setShowCelebrationModal(false);
    setShowConfigModal(false);
  };

  const startEditingName = (playerId: string) => {
    setEditingPlayerId(playerId);
    const p = players.find(x => x.id === playerId);
    setTempName(p ? p.name : '');
  };

  const saveName = (playerId: string) => {
    if (!tempName.trim()) return;
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, name: tempName.trim().slice(0, 15) } : p));
    setEditingPlayerId(null);
  };

  const saveMatchTitleInline = () => {
    if (tempMatchTitle.trim()) {
      setMatchTitle(tempMatchTitle.trim().slice(0, 40));
    }
    setEditingTitleInline(false);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  const activePlayer = players[currentTurnIndex];
  const isGameActive = winners === null && ((gameMode !== 'tournament' || totalRolls < 20) && (gameMode !== 'timed' || timeRemaining > 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden relative">
      
      {/* Toast Error Notification */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-3 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-red-400 text-xs font-medium"
          >
            <span>⚠️ {errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navbar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2 sticky top-0 z-40 shadow-lg shrink-0">
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin shrink-0" style={{ animationDuration: '4s' }} />
          
          {editingTitleInline ? (
            <div className="flex items-center gap-1 flex-1">
              <input 
                type="text"
                value={tempMatchTitle}
                onChange={(e) => setTempMatchTitle(e.target.value)}
                className="bg-slate-800 border border-indigo-500 text-white px-2 py-0.5 rounded text-xs font-bold w-full focus:outline-none"
                maxLength={40}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveMatchTitleInline()}
              />
              <button onClick={saveMatchTitleInline} className="p-1 bg-emerald-600 text-white rounded shrink-0">
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group cursor-pointer truncate" onClick={() => { setTempMatchTitle(matchTitle); setEditingTitleInline(true); }}>
              <h1 className="text-xs sm:text-base font-black bg-gradient-to-r from-indigo-300 via-amber-200 to-pink-300 bg-clip-text text-transparent truncate tracking-tight">
                {matchTitle}
              </h1>
              <span className="text-[10px] bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider border border-indigo-500/30 flex items-center gap-1">
                <Users className="w-3 h-3" /> {playerCount}P • {gameMode}
              </span>
              <Edit3 className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 transition shrink-0" title="Edit Match Title" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700/50"
            title={soundEnabled ? "Mute" : "Unmute"}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          <button 
            onClick={() => setShowRules(true)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700/50"
            title="Rules"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
          </button>
        </div>
      </header>

      {/* Main Content Area - 9:16 Portrait Optimized */}
      <main className="flex-1 max-w-md lg:max-w-3xl w-full mx-auto p-2.5 sm:p-5 flex flex-col gap-3">
        
        {/* Player Cards Grid (2 to 6 players) */}
        <div className={`grid gap-2.5 items-stretch shrink-0 ${playerCount <= 2 ? 'grid-cols-2' : playerCount <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-3'}`}>
          
          {players.map((p, idx) => {
            const isCurrentActive = isGameActive && currentTurnIndex === idx;
            const colorTheme = PLAYER_COLORS[idx % PLAYER_COLORS.length];

            return (
              <div 
                key={p.id}
                className={`rounded-2xl p-2 sm:p-3 flex flex-col justify-between transition-all border backdrop-blur-xl relative overflow-hidden ${
                  isCurrentActive 
                    ? `bg-gradient-to-b from-slate-900 via-slate-900 to-slate-900 ${colorTheme.border} shadow-md ring-1 ${colorTheme.ring}` 
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                {isCurrentActive && (
                  <div className={`absolute top-0 right-0 ${colorTheme.badge} text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider animate-pulse`}>
                    Turn
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] uppercase font-extrabold tracking-wider ${colorTheme.text}`}>P{idx + 1}</span>
                    <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.5 rounded">
                      {gameMode === 'tournament' ? `${p.rollsCount}r` : `${p.rollsCount}`}
                    </span>
                  </div>

                  {/* Avatar */}
                  <div className="flex flex-col items-center my-0.5">
                    <div className="relative group">
                      <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-800 border-2 ${colorTheme.border} flex items-center justify-center relative shadow-inner`}>
                        {p.photo ? (
                          <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className={`w-6 h-6 ${colorTheme.text} opacity-80`} />
                        )}

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <button onClick={() => {
                            document.getElementById(`file_input_${p.id}`)?.click();
                          }} className="p-1 bg-indigo-600 text-white rounded" title="Upload">
                            <Camera className="w-2.5 h-2.5" />
                          </button>
                          {p.photo && (
                            <button onClick={() => removePhoto(p.id)} className="p-1 bg-red-600 text-white rounded" title="Remove">
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <input 
                        type="file" 
                        id={`file_input_${p.id}`}
                        onChange={(e) => handlePhotoUpload(p.id, e)} 
                        accept="image/png, image/jpeg, image/webp" 
                        className="hidden" 
                      />
                    </div>
                    <button onClick={() => document.getElementById(`file_input_${p.id}`)?.click()} className="text-[8px] mt-0.5 text-slate-400 hover:underline">
                      {p.photo ? 'Change' : '+ Photo'}
                    </button>
                  </div>

                  {/* Name */}
                  <div className="text-center my-1">
                    {editingPlayerId === p.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input 
                          type="text" 
                          value={tempName} 
                          onChange={(e) => setTempName(e.target.value)}
                          maxLength={15}
                          className="bg-slate-800 border border-indigo-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold text-center w-full focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && saveName(p.id)}
                        />
                        <button onClick={() => saveName(p.id)} className="p-0.5 bg-emerald-600 text-white rounded"><Check className="w-2.5 h-2.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 group cursor-pointer truncate" onClick={() => startEditingName(p.id)}>
                        <h2 className={`text-[11px] sm:text-xs font-black ${colorTheme.text} truncate`}>{p.name}</h2>
                        <Edit3 className="w-2.5 h-2.5 text-slate-400 opacity-60 group-hover:opacity-100 shrink-0" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="mt-1 bg-slate-950/60 rounded-xl p-1 sm:p-1.5 border border-slate-800 text-center">
                  <span className="text-[7px] uppercase font-bold text-slate-400 tracking-wider">Score</span>
                  <div className={`text-base sm:text-xl font-black ${colorTheme.text} font-mono`}>
                    {displayedScores[p.id] ?? p.score}
                  </div>
                </div>
              </div>
            );
          })}

        </div>

        {/* Dice Arena with Gentle 3D Rotation Dice & Timed Mode Stats */}
        <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col items-center shrink-0">
          
          <div className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-2">
            {gameMode === 'tournament' && (
              <span className="bg-slate-800 px-2 py-0.5 rounded-md">Roll {totalRolls}/20</span>
            )}
            {gameMode === 'unlimited' && (
              <span className="bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Infinity className="w-3.5 h-3.5 text-purple-400" /> Total Rolls: {totalRolls}
              </span>
            )}
            {gameMode === 'timed' && (
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-md font-mono font-bold flex items-center gap-1 text-xs ${timeRemaining <= 30 ? 'bg-red-950 text-red-400 animate-pulse border border-red-500/40' : 'bg-slate-800 text-amber-300'}`}>
                  <Clock className="w-3.5 h-3.5" /> {formatTime(timeRemaining)}
                </span>
                <span className="text-[10px] text-slate-400">Rolls: {totalRolls}</span>
              </div>
            )}

            {isGameActive && (
              <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                Turn: {activePlayer.name}
              </span>
            )}
          </div>

          {/* Three.js Canvas Container (Gentle 3D Rotation Dice) */}
          <div ref={mountRef} className="w-36 h-36 sm:w-44 sm:h-44 my-1 cursor-pointer" onClick={handleRollDice}></div>

          <span className="text-[10px] font-mono font-bold text-indigo-300 mt-1">
            {isRolling ? "Rotating Dice..." : isScoreAnimating ? "Updating Score..." : `Result: ${displayDiceValue}`}
          </span>

          {/* Last Result Commentary */}
          <div className="h-8 my-1 text-center flex items-center justify-center px-1">
            {lastRoll ? (
              <p className="text-[11px] italic text-amber-300 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-amber-500/20 truncate max-w-xs">
                "{lastRoll.comment}"
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 italic">Click dice or Roll button to start!</p>
            )}
          </div>

          {/* Roll Dice Button & Stop Match Button */}
          <div className="w-full mt-1 flex flex-col gap-2">
            {isGameActive ? (
              <button
                onClick={handleRollDice}
                disabled={isRolling || isScoreAnimating}
                className={`w-full py-3 rounded-xl font-black text-sm sm:text-base tracking-wider uppercase shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
                  isRolling || isScoreAnimating
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                    : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-indigo-600/40 border border-indigo-400/40'
                }`}
              >
                <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                <span>{isRolling ? "Rotating..." : isScoreAnimating ? "Updating Score..." : `Roll Dice (${activePlayer.name})`}</span>
              </button>
            ) : (
              <div className="bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-pink-500/20 p-3 rounded-xl border border-amber-500/30 text-center">
                <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs mb-1.5">
                  <Trophy className="w-4 h-4" />
                  <span>
                    {winners && winners.length > 1 
                      ? `TIE BETWEEN ${winners.map(w => w.name.toUpperCase()).join(' & ')}!` 
                      : winners && winners.length === 1 
                        ? `${winners[0].name.toUpperCase()} WINS!` 
                        : "MATCH CONCLUDED"}
                  </span>
                </div>
                <button
                  onClick={openNewMatchModal}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition"
                >
                  New Match
                </button>
              </div>
            )}

            {/* Stop Match button for Unlimited Mode */}
            {gameMode === 'unlimited' && winners === null && (
              <button
                onClick={handleStopMatch}
                disabled={isRolling || isScoreAnimating}
                className="w-full py-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs tracking-wider uppercase shadow transition flex items-center justify-center gap-1.5 border border-red-500/40"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Match & Declare Winner</span>
              </button>
            )}
          </div>

          {/* New Match Button */}
          <div className="w-full mt-3 pt-2.5 border-t border-slate-800">
            <button 
              onClick={openNewMatchModal}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs font-bold shadow transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>New Match / Multiplayer Setup</span>
            </button>
          </div>

        </div>

        {/* Scorecard and Roll History at Bottom with Vertical Scrolling */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3 sm:p-4 backdrop-blur-xl shadow-xl shrink-0">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <h3 className="font-bold text-slate-200 text-xs">Scorecard & Roll History</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {gameMode === 'tournament' ? `${totalRolls}/20 Rolls` : `${totalRolls} Rolls`}
            </span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs">
              No history yet. Roll the dice to begin!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
              {history.map((item) => (
                <div 
                  key={item.id}
                  className="p-2 rounded-xl border bg-slate-950/40 border-slate-800 text-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <span>#{item.rollNumber}</span>
                      <span className="text-slate-300 truncate">({item.playerName})</span>
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">{item.comment}</div>
                  </div>
                  <div className="text-xs font-black font-mono bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                    🎲 {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Winner Celebration Modal with Full-Screen Canvas Fireworks & Confetti */}
      <AnimatePresence>
        {showCelebrationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <canvas 
              ref={fireworksCanvasRef} 
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            />
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0"></div>

            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center overflow-hidden z-25"
            >
              <div className="flex justify-center mb-3">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20 animate-bounce">
                  <Trophy className="w-10 h-10" />
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-widest mb-1">
                <PartyPopper className="w-4 h-4" />
                <span>Match Concluded ({gameMode.toUpperCase()})</span>
                <PartyPopper className="w-4 h-4" />
              </div>

              {winners && winners.length > 1 ? (
                <div className="my-4">
                  <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-300 via-white to-amber-400 bg-clip-text text-transparent tracking-wide uppercase mb-2">
                    IT'S A TIE!
                  </h2>
                  <p className="text-xs text-amber-200">{winners.map(w => w.name).join(' & ')} share the victory!</p>
                </div>
              ) : winners && winners.length === 1 ? (
                <div className="my-4">
                  {winners[0].photo && (
                    <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto mb-3 border-2 border-amber-400 shadow-xl">
                      <img src={winners[0].photo} alt={winners[0].name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <h2 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-300 via-white to-amber-400 bg-clip-text text-transparent tracking-wide uppercase">
                    {`${winners[0].name} WINS!`}
                  </h2>
                </div>
              ) : null}

              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 mb-6 flex flex-wrap justify-around gap-2 text-sm font-mono">
                {players.map(p => (
                  <div key={p.id} className="text-center">
                    <span className="text-[10px] text-slate-400 block truncate max-w-[80px]">{p.name}</span>
                    <span className="text-sm font-bold text-indigo-300">{p.score} pts</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCelebrationModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition shadow"
                >
                  View Scorecard
                </button>
                <button 
                  onClick={openNewMatchModal}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl transition"
                >
                  New Match
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Match & Multiplayer Setup Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-400" />
                  <span>Configure Multiplayer Match</span>
                </h3>
                <button 
                  onClick={() => setShowConfigModal(false)}
                  className="text-slate-400 hover:text-white font-bold px-2 py-0.5 rounded bg-slate-800 text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleStartConfiguredMatch} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-1">Match Title</label>
                  <input 
                    type="text" 
                    value={configTitle} 
                    onChange={(e) => setConfigTitle(e.target.value)}
                    placeholder="e.g. Ultimate Multiplayer Battle"
                    maxLength={40}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                {/* Player Count Selection (2 to 6) */}
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Select Number of Players</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handlePlayerCountChange(num)}
                        className={`py-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center ${
                          configPlayerCount === num
                            ? 'bg-indigo-600 text-white shadow ring-2 ring-indigo-400'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5 mb-0.5" />
                        <span>{num}P</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Game Mode Cards Selection */}
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Select Game Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfigMode('tournament')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                        configMode === 'tournament'
                          ? 'bg-indigo-600/30 border-indigo-500 text-white ring-1 ring-indigo-500'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Award className="w-4 h-4 text-indigo-400" />
                        <span className="text-[10px] font-mono bg-indigo-950 px-1.5 py-0.5 rounded text-indigo-300">20 Rolls</span>
                      </div>
                      <div className="font-bold text-xs">Tournament</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfigMode('unlimited')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                        configMode === 'unlimited'
                          ? 'bg-purple-600/30 border-purple-500 text-white ring-1 ring-purple-500'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Infinity className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] font-mono bg-purple-950 px-1.5 py-0.5 rounded text-purple-300">Free Play</span>
                      </div>
                      <div className="font-bold text-xs">Unlimited</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfigMode('timed')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                        configMode === 'timed'
                          ? 'bg-amber-600/30 border-amber-500 text-white ring-1 ring-amber-500'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] font-mono bg-amber-950 px-1.5 py-0.5 rounded text-amber-300">Countdown</span>
                      </div>
                      <div className="font-bold text-xs">Timed Mode</div>
                    </button>
                  </div>
                </div>

                {/* Timed Mode Duration Options */}
                {configMode === 'timed' && (
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-2">
                    <label className="block text-[10px] uppercase font-bold text-amber-400">Match Duration</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 3, 5, 10, 15, 30, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setConfigDurationMin(mins)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition ${
                            configDurationMin === mins
                              ? 'bg-amber-600 text-white shadow'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {mins === 60 ? '1 Hour' : `${mins} min`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Player Names & Photos */}
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Configure Players</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {configPlayers.map((cp, idx) => {
                      const col = PLAYER_COLORS[idx % PLAYER_COLORS.length];
                      return (
                        <div key={cp.id} className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center border ${col.border} shrink-0`}>
                            {cp.photo ? (
                              <img src={cp.photo} alt={`P${idx + 1}`} className="w-full h-full object-cover" />
                            ) : (
                              <User className={`w-4 h-4 ${col.text}`} />
                            )}
                          </div>
                          <div className="flex-1">
                            <input 
                              type="text" 
                              value={cp.name} 
                              onChange={(e) => {
                                const val = e.target.value;
                                setConfigPlayers(prev => prev.map(x => x.id === cp.id ? { ...x, name: val } : x));
                              }}
                              maxLength={15}
                              placeholder={`Player ${idx + 1} Name`}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
                              required
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              document.getElementById(`config_file_${cp.id}`)?.click();
                            }}
                            className="text-[10px] px-2.5 py-1 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/40 shrink-0 font-medium"
                          >
                            {cp.photo ? 'Change Photo' : '+ Photo'}
                          </button>
                          <input 
                            type="file" 
                            id={`config_file_${cp.id}`}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                processImageFile(f, (url) => {
                                  setConfigPlayers(prev => prev.map(x => x.id === cp.id ? { ...x, photo: url } : x));
                                });
                              }
                              e.target.value = '';
                            }}
                            accept="image/png, image/jpeg, image/webp"
                            className="hidden"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg transition"
                  >
                    Start Match
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-xs w-full shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Multiplayer Game Rules</span>
                </h3>
                <button 
                  onClick={() => setShowRules(false)}
                  className="text-slate-400 hover:text-white font-bold px-1.5 py-0.5 rounded bg-slate-800 text-[10px]"
                >
                  ✕
                </button>
              </div>

              <ul className="space-y-1.5 text-[11px] text-slate-300">
                <li>• <strong>Multiplayer Mode:</strong> Supports 2 to 6 players with automatic turn rotation.</li>
                <li>• <strong>Accurate Scoring:</strong> Exact `rollResult` is added to the active player's score with odometer counting.</li>
                <li>• <strong>Game Modes:</strong> Tournament (20 rolls), Unlimited, and Timed Mode.</li>
              </ul>

              <div className="mt-3 text-center">
                <button 
                  onClick={() => setShowRules(false)}
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
                >
                  Got It!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
