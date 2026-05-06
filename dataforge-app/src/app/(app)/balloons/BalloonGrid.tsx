"use client";

import { useState, useTransition } from "react";
import { popBalloonAction } from "@/actions/balloons.actions";

type BalloonData = {
  id: string;
  position: number;
  prize: string;
  isPopped: boolean;
  poppedAt: Date | null;
  poppedBy: { id: string; name: string | null; nickname: string | null } | null;
};

function BalloonSVG({ state }: { state: "intact" | "burst" | "fading" }) {
  return (
    <svg viewBox="0 0 100 130" className="w-full h-full" style={{ overflow: "visible" }}>
      {/* Intact balloon */}
      {state === "intact" && (
        <g>
          <ellipse cx="50" cy="52" rx="32" ry="38" fill="#e53e3e" />
          <ellipse cx="40" cy="38" rx="9" ry="13" fill="rgba(255,255,255,0.25)" />
          <path d="M50 90 Q46 100 50 108 Q54 100 50 90" stroke="#c53030" strokeWidth="1.5" fill="none" />
          <polygon points="50,108 45,116 55,116" fill="#c53030" />
          <path d="M50 108 Q38 120 30 128" stroke="#c53030" strokeWidth="1" fill="none" />
        </g>
      )}

      {/* Burst fragments */}
      {(state === "burst" || state === "fading") && (
        <g opacity={state === "fading" ? 0.4 : 1}>
          {/* Center remnant */}
          <ellipse cx="50" cy="52" rx="10" ry="8" fill="#e53e3e" />
          {/* Flying fragments */}
          <ellipse cx="20" cy="25" rx="10" ry="6" fill="#e53e3e" transform="rotate(-30 20 25)" />
          <ellipse cx="80" cy="20" rx="8" ry="5" fill="#fc8181" transform="rotate(25 80 20)" />
          <ellipse cx="15" cy="65" rx="9" ry="5" fill="#c53030" transform="rotate(15 15 65)" />
          <ellipse cx="85" cy="70" rx="7" ry="5" fill="#e53e3e" transform="rotate(-20 85 70)" />
          <ellipse cx="50" cy="10" rx="8" ry="5" fill="#fc8181" transform="rotate(5 50 10)" />
          <ellipse cx="30" cy="90" rx="6" ry="4" fill="#c53030" transform="rotate(-10 30 90)" />
          <ellipse cx="75" cy="88" rx="7" ry="4" fill="#feb2b2" transform="rotate(20 75 88)" />
          {/* Confetti dots */}
          <circle cx="60" cy="15" r="3" fill="#fc8181" />
          <circle cx="25" cy="42" r="2.5" fill="#feb2b2" />
          <circle cx="82" cy="45" r="2" fill="#e53e3e" />
          <circle cx="40" cy="100" r="2.5" fill="#c53030" />
        </g>
      )}
    </svg>
  );
}

function BalloonCell({
  balloon,
  myPoints,
  myId,
  onPopped,
}: {
  balloon: BalloonData;
  myPoints: number;
  myId: string;
  onPopped: (id: string, prize: string) => void;
}) {
  const [animState, setAnimState] = useState<"idle" | "popping" | "burst" | "fading" | "done">("idle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canPop = !balloon.isPopped && animState === "idle" && myPoints >= 1 && !isPending;

  function handleClick() {
    if (!canPop) return;
    setError(null);
    setAnimState("popping");

    // After 130ms show burst, 150ms fading, 300ms call server
    setTimeout(() => setAnimState("burst"), 130);
    setTimeout(() => setAnimState("fading"), 150);
    setTimeout(() => {
      startTransition(async () => {
        const res = await popBalloonAction(balloon.id);
        if (res.error) {
          setError(res.error);
          setAnimState("idle");
        } else {
          setAnimState("done");
          onPopped(balloon.id, res.prize!);
        }
      });
    }, 300);
  }

  const isPopped = balloon.isPopped || animState === "done";
  const displayName = balloon.poppedBy?.nickname ?? balloon.poppedBy?.name ?? null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`relative w-20 h-24 sm:w-24 sm:h-28 select-none transition-transform duration-150 ${
          canPop ? "cursor-[url('/cursor-pin.svg'),_crosshair] hover:scale-110 active:scale-95" : "cursor-default"
        } ${animState === "popping" ? "scale-95" : ""}`}
        onClick={handleClick}
        title={canPop ? "Click to pop!" : isPopped ? `Popped by ${displayName ?? "someone"}` : myPoints < 1 ? "Need 1 balloon point" : ""}
      >
        {isPopped ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center gap-0.5 bg-muted/30 rounded-xl border border-dashed border-border/50 p-1.5">
            <span className="text-xl">🎉</span>
            <p className="text-[9px] font-bold text-primary leading-tight line-clamp-2">{balloon.prize}</p>
            {displayName && <p className="text-[8px] text-muted-foreground leading-tight">{displayName}</p>}
          </div>
        ) : (
          <BalloonSVG
            state={
              animState === "burst" ? "burst"
              : animState === "fading" ? "fading"
              : "intact"
            }
          />
        )}

        {/* Position number */}
        {!isPopped && (
          <span className="absolute bottom-0 right-0 text-[9px] font-bold text-white/70">
            #{balloon.position}
          </span>
        )}
      </div>

      {error && <p className="text-[9px] text-destructive text-center max-w-[80px] leading-tight">{error}</p>}
    </div>
  );
}

export function BalloonGrid({
  initialBalloons,
  myPoints: initialPoints,
  myId,
}: {
  initialBalloons: BalloonData[];
  myPoints: number;
  myId: string;
}) {
  const [balloons, setBalloons] = useState(initialBalloons);
  const [myPoints, setMyPoints] = useState(initialPoints);
  const [pops, setPops] = useState<{ prize: string; at: Date }[]>([]);

  function handlePopped(id: string, prize: string) {
    setBalloons((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, isPopped: true, poppedAt: new Date(), poppedBy: null } : b
      )
    );
    setMyPoints((p) => Math.max(0, p - 1));
    setPops((prev) => [{ prize, at: new Date() }, ...prev].slice(0, 5));
  }

  const totalPopped = balloons.filter((b) => b.isPopped).length;

  return (
    <div className="space-y-6">
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
      <div className="grid grid-cols-4 gap-4 sm:gap-6 justify-items-center">
        {balloons.map((balloon) => (
          <BalloonCell
            key={balloon.id}
            balloon={balloon}
            myPoints={myPoints}
            myId={myId}
            onPopped={handlePopped}
          />
        ))}

        {/* Fill empty slots (when fewer than 16 exist in DB) */}
        {Array.from({ length: Math.max(0, 16 - balloons.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl bg-muted/20 border border-dashed border-border/40 flex items-center justify-center"
          >
            <span className="text-muted-foreground/40 text-2xl">🎈</span>
          </div>
        ))}
      </div>

      {/* Recent pops this session */}
      {pops.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40">
            <p className="text-sm font-bold">Your recent pops</p>
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
