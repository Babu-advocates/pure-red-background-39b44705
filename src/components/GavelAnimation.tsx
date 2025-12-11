import { Gavel } from "lucide-react";
import { useEffect, useState } from "react";

interface GavelAnimationProps {
  isVisible: boolean;
  onComplete?: () => void;
}

const GavelAnimation = ({ isVisible, onComplete }: GavelAnimationProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      // Auto-hide after animation completes
      const timer = setTimeout(() => {
        setShow(false);
        onComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 animate-pulse">
          <div className="w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
        </div>
        
        {/* Main gavel animation */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="gavel-container">
            <Gavel 
              className="w-32 h-32 text-primary drop-shadow-2xl gavel-beat" 
              strokeWidth={1.5}
            />
          </div>
          
          {/* Sound waves */}
          <div className="flex gap-2">
            <div className="sound-wave" style={{ animationDelay: '0s' }}></div>
            <div className="sound-wave" style={{ animationDelay: '0.1s' }}></div>
            <div className="sound-wave" style={{ animationDelay: '0.2s' }}></div>
          </div>
          
          <div className="text-center space-y-2 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <h3 className="text-2xl font-bold text-white">Generating Document</h3>
            <p className="text-white/80">Please wait while we prepare your legal document...</p>
          </div>
        </div>
      </div>
      
      <style>{`
        .gavel-container {
          animation: gavel-lift 0.6s ease-in-out infinite;
        }
        
        .gavel-beat {
          animation: gavel-strike 0.6s ease-in-out infinite;
          transform-origin: bottom right;
        }
        
        @keyframes gavel-lift {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        
        @keyframes gavel-strike {
          0% {
            transform: rotate(-15deg);
          }
          25% {
            transform: rotate(-25deg);
          }
          50% {
            transform: rotate(0deg) scale(1.1);
          }
          75% {
            transform: rotate(-15deg);
          }
          100% {
            transform: rotate(-15deg);
          }
        }
        
        .sound-wave {
          width: 4px;
          height: 40px;
          background: linear-gradient(to top, hsl(var(--primary)), transparent);
          border-radius: 2px;
          animation: wave 0.6s ease-in-out infinite;
        }
        
        @keyframes wave {
          0%, 100% {
            height: 20px;
            opacity: 0.3;
          }
          50% {
            height: 50px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default GavelAnimation;
