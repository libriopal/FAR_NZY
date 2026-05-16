import React, { useEffect, useRef } from 'react';
import { WildCubeEngine } from '../game/WildCubeEngine.js';

interface WildBlockerProps {
    audioStream?: MediaStream;
    className?: string;
    style?: React.CSSProperties;
}

export function WildBlocker({ audioStream, className, style }: WildBlockerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<WildCubeEngine | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const engine = new WildCubeEngine(containerRef.current, audioStream);
        engineRef.current = engine;
        return () => {
            engine.destroy();
            engineRef.current = null;
        };
    }, [audioStream]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ width: '100%', height: '100%', ...style }}
        />
    );
}
