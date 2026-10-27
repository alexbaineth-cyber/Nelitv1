import React, { useState, useRef, useEffect } from 'react';
import { Channel } from '../data/channels.ts';
import { Maximize2, X, Volume2, VolumeX, Move, ZoomIn, ZoomOut, Radio } from 'lucide-react';

interface FloatingPiPPlayerProps {
  channel: Channel;
  onExpand: () => void;
  onClose: () => void;
}

export const FloatingPiPPlayer: React.FC<FloatingPiPPlayerProps> = ({
  channel,
  onExpand,
  onClose,
}) => {
  // Draggable position state
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 340) : 20;
    const defaultY = typeof window !== 'undefined' ? Math.max(80, window.innerHeight - 240) : 80;
    return { x: defaultX, y: defaultY };
  });

  // Size state (zoomable / resizable presets: small, normal, large)
  const [sizeTier, setSizeTier] = useState<'compact' | 'normal' | 'expanded'>('normal');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  const width = sizeTier === 'compact' ? 220 : sizeTier === 'expanded' ? 380 : 300;
  const height = Math.round((width * 9) / 16) + 40; // 16:9 aspect + header bar

  // Mouse / Pointer Drag
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag from header or empty area, not buttons
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    const maxX = Math.max(0, window.innerWidth - width - 12);
    const maxY = Math.max(0, window.innerHeight - height - 12);

    const nextX = Math.min(maxX, Math.max(12, dragRef.current.posX + deltaX));
    const nextY = Math.min(maxY, Math.max(12, dragRef.current.posY + deltaY));

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Zoom tier toggle
  const toggleZoom = () => {
    setSizeTier((prev) => (prev === 'normal' ? 'expanded' : prev === 'expanded' ? 'compact' : 'normal'));
  };

  return (
    <div
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: `${width}px`,
        touchAction: 'none',
      }}
      className={`fixed top-0 left-0 z-50 rounded-2xl bg-[#070A14]/95 border border-cyan-500/40 shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden select-none transition-shadow ${
        isDragging ? 'shadow-cyan-500/30 cursor-grabbing' : 'cursor-grab'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* PiP Header Bar (Draggable handle) */}
      <div className="px-3 py-2 bg-gradient-to-r from-blue-950/80 to-[#070A14] border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Move className="w-3.5 h-3.5 text-cyan-400 shrink-0 opacity-70" />
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-[11px] font-bold text-white truncate max-w-[120px]">
            {channel.name}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom / Resize */}
          <button
            onClick={toggleZoom}
            className="p-1 rounded-lg text-neutral-300 hover:text-cyan-400 hover:bg-white/10 transition"
            title={sizeTier === 'expanded' ? 'Punguza Ukubwa (Compact)' : 'Ongeza Ukubwa (Zoom In)'}
          >
            {sizeTier === 'expanded' ? (
              <ZoomOut className="w-3.5 h-3.5" />
            ) : (
              <ZoomIn className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Mute/Unmute */}
          <button
            onClick={() => setIsMuted((prev) => !prev)}
            className="p-1 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition"
            title={isMuted ? 'Washa Sauti' : 'Zima Sauti'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Expand to WatchPage */}
          <button
            onClick={onExpand}
            className="p-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95"
            title="Rudi Kwenye Skrini Kubwa (Expand)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-white/10 transition"
            title="Funga Dirisha la PiP"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Embedded or Stream Preview inside PiP */}
      <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
        {channel.embedUrl ? (
          <iframe
            src={channel.embedUrl}
            title={channel.name}
            className="w-full h-full border-0 pointer-events-none"
            allow="autoplay; encrypted-media; picture-in-picture"
          />
        ) : (
          <div className="w-full h-full relative group">
            <img
              src={channel.thumbnailUrl}
              alt={channel.name}
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex flex-col justify-between p-2.5">
              <span className="self-start px-1.5 py-0.5 rounded bg-red-600/90 text-white text-[9px] font-black uppercase flex items-center gap-1 shadow">
                <Radio className="w-2.5 h-2.5" />
                <span>LIVE PiP</span>
              </span>

              <button
                onClick={onExpand}
                className="w-full py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 backdrop-blur-md shadow-lg transition active:scale-95"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Fungua Skrini Kubwa</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
