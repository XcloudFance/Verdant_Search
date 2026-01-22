import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Activity, Database, Server, Search, Image as ImageIcon } from 'lucide-react'

const API_BASE = "http://localhost:8001/api/analytics"

export default function DashboardOverview() {
    const [stats, setStats] = useState({
        total_documents: 0,
        total_images: 0,
        queue_size: 0,
        active_workers: 0,
        worker_statuses: []
    })
    const [keywords, setKeywords] = useState([])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, keywordsRes] = await Promise.all([
                    fetch(`${API_BASE}/dashboard-stats`),
                    fetch(`${API_BASE}/top-keywords`)
                ])

                if (statsRes.ok) setStats(await statsRes.json())
                if (keywordsRes.ok) setKeywords(await keywordsRes.json())
            } catch (e) {
                console.error("Failed to fetch stats", e)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 3000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_documents.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Indexed in database</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Crawler Queue</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.queue_size.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">URLs pending</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.active_workers}</div>
                        <p className="text-xs text-muted-foreground">Crawling right now</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Multimodal Images</CardTitle>
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_images?.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground">Indexed embeddings</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Top Search Keywords</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={keywords.slice(0, 8)}>
                                    <XAxis
                                        dataKey="text"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                                    />
                                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                                        {keywords.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - index * 0.1})`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>System Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                <span className="flex-1">Redis Connection</span>
                                <span className="text-sm text-muted-foreground">Connected</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                <span className="flex-1">Database</span>
                                <span className="text-sm text-muted-foreground">Healthy</span>
                            </div>
                            <div className="flex items-center">
                                <div className={`w-2 h-2 rounded-full mr-2 ${stats.active_workers > 0 ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`}></div>
                                <span className="flex-1">Crawler Status</span>
                                <span className="text-sm text-muted-foreground">{stats.active_workers > 0 ? "Running" : "Idle"}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
