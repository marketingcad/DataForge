"use client";

import { useState, useTransition, useMemo } from "react";
import { popBalloonAction } from "@/actions/balloons.actions";

type BalloonData = {
  id: string;
  position: number;
  prize: string;
  isPopped: boolean;
  poppedAt: Date | null;
  poppedBy: { id: string; name: string | null; nickname: string | null } | null;
};

// ── Colour themes ─────────────────────────────────────────────────────────────

const THEMES = [
  { main: "#d83940", hi: "#de5d63", lo: "#e17980", dk: "#be252c", shine: "#f1d4d6" },
  { main: "#2563eb", hi: "#3b82f6", lo: "#60a5fa", dk: "#1d4ed8", shine: "#dbeafe" },
  { main: "#16a34a", hi: "#22c55e", lo: "#4ade80", dk: "#15803d", shine: "#dcfce7" },
  { main: "#d97706", hi: "#f59e0b", lo: "#fbbf24", dk: "#b45309", shine: "#fef3c7" },
  { main: "#7c3aed", hi: "#8b5cf6", lo: "#a78bfa", dk: "#6d28d9", shine: "#ede9fe" },
  { main: "#db2777", hi: "#ec4899", lo: "#f472b6", dk: "#be185d", shine: "#fce7f3" },
  { main: "#0891b2", hi: "#06b6d4", lo: "#22d3ee", dk: "#0e7490", shine: "#cffafe" },
  { main: "#65a30d", hi: "#84cc16", lo: "#a3e635", dk: "#4d7c0f", shine: "#ecfccb" },
];

type Theme = typeof THEMES[0];

function theme(position: number): Theme {
  return THEMES[(position - 1) % THEMES.length];
}

// ── CSS keyframes (injected once via BalloonGrid) ─────────────────────────────

const KEYFRAMES = `
@keyframes balloon-float {
  0%,100% { transform: translateY(0px) rotate(-1.5deg); }
  50%      { transform: translateY(-8px) rotate(1.5deg); }
}
@keyframes prize-in {
  0%   { transform: scale(0.1) rotate(-12deg); opacity: 0; }
  60%  { transform: scale(1.08) rotate(3deg);  opacity: 1; }
  80%  { transform: scale(0.97) rotate(-1deg); }
  100% { transform: scale(1) rotate(0deg);     opacity: 1; }
}
@keyframes confetti-fall {
  0%   { transform: translateY(0)    rotate(0deg);   opacity: 1; }
  100% { transform: translateY(520px) rotate(820deg); opacity: 0; }
}
@keyframes twinkle {
  0%,100% { transform: scale(1)   rotate(0deg);  opacity: 0.5; }
  50%      { transform: scale(1.4) rotate(25deg); opacity: 1;   }
}
@keyframes gold-pulse {
  0%,100% { box-shadow: 0 4px 18px rgba(245,158,11,0.4); }
  50%      { box-shadow: 0 4px 38px rgba(245,158,11,0.85); }
}
@keyframes badge-bob {
  0%,100% { transform: translateY(0)   scale(1);    }
  40%      { transform: translateY(-6px) scale(1.06); }
}
`;

// ── Synthetic pop sound ───────────────────────────────────────────────────────

function playPop() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    function fire() {
      const duration = 0.22;
      const rate = ctx.sampleRate;
      const buf = ctx.createBuffer(1, Math.ceil(rate * duration), rate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 180;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      src.connect(hp); hp.connect(gain); gain.connect(ctx.destination);
      src.start();
      setTimeout(() => ctx.close(), 600);
    }
    if (ctx.state === "suspended") ctx.resume().then(fire); else fire();
  } catch { /* audio unavailable */ }
}

// ── SVG shared props ──────────────────────────────────────────────────────────

const S = {
  viewBox: "-3 8 58 90",
  className: "absolute inset-0 w-full h-full",
  style: { overflow: "visible" as const },
  strokeWidth: 0.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

// ── Frame 1: intact balloon ───────────────────────────────────────────────────

function IntactBalloon({ t }: { t: Theme }) {
  return (
    <svg {...S}>
      <path d="M24 55 C0 45 10 20 25 20 C40 20 50 45 26 55" fill={t.main} stroke={t.dk} />
      <path d="M24 55 Q25 57 22 59 Q25 59 25 58 Q26 59 28 59 Q25 57 26 55" fill={t.main} stroke={t.dk} />
      <path d="M24.5 55.5 L25.5 55.5" strokeWidth={1} stroke="#444" />
      <path d="M25.5 55.8 C16 58 27 60 23 70" strokeWidth={1} stroke="#444" />
      <path d="M23 70 C18 78 27 80 23 90" strokeWidth={1} stroke="#444" />
      <ellipse cx="31.5" cy="25.5" rx="10" ry="13" fill={t.hi} stroke="none" style={{ transform: "rotate(20deg)" }} />
      <ellipse cx="30" cy="18" rx="4" ry="7" fill={t.lo} stroke="none" style={{ transform: "rotate(30deg)" }} />
      <path d="M11 40 Q10 35 12 30 L13.5 32 Q11.5 35 12 39 Z" fill={t.shine} stroke="none" />
      <path d="M12.5 38.5 Q12 35 14 32.5 L15.5 34 Q14 35 13.8 37 Z" fill={t.shine} stroke="none" />
      <path d="M12.5 29 Q15 25 19 23 Q18 24 18 27 Q15.5 28 14 31 Z" fill={t.shine} stroke="none" />
      <path d="M14.5 31.5 Q15.5 29 18 28 Q17.5 30 18 31.5 Q17 32 16 33 Z" fill={t.shine} stroke="none" />
      <path d="M30 52 Q40 46 39.5 35 L38 34 Q38 46 30 52" fill={t.shine} stroke="none" />
      <path d="M24.5 55.5 L25.5 55.5 C15 59 28 65 25 72 C19 83 23 83 25 90" stroke="black" strokeWidth={1} fill="none" />
    </svg>
  );
}

// ── Frame 2: burst ────────────────────────────────────────────────────────────

function BurstBalloon({ t }: { t: Theme }) {
  return (
    <svg {...S}>
      <path d="M20 50 L21 45 C15 45 14 45 17 42 Q30 28 35 32 Q33 34 35.5 36 Q32 38 34 44 Q32 46 28 48 Q27 48 27 46 Q25 48 20 50" stroke={t.dk} fill={t.main} />
      <path d="M19 43 L23 39 Q24 38 28 38 Q24 40 22 43 Z" fill={t.hi} stroke="none" />
      <path d="M25 37 Q27 35 32 34 L29 37 Q27 36 25 37" fill={t.hi} stroke="none" />
      <path d="M10 53 Q10 46 13 46 Q12 48 15 53 C13 55 11 50 10 53" fill={t.main} stroke="none" />
      <path d="M32 46 L31 28 L33 28 Z" fill="#ded5d1" stroke="none" />
      <path d="M40 40 L44 34 L46 36 Z" fill="#ded5d1" stroke="none" />
      <path d="M35 50 L60 37 L61 40 Z" fill="#ded5d1" stroke="none" />
      <path d="M45 52 L55 51 L55 53 Z" fill="#ded5d1" stroke="none" />
      <path d="M20 60 Q19 59 24 56 C22 65 21 58 20 60" fill={t.main} stroke="none" />
      <path d="M25 75 C29 68 18 70 19 60 Q23 63 28 60 Q28 63 31 61 Q31 64 36 59 C36 64 39 59 46 62 C43 61 36 74 27 72 C25 76 30 79 25 79 C25 76 22 78 22 76 Q24 76 25 75" fill={t.main} stroke="none" />
      <path d="M48 60 Q46 58 53 56 C51 63 50 57 48 60" fill={t.main} stroke="none" />
      <rect x="50" y="45" width="10" height="5" rx="2" fill={t.main} stroke="none" />
      <path d="M50 35 L52 30 Q54 32 59 31 Q56 36 50 35" fill={t.dk} stroke="none" />
      <path d="M35 53 L55 62 L56 60 Z" fill="#ded5d1" stroke="none" />
      <path d="M56 34 L55 28 C60 28 60 32 56 34" fill={t.main} stroke="none" />
      <path d="M26.5 72.2 L26.1 72 C5 66 28 76 15 87 Q5 95 15 97" stroke="black" strokeWidth={1} fill="none" />
      <path d="M32 56 L30 75 L34 75 Z" fill="#ded5d1" stroke="none" />
      <path d="M0 60 L20 56 L2 62 Z" fill="#ded5d1" stroke="none" />
    </svg>
  );
}

// ── Frame 3: ghost ────────────────────────────────────────────────────────────

function GhostBalloon({ t }: { t: Theme }) {
  return (
    <svg {...S} style={{ overflow: "visible", opacity: 0.45 }}>
      <path d="M17 47 L18 42 C12 42 11 42 14 39 Q27 25 32 29 Q30 31 32.5 33 Q29 35 31 41 Q29 43 25 45 Q24 45 24 43 Q22 45 17 47" stroke={t.dk} fill={t.main} />
      <path d="M7 50 Q7 43 10 43 Q9 45 12 50 C10 52 8 47 7 50" fill={t.main} stroke="none" />
      <path d="M43 37 L47 31 L49 33 Z" fill="#ded5d1" stroke="none" />
      <path d="M37 48 L62 35 L63 38 Z" fill="#ded5d1" stroke="none" />
      <path d="M48 52 L59 51 L59 53 Z" fill="#ded5d1" stroke="none" />
      <path d="M19 59 Q18 58 23 55 C21 64 20 57 19 59" fill={t.main} stroke="none" />
      <path d="M22 78 C26 71 15 73 16 63 Q20 66 25 63 Q25 66 34 64 Q28 67 33 62 C33 67 36 62 43 65 C41 64 33 77 24 75 C22 79 27 81 22 82 C22 79 19 81 18 79 Q21 79 22 78" fill={t.main} stroke="none" />
      <path d="M49 61 Q49 59 54 57 C53 64 51 58 49 61" fill={t.main} stroke="none" />
      <rect x="53" y="43" width="10" height="5" rx="2" fill={t.main} stroke="none" />
      <path d="M53 32 L55 27 Q57 28 61.5 28 Q59 33 53 32" fill={t.main} stroke="none" />
      <path d="M59 31 L58 25 C63 25 63 28 59 31" fill="#e99a7a" stroke="none" />
      <path d="M38 53 L58 62 L59 60 Z" fill="#ded5d1" stroke="none" />
      <path d="M23.5 75.2 L23.1 75 C2 69 25 79 12 91 Q2 98 12 99" stroke="black" strokeWidth={1} fill="none" />
      <path d="M32 59 L30 79 L34 79 Z" fill="#ded5d1" stroke="none" />
      <path d="M0 59 L20 55 L2 61 Z" fill="#ded5d1" stroke="none" />
    </svg>
  );
}

// ── Prize modal ───────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["#f59e0b","#ef4444","#10b981","#3b82f6","#8b5cf6","#ec4899","#f97316","#06b6d4","#a3e635","#fff"];

const SPARKLE_POSITIONS = [
  "top-4 left-5", "top-4 right-5", "top-14 left-3", "top-14 right-3",
  "bottom-24 left-5", "bottom-24 right-5",
];

function PrizeModal({ prize, onClose }: { prize: string; onClose: () => void }) {
  const confetti = useMemo(() =>
    Array.from({ length: 65 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: 2 + Math.random() * 96,
      delay: Math.random() * 0.9,
      dur: 1.4 + Math.random() * 1.8,
      w: 4 + Math.random() * 9,
      tall: 7 + Math.random() * 11,
      circle: Math.random() > 0.45,
      rot: Math.random() * 360,
    })),
  []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(7px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[300px]"
        style={{ animation: "prize-in 0.52s cubic-bezier(0.22, 1.5, 0.36, 1) both" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Confetti burst (clipped to card area) */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none" style={{ zIndex: 0 }}>
          {confetti.map(p => (
            <div
              key={p.id}
              style={{
                position: "absolute",
                top: -14,
                left: `${p.left}%`,
                width: p.w,
                height: p.circle ? p.w : p.tall,
                borderRadius: p.circle ? "50%" : 2,
                background: p.color,
                transform: `rotate(${p.rot}deg)`,
                animation: `confetti-fall ${p.dur}s ${p.delay}s ease-in both`,
              }}
            />
          ))}
        </div>

        {/* Card */}
        <div
          className="relative z-10 rounded-3xl px-7 pt-9 pb-7 flex flex-col items-center gap-3 text-center"
          style={{
            background: "linear-gradient(160deg, #0c1829 0%, #162543 55%, #091220 100%)",
            border: "1.5px solid rgba(251,191,36,0.35)",
            boxShadow: "0 0 90px rgba(251,191,36,0.18), 0 30px 70px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Corner sparkles */}
          {SPARKLE_POSITIONS.map((pos, i) => (
            <span
              key={i}
              className={`absolute text-yellow-400 ${pos}`}
              style={{
                fontSize: 16,
                animation: `twinkle 2s ${(i * 0.18).toFixed(2)}s ease-in-out infinite`,
              }}
            >
              ✦
            </span>
          ))}

          {/* Trophy */}
          <div
            style={{
              fontSize: 76,
              lineHeight: 1,
              filter: "drop-shadow(0 0 24px rgba(251,191,36,0.65))",
              animation: "badge-bob 2.2s 0.4s ease-in-out infinite",
            }}
          >
            🏆
          </div>

          {/* YOU WON */}
          <p style={{
            color: "#fbbf24",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            textShadow: "0 0 18px rgba(251,191,36,0.8)",
          }}>
            YOU WON
          </p>

          {/* Gold line */}
          <div style={{
            width: 56,
            height: 1.5,
            background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.7), transparent)",
          }} />

          {/* Prize name */}
          <p className="font-black text-white leading-snug" style={{
            fontSize: "clamp(19px, 5.5vw, 27px)",
            textShadow: "0 2px 18px rgba(255,255,255,0.12)",
          }}>
            {prize}
          </p>

          {/* Button */}
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-2xl py-3.5 font-black text-sm active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
              color: "#1c0a00",
              letterSpacing: "0.1em",
              animation: "gold-pulse 2s 0.6s ease-in-out infinite",
            }}
          >
            🎉 AWESOME!
          </button>

          <p className="text-[10px] text-white/25 mt-1">tap anywhere to dismiss</p>
        </div>
      </div>
    </div>
  );
}

// ── Balloon cell ──────────────────────────────────────────────────────────────

type AnimState = "idle" | "burst" | "fading" | "done";

function BalloonCell({
  balloon, myPoints, onPopped,
}: {
  balloon: BalloonData;
  myPoints: number;
  onPopped: (id: string, prize: string) => void;
}) {
  const [anim, setAnim]     = useState<AnimState>("idle");
  const [fading, setFading] = useState(false);
  const [isPending, startT] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const t = theme(balloon.position);

  const isPopped = balloon.isPopped || anim === "done";
  const canPop   = !isPopped && anim === "idle" && myPoints >= 1 && !isPending;

  function handleClick() {
    if (!canPop) return;
    setError(null);
    playPop();
    setAnim("burst");
    setTimeout(() => setAnim("fading"), 20);
    setTimeout(() => setFading(true), 120);
    setTimeout(() => {
      startT(async () => {
        const res = await popBalloonAction(balloon.id);
        if (res.error) {
          setError(res.error);
          setAnim("idle");
          setFading(false);
        } else {
          setAnim("done");
          setFading(false);
          onPopped(balloon.id, res.prize!);
        }
      });
    }, 300);
  }

  const displayName = balloon.poppedBy?.nickname ?? balloon.poppedBy?.name ?? null;
  const floatDelay = `${((balloon.position - 1) % 7) * 0.18}s`;
  const floatDur   = `${2.6 + (balloon.position % 5) * 0.22}s`;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Float wrapper — only on idle intact balloons */}
      <div style={anim === "idle" && !isPopped ? {
        animation: `balloon-float ${floatDur} ${floatDelay} ease-in-out infinite`,
      } : {}}>
        <div
          onClick={handleClick}
          title={
            canPop       ? "Click to pop!" :
            isPopped     ? `Won by ${displayName ?? "someone"}` :
            myPoints < 1 ? "Need 1 balloon point" : ""
          }
          className={[
            "relative select-none w-20 h-28 sm:w-24 sm:h-32 md:w-28 md:h-36",
            canPop ? "cursor-[url('/cursor-pin.svg'),_crosshair] hover:scale-105 active:scale-95" : "cursor-default",
          ].join(" ")}
          style={{
            transition: fading ? "opacity 0.18s ease-out" : "opacity 0s, transform 0.15s",
            opacity: fading ? 0 : 1,
          }}
        >
          {isPopped ? (
            <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center gap-1 p-1.5"
              style={{
                background: "linear-gradient(145deg, rgba(var(--primary)/0.12), rgba(var(--primary)/0.04))",
                border: "1px dashed rgba(var(--primary)/0.25)",
              }}
            >
              <span className="text-2xl leading-none">🎁</span>
              <p className="text-[11px] sm:text-xs font-black text-primary leading-tight line-clamp-3 break-words w-full">
                {balloon.prize}
              </p>
              {displayName && (
                <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight font-medium">
                  {displayName}
                </p>
              )}
            </div>
          ) : (
            <>
              {anim === "idle"                       && <IntactBalloon t={t} />}
              {(anim === "burst" || anim === "fading") && <BurstBalloon t={t} />}
              {anim === "fading"                     && <GhostBalloon t={t} />}
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[9px] text-destructive text-center max-w-[90px] leading-tight">{error}</p>
      )}
    </div>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────

export function BalloonGrid({
  initialBalloons,
  myPoints: initialPoints,
  myId,
  myName,
}: {
  initialBalloons: BalloonData[];
  myPoints: number;
  myId: string;
  myName: string | null;
}) {
  const [balloons, setBalloons] = useState(initialBalloons);
  const [myPoints, setMyPoints] = useState(initialPoints);
  const [pops, setPops]         = useState<{ prize: string; at: Date }[]>([]);
  const [winner, setWinner]     = useState<string | null>(null);

  function handlePopped(id: string, prize: string) {
    setBalloons(prev =>
      prev.map(b => b.id === id
        ? { ...b, isPopped: true, poppedAt: new Date(), poppedBy: { id: myId, name: myName, nickname: null } }
        : b
      )
    );
    setMyPoints(p => Math.max(0, p - 1));
    setPops(prev => [{ prize, at: new Date() }, ...prev].slice(0, 5));
    setWinner(prize);
  }

  const totalPopped = balloons.filter(b => b.isPopped).length;

  return (
    <div className="space-y-5">
      <style>{KEYFRAMES}</style>

      {winner && <PrizeModal prize={winner} onClose={() => setWinner(null)} />}

      {/* Points bar */}
      <div className="flex items-center justify-between rounded-2xl bg-card border border-border/40 shadow-sm px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎈</span>
          <div>
            <p className="text-sm font-black">{myPoints} balloon point{myPoints !== 1 ? "s" : ""}</p>
            <p className="text-[11px] text-muted-foreground">1 point per appointment booked</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-muted-foreground">{totalPopped}/16 popped</p>
          <p className="text-[11px] text-muted-foreground">{16 - totalPopped} remaining</p>
        </div>
      </div>

      {myPoints < 1 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/40 px-5 py-3 text-sm text-amber-700 dark:text-amber-400 font-medium">
          📅 Book an appointment to earn balloon points and pop a balloon!
        </div>
      )}

      {/* 4×4 grid */}
      <div className="grid grid-cols-4 gap-3 sm:gap-4 md:gap-5 justify-items-center">
        {balloons.map(balloon => (
          <BalloonCell
            key={balloon.id}
            balloon={balloon}
            myPoints={myPoints}
            onPopped={handlePopped}
          />
        ))}
        {Array.from({ length: Math.max(0, 16 - balloons.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-20 h-28 sm:w-24 sm:h-32 md:w-28 md:h-36 rounded-2xl bg-muted/20 border border-dashed border-border/40 flex items-center justify-center"
          >
            <span className="text-muted-foreground/40 text-3xl">🎈</span>
          </div>
        ))}
      </div>

      {/* Recent pops this session */}
      {pops.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40">
            <p className="text-sm font-bold">Your recent pops 🎉</p>
          </div>
          <div className="divide-y divide-border/30">
            {pops.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="text-lg">🎉</span>
                <p className="text-sm font-semibold flex-1">{p.prize}</p>
                <p className="text-xs text-muted-foreground">{p.at.toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
