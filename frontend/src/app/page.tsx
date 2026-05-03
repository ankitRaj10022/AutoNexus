import Link from "next/link";
import { Zap, ChevronRight, Activity, Workflow, Lock } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative selection:bg-indigo-500/30">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              AutoNexus
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/login" className="text-sm font-medium bg-white text-black px-4 py-2 rounded-full hover:bg-gray-200 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center z-10">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 max-w-4xl leading-tight">
          Automate your workflows with{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            intelligent precision.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl leading-relaxed">
          The production-grade, multi-tenant SaaS platform that empowers your team to build, monitor, and scale complex automated workflows visually.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/login" className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-full font-medium hover:opacity-90 transition-opacity shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]">
            Start Automating Free
            <ChevronRight className="w-5 h-5" />
          </Link>
          <a href="#features" className="px-8 py-4 rounded-full font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all backdrop-blur-sm">
            View Features
          </a>
        </div>

        {/* Feature Highlights Glass Cards */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full text-left">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl hover:bg-white/[0.04] transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Workflow className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Visual DAG Editor</h3>
            <p className="text-gray-400 leading-relaxed">Build complex workflows by connecting nodes visually. Built on React Flow for unparalleled flexibility.</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl hover:bg-white/[0.04] transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Real-time Execution</h3>
            <p className="text-gray-400 leading-relaxed">Watch your workflows execute in real-time with our WebSocket-powered Celery backend engine.</p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl hover:bg-white/[0.04] transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Lock className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Multi-Tenant Secure</h3>
            <p className="text-gray-400 leading-relaxed">Enterprise-grade security with isolated workspaces, role-based access control, and encrypted API keys.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
