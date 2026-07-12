"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud, File, FileText, X, AlertCircle, Copy, Check, RotateCcw } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

type SummaryLength = "Short" | "Medium" | "Long";

export default function DocumentSummaryAssistant() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>("Medium");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryData, setSummaryData] = useState<{ summary: string, keyPoints: string[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const validateAndSetFile = (selectedFile: File) => {
    setErrorMsg("");
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMsg("File size exceeds 10MB limit.");
      return;
    }
    if (ACCEPTED_TYPES.includes(selectedFile.type) || 
        selectedFile.name.toLowerCase().match(/\.(pdf|png|jpe?g)$/)) {
      setFile(selectedFile);
    } else {
      setErrorMsg("Please upload a valid .pdf, .png, or .jpg/.jpeg file.");
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleStartOver = () => {
    setFile(null);
    setSummaryData(null);
    setErrorMsg("");
    setIsCopied(false);
  };

  const handleCopy = () => {
    if (!summaryData) return;
    const text = `Summary:\n${summaryData.summary}\n\nKey Points:\n${summaryData.keyPoints.map(p => `- ${p}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleGenerateSummary = async () => {
    if (!file) return;

    setIsExtracting(true);
    setSummaryData(null);
    setErrorMsg("");

    try {
      // Step 1: Extract Text
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = file.type === "application/pdf" ? "/api/extract-pdf" : "/api/extract-image";

      const extractRes = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to extract text");
      }

      const extractData = await extractRes.json();
      const text = extractData.text;

      if (!text || text.trim().length < 50) {
        throw new Error("Could not extract readable text from this document");
      }
      
      setIsExtracting(false);
      setIsSummarizing(true);

      // Step 2: Summarize
      const sumRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, length: summaryLength }),
      });

      if (!sumRes.ok) {
        const err = await sumRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate summary");
      }

      const sumData = await sumRes.json();
      setSummaryData(sumData);
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "An error occurred during processing.";
      setErrorMsg(message);
    } finally {
      setIsExtracting(false);
      setIsSummarizing(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4 selection:bg-indigo-500/30 font-sans">
      <div className="w-full max-w-xl bg-white dark:bg-neutral-900 rounded-3xl shadow-xl shadow-indigo-500/5 dark:shadow-indigo-500/10 border border-neutral-200 dark:border-neutral-800 p-8 sm:p-10 transition-all">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl mb-4 text-indigo-600 dark:text-indigo-400">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">
            Document Summary Assistant
          </h1>
          <p className="mt-2 text-neutral-500 dark:text-neutral-400 text-sm sm:text-base">
            Upload your document to generate a smart summary.
          </p>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="flex items-center justify-between p-4 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-2xl animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload Zone */}
        <div
          className={cn(
            "relative group flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl transition-all cursor-pointer bg-neutral-50 dark:bg-neutral-900/50",
            isDragging 
              ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/5" 
              : "border-neutral-300 dark:border-neutral-700 hover:border-indigo-400 hover:bg-neutral-100 dark:hover:bg-neutral-800",
            file && "hidden"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className={cn(
            "w-10 h-10 mb-4 transition-colors",
            isDragging ? "text-indigo-500" : "text-neutral-400 group-hover:text-indigo-500"
          )} />
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            <span className="text-indigo-600 dark:text-indigo-400">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-neutral-500 mt-2">
            PDF, PNG, JPG (max. 10MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={handleFileInput}
          />
        </div>

        {/* Selected File State */}
        {file && (
          <div className="flex items-center justify-between p-4 mb-6 bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl">
            <div className="flex items-center space-x-4 overflow-hidden">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex-shrink-0">
                <File className="w-6 h-6" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Settings & Action */}
        <div className="space-y-6 mt-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Summary Length
            </label>
            <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              {(["Short", "Medium", "Long"] as const).map((length) => (
                <button
                  key={length}
                  onClick={() => setSummaryLength(length)}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                    summaryLength === length
                      ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  {length}
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={!file || isExtracting || isSummarizing}
            onClick={handleGenerateSummary}
            className="w-full relative flex items-center justify-center py-3.5 px-4 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-neutral-900 dark:disabled:hover:bg-white active:scale-[0.98]"
          >
            {(isExtracting || isSummarizing) ? (
              <span className="flex items-center space-x-2">
                <Spinner />
                <span>{isExtracting ? "Extracting text from document..." : "Generating summary..."}</span>
              </span>
            ) : (
              "Generate Summary"
            )}
          </button>
        </div>

        {summaryData && (
          <div className="mt-8 p-6 bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <span>Document Summary</span>
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopy}
                  className="p-2 text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-500/20 rounded-lg transition-colors flex items-center space-x-1"
                  title="Copy to clipboard"
                >
                  {isCopied ? (
                    <span className="flex items-center space-x-1 text-green-600 dark:text-green-500 text-xs font-medium"><Check className="w-4 h-4" /> <span>Copied!</span></span>
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleStartOver}
                  className="p-2 text-neutral-500 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Start Over"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Summary</h3>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {summaryData.summary}
                </p>
              </div>

              {summaryData.keyPoints && summaryData.keyPoints.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Key Points</h3>
                  <ul className="space-y-2">
                    {summaryData.keyPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                        <span className="block mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
