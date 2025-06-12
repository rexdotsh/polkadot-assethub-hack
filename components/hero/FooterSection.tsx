'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function FooterSection() {
  return (
    <footer className="sticky z-0 bottom-0 left-0 w-full h-screen bg-[#1f1f1f] flex justify-center items-center">
      <div className="relative overflow-hidden w-full h-full flex flex-col md:flex-row items-center">
        <div className="hidden md:block md:w-1/2 relative h-full">
          <Image
            src="/footer-art.png"
            alt="Footer Art"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="w-full md:w-1/2 flex flex-col justify-center items-center h-full px-4 md:pr-12">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <h1 className="text-[40px] sm:text-[60px] md:text-[100px] lg:text-[140px] xl:text-[180px] 2xl:text-[220px] font-garamond font-bold uppercase tracking-tighter text-white leading-none select-none">
              VULPIX
            </h1>
            <p className="text-white/70 text-sm sm:text-lg md:text-2xl lg:text-3xl xl:text-4xl font-garamond uppercase tracking-widest mt-2 sm:mt-4 md:mt-8">
              The Ultimate Battle Arena
            </p>
          </div>

          <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-4 sm:gap-6 md:gap-12 lg:gap-16 text-white mb-6 sm:mb-8 md:mb-12 w-full max-w-lg md:max-w-none">
            <Link
              href="/"
              className="text-lg sm:text-xl md:text-3xl lg:text-4xl xl:text-5xl font-garamond tracking-tighter uppercase hover:text-[#1e7a44] transition-all duration-300 hover:scale-110 text-center"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="text-lg sm:text-xl md:text-3xl lg:text-4xl xl:text-5xl font-garamond tracking-tighter uppercase hover:text-[#1e7a44] transition-all duration-300 hover:scale-110 text-center"
            >
              Dashboard
            </Link>
            <Link
              href="/generate"
              className="text-lg sm:text-xl md:text-3xl lg:text-4xl xl:text-5xl font-garamond tracking-tighter uppercase hover:text-[#1e7a44] transition-all duration-300 hover:scale-110 text-center"
            >
              Generate
            </Link>
            <Link
              href="/battle"
              className="text-lg sm:text-xl md:text-3xl lg:text-4xl xl:text-5xl font-garamond tracking-tighter uppercase hover:text-[#1e7a44] transition-all duration-300 hover:scale-110 text-center"
            >
              Battle
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 text-white/60">
            <a
              href="https://github.com/rexdotsh/vulpix"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm sm:text-lg md:text-2xl lg:text-3xl font-garamond uppercase tracking-wider hover:text-white transition-all duration-300 hover:scale-110"
            >
              Github
            </a>
            <a
              href="https://deepwiki.com/rexdotsh/vulpix"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm sm:text-lg md:text-2xl lg:text-3xl font-garamond uppercase tracking-wider hover:text-white transition-all duration-300 hover:scale-110"
            >
              Deepwiki
            </a>
            <Link
              href="#about"
              className="text-sm sm:text-lg md:text-2xl lg:text-3xl font-garamond uppercase tracking-wider hover:text-white transition-all duration-300 hover:scale-110"
            >
              About
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
