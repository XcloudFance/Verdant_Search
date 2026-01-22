import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, Clock, Server } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const API_BASE = "http://localhost:8001/api/analytics"

export default function CrawlerStatus() {
    const [data, setData] = useState({ worker_statuses: [], queue_size: 0 })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`${API_BASE}/dashboard-stats`)
                if (res.ok) setData(await res.json())
            } catch (e) {
                console.error("Failed to fetch crawler stats", e)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 1000) // Fast refresh for crawler
        return () => clearInterval(interval)
    }, [])

    // Create a map of worker IDs to ensure we display all configured workers (assuming 3 for now if empty)
    // Actually, we scan keys. If no keys, maybe crawler is off.
    // We can infer max workers or just show active ones.
    // The API returns what it finds in Redis.

    // Sort workers by ID
    const workers = [...data.worker_statuses].sort((a, b) => a.worker_id - b.worker_id)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Crawler Nodes</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Queue Size:</span>
                    <span className="text-xl font-mono font-bold">{data.queue_size}</span>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                    {workers.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                            No active workers found. Is the crawler running?
                        </div>
                    ) : (
                        workers.map((worker) => (
                            <WorkerCard key={worker.worker_id} worker={worker} />
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

function WorkerCard({ worker }) {
    const isProcessing = worker.status === 'processing'

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        >
            <Card className={`overflow-hidden transition-all duration-300 ${isProcessing ? 'border-primary shadow-lg shadow-primary/10' : 'opacity-75'}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/30">
                    <div className="flex items-center space-x-2">
                        <Server className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">Worker #{worker.worker_id}</span>
                    </div>
                    {isProcessing ? (
                        <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                    ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/50"></span>
                    )}
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                            <div className={`text-sm font-medium ${isProcessing ? 'text-primary' : 'text-yellow-600'}`}>
                                {worker.status.toUpperCase()}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current URL</span>
                            <div className="flex items-start gap-2 h-14 overflow-hidden">
                                <Globe className="w-3 h-3 mt-1 shrink-0 text-muted-foreground" />
                                <span className="text-xs font-mono break-all leading-relaxed text-foreground/90">
                                    {worker.url || "Idle..."}
                                </span>
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="flex items-center text-xs text-muted-foreground">
                                <Clock className="w-3 h-3 mr-1" />
                                <span>{(Date.now() / 1000 - worker.timestamp).toFixed(1)}s elapsed</span>
                            </div>
                        )}
                    </div>
                </CardContent>
                {isProcessing && (
                    <div className="h-1 w-full bg-secondary overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        />
                    </div>
                )}
            </Card>
        </motion.div>
    )
}
