import type { ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Home } from "@/pages/Home";
import { BrowseMods } from "@/pages/BrowseMods";
import { BrowseModpacks } from "@/pages/BrowseModpacks";
import { SyncHub } from "@/pages/SyncHub";
import { Settings } from "@/pages/Settings";
import { InstanceDetail } from "@/pages/InstanceDetail";
import { Auth } from "@/pages/Auth";
import { JavaRuntimeProvider } from "@/hooks/use-java-runtime";
import { JavaSetupModal } from "@/components/java/JavaSetupModal";

export function App(): ReactNode {
  return (
    <JavaRuntimeProvider>
      <BrowserRouter>
        <div
          className="flex h-screen flex-col"
          style={{ background: "#FFFFFF", color: "rgba(55, 53, 47, 1)" }}
        >
          <TitleBar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main
              className="flex-1 overflow-y-auto"
              style={{ background: "rgba(247, 246, 243, 1)" }}
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/mods" element={<BrowseMods />} />
                <Route path="/modpacks" element={<BrowseModpacks />} />
                <Route path="/sync" element={<SyncHub />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/instance/:id" element={<InstanceDetail />} />
              </Routes>
            </main>
          </div>
          <JavaSetupModal />
        </div>
      </BrowserRouter>
    </JavaRuntimeProvider>
  );
}
