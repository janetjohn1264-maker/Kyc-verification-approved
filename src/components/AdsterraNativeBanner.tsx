import React, { useEffect, useRef } from 'react';
import { AdsterraConfig, loadAdsterraNativeBanner } from '../utils/adsterra.ts';

interface AdsterraNativeBannerProps {
  className?: string;
  showDisclosure?: boolean;
}

export const AdsterraNativeBanner: React.FC<AdsterraNativeBannerProps> = ({
  className = '',
  showDisclosure = true,
}) => {
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (initializedRef.current) return;
    loadAdsterraNativeBanner();
    initializedRef.current = true;
  }, []);

  return (
    <aside
      id="floating-apps-ad-banner"
      aria-label="Sponsored Partner Content"
      className={`no-print w-full mb-3.5 relative z-30 ${className}`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs text-center">
          {showDisclosure && (
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-rectangle-ad text-blue-600"></i>
                <span className="text-slate-600 font-bold">Partner Announcements</span>
              </span>
              <span className="text-[9px] text-slate-400 tracking-widest">Sponsored</span>
            </div>
          )}
          <div className="w-full flex justify-center items-center min-h-[50px] sm:min-h-[90px] overflow-hidden text-center">
            <div id={AdsterraConfig.nativeBanner.containerId} className="w-full"></div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AdsterraNativeBanner;
