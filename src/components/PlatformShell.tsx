"use client";

import React, { useState, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { LandingView } from "./views/LandingView";
import { DatasetView } from "./views/DatasetView";
import { DatasetsListView } from "./views/DatasetsListView";

export type ViewType = "landing" | "datasets" | "dataset";

export function PlatformShell() {
  const [currentView, setCurrentView] = useState<ViewType>("landing");
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigateTo = useCallback((view: ViewType, datasetId?: string) => {
    setCurrentView(view);
    if (datasetId) setActiveDatasetId(datasetId);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentView={currentView}
        onNavigate={navigateTo}
      />
      <main
        className={`flex-1 min-w-0 overflow-y-auto transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-16 md:ml-64"
        }`}
      >
        {currentView === "landing" && <LandingView onNavigate={navigateTo} />}
        {currentView === "datasets" && (
          <DatasetsListView onNavigate={navigateTo} />
        )}
        {currentView === "dataset" && activeDatasetId && (
          <DatasetView datasetId={activeDatasetId} onNavigate={navigateTo} />
        )}
      </main>
    </div>
  );
}
