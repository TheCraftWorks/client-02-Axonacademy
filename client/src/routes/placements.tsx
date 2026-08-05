import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../components/site/Layout";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/placements")({ component: Placements });

const NAVY = "#0B1F3A";
const GOLD = "#F4B400";
const SKY  = "#2D9CDB";
const EMERALD = "#16A34A";

function Placements() {
  const results2024 = [
    { rank: 1, name: "Dr. Lalith Paul", institution: "GSMC, CH", special: true },
    { rank: 5, name: "Dr. Dayana", institution: "GSMC, CH" },
    { rank: 16, name: "Dr. Sandhiya", institution: "GSMC, CH" },
    { rank: 25, name: "Dr. Senthamizh", institution: "MARIA" },
    { rank: 34, name: "Ilanchezhiyan", institution: "GSMC, CH" },
    { rank: 39, name: "Dr. Ajay Chandru", institution: "GSMC, CH" },
    { rank: 42, name: "Dr. Sangeetha", institution: "SAIRAM" },
    { rank: 50, name: "Dr. Naveen", institution: "GSMC, CH" },
    { rank: 52, name: "Dr. Shilpa", institution: "GSMC, CH" },
    { rank: 56, name: "Jayashree Kavya", institution: "GSMC, CH" },
    { rank: 73, name: "Dr. Rose Brito", institution: "GSMC, CH" },
    { rank: 106, name: "Dr. Vasundhara", institution: "GSMC, CH" },
    { rank: 126, name: "Dr. Hariharasudhan", institution: "MARIA" },
  ];

  const results2025 = [
    { rank: 1, name: "Dr. U. Poorani", institution: "VSMC", special: true },
    { rank: 2, name: "Dr. M. Priya", institution: "GSMC" },
    { rank: 7, name: "Dr. K. M. Kavin Shree", institution: "GSMC" },
    { rank: 10, name: "Dr. Jeniba Jubit", institution: "GSMC, Palay" },
    { rank: 12, name: "Dr. Charulekha", institution: "Sairam" },
    { rank: 18, name: "Dr. Dhamayanthi", institution: "GSMC, CH" },
    { rank: 19, name: "Dr. S. Madhu Dhamayanthi", institution: "GSMC" },
    { rank: 20, name: "Dr. Vaishnavi", institution: "Sairam" },
    { rank: 22, name: "Dr. S. Suhaina Fathima", institution: "GSMC" },
    { rank: 32, name: "Dr. Sneha", institution: "Sairam" },
    { rank: 50, name: "Dr. Shyamala", institution: "GSMC, CH" },
  ];

  return (
    <PublicLayout>
      <section className="relative py-20 lg:py-28 overflow-hidden">
        {/* Decorative gold blur */}
        <div className="absolute -z-10 top-0 right-0 h-[500px] w-[500px] rounded-full blur-3xl"
          style={{ background: 'rgba(244,180,0,0.18)' }} />
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: SKY }}>— Results</div>
          <h1 className="mt-3 max-w-3xl font-display text-4xl lg:text-7xl font-bold tracking-[-0.03em] leading-[1.02]"
            style={{ color: NAVY }}>
            Our Legacy of Success in <br />
            <span className="px-3 rounded text-navy" style={{ backgroundColor: GOLD }}>MRB & AIAPGET</span>
          </h1>
        </div>
      </section>

      <section className="py-16 relative overflow-hidden text-white" style={{ backgroundColor: NAVY }}>
        <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="font-display text-4xl lg:text-5xl font-bold" style={{ color: GOLD }}>AIR 1</div>
              <div className="mt-2 text-sm text-white/70">All India Rank 1</div>
            </div>
            <div>
              <div className="font-display text-4xl lg:text-5xl font-bold" style={{ color: GOLD }}> AIAPGET</div>
              <div className="mt-2 text-sm text-white/70"> 2024-Higlights </div>
            </div>
            <div>
              <div className="font-display text-4xl lg:text-5xl font-bold" style={{ color: GOLD }}>MRB</div>
              <div className="mt-2 text-sm text-white/70"> 2025-Highlights</div>
            </div>
            <div>
              <div className="font-display text-4xl lg:text-5xl font-bold" style={{ color: GOLD }}>2024-25</div>
              <div className="mt-2 text-sm text-white/70">Batch Years</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-xs font-mono uppercase tracking-[0.2em] mb-8" style={{ color: SKY }}>— 2024 Batch Results</div>
          <h2 className="font-display text-2xl lg:text-4xl font-bold tracking-tight mb-6" style={{ color: NAVY }}>MRB & AIAPGET Results 2024</h2>
          <p className="text-foreground/70 mb-6">Outstanding results by our 2024 batch students in MRB and AIAPGET examinations.</p>
          
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-2">
            {results2024.map((student, idx) => (
              <div key={`2024-${idx}`} 
                className="rounded-xl bg-white border p-4 flex items-center gap-4 transition-all hover:shadow-md hover:border-[#2D9CDB]"
                style={{ 
                  borderColor: student.rank === 1 ? GOLD : 'rgba(45,156,219,0.15)',
                  backgroundColor: student.rank === 1 ? 'rgba(244,180,0,0.03)' : 'white'
                }}>
                <div className="grid h-12 w-12 place-items-center rounded-xl font-display font-bold text-white shrink-0"
                  style={{ backgroundColor: student.rank <= 10 ? GOLD : NAVY }}>
                  <div className="text-center">
                    <div className="text-[10px]">AIR</div>
                    <div className="text-sm">{student.rank}</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-display font-semibold text-base truncate" style={{ color: NAVY }}>{student.name}</div>
                    {student.rank === 1 && (
                      <Trophy className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />
                    )}
                  </div>
                  <div className="text-xs text-foreground/60 mt-0.5">{student.institution}</div>
                </div>
                <div className="text-xs font-mono px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: 'rgba(45,156,219,0.1)', color: SKY }}>
                  2024
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-[#FBFAFC]">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-xs font-mono uppercase tracking-[0.2em] mb-8" style={{ color: SKY }}>— 2025 Batch Results</div>
          <h2 className="font-display text-2xl lg:text-4xl font-bold tracking-tight mb-6" style={{ color: NAVY }}>MRB & AIAPGET Results 2025</h2>
          <p className="text-foreground/70 mb-6">Outstanding results by our 2025 batch students in MRB and AIAPGET examinations.</p>
          
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-2">
            {results2025.map((student, idx) => (
              <div key={`2025-${idx}`} 
                className="rounded-xl bg-white border p-4 flex items-center gap-4 transition-all hover:shadow-md hover:border-[#2D9CDB]"
                style={{ 
                  borderColor: student.rank === 1 ? GOLD : 'rgba(45,156,219,0.15)',
                  backgroundColor: student.rank === 1 ? 'rgba(244,180,0,0.03)' : 'white'
                }}>
                <div className="grid h-12 w-12 place-items-center rounded-xl font-display font-bold text-white shrink-0"
                  style={{ backgroundColor: student.rank <= 10 ? GOLD : NAVY }}>
                  <div className="text-center">
                    <div className="text-[10px]">AIR</div>
                    <div className="text-sm">{student.rank}</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-display font-semibold text-base truncate" style={{ color: NAVY }}>{student.name}</div>
                    {student.rank === 1 && (
                      <Trophy className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />
                    )}
                  </div>
                  <div className="text-xs text-foreground/60 mt-0.5">{student.institution}</div>
                </div>
                <div className="text-xs font-mono px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: 'rgba(244,180,0,0.1)', color: GOLD }}>
                  2025
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center mb-16">
            <div className="text-xs font-mono uppercase tracking-[0.2em] inline-block px-4 py-2 rounded-full mb-6" style={{ color: SKY, backgroundColor: 'rgba(45,156,219,0.1)' }}>
              — 2024 Batch Topper
            </div>
            <h2 className="font-display text-4xl lg:text-6xl font-bold tracking-tight mb-3" style={{ color: NAVY }}>Dr. Lalith Paul</h2>
            <p className="text-xl mb-2" style={{ color: NAVY }}>GSMC, CH</p>
            <p className="text-foreground/70 mb-8">AIR 1 in AIAPGET - 2025</p>
            
            <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl p-6 border-2" style={{ borderColor: 'rgba(244,180,0,0.3)' }}>
                <Trophy className="h-10 w-10 mx-auto mb-3" style={{ color: GOLD }} />
                <div className="font-display text-2xl font-bold" style={{ color: NAVY }}>AIR 1</div>
                <div className="text-sm text-foreground/60 mt-1">Highest Rank</div>
              </div>
              <div className="bg-white rounded-2xl p-6 border-2" style={{ borderColor: 'rgba(45,156,219,0.3)' }}>
                <Medal className="h-10 w-10 mx-auto mb-3" style={{ color: SKY }} />
                <div className="font-display text-2xl font-bold" style={{ color: NAVY }}>13+ Students</div>
                <div className="text-sm text-foreground/60 mt-1">Under AIR 200</div>
              </div>
            </div>
          </div>

          <div className="text-center mt-24">
            <div className="text-xs font-mono uppercase tracking-[0.2em] inline-block px-4 py-2 rounded-full mb-6" style={{ color: SKY, backgroundColor: 'rgba(45,156,219,0.1)' }}>
              — 2025 Batch Topper
            </div>
            <h2 className="font-display text-4xl lg:text-6xl font-bold tracking-tight mb-3" style={{ color: NAVY }}>Dr. U. Poorani</h2>
            <p className="text-xl mb-2" style={{ color: NAVY }}>VSMC</p>
            <p className="text-foreground/70 mb-8">AIR 1 in MRB - 2025</p>
            
            <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl p-6 border-2" style={{ borderColor: 'rgba(244,180,0,0.3)' }}>
                <Trophy className="h-10 w-10 mx-auto mb-3" style={{ color: GOLD }} />
                <div className="font-display text-2xl font-bold" style={{ color: NAVY }}>AIR 1</div>
                <div className="text-sm text-foreground/60 mt-1">MRB 2025</div>
              </div>
              <div className="bg-white rounded-2xl p-6 border-2" style={{ borderColor: 'rgba(45,156,219,0.3)' }}>
                <Medal className="h-10 w-10 mx-auto mb-3" style={{ color: SKY }} />
                <div className="font-display text-2xl font-bold" style={{ color: NAVY }}>11+</div>
                <div className="text-sm text-foreground/60 mt-1">Under AIR 50</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}