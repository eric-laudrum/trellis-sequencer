import React, {useState, useEffect} from "react";
import AuthModal from './AuthModal.jsx';
import '../styles/AccountStatus.css';

export default function AccountStatus() {
    const [user, setUser] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [displayName, setDisplayName] = useState('');

    const updateDisplayName = (currentUser) => {
        if (currentUser) {
            const custom = localStorage.getItem(`trellis_custom_name_${currentUser.email}`);
            setDisplayName(custom || currentUser.email.split('@')[0]);
        } else {
            let guest = localStorage.getItem('trellis_guest_name');
            if (!guest) {
                guest = `Guest-${Math.floor(Math.random() * 10000)}`;
                localStorage.setItem('trellis_guest_name', guest);
            }
            setDisplayName(guest);
        }
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('trellis_user');
        let parsedUser = null;
        if (storedUser) {
            try {
                parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
            } catch (e) {}
        }
        updateDisplayName(parsedUser);
    }, []);

    useEffect(() => {
        const handleNameUpdate = () => updateDisplayName(user);
        window.addEventListener('userNameUpdated', handleNameUpdate);
        return () => window.removeEventListener('userNameUpdated', handleNameUpdate);
    }, [user]);

    const handleLogout = () => {
        localStorage.removeItem('trellis_token');
        localStorage.removeItem('trellis_user');
        setUser(null);
    };

    // Use BACKEND_URL from environment or fallback
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

    const [guestName, setGuestName] = useState(() => {
        const stored = localStorage.getItem('trellis_guest_name');
        if (stored) return stored;
        const generated = `Guest-${Math.floor(Math.random() * 10000)}`;
        localStorage.setItem('trellis_guest_name', generated);
        return generated;
    });

    useEffect(() => {
        const handleNameUpdate = () => {
            const stored = localStorage.getItem('trellis_guest_name');
            if (stored && stored !== guestName) setGuestName(stored);
        };
        window.addEventListener('guestNameUpdated', handleNameUpdate);
        return () => window.removeEventListener('guestNameUpdated', handleNameUpdate);
    }, [guestName]);


    return (
        <div className="account-status">
            {user ? (
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <span style={{color: '#aaa', fontSize: '12px'}}>{displayName}</span>
                    <button onClick={handleLogout} className="settings-btn">Logout</button>
                </div>
            ) : (
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <span style={{color: '#aaa', fontSize: '12px'}}>{displayName}</span>
                    <button onClick={() => setShowAuthModal(true)} className="settings-btn">Login / Sign Up</button>
                </div>
            )}

            {showAuthModal && (
                <AuthModal
                    onLoginSuccess={(userData) => {
                        localStorage.setItem('trellis_user', JSON.stringify(userData));
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