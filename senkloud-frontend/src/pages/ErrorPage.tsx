import React from 'react';
import { Link } from 'react-router-dom';
import { Home, RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorPageProps {
  errorCode?: string;
  errorTitle?: string;
  errorMessage?: string;
}

const ErrorPage: React.FC<ErrorPageProps> = ({
  errorCode = '404',
  errorTitle = 'Page Not Found',
  errorMessage = 'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.'
}) => {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* Error Icon */}
        <div className="w-24 h-24 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-12 h-12 text-destructive" />
        </div>

        {/* Error Code */}
        <h1 className="text-6xl font-bold text-foreground mb-4">
          {errorCode}
        </h1>

        {/* Error Title */}
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          {errorTitle}
        </h2>

        {/* Error Message */}
        <p className="text-muted-foreground mb-8 leading-relaxed">
          {errorMessage}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/" className="btn-primary flex items-center gap-2">
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          
          <button 
            onClick={handleRefresh}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>

        {/* Additional Help */}
        <div className="mt-12 p-6 glass-effect rounded-xl">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Need Help?
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            If you believe this is an error, please contact our support team.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
            <Link to="#" className="text-primary hover:text-primary/80 transition-colors">
              Contact Support
            </Link>
            <span className="hidden sm:inline text-muted-foreground">•</span>
            <Link to="#" className="text-primary hover:text-primary/80 transition-colors">
              System Status
            </Link>
            <span className="hidden sm:inline text-muted-foreground">•</span>
            <Link to="#" className="text-primary hover:text-primary/80 transition-colors">
              Documentation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;