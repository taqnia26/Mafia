import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

export type RankTier = "bronze" | "silver" | "gold" | "platinum";

export function getRankTier(rank: number): RankTier {
  if (rank <= 3) return "bronze";
  if (rank <= 6) return "silver";
  if (rank <= 9) return "gold";
  return "platinum";
}

const TIER_STYLES: Record<RankTier, string> = {
  bronze: "bg-amber-900/30 text-amber-300 border-amber-800/60",
  silver: "bg-slate-700/40 text-slate-200 border-slate-500/60",
  gold: "bg-yellow-900/30 text-yellow-300 border-yellow-700/70",
  platinum: "bg-gradient-to-r from-fuchsia-700/30 to-cyan-700/30 text-cyan-200 border-cyan-500/60",
};

interface RankBadgeProps {
  rank: number;
  nameEn?: string | null;
  nameAr?: string | null;
  language?: "en" | "ar";
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RankBadge({
  rank, nameEn, nameAr, language = "en", className, showIcon = true, size = "md",
}: RankBadgeProps) {
  const tier = getRankTier(rank);
  const name = (language === "ar" ? nameAr : nameEn) ?? `#${rank}`;
  const sizeClass =
    size === "sm" ? "text-xs px-2 py-0.5 gap-1" :
    size === "lg" ? "text-base px-3 py-1.5 gap-2" :
    "text-sm px-2.5 py-1 gap-1.5";
  return (
    <span className={cn(
      "inline-flex items-center rounded-md border font-medium",
      TIER_STYLES[tier], sizeClass, className,
    )} data-testid={`rank-badge-${rank}`}>
      {showIcon && <Award className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />}
      <span className="font-bold tabular-nums">#{rank}</span>
      <span>{name}</span>
    </span>
  );
}
