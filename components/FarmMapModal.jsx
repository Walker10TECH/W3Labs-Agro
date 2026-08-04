import React, { useState, useMemo } from 'react';
import {
    X,
    MapPin,
    Layers,
    Tractor,
    Maximize2,
    Compass,
    Sprout,
    Search
} from 'lucide-react-native';
import OpenSourceMap from './OpenSourceMap';

export default function FarmMapModal({ talhoes = [], onClose, onSelectTalhao = null }) {
    const [selectedTalhaoId, setSelectedTalhaoId] = useState(null);
    const [filterCultura, setFilterCultura] = useState('todas');

    const culturasList = useMemo(() => {
        const set = new Set();
        talhoes.forEach(t => {
            if (t.culturaAtual) set.add(t.culturaAtual);
        });
        return Array.from(set);
    }, [talhoes]);

    const filteredTalhoes = useMemo(() => {
        if (filterCultura === 'todas') return talhoes;
        return talhoes.filter(t => t.culturaAtual?.toLowerCase() === filterCultura.toLowerCase());
    }, [talhoes, filterCultura]);

    const stats = useMemo(() => {
        let totalHa = 0;
        let mappedCount = 0;
        talhoes.forEach(t => {
            totalHa += parseFloat(t.areaTotal || t.area || 0);
            if (t.coordenadas) mappedCount++;
        });
        return { totalHa, mappedCount, total: talhoes.length };
    }, [talhoes]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-5xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col h-[92vh]">
                
                {/* Header Bar */}
                <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md">
                            <Compass size={20} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black text-white tracking-tight">
                                    Mapa da Propriedade & Talhões
                                </h2>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    OpenStreetMap + Satélite
                                </span>
                            </div>
                            <span className="text-xs text-slate-400">
                                {stats.mappedCount} de {stats.total} talhões georreferenciados ({stats.totalHa.toLocaleString('pt-BR')} ha)
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Filtro por Cultura */}
                        {culturasList.length > 0 && (
                            <select
                                value={filterCultura}
                                onChange={(e) => setFilterCultura(e.target.value)}
                                className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-emerald-500"
                            >
                                <option value="todas">Todas as Culturas ({talhoes.length})</option>
                                {culturasList.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Map Body Container */}
                <div className="flex-1 relative">
                    <OpenSourceMap
                        markers={filteredTalhoes}
                        selectable={false}
                        height="100%"
                        className="rounded-none border-0"
                    />

                    {/* Overlay List on Left / Bottom for Mobile */}
                    <div className="absolute left-3 top-16 bottom-3 z-[400] w-64 max-h-[calc(100%-80px)] overflow-y-auto hidden md:flex flex-col gap-2 pointer-events-none">
                        <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-700 shadow-xl pointer-events-auto space-y-2">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                <span>Lista de Talhões</span>
                                <span className="text-emerald-400">{filteredTalhoes.length}</span>
                            </div>

                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                                {filteredTalhoes.map(t => (
                                    <div
                                        key={t.id}
                                        className={`p-2 rounded-xl border text-xs transition-all ${
                                            t.coordenadas 
                                                ? 'bg-slate-800/80 border-slate-700 hover:border-emerald-500 text-slate-200' 
                                                : 'bg-slate-800/40 border-slate-800 text-slate-500'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between font-bold">
                                            <span className="truncate">{t.nome}</span>
                                            <span className="text-emerald-400 text-[11px] shrink-0">{t.areaTotal || t.area} ha</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                            <span>{t.culturaAtual || 'Livre'}</span>
                                            <span>{t.coordenadas ? '📍 Mapeado' : 'Sem GPS'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
