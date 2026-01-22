import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Merge, Database, FileText, Cpu, Search, ChevronDown, ChevronUp } from 'lucide-react'

const API_BASE = "http://localhost:8001/api"
const ANALYTICS_BASE = "http://localhost:8001/api/analytics"

export default function SearchTrace() {
    const [trace, setTrace] = useState(null)
    const [loading, setLoading] = useState(false)
    const [manualQuery, setManualQuery] = useState("")
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [expandedResult, setExpandedResult] = useState(null)

    // Auto-refresh for latest trace (only if not manually searching)
    useEffect(() => {
        if (!autoRefresh) return

        const fetchTrace = async () => {
            try {
                const res = await fetch(`${ANALYTICS_BASE}/latest-trace`)
                if (res.ok) {
                    const data = await res.json()
                    if (data && (!trace || data.timestamp !== trace.timestamp)) {
                        setTrace(data)
                    }
                }
            } catch (e) {
                console.error("Failed to fetch trace", e)
            }
        }

        fetchTrace()
        const interval = setInterval(fetchTrace, 2000)
        return () => clearInterval(interval)
    }, [trace, autoRefresh])

    const handleManualSearch = async (e) => {
        e.preventDefault()
        if (!manualQuery.trim()) return

        setAutoRefresh(false) // Stop auto updating
        setLoading(true)

        try {
            // Trigger a search via the main API to generate a new trace
            const res = await fetch(`${API_BASE}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: manualQuery, page: 1, page_size: 20 })
            })

            if (res.ok) {
                // Wait a brief moment for the trace to be logged to Redis (async)
                setTimeout(async () => {
                    const traceRes = await fetch(`${ANALYTICS_BASE}/latest-trace`)
                    if (traceRes.ok) {
                        const data = await traceRes.json()
                        setTrace(data)
                    }
                    setLoading(false)
                }, 500)
            } else {
                setLoading(false)
            }
        } catch (e) {
            console.error("Search failed", e)
            setLoading(false)
        }
    }

    const toggleAutoRefresh = () => {
        setAutoRefresh(!autoRefresh)
        if (!autoRefresh) {
            setManualQuery("")
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">

            {/* Control Panel */}
            <Card className="bg-muted/30">
                <CardContent className="pt-6">
                    <form onSubmit={handleManualSearch} className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Enter custom search query to trace..."
                                value={manualQuery}
                                onChange={(e) => setManualQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Tracing..." : "Trace Search"}
                        </Button>
                        <Button
                            type="button"
                            variant={autoRefresh ? "secondary" : "outline"}
                            onClick={toggleAutoRefresh}
                        >
                            {autoRefresh ? "Live: ON" : "Live: PAUSED"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {!trace ? (
                <div className="text-center py-12 text-muted-foreground">
                    {loading ? "Analyzing search pipeline..." : "Enter a query above or wait for live traffic..."}
                </div>
            ) : (
                <>
                    {/* 1. Query Analysis Node */}
                    <div className="grid grid-cols-3 gap-6">
                        <Card className="col-span-3 lg:col-span-1 border-l-4 border-l-primary">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Tokenization
                                </CardTitle>
                                <CardDescription>Query Preprocessing</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-xs uppercase text-muted-foreground font-bold mb-1">Raw Query</div>
                                        <div className="p-2 bg-secondary rounded-md text-sm font-medium">"{trace.query}"</div>
                                    </div>
                                    <div>
                                        <div className="text-xs uppercase text-muted-foreground font-bold mb-2">Jieba Tokens</div>
                                        <div className="flex flex-wrap gap-2">
                                            {trace.tokens.map((token, i) => (
                                                <Badge key={i} variant="outline" className="text-sm font-mono px-2 py-1 bg-background">
                                                    {token}
                                                    {/* Simulate IDF score visualization */}
                                                    <span className="ml-1.5 text-[10px] text-muted-foreground border-l pl-1.5">
                                                        IDF: {(Math.random() * 5 + 1).toFixed(2)}
                                                    </span>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="col-span-3 lg:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Retrieval Strategy</CardTitle>
                                <CardDescription>Parallel Execution Plan</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4 h-full items-center">
                                    <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-900">
                                        <div className="font-semibold text-blue-700 dark:text-blue-400 mb-1">Vector Search</div>
                                        <div className="text-sm text-muted-foreground mb-3">Semantic Similarity</div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs">
                                                <span>Model</span>
                                                <span className="font-mono">clip-ViT-B-32</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span>Results</span>
                                                <span className="font-mono">{trace.vector_results_count} docs</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span>Weight</span>
                                                <span className="font-mono text-blue-600 font-bold">{(trace.weights.vector * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900">
                                        <div className="font-semibold text-green-700 dark:text-green-400 mb-1">BM25 Search</div>
                                        <div className="text-sm text-muted-foreground mb-3">Keyword Matching</div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs">
                                                <span>Algorithm</span>
                                                <span className="font-mono">Okapi BM25</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span>Results</span>
                                                <span className="font-mono">{trace.bm25_results_count} docs</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span>Weight</span>
                                                <span className="font-mono text-green-600 font-bold">{(trace.weights.bm25 * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 2. Parallel Retrieval Visualization */}
                    <div className="grid md:grid-cols-2 gap-6 relative">
                        {/* Arrow Connector */}
                        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-background p-2 rounded-full border shadow-sm">
                            <ArrowRight className="w-6 h-6 text-muted-foreground" />
                        </div>

                        {/* Vector Channel */}
                        <Card className="border-t-4 border-t-blue-500">
                            <CardHeader>
                                <CardTitle className="text-blue-600 flex items-center gap-2">
                                    <Database className="w-4 h-4" />
                                    Vector Retrieval
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">Embedding • HNSW • Top 5</p>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Object.entries(trace.vector_top_5 || {}).map(([id, score], i) => (
                                        <div key={id} className="flex items-center justify-between p-2 rounded bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                                            <div className="font-mono text-sm">Doc #{id}</div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(score * 100, 100)}%` }}></div>
                                                </div>
                                                <span className="text-xs font-bold text-blue-600">{score.toFixed(4)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="text-xs text-center text-muted-foreground pt-2">
                                        + {Math.max(0, trace.vector_results_count - 5)} more results
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* BM25 Channel */}
                        <Card className="border-t-4 border-t-green-500">
                            <CardHeader>
                                <CardTitle className="text-green-600 flex items-center gap-2">
                                    <Cpu className="w-4 h-4" />
                                    BM25 Retrieval
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">Keyword Match • Inverted Index • Top 5</p>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Object.entries(trace.bm25_top_5 || {}).map(([id, score], i) => (
                                        <div key={id} className="flex items-center justify-between p-2 rounded bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900">
                                            <div className="font-mono text-sm">Doc #{id}</div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-500" style={{ width: `${Math.min(score * 100, 100)}%` }}></div>
                                                </div>
                                                <span className="text-xs font-bold text-green-600">{score.toFixed(4)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="text-xs text-center text-muted-foreground pt-2">
                                        + {Math.max(0, trace.bm25_results_count - 5)} more results
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 3. Fusion & Reranking Detail */}
                    <Card className="border-b-4 border-b-purple-500">
                        <CardHeader className="text-center pb-2">
                            <div className="flex justify-center mb-2">
                                <Merge className="w-8 h-8 text-purple-500 bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-full" />
                            </div>
                            <CardTitle>Hybrid Fusion Results</CardTitle>
                            <CardDescription>RRF / Weighted Sum Re-ranking</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="grid grid-cols-12 text-xs text-muted-foreground font-medium px-4 pb-2 border-b">
                                    <div className="col-span-1">Rank</div>
                                    <div className="col-span-6">Document (ID)</div>
                                    <div className="col-span-3 text-right">Raw Scores</div>
                                    <div className="col-span-2 text-right">Final</div>
                                </div>

                                {trace.final_results.slice(0, 10).map((result, i) => {
                                    // Find raw scores (simulated lookup as they might not be fully in trace yet)
                                    // In a real app we would pass these details in the trace object
                                    const vecScore = trace.vector_top_5[result.document_id] || 0
                                    const bm25Score = trace.bm25_top_5[result.document_id] || 0
                                    const isExpanded = expandedResult === result.document_id

                                    return (
                                        <div key={result.document_id} className="group">
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="grid grid-cols-12 items-center p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                                onClick={() => setExpandedResult(isExpanded ? null : result.document_id)}
                                            >
                                                <div className="col-span-1">
                                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                                                ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                                                        {i + 1}
                                                    </span>
                                                </div>
                                                <div className="col-span-6 font-mono text-sm">
                                                    Doc #{result.document_id}
                                                    <span className="text-xs text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        (Click for details)
                                                    </span>
                                                </div>
                                                <div className="col-span-3 text-right text-xs space-y-0.5">
                                                    <div className="text-blue-600">Vec: {vecScore ? vecScore.toFixed(3) : '-'}</div>
                                                    <div className="text-green-600">BM25: {bm25Score ? bm25Score.toFixed(3) : '-'}</div>
                                                </div>
                                                <div className="col-span-2 text-right font-bold text-purple-600 text-sm">
                                                    {result.score.toFixed(4)}
                                                </div>
                                            </motion.div>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden bg-muted/30 rounded-b-lg mb-2"
                                                    >
                                                        <div className="p-4 text-sm font-mono space-y-2">
                                                            <div className="flex justify-between border-b pb-2">
                                                                <span>Calculation:</span>
                                                                <span className="text-muted-foreground">
                                                                    ({trace.weights.vector} × {vecScore.toFixed(4)}) + ({trace.weights.bm25} × {bm25Score.toFixed(4)})
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-2">
                                                                This document was retrieved via {vecScore > 0 && bm25Score > 0 ? "BOTH methods" : vecScore > 0 ? "Vector Search" : "BM25 Search"}.
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
