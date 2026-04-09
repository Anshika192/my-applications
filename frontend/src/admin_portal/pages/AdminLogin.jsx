import React, { useState } from 'react';
import axios from 'axios';
import './AdminLogin.css'; 

const AdminLogin = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false); // ✅ NEW
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/api/admin/login`,
                {
                    email,
                    password
                }
            );

            // Save token & admin info
            localStorage.setItem('admin_token', response.data.access_token);
            localStorage.setItem('admin_info', JSON.stringify(response.data.admin));

            if (onLoginSuccess) {
                onLoginSuccess();
            }
        } catch (err) {
            console.error("Login Error:", err);
            setError(err.response?.data?.detail || 'Invalid Admin Credentials!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-login-wrapper">
            <div className="login-box">
                <div className="admin-icon">🔐</div>
                <h1>Admin Control</h1>
                <p>Please enter your administrative credentials</p>

                {error && <div className="error-msg">{error}</div>}

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            placeholder="Type Admin Email Here"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {/* ✅ PASSWORD WITH EYE ICON */}
                    <div className="input-group">
                        <label>Password</label>

                        <div className="password-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />

                            <span
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                title={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? "🙈" : "👁️"}
                            </span>
                        </div>
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Secure Login'}
                    </button>
                </form>

                <button
                    className="back-to-site"
                    onClick={() => window.location.reload()}
                >
                    ← Back to Main Dashboard
                </button>
            </div>
        </div>
    );
};

export default AdminLogin;