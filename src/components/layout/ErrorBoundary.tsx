"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ReboundFit Client Exception caught by ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-3xl bg-[#1C1C1E] border border-[#38383A] text-center space-y-4 my-8 shadow-2xl max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-[#FF2D55]/15 border border-[#FF2D55]/30 text-[#FF2D55] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Health Interface Recovery
            </h3>
            <p className="text-xs text-[#8E8E93] mt-1 leading-relaxed">
              A temporary display glitch occurred while rendering metrics. Your data in local storage and Supabase cloud is safe.
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#0A84FF] text-white font-bold text-xs shadow-lg shadow-[#0A84FF]/20 active:scale-95 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Health View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
