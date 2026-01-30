
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center md:text-left">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} <span className="font-semibold text-slate-700">RDR Finance</span>. All rights reserved.</p>
        <p className="mt-1 md:mt-0">Dibuat dengan sistem profesional.</p>
      </div>
    </footer>
  );
};

export default Footer;
