import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Background styling */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-luminosity"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background"></div>
      
      {/* Navbar */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Mafia World" className="h-10 w-10" />
          <span className="font-heading font-bold text-2xl tracking-widest text-primary uppercase">Mafia World</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up">
            <Button variant="default" className="font-heading uppercase tracking-wider">
              Play Now
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative z-10 flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl font-bold uppercase tracking-tight text-white drop-shadow-lg">
            Rule the <span className="text-primary">Underworld</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Build your criminal empire, hire bodyguards, smuggle weapons, and eliminate rival bosses in the most ruthless browser-based mafia strategy game.
          </p>
          <div className="pt-8">
            <Link href="/sign-up">
              <Button size="lg" className="h-16 px-12 text-xl font-heading uppercase tracking-widest shadow-[0_0_20px_rgba(139,0,0,0.5)] hover:shadow-[0_0_30px_rgba(139,0,0,0.8)] transition-all">
                Start Your Empire
              </Button>
            </Link>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-muted-foreground text-sm border-t border-border/50">
        &copy; {new Date().getFullYear()} Mafia World. All rights reserved.
      </footer>
    </div>
  );
}
