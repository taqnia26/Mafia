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

function CardFace({ value, suit, size }: { value: number; suit: Suit; size: "sm" | "md" }) {
  const isRed = suit === "hearts" || suit === "diamonds";
  const dim =
    size === "sm"
      ? "w-16 h-24 sm:w-20 sm:h-28"
      : "w-20 h-28 sm:w-24 sm:h-36";
  const corner = size === "sm" ? "text-[10px] sm:text-xs" : "text-xs sm:text-sm";
  const cornerSym = size === "sm" ? "text-sm sm:text-base" : "text-base sm:text-lg";
  const center = size === "sm" ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl";
  return (
    <div
      className={`${dim} relative rounded-lg bg-gradient-to-br from-white to-slate-100 border border-slate-300 shadow-[0_6px_18px_rgba(0,0,0,0.45)] ${
        isRed ? "text-red-600" : "text-slate-900"
      } select-none`}
      style={{ backfaceVisibility: "hidden" }}
    >
      <div className={`absolute top-1 left-1.5 flex flex-col items-center font-extrabold leading-none ${corner}`}>
        <span>{valueLabel(value)}</span>
        <span className={`${cornerSym} leading-none`}>{SUIT_SYMBOL[suit]}</span>
      </div>
      <div className={`w-full h-full flex items-center justify-center ${center} font-bold`}>
        <span>{SUIT_SYMBOL[suit]}</span>
      </div>
      <div className={`absolute bottom-1 right-1.5 flex flex-col items-center font-extrabold leading-none rotate-180 ${corner}`}>
        <span>{valueLabel(value)}</span>
        <span className={`${cornerSym} leading-none`}>{SUIT_SYMBOL[suit]}</span>
      </div>
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
