import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Pricing } from './components/Pricing';
import { MapSection } from './components/MapSection';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <Hero />
        <Features />
        <Pricing />
        <MapSection />
      </main>
      <Footer />
    </>
  );
}
