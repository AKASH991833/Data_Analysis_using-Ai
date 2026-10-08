"use client";

import React from "react";
import type { ViewType } from "./PlatformShell";
import {
  LayoutDashboard,
  Database,
  Upload,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Brain,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}

const navItems = [
  { view: "landing" as ViewType, label: "Home", icon: LayoutDashboard },
  { view: "datasets" as ViewType, label: "Datasets", icon: Database },
];

export function Sidebar({
  collapsed,
  onToggle,
  currentView,
  onNavigate,
}: SidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-0 h-full z-50 transition-all duration-300 ${
        collapsed ? "w-16" : "w-16 md:w-64"
      } glass-card border-r border-white/5 flex flex-col`}
      style={{ borderRadius: 0 }}
    >
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
          <Brain className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="hidden md:block animate-fade-in">
            <h1 className="text-lg font-bold gradient-text leading-tight">
              NexusAI
            </h1>
            <p className="text-[10px] text-slate-500 leading-tight">
              Analytics Platform
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-1 md:p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentView === item.view ||
            (item.view === "datasets" && currentView === "dataset");
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              aria-label={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              {!collapsed && (
                <span className="hidden md:block animate-fade-in">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Upload */}
      {!collapsed && (
        <div className="p-3 hidden md:block animate-fade-in">
          <button
            onClick={() => onNavigate("landing")}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-blue-500/20"
          >
            <Upload className="w-4 h-4" />
            Upload Data
          </button>
        </div>
      )}

      {/* AI Badge */}
      {!collapsed && (
        <div className="p-3 mx-3 mb-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 hidden md:block animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-semibold text-purple-300">
              AI Engine
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Auto-profiling, domain detection, smart insights & NL queries
          </p>
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={onToggle}
        className="p-3 border-t border-white/5 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
