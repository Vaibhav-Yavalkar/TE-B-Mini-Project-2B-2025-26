import { Link } from "react-router";
import {
  Shield,
  Link as LinkIcon,
  Video,
  AlertTriangle,
  Eye,
  CheckCircle2,
  FileText,
  Image,
  Database,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Header } from "../components/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2350] to-[#1a2b5f]">
      <Header />
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Shield className="w-16 h-16 text-cyan-400 mr-4" />
            <h1 className="text-6xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              BitTruth
            </h1>
          </div>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Advanced AI-powered platform to detect deepfakes. Protect yourself from
            digital deception.
          </p>

          {/* Main Action Buttons - 2x2 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
            <Link to="/link-analyser" className="group">
              <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border-2 border-cyan-500/30 rounded-2xl p-8 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-cyan-400 hover:shadow-2xl hover:shadow-cyan-500/50">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-cyan-400/30 transition-all"></div>
                <div className="relative">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                    <LinkIcon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-cyan-300 mb-2">
                    Plagiarism Detector
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Detect plagiarized text
                  </p>
                </div>
              </div>
            </Link>

            <Link to="/image-analyser" className="group">
              <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-green-600/10 border-2 border-emerald-500/30 rounded-2xl p-8 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/50">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-400/30 transition-all"></div>
                <div className="relative">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                    <Image className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-emerald-300 mb-2">
                    Image Analyser
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Detect AI-generated and manipulated images
                  </p>
                </div>
              </div>
            </Link>

            <Link to="/video-analyser" className="group">
              <div className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 to-pink-600/10 border-2 border-purple-500/30 rounded-2xl p-8 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-purple-400 hover:shadow-2xl hover:shadow-purple-500/50">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-400/30 transition-all"></div>
                <div className="relative">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                    <Video className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-purple-300 mb-2">
                    Video Analyser
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Identify deepfake videos
                  </p>
                </div>
              </div>
            </Link>

            <Link to="/audio-analyser" className="group">
              <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 to-red-600/10 border-2 border-orange-500/30 rounded-2xl p-8 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-orange-400 hover:shadow-2xl hover:shadow-orange-500/50">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-orange-400/30 transition-all"></div>
                <div className="relative">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-orange-300 mb-2">
                    Audio Analyzer
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Detect fake and cloned voices
                  </p>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex justify-center">
            <Link to="/admin" className="group">
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-500/10 to-cyan-600/10 border border-cyan-500/30 rounded-2xl px-8 py-5 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-500/30">
                <div className="flex items-center gap-3">
                  <Database className="w-6 h-6 text-cyan-300" />
                  <div className="text-left">
                    <p className="text-lg font-semibold text-cyan-200">Admin Dashboard</p>
                    <p className="text-sm text-gray-400">Inspect users, plans, and upload usage</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-sm border-t border-gray-700/50 py-6 mt-16">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-300 text-lg">
            Team:{" "}
            <span className="text-cyan-400 font-semibold">
              CODE CLUCTURES
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
