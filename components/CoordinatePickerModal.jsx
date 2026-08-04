import React, { useState } from 'react';
import {
    Check,
    MapPin,
    X
} from 'lucide-react-native';
import OpenSourceMap from './OpenSourceMap';

export default function CoordinatePickerModal({ initialCoordinates, onConfirm, onClose }) {
    const [selectedCoords, setSelectedCoords] = useState(null);

    const handleConfirm = () => {
        if (selectedCoords) {
            onConfirm(selectedCoords.formatted, selectedCoords.address);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-4xl bg-slate-900 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] border border-slate-700/80 overflow-hidden flex flex-col h-[85vh]">
                
                {/* Header */}
                <div className="px-5 py-3.5 bg-gradient-to-b from-slate-800 to-slate-800/95 border-b border-slate-700 flex items-center justify-between text-white shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 border-t border-emerald-400/40 border-b-2 border-b-emerald-900 shadow-md flex items-center justify-center">
                            <MapPin size={18} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white tracking-tight">Selecionar Ponto GPS no Mapa</h3>
                            <span className="text-[11px] text-slate-400">Clique na área da fazenda para marcar a localização do talhão</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl bg-slate-700/60 border border-slate-600/80 border-b-2 border-b-slate-950 text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Map Area */}
                <div className="flex-1 relative">
                    <OpenSourceMap
                        selectable={true}
                        initialCoordinates={initialCoordinates}
                        onSelectCoordinates={(coords) => setSelectedCoords(coords)}
                        height="100%"
                        className="rounded-none border-0"
                    />
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-gradient-to-b from-slate-800/90 to-slate-900/95 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-center relative gap-3">
                    <div className="text-xs text-slate-300 sm:absolute sm:left-5 text-center sm:text-left">
                        {selectedCoords ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-emerald-500/30 border-b-2 border-b-emerald-900 shadow-inner">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                <span className="font-bold text-emerald-400 text-xs">
                                    Coordenadas: {selectedCoords.formatted}
                                </span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-400 text-xs">
                                <span>Nenhum ponto marcado no mapa</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-center gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-gradient-to-b from-slate-700 to-slate-800 text-slate-200 text-xs font-bold border-t border-slate-600/60 border-b-4 border-slate-950 active:border-b-2 active:translate-y-[2px] shadow-md cursor-pointer flex items-center justify-center"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!selectedCoords}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white text-xs font-black tracking-wide border-t border-emerald-300/40 border-b-4 border-emerald-900 active:border-b-2 active:translate-y-[2px] shadow-[0_4px_14px_rgba(5,150,105,0.45)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:border-b-4 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                        >
                            <Check size={16} strokeWidth={2.8} />
                            <span>Confirmar Coordenadas</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
