import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './Login.css';

const ALLOWED_EMAILS = [
    'kacey.killingbeck@northwoodscareerprep.com',
    'william.michel@northwoodscareerprep.com',
    'andrew.highley@northwoodscareerprep.com',
    'mesfin.gobena@northwoodscareerprep.com',
    'mesfin.goebna@northwoodscareerprep.com', // Added to handle user typo
    'nasro.hersi@northwoodscareerprep.com',
    'bethany.howard@northwoodscareerprep.com'
];

const Login = () => {
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [step, setStep] = useState('email'); // 'email' | 'token'
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        setError(null);

        const normalizedEmail = email.trim().toLowerCase();

        // 1. Gatekeeper Check
        if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
            setError("Access Restricted: This email is not authorized to access ClassVista.");
            setLoading(false);
            return;
        }

        // 2. Request OTP
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: normalizedEmail,
                // No options.emailRedirectTo means it defaults to sending a token if supported/configured, 
                // or we explicitly rely on the token instructions.
            });

            if (error) throw error;

            setMessage("Token sent! Check your email.");
            setStep('token'); // Move to step 2
        } catch (error) {
            setError(error.error_description || error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email: email,
                token: token,
                type: 'email'
            });

            if (error) throw error;
            // Success! Session will update automatically via App.jsx listener
        } catch (error) {
            setError(error.error_description || error.message);
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1>ClassVista</h1>
                <p className="subtitle">Northwoods Career Prep Dashboard</p>

                {step === 'email' ? (
                    <form onSubmit={handleSendOtp} className="login-form">
                        <input
                            type="email"
                            placeholder="Enter your school email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="login-input"
                        />
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Login Token'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="login-form">
                        <input
                            type="text"
                            placeholder="Enter 6-digit Token"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            required
                            className="login-input"
                            style={{ letterSpacing: '2px', textAlign: 'center', fontSize: '1.2rem' }}
                        />
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'Verifying...' : 'Login'}
                        </button>
                        <button
                            type="button"
                            className="text-link"
                            onClick={() => setStep('email')}
                            style={{ background: 'none', border: 'none', color: '#64748b', marginTop: '1rem', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                            ← Back to Email
                        </button>
                    </form>
                )}

                {message && <div className="login-message success">{message}</div>}
                {error && <div className="login-message error">{error}</div>}

                <div className="login-footer">
                    <p>Protected System. Authorized Personnel Only.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
