import React, {useState} from "react";
import AuthModal from './AuthModal.jsx';
import '../styles/AccountStatus.css';

export default function AccountStatus() {
    const [user, setUser] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('trellis_token');
        setUser(null);
    };

    // Use BACKEND_URL from environment or fallback
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

    return (
        <div className="account-status">
            {user ? (

                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <span style={{color: '#aaa', fontSize: '12px'}}>{user.email}</span>
                    <button onClick={handleLogout} className="settings-btn">Logout</button>
                </div>
            ) : (
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <span style={{color: '#aaa', fontSize: '12px'}}>guest</span>
                    <button onClick={() => setShowAuthModal(true)} className="settings-btn">Login / Sign Up</button>
                </div>
            )}

        { showAuthModal && (
        <AuthModal
            onLoginSuccess={(userData) => {
                        setUser(userData);
                        setShowAuthModal(false);
                    }}
                    onClose={() => setShowAuthModal(false)}
                    backendUrl={BACKEND_URL}
                />
            )}
        </div>
    )
}