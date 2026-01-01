import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center">
                <Image
                  src="/icon.png"
                  alt="Next.js logo"
                  width={100}
                  height={20}
                  priority
                />
              </div>
              <span className="text-xl font-bold text-foreground">Coffee Sphut</span>
            </div>
          <nav className="hidden gap-6 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#app"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              App
            </a>
            <a 
              href="#download"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Download
            </a>
          </nav>
          <span className="text-xl font-bold text-foreground">Comming Soon!</span>
          </div>
        </div>
      </header>
      
      <section id="hero">
      </section>

      <section id="features">
      </section>

      <section id="app">
      </section>

      <section id="download">
      </section>
      <footer className="border-t border-border bg-card py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center">
                <Image
                  src="/icon.png"
                  alt="Next.js logo"
                  width={100}
                  height={20}
                  priority
                />
              </div>
              <span className="text-lg font-bold text-card-foreground">Coffee Sphut</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 Coffee Sphut. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#privacy" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                Privacy Policy
              </a>
              <a href="#terms" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                Terms of Service
              </a>
              <a href="#contact" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
