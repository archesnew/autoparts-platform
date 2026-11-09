"use client";

import { useMemo } from "react";
import { resolveVehicleVisual, type BodyType } from "@/lib/garage/vehicle-visual-registry";

interface VehicleSideViewProps {
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  bodyType?: string | null;
  colorHex?: string | null;
  className?: string;
}

export function VehicleSideView({
  make,
  model,
  generation,
  bodyType,
  colorHex = "#2E3338",
  className = "w-full h-auto",
}: VehicleSideViewProps) {
  const visual = useMemo(() => {
    return resolveVehicleVisual({ make, model, generation, bodyType });
  }, [make, model, generation, bodyType]);

  const activeColor = colorHex || "#2E3338";
  const isSuvOrCrossover = visual.bodyType === "SUV" || visual.bodyType === "CROSSOVER";

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* SVG Canvas with strict 2D side projection */}
      <svg
        viewBox="0 0 800 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-lg"
      >
        <defs>
          {/* Subtle metallic reflection for car paint */}
          <linearGradient id="bodyPaintGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="35%" stopColor={activeColor} stopOpacity="1" />
            <stop offset="75%" stopColor={activeColor} stopOpacity="1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
          </linearGradient>

          {/* Roof highlight */}
          <linearGradient id="roofHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
          </linearGradient>

          {/* Glass gradient */}
          <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#0f172a" stopOpacity="0.98" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.95" />
          </linearGradient>

          {/* Alloy Rim Gradient */}
          <radialGradient id="alloyRim" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="40%" stopColor="#cbd5e1" />
            <stop offset="85%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>

          {/* Rubber Tire Texture */}
          <radialGradient id="tireRubber" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#18181b" />
            <stop offset="90%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#09090b" />
          </radialGradient>

          {/* Headlight projector */}
          <linearGradient id="headlightGlow" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
          </linearGradient>

          {/* Taillight LED */}
          <linearGradient id="taillightGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.7" />
          </linearGradient>

          {/* Underbody Shadow */}
          <radialGradient id="asphaltShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.65" />
            <stop offset="70%" stopColor="#000000" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. Ground contact shadow strictly under the wheels and body */}
        <ellipse cx="400" cy="272" rx="340" ry="12" fill="url(#asphaltShadow)" />

        {isSuvOrCrossover ? (
          /* ========================================================
             SUV / CROSSOVER STRICT SIDE PROJECTION (Sportage/Tucson/Tiguan)
             ======================================================== */
          <g id="suv-projection">
            {/* Plastic wheel arch guards / rocker sills (Dark cladding) */}
            <path
              d="M100 240 L160 240 C170 200 215 170 260 200 L530 200 C575 170 620 200 635 240 L690 238 C680 248 650 252 620 252 L170 252 C135 252 110 246 100 240 Z"
              fill="#181a1b"
            />

            {/* Main Body Shell (Takes activeColor) */}
            <path
              d="M102 208 C98 180 120 160 145 158 L240 156 L355 86 C370 76 395 72 430 72 L580 72 C615 72 630 82 645 106 L685 155 C705 168 710 185 706 208 C704 220 690 232 675 234 L642 234 C632 186 580 162 538 190 C508 210 514 234 514 234 L282 234 C272 186 220 162 178 190 C148 210 154 234 154 234 L120 234 C105 232 103 218 102 208 Z"
              fill="url(#bodyPaintGradient)"
              stroke="#0f1112"
              strokeWidth="2"
            />

            {/* Roof Rack Rails */}
            <path d="M375 66 L595 66" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
            <path d="M385 66 L385 72 M585 66 L585 72 M485 66 L485 72" stroke="#334155" strokeWidth="3" />

            {/* Roof Highlight Line */}
            <path d="M365 88 L580 88" stroke="url(#roofHighlight)" strokeWidth="2" />

            {/* Side Window Frame & Translucent Glass */}
            {/* Front windshield rake */}
            <path
              d="M632 110 L585 82 L495 82 L495 152 L658 152 Z"
              fill="url(#glassGradient)"
              stroke="#1e293b"
              strokeWidth="2.5"
            />
            {/* Rear passenger window */}
            <path
              d="M485 82 L385 82 L345 125 L345 152 L485 152 Z"
              fill="url(#glassGradient)"
              stroke="#1e293b"
              strokeWidth="2.5"
            />
            {/* Third quarter window */}
            <path
              d="M336 127 L285 152 L336 152 Z"
              fill="url(#glassGradient)"
              stroke="#1e293b"
              strokeWidth="2"
            />

            {/* B-Pillar & C-Pillar trims (Piano Black) */}
            <line x1="490" y1="80" x2="490" y2="154" stroke="#090a0b" strokeWidth="12" />
            <line x1="341" y1="84" x2="341" y2="154" stroke="#090a0b" strokeWidth="10" />

            {/* Door Panel Character Seams */}
            <path d="M485 154 L485 234" stroke="#17191b" strokeWidth="2" />
            <path d="M335 154 L335 234" stroke="#17191b" strokeWidth="2" />

            {/* Door Handles */}
            <rect x="440" y="165" width="30" height="7" rx="3.5" fill="#17191b" stroke="#475569" strokeWidth="1" />
            <rect x="290" y="165" width="30" height="7" rx="3.5" fill="#17191b" stroke="#475569" strokeWidth="1" />

            {/* Side Mirror */}
            <path
              d="M625 142 C640 142 650 148 648 156 C645 160 630 160 622 156 Z"
              fill={activeColor}
              stroke="#0f1112"
              strokeWidth="1.5"
            />

            {/* Modern Headlamp cluster */}
            <path
              d="M678 158 L706 170 C705 186 695 195 685 195 L674 176 Z"
              fill="url(#headlightGlow)"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* Taillamp cluster */}
            <path
              d="M104 185 C102 170 110 165 125 165 L130 178 L108 195 Z"
              fill="url(#taillightGlow)"
              stroke="#991b1b"
              strokeWidth="1.5"
            />

            {/* Dynamic Sculpted Body Crease line */}
            <path d="M145 162 Q 400 174 670 168" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
            <path d="M165 212 Q 400 220 640 216" stroke="#000000" strokeOpacity="0.3" strokeWidth="2" />
          </g>
        ) : (
          /* ========================================================
             SEDAN / LIFTBACK STRICT SIDE PROJECTION (Camry/BMW 3/Octavia)
             ======================================================== */
          <g id="sedan-projection">
            {/* Main Body Shell (Takes activeColor) */}
            <path
              d="M95 212 C90 190 110 172 135 170 L210 166 L335 106 C365 88 410 82 450 82 L550 82 C590 82 615 95 635 118 L705 170 C720 180 725 195 720 212 C716 226 702 234 685 235 L642 235 C632 186 580 162 538 190 C508 210 514 235 514 235 L282 235 C272 186 220 162 178 190 C148 210 154 235 154 235 L115 235 C100 234 96 224 95 212 Z"
              fill="url(#bodyPaintGradient)"
              stroke="#0f1112"
              strokeWidth="2"
            />

            {/* Roof Highlight Line */}
            <path d="M345 96 L545 96" stroke="url(#roofHighlight)" strokeWidth="2" />

            {/* Side Window Frame & Translucent Glass */}
            {/* Front windshield rake */}
            <path
              d="M622 124 L565 92 L485 92 L485 156 L655 156 Z"
              fill="url(#glassGradient)"
              stroke="#1e293b"
              strokeWidth="2"
            />
            {/* Rear passenger window */}
            <path
              d="M475 92 L380 92 L320 134 L320 156 L475 156 Z"
              fill="url(#glassGradient)"
              stroke="#1e293b"
              strokeWidth="2"
            />

            {/* B-Pillar trim */}
            <line x1="480" y1="90" x2="480" y2="158" stroke="#090a0b" strokeWidth="12" />

            {/* Door Panel Seams */}
            <path d="M475 158 L475 235" stroke="#17191b" strokeWidth="2" />
            <path d="M315 158 L315 235" stroke="#17191b" strokeWidth="2" />

            {/* Door Handles */}
            <rect x="430" y="168" width="28" height="6" rx="3" fill="#17191b" stroke="#475569" strokeWidth="1" />
            <rect x="270" y="168" width="28" height="6" rx="3" fill="#17191b" stroke="#475569" strokeWidth="1" />

            {/* Side Mirror */}
            <path
              d="M615 146 C630 146 640 152 638 160 C635 163 620 163 612 160 Z"
              fill={activeColor}
              stroke="#0f1112"
              strokeWidth="1.5"
            />

            {/* Sleek Headlamp cluster */}
            <path
              d="M695 170 L722 180 C720 195 710 200 698 200 L685 184 Z"
              fill="url(#headlightGlow)"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* Taillamp cluster */}
            <path
              d="M98 190 C96 176 105 172 120 172 L125 182 L102 198 Z"
              fill="url(#taillightGlow)"
              stroke="#991b1b"
              strokeWidth="1.5"
            />

            {/* Dynamic Sculpted Body Crease line */}
            <path d="M135 174 Q 400 182 690 178" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.5" />
            <path d="M150 216 Q 400 224 650 220" stroke="#000000" strokeOpacity="0.3" strokeWidth="2" />
          </g>
        )}

        {/* ========================================================
            PREMIUM HIGH-DETAIL WHEELS (SHARED FRONT & REAR)
            Front Axle Center: (590, 235)
            Rear Axle Center: (230, 235)
            ======================================================== */}
        {/* REAR WHEEL */}
        <g id="rear-wheel" transform="translate(230, 235)">
          {/* Brake Disc & Caliper inside wheel */}
          <circle cx="0" cy="0" r="32" fill="#64748b" stroke="#334155" strokeWidth="1.5" />
          <path d="M-10 -26 A 28 28 0 0 1 18 -20 L12 -6 L-4 -12 Z" fill="#ef4444" />

          {/* Rubber Tire */}
          <circle cx="0" cy="0" r="48" fill="url(#tireRubber)" stroke="#09090b" strokeWidth="3" />
          <circle cx="0" cy="0" r="44" stroke="#27272a" strokeWidth="1" strokeDasharray="3 3" />

          {/* Rim Rim Outer Ring */}
          <circle cx="0" cy="0" r="33" fill="url(#alloyRim)" stroke="#94a3b8" strokeWidth="2" />

          {/* Dual 5-Spoke Sport Rim Geometry */}
          {[0, 72, 144, 216, 288].map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <path d="M-4 -8 L-3 -30 L3 -30 L4 -8 Z" fill="#e2e8f0" stroke="#475569" strokeWidth="0.8" />
              <circle cx="0" cy="-18" r="2.5" fill="#0f172a" />
            </g>
          ))}

          {/* Center Wheel Cap with ZAPTUT accent */}
          <circle cx="0" cy="0" r="8" fill="#1e293b" stroke="#ff6428" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="3" fill="#ff6428" />
        </g>

        {/* FRONT WHEEL */}
        <g id="front-wheel" transform="translate(590, 235)">
          {/* Brake Disc & Caliper inside wheel */}
          <circle cx="0" cy="0" r="32" fill="#64748b" stroke="#334155" strokeWidth="1.5" />
          <path d="M-10 -26 A 28 28 0 0 1 18 -20 L12 -6 L-4 -12 Z" fill="#ef4444" />

          {/* Rubber Tire */}
          <circle cx="0" cy="0" r="48" fill="url(#tireRubber)" stroke="#09090b" strokeWidth="3" />
          <circle cx="0" cy="0" r="44" stroke="#27272a" strokeWidth="1" strokeDasharray="3 3" />

          {/* Rim Rim Outer Ring */}
          <circle cx="0" cy="0" r="33" fill="url(#alloyRim)" stroke="#94a3b8" strokeWidth="2" />

          {/* Dual 5-Spoke Sport Rim Geometry */}
          {[0, 72, 144, 216, 288].map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <path d="M-4 -8 L-3 -30 L3 -30 L4 -8 Z" fill="#e2e8f0" stroke="#475569" strokeWidth="0.8" />
              <circle cx="0" cy="-18" r="2.5" fill="#0f172a" />
            </g>
          ))}

          {/* Center Wheel Cap with ZAPTUT accent */}
          <circle cx="0" cy="0" r="8" fill="#1e293b" stroke="#ff6428" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="3" fill="#ff6428" />
        </g>
      </svg>
    </div>
  );
}
