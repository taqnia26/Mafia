import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_ORDER: Suit[] = ["spades", "hearts", "clubs", "diamonds"];

function valueLabel(v: number): string {
  if (v === 1) return "A";
  if (v === 11) return "J";
  if (v === 12) return "Q";
  if (v === 13) return "K";
  return String(v);
}

export function suitForIndex(seed: number, index: number): Suit {
  const h = Math.abs(Math.imul(seed + 1, 2654435761) ^ Math.imul(index + 1, 40503));
  return SUIT_ORDER[h % 4];
}

// Pip positions as [topPercent, leftPercent, flipped]. Coordinates are within
// the inner pip area (between the corner labels). Bottom-half pips are
// rotated 180° to mimic real playing cards.
type Pip = [number, number, boolean];

const PIP_LAYOUTS: Record<number, Pip[]> = {
  2: [[0, 50, false], [100, 50, true]],
  3: [[0, 50, false], [50, 50, false], [100, 50, true]],
  4: [[0, 20, false], [0, 80, false], [100, 20, true], [100, 80, true]],
  5: [
    [0, 20, false], [0, 80, false],
    [50, 50, false],
    [100, 20, true], [100, 80, true],
  ],
  6: [
    [0, 20, false], [0, 80, false],
    [50, 20, false], [50, 80, false],
    [100, 20, true], [100, 80, true],
  ],
  7: [
    [0, 20, false], [0, 80, false],
    [25, 50, false],
    [50, 20, false], [50, 80, false],
    [100, 20, true], [100, 80, true],
  ],
  8: [
    [0, 20, false], [0, 80, false],
    [25, 50, false],
    [50, 20, false], [50, 80, false],
    [75, 50, true],
    [100, 20, true], [100, 80, true],
  ],
  9: [
    [0, 20, false], [0, 80, false],
    [33, 20, false], [33, 80, false],
    [50, 50, false],
    [67, 20, true], [67, 80, true],
    [100, 20, true], [100, 80, true],
  ],
  10: [
    [0, 20, false], [0, 80, false],
    [20, 50, false],
    [33, 20, false], [33, 80, false],
    [67, 20, true], [67, 80, true],
    [80, 50, true],
    [100, 20, true], [100, 80, true],
  ],
};

function FaceCardArt({ value, isRed }: { value: number; isRed: boolean }) {
  // Stylized monogram + ornamental frame for J/Q/K
  const letter = valueLabel(value);
  const accent = isRed ? "#b91c1c" : "#0f172a";
  return (
    <div className="absolute inset-3 rounded border-2 flex items-center justify-center"
      style={{ borderColor: accent, background: `repeating-linear-gradient(45deg, transparent 0 6px, ${accent}10 6px 7px)` }}>
      <div className="font-serif font-extrabold text-4xl sm:text-5xl" style={{ color: accent, textShadow: "0 1px 0 rgba(255,255,255,0.6)" }}>
        {letter}
      </div>
    </div>
  );
}

function CardFace({ value, suit, size }: { value: number; suit: Suit; size: "sm" | "md" }) {
  const isRed = suit === "hearts" || suit === "diamonds";
  const dim =
    size === "sm"
      ? "w-16 h-24 sm:w-20 sm:h-28"
      : "w-20 h-28 sm:w-24 sm:h-36";
  const corner = size === "sm" ? "text-[10px] sm:text-xs" : "text-xs sm:text-sm";
  const cornerSym = size === "sm" ? "text-[11px] sm:text-sm" : "text-sm sm:text-base";
  const pipSize = size === "sm" ? "text-[11px] sm:text-sm" : "text-sm sm:text-base";
  const aceSize = size === "sm" ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl";

  const colorClass = isRed ? "text-red-600" : "text-slate-900";
  const sym = SUIT_SYMBOL[suit];
  const label = valueLabel(value);
  const isFace = value === 11 || value === 12 || value === 13;
  const isAce = value === 1;
  const pips = !isFace && !isAce ? PIP_LAYOUTS[value] ?? [] : [];

  return (
    <div
      className={`${dim} relative rounded-lg bg-gradient-to-br from-white to-slate-100 border border-slate-300 shadow-[0_6px_18px_rgba(0,0,0,0.45)] ${colorClass} select-none overflow-hidden`}
      style={{ backfaceVisibility: "hidden" }}
    >
      {/* Top-left corner */}
      <div className={`absolute top-1 left-1.5 flex flex-col items-center font-extrabold leading-none ${corner}`}>
        <span>{label}</span>
        <span className={`${cornerSym} leading-none`}>{sym}</span>
      </div>
      {/* Bottom-right corner (flipped) */}
      <div className={`absolute bottom-1 right-1.5 flex flex-col items-center font-extrabold leading-none rotate-180 ${corner}`}>
        <span>{label}</span>
        <span className={`${cornerSym} leading-none`}>{sym}</span>
      </div>

      {/* Inner pip / face area, inset to avoid corner labels */}
      <div className="absolute" style={{ top: "16%", bottom: "16%", left: "22%", right: "22%" }}>
        {isAce && (
          <div className={`w-full h-full flex items-center justify-center ${aceSize} font-bold`}>
            <span style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}>{sym}</span>
          </div>
        )}
        {pips.map(([top, left, flipped], i) => (
          <span
            key={i}
            className={`absolute ${pipSize} font-bold leading-none`}
            style={{
              top: `${top}%`,
              left: `${left}%`,
              transform: `translate(-50%, -50%) ${flipped ? "rotate(180deg)" : ""}`,
            }}
          >
            {sym}
          </span>
        ))}
      </div>

      {isFace && <FaceCardArt value={value} isRed={isRed} />}
    </div>
  );
}

function CardBack({ size }: { size: "sm" | "md" }) {
  const dim =
    size === "sm"
      ? "w-16 h-24 sm:w-20 sm:h-28"
      : "w-20 h-28 sm:w-24 sm:h-36";
  return (
    <div
      className={`${dim} rounded-lg border border-amber-700/60 shadow-[0_6px_18px_rgba(0,0,0,0.45)] relative overflow-hidden`}
      style={{
        background:
          "repeating-linear-gradient(45deg, #7f1d1d 0 8px, #991b1b 8px 16px), radial-gradient(circle at center, rgba(212,175,55,0.5), transparent 70%)",
        backgroundBlendMode: "overlay",
        backfaceVisibility: "hidden",
      }}
    >
      <div className="absolute inset-1.5 rounded-md border-2 border-amber-400/70 flex items-center justify-center">
        <div className="text-amber-300 text-2xl sm:text-3xl drop-shadow-[0_0_4px_rgba(212,175,55,0.8)]">♣</div>
      </div>
    </div>
  );
}

interface PlayingCardProps {
  value: number;
  suit: Suit;
  hidden?: boolean;
  size?: "sm" | "md";
  delay?: number;
  index?: number;
  toPlayer?: boolean;
}

export function PlayingCard({
  value,
  suit,
  hidden = false,
  size = "md",
  delay = 0,
  index = 0,
  toPlayer = true,
}: PlayingCardProps) {
  const [revealed, setRevealed] = useState(!hidden);
  useEffect(() => {
    if (!hidden && !revealed) {
      const t = setTimeout(() => setRevealed(true), 80);
      return () => clearTimeout(t);
    }
    if (hidden && revealed) setRevealed(false);
    return undefined;
  }, [hidden, revealed]);

  return (
    <motion.div
      initial={{
        x: toPlayer ? -160 : -160,
        y: toPlayer ? -120 : -40,
        rotate: -25,
        scale: 0.6,
        opacity: 0,
      }}
      animate={{
        x: index * 4,
        y: 0,
        rotate: (index - 0.5) * 3,
        scale: 1,
        opacity: 1,
      }}
      transition={{ delay, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ perspective: 1000, marginLeft: index === 0 ? 0 : -8 }}
      className="relative"
    >
      <motion.div
        animate={{ rotateY: revealed ? 0 : 180 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d", position: "relative" }}
      >
        <div style={{ backfaceVisibility: "hidden" }}>
          <CardFace value={value} suit={suit} size={size} />
        </div>
        <div
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            position: "absolute",
            inset: 0,
          }}
        >
          <CardBack size={size} />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CardSlot({ size = "md" }: { size?: "sm" | "md" }) {
  const dim =
    size === "sm"
      ? "w-16 h-24 sm:w-20 sm:h-28"
      : "w-20 h-28 sm:w-24 sm:h-36";
  return (
    <div className={`${dim} rounded-lg border-2 border-dashed border-white/15`} />
  );
}
