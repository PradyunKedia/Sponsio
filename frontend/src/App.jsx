import { useState, useEffect } from 'react';
import Projector from './Projector';
import PlayerBoard from './PlayerBoard';
import Register from './Register';

function App() {
  const [currentView, setCurrentView] = useState('register');
  const [userAddress, setUserAddress] = useState(null);

  // Simple state-based routing
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/projector') {
      setCurrentView('projector');
    } else if (path === '/board') {
      setCurrentView('board');
    }
  }, []);

  const navigate = (view) => {
    setCurrentView(view);
    window.history.pushState({}, '', view === 'register' ? '/' : `/${view}`);
  };

  return (
    <div className="app-container">
      {currentView === 'projector' && <Projector />}
      {currentView === 'board' && <PlayerBoard />}
      {currentView === 'register' && (
        <Register 
          onSuccess={(address) => {
            setUserAddress(address);
            navigate('board');
          }} 
          onSwitchToProjector={() => navigate('projector')}
        />
      )}
    </div>
  );
}

export default App;
