import { motion, AnimatePresence } from "framer-motion";
import dealerSofia from "@/assets/dealer-sofia.png";

interface DealerProps {
  message: string;
  active?: boolean;
}

export function Dealer({ message, active = true }: DealerProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        animate={{
          boxShadow: active
            ? [
                "0 0 16px rgba(212,175,55,0.45)",
                "0 0 32px rgba(212,175,55,0.9)",
                "0 0 16px rgba(212,175,55,0.45)",
              ]
            : "0 0 12px rgba(212,175,55,0.3)",
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-amber-400 overflow-hidden bg-black"
      >
        <img
          src={dealerSofia}
          alt="Sofia, casino dealer"
          className="w-full h-full object-cover"
          draggable={false}
        />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider shadow-md">
          DEALER
        </span>
      </motion.div>
      <div className="text-center">
        <div className="text-amber-300 font-serif text-base leading-tight">Sofia</div>
        <div className="text-[10px] uppercase tracking-widest text-amber-200/60">Professional Dealer</div>
      </div>

      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="relative max-w-xs bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-4 py-2 mt-1"
          >
            <p className="text-sm italic text-amber-100/90 text-center">"{message}"</p>
            <span
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white/10 border-l border-t border-white/15"
              aria-hidden
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
