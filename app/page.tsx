"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.8 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5 } },
  };

  const handleInstallClick = () => {
    alert("This would redirect to the Chrome Web Store in production!");
  };


  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-blue-500 selection:text-white overflow-x-hidden">
      {/* BACKGROUND ELEMENTS */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 flex flex-col items-center">
        {/* HERO SECTION */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center mt-20 mb-32"
        >
          <motion.div variants={itemVariants} className="mb-6">
            <span className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm font-semibold tracking-wide uppercase">
              Now with Realistic AI Voices
            </span>
          </motion.div>
          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent drop-shadow-sm"
          >
            EchoLearn AI <br />
            <span className="text-4xl md:text-6xl text-white/90">Breaking Barriers in Education</span>
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-2xl text-slate-300 max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            Empowering disabled students with real-time sign language translation,
            human-like AI voices, and interactive learning tools.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-6 justify-center">
            <button
              onClick={handleInstallClick}
              className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
            >
              Install Extension
            </button>
            <Link
              href="/demo"
              className="px-8 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-white font-bold text-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 justify-center"
            >
              <span>Try Live Demo</span>
              <span className="text-xl">→</span>
            </Link>
          </motion.div>
        </motion.div>

        {/* FEATURES GRID */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mb-20"
        >
          <FeatureCard
            icon="🗣️"
            title="Real-time Translation"
            description="Seamlessly converts hand gestures into spoken text and teacher's voice into sign language images instantly."
          />
          <FeatureCard
            icon="🎙️"
            title="Human-Like AI Voices"
            description="Powered by ElevenLabs to provide realistic, emotive, and gender-specific voices for students."
          />
          <FeatureCard
            icon="🧩"
            title="Interactive Quizzes"
            description="Engage with gamified learning modules compatible with platforms like Kahoot! and Quizizz."
          />
        </motion.div>

        {/* FOOTER */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-slate-500 text-sm mt-12"
        >
          © 2024 EchoLearn AI. All rights reserved.
        </motion.footer>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors group">
      <div className="text-4xl mb-6 bg-slate-900 w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors">{title}</h3>
      <p className="text-slate-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
