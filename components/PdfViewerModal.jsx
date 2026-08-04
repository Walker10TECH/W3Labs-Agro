import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCw,
    Download,
    Printer,
    ExternalLink,
    Maximize2,
    Minimize2,
    FileText,
    Layers,
    RefreshCw,
    Sparkles
} from 'lucide-react-native';
import { ensurePdfJsLoaded } from '../services/agroDocumentAIService';

/**
 * Converte diferentes formatos de entrada (File, Blob, DataUrl Base64 ou URL) em Uint8Array/ArrayBuffer ou URL utilizável
 */
const preparePdfData = async (source) => {
    if (!source) return null;

    if (source instanceof File || source instanceof Blob) {
        const arrayBuffer = await source.arrayBuffer();
        const blobUrl = URL.createObjectURL(source);
        return { data: new Uint8Array(arrayBuffer), blobUrl, name: source.name || 'documento.pdf' };
    }

    if (typeof source === 'string') {
        if (source.startsWith('data:')) {
            const base64Data = source.split(',')[1];
            const binaryStr = window.atob(base64Data);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            return { data: bytes, blobUrl, name: 'documento.pdf' };
        } else if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('blob:')) {
            return { url: source, blobUrl: source, name: source.split('/').pop() || 'documento.pdf' };
        }
    }

    if (source instanceof ArrayBuffer) {
        const bytes = new Uint8Array(source);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        return { data: bytes, blobUrl: URL.createObjectURL(blob), name: 'documento.pdf' };
    }

    if (source instanceof Uint8Array) {
        const blob = new Blob([source], { type: 'application/pdf' });
        return { data: source, blobUrl: URL.createObjectURL(blob), name: 'documento.pdf' };
    }

    return null;
};

/**
 * Componente Modal Moderno e Completo de Visualização de PDFs
 * Suporta: Zoom, Paginação, Rotação, Miniaturas laterais, Impressão, Download e Alternador Nativo
 */
export default function PdfViewerModal({
    visible,
    onClose,
    fileSource,
    title = 'Visualizador de Documento PDF',
    subtitle = 'Biblioteca de Manuais & Agronomia W3Labs',
    badgeText = 'PDF HD'
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [zoomScale, setZoomScale] = useState(1.2);
    const [rotation, setRotation] = useState(0);
    const [showThumbnails, setShowThumbnails] = useState(false);
    const [viewMode, setViewMode] = useState('canvas'); // 'canvas' | 'native'
    const [blobUrl, setBlobUrl] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fileName, setFileName] = useState('documento.pdf');

    const canvasRef = useRef(null);
    const renderTaskRef = useRef(null);
    const containerRef = useRef(null);

    // Carrega o documento PDF
    useEffect(() => {
        if (!visible || !fileSource) {
            setPdfDoc(null);
            setNumPages(0);
            setCurrentPage(1);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const pdfjs = await ensurePdfJsLoaded();
                if (!pdfjs) {
                    throw new Error("Não foi possível carregar a biblioteca de renderização de PDF.");
                }

                const prepared = await preparePdfData(fileSource);
                if (!prepared) {
                    throw new Error("Formato de arquivo PDF não reconhecido ou inválido.");
                }

                if (isMounted) {
                    setBlobUrl(prepared.blobUrl);
                    if (prepared.name) setFileName(prepared.name);
                }

                const loadingTask = prepared.data
                    ? pdfjs.getDocument({ data: prepared.data })
                    : pdfjs.getDocument({ url: prepared.url });

                const loadedPdf = await loadingTask.promise;

                if (isMounted) {
                    setPdfDoc(loadedPdf);
                    setNumPages(loadedPdf.numPages);
                    setCurrentPage(1);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Erro ao carregar PDF:", err);
                if (isMounted) {
                    setError(err.message || "Falha ao processar o arquivo PDF.");
                    setLoading(false);
                }
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [visible, fileSource]);

    // Renderiza a página atual no Canvas
    const renderPage = useCallback(async (pageNum, doc, scale, rot) => {
        if (!doc || !canvasRef.current) return;

        try {
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }

            const page = await doc.getPage(pageNum);
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            const viewport = page.getViewport({ scale, rotation: rot });

            // Ajuste para Retina / Telas de Alta Resolução (DPI Scaling)
            const pixelRatio = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * pixelRatio);
            canvas.height = Math.floor(viewport.height * pixelRatio);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;
            await renderTask.promise;
        } catch (err) {
            if (err.name !== 'RenderingCancelledException') {
                console.warn("Erro na renderização da página PDF:", err);
            }
        }
    }, []);

    useEffect(() => {
        if (pdfDoc && viewMode === 'canvas' && !loading) {
            renderPage(currentPage, pdfDoc, zoomScale, rotation);
        }
    }, [pdfDoc, currentPage, zoomScale, rotation, viewMode, loading, renderPage]);

    // Controles de Navegação
    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage((prev) => prev - 1);
    };

    const handleNextPage = () => {
        if (currentPage < numPages) setCurrentPage((prev) => prev + 1);
    };

    const handleZoomIn = () => {
        setZoomScale((prev) => Math.min(prev + 0.25, 3.0));
    };

    const handleZoomOut = () => {
        setZoomScale((prev) => Math.max(prev - 0.25, 0.6));
    };

    const handleFitWidth = () => {
        if (containerRef.current) {
            const containerWidth = containerRef.current.clientWidth - 48;
            setZoomScale(Math.max(containerWidth / 600, 0.8));
        } else {
            setZoomScale(1.2);
        }
    };

    const handleRotate = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    const handleDownload = () => {
        if (!blobUrl) return;
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName || 'documento.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handlePrint = () => {
        if (!blobUrl) return;
        const printWindow = window.open(blobUrl, '_blank');
        if (printWindow) {
            printWindow.focus();
        }
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-sans">
            <div
                className={`w-full bg-slate-900 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
                    isFullscreen ? 'h-full max-h-screen rounded-none' : 'max-w-5xl h-[92vh]'
                }`}
            >
                {/* Header Superior com Título & Ações Principais */}
                <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                            <FileText size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-md">
                                    {title}
                                </h2>
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                    {badgeText}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate">{subtitle}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Botão Alternar Modo Nativo / Canvas */}
                        <button
                            type="button"
                            onClick={() => setViewMode(viewMode === 'canvas' ? 'native' : 'canvas')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer hidden sm:flex items-center gap-1.5 ${
                                viewMode === 'native'
                                    ? 'bg-emerald-600 border-emerald-500 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                            }`}
                            title="Alternar entre renderizador nativo do navegador e renderizador Canvas HD"
                        >
                            <Sparkles size={14} />
                            <span>{viewMode === 'canvas' ? 'Modo Nativo' : 'Modo HD'}</span>
                        </button>

                        {/* Botão Download */}
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                            title="Baixar Arquivo PDF"
                        >
                            <Download size={18} />
                        </button>

                        {/* Botão Imprimir */}
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                            title="Imprimir Documento"
                        >
                            <Printer size={18} />
                        </button>

                        {/* Botão Tela Cheia */}
                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer hidden sm:flex"
                            title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                        >
                            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>

                        {/* Botão Fechar */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white border border-red-500/30 transition-colors cursor-pointer ml-1"
                            title="Fechar Visualizador"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Barra de Ferramentas Secundária (Paginação, Zoom, Rotação) */}
                {viewMode === 'canvas' && !loading && !error && (
                    <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                        {/* Controles de Página */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowThumbnails(!showThumbnails)}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                    showThumbnails
                                        ? 'bg-emerald-600 border-emerald-500 text-white'
                                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                                }`}
                                title="Mostrar miniaturas de páginas"
                            >
                                <Layers size={16} />
                            </button>

                            <div className="h-4 w-px bg-slate-800" />

                            <button
                                type="button"
                                onClick={handlePrevPage}
                                disabled={currentPage <= 1}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                                title="Página Anterior"
                            >
                                <ChevronLeft size={16} />
                            </button>

                            <div className="flex items-center gap-1.5 font-bold text-slate-300">
                                <span>Página</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={numPages || 1}
                                    value={currentPage}
                                    onChange={(e) => {
                                        const p = parseInt(e.target.value);
                                        if (!isNaN(p) && p >= 1 && p <= numPages) {
                                            setCurrentPage(p);
                                        }
                                    }}
                                    className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-0.5 text-center text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                                />
                                <span>de {numPages || 1}</span>
                            </div>

                            <button
                                type="button"
                                onClick={handleNextPage}
                                disabled={currentPage >= numPages}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                                title="Próxima Página"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* Controles de Zoom & Rotação */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleZoomOut}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                                title="Diminuir Zoom"
                            >
                                <ZoomOut size={16} />
                            </button>

                            <span className="font-bold text-slate-300 min-w-[45px] text-center">
                                {Math.round(zoomScale * 100)}%
                            </span>

                            <button
                                type="button"
                                onClick={handleZoomIn}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                                title="Aumentar Zoom"
                            >
                                <ZoomIn size={16} />
                            </button>

                            <button
                                type="button"
                                onClick={handleFitWidth}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-semibold transition-colors cursor-pointer"
                                title="Ajustar à tela"
                            >
                                Ajustar
                            </button>

                            <div className="h-4 w-px bg-slate-800" />

                            <button
                                type="button"
                                onClick={handleRotate}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                                title="Girar 90 Graus"
                            >
                                <RotateCw size={16} />
                                <span className="hidden sm:inline text-[11px]">{rotation}°</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Corpo do Visualizador */}
                <div className="flex-1 flex overflow-hidden relative bg-slate-950">
                    {/* Gaveta Lateral de Miniaturas */}
                    {showThumbnails && numPages > 0 && viewMode === 'canvas' && (
                        <div className="w-48 bg-slate-900 border-r border-slate-800 p-3 overflow-y-auto space-y-3 shrink-0 animate-fadeIn">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                                Páginas ({numPages})
                            </span>
                            {Array.from({ length: numPages }, (_, i) => i + 1).map((pg) => (
                                <button
                                    key={pg}
                                    type="button"
                                    onClick={() => setCurrentPage(pg)}
                                    className={`w-full p-2 rounded-xl text-left transition-all border cursor-pointer ${
                                        currentPage === pg
                                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold">Página {pg}</span>
                                        {currentPage === pg && (
                                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                        )}
                                    </div>
                                    <div className="w-full h-20 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-[10px] text-slate-500 font-mono">
                                        Pg #{pg}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Área Principal de Renderização */}
                    <div
                        ref={containerRef}
                        className="flex-1 overflow-auto flex items-center justify-center p-4 relative"
                    >
                        {loading && (
                            <div className="flex flex-col items-center justify-center gap-3">
                                <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs font-semibold text-slate-400">
                                    Carregando páginas do PDF...
                                </span>
                            </div>
                        )}

                        {error && (
                            <div className="max-w-md bg-red-950/40 border border-red-500/40 rounded-2xl p-6 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
                                    <X size={24} />
                                </div>
                                <h3 className="text-sm font-bold text-red-200 mb-1">Falha na Visualização</h3>
                                <p className="text-xs text-red-300/80 mb-4">{error}</p>
                                {blobUrl && (
                                    <a
                                        href={blobUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-sm"
                                    >
                                        <ExternalLink size={14} />
                                        <span>Tentar Abrir no Navegador</span>
                                    </a>
                                )}
                            </div>
                        )}

                        {!loading && !error && viewMode === 'canvas' && (
                            <div className="shadow-2xl rounded-xl overflow-hidden bg-white max-w-full my-auto transition-transform duration-150">
                                <canvas ref={canvasRef} className="block mx-auto" />
                            </div>
                        )}

                        {!loading && !error && viewMode === 'native' && blobUrl && (
                            <iframe
                                src={blobUrl}
                                title={title}
                                className="w-full h-full border-0 rounded-2xl bg-slate-900"
                            />
                        )}
                    </div>
                </div>

                {/* Rodapé Informativo */}
                <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-300">W3Labs Agronomia AI Document Engine</span>
                        <span>•</span>
                        <span>Renderização Otimizada</span>
                    </div>
                    <div>
                        {numPages > 0 && <span>Total de {numPages} página(s)</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}
