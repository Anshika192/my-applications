import React, { useState } from 'react';
import axios from 'axios';
import './AdminLogin.css'; 

const AdminLogin = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Backend endpoint ko call karein
            const response = await axios.post('http://localhost:8000/api/admin/login', {
                email: email,
                password: password
            });
            
            // 1. Token aur Admin info save karein
            localStorage.setItem('admin_token', response.data.access_token);
            localStorage.setItem('admin_info', JSON.stringify(response.data.admin));
            
            // 2. App.jsx ko batao ki login ho gaya hai taaki activeTab badal jaye
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
                            placeholder="admin@kashish.com" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    <div className="input-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Secure Login'}
                    </button>
                </form>
                
                <button className="back-to-site" onClick={() => window.location.reload()}>
                    ← Back to Main Dashboard
                </button>
            </div>
        </div>
    );
};

export default AdminLogin;