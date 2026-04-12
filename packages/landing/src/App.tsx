import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Features } from './components/Features';
import { WikiAndNotes } from './components/WikiAndNotes';
import { LocalAndSecure } from './components/LocalAndSecure';
import { LLMProviders } from './components/LLMProviders';
import { Hosting } from './components/Hosting';
import { MapSection } from './components/MapSection';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <Hero />
        <HowItWorks />
        <Features />
        <WikiAndNotes />
        <LocalAndSecure />
        <LLMProviders />
        <Hosting />
        <MapSection />
      </main>
      <Footer />
    </>
  );
}
