import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#070C18',
            color: '#F3F6FB',
            fontFamily: 'system-ui, sans-serif',
            padding: '24px',
            textAlign: 'center',
            zIndex: 99999,
          }}
        >
          <h2 style={{ color: '#E53E3E', marginBottom: '8px', fontSize: '24px' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#A0AEC0', maxWidth: '500px', marginBottom: '20px' }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering the scene.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              background: '#00E58F',
              color: '#070C18',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
