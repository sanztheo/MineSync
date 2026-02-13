import type { ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Home } from "@/pages/Home";
import { BrowseMods } from "@/pages/BrowseMods";
import { SyncHub } from "@/pages/SyncHub";
import { Settings } from "@/pages/Settings";
import { InstanceDetail } from "@/pages/InstanceDetail";
import { Auth } from "@/pages/Auth";

export function App(): ReactNode {
  return (
    <BrowserRouter>
      <div className="flex h-screen flex-col bg-surface-900 text-zinc-100">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-surface-900">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/mods" element={<BrowseMods />} />
              <Route path="/sync" element={<SyncHub />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/instance/:id" element={<InstanceDetail />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
