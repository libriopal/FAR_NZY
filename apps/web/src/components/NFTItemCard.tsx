// ─────────────────────────────────────────────────────
// FARKLE FRENZY / FAR_NZY — SURFACE FILE
// NFTItemCard — Chamfered Crystal UI card with R3F 3D preview.
// Every visual derives from deterministicSeed (token ID hash) — never Math.random().
// ─────────────────────────────────────────────────────

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { PILLAR, CURRENCY, UI_THEME, OV, TYPE } from '../theme/tokens.js';
import type { ItemRarity } from './CargoOpeningSequence.js';

export interface NFTItem {
  tokenId:           string;   // on-chain ID
  name:              string;
  rarity:            ItemRarity;
  ownerAddress:      string;   // truncated wallet
  deterministicSeed: number;   // derived from tokenId — governs all procedural variation
}

export interface NFTItemCardProps {
  item:         NFTItem;
  onListForSale?: () => void;
  onTransfer?:    () => void;
  /** compact = smaller 3D preview, used in marketplace grid */
  compact?:     boolean;
}

// ── Rarity config ─────────────────────────────────────────────────────────────
const RARITY_COLOR: Record<ItemRarity, string> = {
  common:    OV.bone,
  rare:      OV.cyan,
  epic:      PILLAR.CRYSTALLINE.accent,
  legendary: PILLAR.CRYSTALLINE.primary,
};

const RARITY_BADGE_BG: Record<ItemRarity, string> = {
  common:    'rgba(232,213,163,0.12)',
  rare:      'rgba(0,229,255,0.12)',
  epic:      'rgba(191,128,255,0.15)',
  legendary: 'rgba(123,0,255,0.20)',
};

// ── Deterministic mesh geometry — derives shape from seed ─────────────────────
function getGeometry(seed: number): React.ReactElement {
  const variant = seed % 4;
  if (variant === 0) return <boxGeometry args={[0.7, 0.7, 0.7]} />;
  if (variant === 1) return <octahedronGeometry args={[0.5, 0]} />;
  if (variant === 2) return <icosahedronGeometry args={[0.5, 0]} />;
  return <dodecahedronGeometry args={[0.45, 0]} />;
}

// ── 3D item preview — rotation driven by seed, never Math.random() ────────────
function ItemPreview({ item }: { item: NFTItem }) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const color    = RARITY_COLOR[item.rarity];
  const rotSpeed = 0.3 + (item.deterministicSeed % 11) * 0.02;
  const axisY    = item.deterministicSeed % 2 === 0 ? 1 : -1;

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += rotSpeed * axisY * dt;
    meshRef.current.rotation.x += rotSpeed * 0.3 * dt;
  });

  const isLegendary = item.rarity === 'legendary';
  const isEpic      = item.rarity === 'epic';

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[1.5, 2, 2]} color={color} intensity={2.0} distance={8} decay={2} />

      <mesh ref={meshRef} castShadow>
        {getGeometry(item.deterministicSeed)}
        {isLegendary ? (
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            roughness={0.05}
            metalness={0.9}
            wireframe
          />
        ) : isEpic ? (
          <meshPhysicalMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3}
            transmission={0.6}
            thickness={1.0}
            roughness={0.05}
            metalness={0}
            ior={1.6}
          />
        ) : (
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={item.rarity === 'rare' ? 0.4 : 0.15}
            roughness={0.4}
            metalness={0.2}
          />
        )}
      </mesh>

      {/* Idle sparkles for rare+ */}
      {(isLegendary || isEpic) && (
        <Sparkles
          count={isLegendary ? 40 : 20}
          scale={1.5}
          size={0.6}
          speed={0.2}
          opacity={0.5}
          color={color}
        />
      )}
    </>
  );
}

// ── Truncate wallet address ───────────────────────────────────────────────────
function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function NFTItemCard({ item, onListForSale, onTransfer, compact = false }: NFTItemCardProps) {
  const rarityColor   = RARITY_COLOR[item.rarity];
  const rarityBadgeBg = RARITY_BADGE_BG[item.rarity];
  const previewH      = compact ? 100 : 160;

  const cardStyle: React.CSSProperties = {
    ...UI_THEME.crystal,
    display:       'flex',
    flexDirection: 'column',
    width:         compact ? 160 : 220,
    overflow:      'hidden',
    position:      'relative',
    boxShadow:     `0 0 20px rgba(123,0,255,0.15)`,
    fontFamily:    TYPE.fontCode,
  };

  return (
    <div style={cardStyle}>
      {/* 3D preview */}
      <div style={{ height: previewH, position: 'relative', background: UI_THEME.crystal.background }}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 2.2], fov: 45, near: 0.1, far: 20 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
            outputColorSpace: THREE.SRGBColorSpace,
            alpha: true,
          }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <ItemPreview item={item} />
        </Canvas>

        {/* Rarity badge — top right */}
        <div style={{
          position:  'absolute', top: 6, right: 6,
          background: rarityBadgeBg,
          border:    `1px solid ${rarityColor}`,
          borderRadius: 3, padding: '2px 6px',
          fontSize: 8, color: rarityColor,
          letterSpacing: 2, fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          {item.rarity}
        </div>
      </div>

      {/* Info panel */}
      <div style={{ padding: compact ? '8px 10px' : '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Name */}
        <div style={{ color: UI_THEME.crystal.colorLabel, fontSize: compact ? 11 : 13, fontWeight: 700, letterSpacing: 1 }}>
          {item.name}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: `linear-gradient(90deg, ${rarityColor}44, transparent)` }} />

        {/* Owner address */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: UI_THEME.crystal.colorBody, fontSize: 10 }}>
            {truncateAddress(item.ownerAddress)}
          </span>
          <span style={{ color: CURRENCY.sdx.glowColor, fontSize: 10, letterSpacing: 1 }}>
            {CURRENCY.sdx.symbol}
          </span>
        </div>

        {/* Token ID */}
        <div style={{ color: OV.boneDim, fontSize: 9, letterSpacing: 1 }}>
          #{item.tokenId.padStart(8, '0')}
        </div>

        {/* Divider */}
        {!compact && (onListForSale || onTransfer) && (
          <div style={{ height: 1, background: `rgba(123,0,255,0.2)` }} />
        )}

        {/* Action buttons */}
        {!compact && (
          <div style={{ display: 'flex', gap: 6 }}>
            {onListForSale && (
              <button onClick={onListForSale} style={{
                flex: 1, background: rarityColor, border: 'none',
                color: OV.void, borderRadius: 2,
                padding: '6px 0', fontSize: 9, fontWeight: 700,
                letterSpacing: 1, cursor: 'pointer', fontFamily: TYPE.fontCode,
                textTransform: 'uppercase',
              }}>
                List for Sale
              </button>
            )}
            {onTransfer && (
              <button onClick={onTransfer} style={{
                flex: 1, background: 'transparent',
                border: `1px solid ${rarityColor}`,
                color: rarityColor, borderRadius: 2,
                padding: '6px 0', fontSize: 9, fontWeight: 700,
                letterSpacing: 1, cursor: 'pointer', fontFamily: TYPE.fontCode,
                textTransform: 'uppercase',
              }}>
                Transfer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
