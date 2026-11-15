/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { ShutdownLandingView } from './components/ShutdownLandingView.tsx';

function MainApp() {
  // Push ads on mount if AdSense is present
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const win = window as any;
        win.adsbygoogle = win.adsbygoogle || [];
        win.adsbygoogle.push({});
      }
    } catch {}
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
