import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import DashboardOverview from "./components/DashboardOverview"
import SearchTrace from "./components/SearchTrace"
import CrawlerStatus from "./components/CrawlerStatus"

function App() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Verdant Analytics</h1>
            <p className="text-muted-foreground">Search Engine & Crawler Real-time Monitoring</p>
          </div>
          <div className="flex items-center space-x-2 bg-secondary/50 p-1 rounded-lg">
            {["overview", "trace", "crawler"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/50"
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </header>

        <main className="space-y-6">
          {activeTab === "overview" && <DashboardOverview />}
          {activeTab === "trace" && <SearchTrace />}
          {activeTab === "crawler" && <CrawlerStatus />}
        </main>
      </div>
    </div>
  )
}

export default App
