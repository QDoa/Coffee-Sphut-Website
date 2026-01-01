import Image from "next/image";

export default function Home() {
  return (
    <div>
      {/* Header */}
      <header>
        <Image
          // className="dark:invert"
          src="/icon.png"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <span>Coffee Sphut</span>
        <nav>
          <a href="#features">Features</a>
          <a href="#app">App</a>
          <a href="#download">Download</a>
        </nav>
      </header>
      
      <section id="hero">
      </section>

      <section id="features">
      </section>

      <section id="app">
      </section>

      <section id="download">
      </section>
      <footer>
        <span>Coffee Sphut</span>
        <p>© 2026 Coffee Sphut. All rights reserved.</p>
        <div>
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms of Service</a>
          <a href="#contact">Contact Us</a>
        </div>
      </footer>
    </div>
  );
}
