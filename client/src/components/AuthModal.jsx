import React, { useState } from 'react';

const AuthModal = ({ onLoginSuccess, onClose, backendUrl }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin ? '/api/user/login' : '/api/user/register';

        if (!isLogin && password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            const response = await fetch(`${backendUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed.');
            }

            if (isLogin) {
                localStorage.setItem('trellis_token', data.token);
                onLoginSuccess(data.user);
            } else {
                setIsLogin(true);
                setError('Registration successful. Log in to continue.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div className="auth-modal" style={{
                backgroundColor: '#1a1a1a', padding: '30px', borderRadius: '10px',
                width: '350px', border: '1px solid #333', position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '10px', right: '15px',
                        background: 'none', border: 'none', color: '#666',
                        fontSize: '18px', cursor: 'pointer'
                    }}
                >
                    ✕
                </button>

                <h2 style={{ textAlign: 'center', color: '#f5820a', marginBottom: '20px' }}>
                    {isLogin ? 'Login' : 'Create Account'}
                </h2>

                {error && <div style={{
                    color: error.includes('successful') ? '#4ade80' : '#ef4444',
                    marginBottom: '15px', textAlign: 'center', fontSize: '14px'
                }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="inline-input"
                        style={{padding: '10px', width: '100%'}}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="inline-input"
                        style={{padding: '10px', width: '100%'}}
                    />
                    {!isLogin && (
                        <input
                            type="password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="inline-input"
                            style={{padding: '10px', width: '100%'}}
                        />
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="settings-btn"
                        style={{
                            backgroundColor: '#f5820a',
                            color: 'black',
                            padding: '10px',
                            fontWeight: 'bold',
                            width: '100%'
                        }}
                    >
                        {loading ? 'Processing...' : (isLogin ? 'LOGIN' : 'SIGN UP')}
                    </button>
                </form>

                <div style={{marginTop: '20px', textAlign: 'center'}}>
                    <span style={{color: '#aaa', fontSize: '14px'}}>
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                    </span>
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        style={{ background: 'none', border: 'none', color: '#f5820a', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        {isLogin ? 'Sign up' : 'Log in'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;