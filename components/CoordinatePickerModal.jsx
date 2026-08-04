import React, { useState } from 'react';
import {
    X,
    MapPin,
    Check,
    Navigation,
    Compass
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-4xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col h-[85vh]">
                
                {/* Header */}
                <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center">
                            <MapPin size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white">Selecionar Ponto GPS no Mapa</h3>
                            <span className="text-[11px] text-slate-400">Clique na área da fazenda para marcar a localização do talhão</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <X size={20} />
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
                <div className="p-4 bg-slate-800/95 border-t border-slate-700 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-300">
                        {selectedCoords ? (
                            <span className="font-bold text-emerald-400">
                                Coordenadas: {selectedCoords.formatted}
                            </span>
                        ) : (
                            <span className="text-slate-400">Nenhum ponto marcado no mapa</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!selectedCoords}
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <Check size={16} />
                            <span>Confirmar Coordenadas</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
