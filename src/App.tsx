/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { ShutdownLandingView } from './components/ShutdownLandingView.tsx';

function MainApp() {
  useEffect(() => {
    document.title = 'NeliTv — Tovuti Imefungwa, Tumia App';
  }, []);

  return (
    <div className="min-h-screen bg-[#060913] text-neutral-100 selection:bg-cyan-500 selection:text-black">
      <ShutdownLandingView />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
