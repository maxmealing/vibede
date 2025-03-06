"use client";
/// <reference types="@tauri-apps/api" />
// Custom reference declarations for Tauri modules
/// <reference path="../types/tauri.d.ts" />

import { DirectorySelector } from "./components/directory-selector";

export default function HomePage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6">VibeDE File Explorer</h1>
      <DirectorySelector />
    </div>
  );
}