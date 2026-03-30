export function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-4 bg-[#fff9ee] bg-opacity-90 backdrop-blur-md">
      <div className="text-2xl font-black text-primary uppercase font-headline tracking-[-0.05em] scale-y-110">
        P.I.P.E.R. <span className="font-light italic lowercase opacity-80">Vault</span>
      </div>
      <div className="hidden md:flex items-center space-x-8 font-headline tracking-tighter">
        <a
          className="text-primary border-b-2 border-primary hover:text-primary-container transition-colors"
          href="#features"
        >
          Features
        </a>
        <a
          className="text-secondary hover:text-primary-container transition-colors"
          href="#pricing"
        >
          Pricing
        </a>
        <a className="text-secondary hover:text-primary-container transition-colors" href="#">
          Documentation
        </a>
        <a className="text-secondary hover:text-primary-container transition-colors" href="#">
          Status
        </a>
      </div>
      <div className="flex items-center space-x-4">
        <button className="text-secondary font-medium hover:text-primary transition-colors">
          Log In
        </button>
        <button className="bg-primary text-on-primary px-6 py-2 rounded shadow-sm hover:bg-primary-container transition-all btn-press font-semibold">
          Register
        </button>
      </div>
    </nav>
  );
}
