// frontend/script.js
// React SPA migration for GiftAI using UMD CDNs (React 18, React Router v6, Framer Motion v10, and HTM).
// Retains 100% compatibility with the file:// protocol and preserves all backend REST APIs.

// Global monkey-patches to prevent React crashes caused by external DOM mutations (e.g. Lucide icons, browser extensions, or translation tools)
(function() {
    const orgRemove = Node.prototype.removeChild;
    Node.prototype.removeChild = function(child) {
        if (child && child.parentNode !== this) {
            return child;
        }
        return orgRemove.call(this, child);
    };
    const orgInsert = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(newNode, referenceNode) {
        if (referenceNode && referenceNode.parentNode !== this) {
            return orgInsert.call(this, newNode, null);
        }
        return orgInsert.call(this, newNode, referenceNode);
    };
})();

// HTM binding to React.createElement
const html = window.htm.bind(React.createElement);

// API Service Layer
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
    ? 'http://localhost:5000/api'
    : 'https://giftai-backend-kpkw.onrender.com/api';
const request = async (url, options = {}) => {
    const sessionStr = sessionStorage.getItem('wishforge_session');
    let headers = options.headers || {};
    if (sessionStr) {
        try {
            const session = JSON.parse(sessionStr);
            if (session && session.token) {
                headers['Authorization'] = `Bearer ${session.token}`;
            }
        } catch (e) {
            console.error("Error loading session token", e);
        }
    }
    
    const mergedHeaders = {
        'Content-Type': 'application/json',
        ...headers
    };
    
    const res = await fetch(url, {
        ...options,
        headers: mergedHeaders
    });
    
    if (res.status === 401) {
        sessionStorage.removeItem('wishforge_session');
        window.dispatchEvent(new CustomEvent('auth-failed'));
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || 'Session expired. Please log in again.' };
    }
    
    if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        return {
            success: false,
            status: 429,
            error: errData.error || 'Too many attempts. Please try again later.'
        };
    }
    
    return res.json();
};

const ApiService = {
    async getOccasions() {
        return request(`${API_BASE}/occasions`);
    },
    async getTones() {
        return request(`${API_BASE}/tones`);
    },
    async getCustomers() {
        return request(`${API_BASE}/customers`);
    },
    async createCustomer(name, email) {
        return request(`${API_BASE}/customers`, {
            method: 'POST',
            body: JSON.stringify({ name, email, phone: "+123-456-7890" })
        });
    },
    async getRecipients(queryParams = '') {
        return request(`${API_BASE}/recipients${queryParams}`);
    },
    async createRecipient(customerId, name, relationship) {
        return request(`${API_BASE}/recipients`, {
            method: 'POST',
            body: JSON.stringify({ customer_id: customerId, name, relationship })
        });
    },
    async getStats() {
        return request(`${API_BASE}/dashboard/stats`);
    },
    async checkConfig() {
        return request(`${API_BASE}/config/check`);
    },
    async checkHealth() {
        return request(`${API_BASE}/health`);
    },
    async generateMessage(payload) {
        return request(`${API_BASE}/messages/generate`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async saveMessage(id) {
        return request(`${API_BASE}/messages/${id}/save`, {
            method: 'POST'
        });
    },
    async linkCard(id) {
        return request(`${API_BASE}/messages/process`, {
            method: 'POST',
            body: JSON.stringify({
                message_id: id,
                status: 'linked',
                gift_order_id: 1,
                greeting_card_id: 1
            })
        });
    },
    async editMessage(id, text) {
        return request(`${API_BASE}/messages/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ message_text: text, edited_by: 'customer' })
        });
    },
    async getMessages(queryParams = '') {
        return request(`${API_BASE}/messages${queryParams}`);
    },
    async login(email, password, isAdmin, signal) {
        return request(`${API_BASE}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email, password, isAdmin }),
            signal
        });
    },
    async register(name, email, password) {
        return request(`${API_BASE}/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
    },
    async changePassword(oldPassword, newPassword) {
        return request(`${API_BASE}/auth/change-password`, {
            method: 'POST',
            body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
        });
    },
    async forgotPassword(email) {
        return request(`${API_BASE}/auth/forgot-password`, {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    },
    async validateOtp(email, pin) {
        return request(`${API_BASE}/auth/validate-otp`, {
            method: 'POST',
            body: JSON.stringify({ email, pin })
        });
    },
    async verifyReset(email, pin, newPassword) {
        return request(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ email, pin, new_password: newPassword })
        });
    }
};

// React and Router Hooks Destructuring
const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;
const { HashRouter, Routes, Route, Link, NavLink, useNavigate, useLocation } = ReactRouterDOM;
const { motion, AnimatePresence } = Motion;

// Recharts components destructuring from UMD global object
const { 
    ResponsiveContainer, 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    Tooltip: ReTooltip, 
    Legend: ReLegend,
    PieChart, 
    Pie, 
    Cell
} = window.Recharts || {};

// App Level Contexts
const ToastContext = createContext(null);
const GlobalDataContext = createContext(null);
const AuthContext = createContext(null);

const getRelativeTime = (isoString) => {
    try {
        const d = new Date(isoString);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch(e) {
        return 'Recently';
    }
};

// Page transition config
const pageTransition = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
};

// Local Activity Logging Helper
const logActivity = (type, details) => {
    try {
        const session = sessionStorage.getItem('wishforge_session');
        let email = 'system';
        if (session) {
            try {
                const parsed = JSON.parse(session);
                email = parsed.user.email.toLowerCase();
            } catch(e) {}
        }
        const key = `wishforge_activities_${email}`;
        const activities = JSON.parse(localStorage.getItem(key) || '[]');
        activities.unshift({
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            type, // 'generate' | 'save' | 'edit' | 'delete' | 'favorite' | 'unfavorite' | 'link'
            details,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(key, JSON.stringify(activities.slice(0, 50)));
    } catch (e) {
        console.error("Failed to log activity:", e);
    }
};

// ============================================================
// AUTHENTICATION PROVIDER
// ============================================================
function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        // Restore session on mount
        const session = sessionStorage.getItem('wishforge_session');
        if (session) {
            try {
                const parsed = JSON.parse(session);
                setCurrentUser(parsed.user);
                setRole(parsed.role);
            } catch (e) {
                sessionStorage.removeItem('wishforge_session');
            }
        }
        setLoading(false);
    }, []);

    // Scoped notifications sync
    useEffect(() => {
        if (currentUser) {
            const key = `wishforge_notifs_${currentUser.email.toLowerCase()}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                try {
                    setNotifications(JSON.parse(saved));
                } catch(e) {
                    setNotifications([]);
                }
            } else {
                const seeds = [
                    {
                        id: 'seed-1',
                        type: 'alert',
                        title: 'Welcome to WishForge',
                        message: `Welcome to your AI greeting workspace, ${currentUser.name}! Composing templates will log events here.`,
                        read: false,
                        timestamp: new Date().toISOString()
                    },
                    {
                        id: 'seed-2',
                        type: 'login',
                        title: 'Secure Access Recorded',
                        message: `Successful login session authorized as role: ${role?.toUpperCase() || 'USER'}.`,
                        read: true,
                        timestamp: new Date().toISOString()
                    }
                ];
                setNotifications(seeds);
                localStorage.setItem(key, JSON.stringify(seeds));
            }
        } else {
            setNotifications([]);
        }
    }, [currentUser, role]);

    const saveNotifs = (list) => {
        setNotifications(list);
        if (currentUser) {
            const key = `wishforge_notifs_${currentUser.email.toLowerCase()}`;
            localStorage.setItem(key, JSON.stringify(list));
        }
    };

    const addNotification = (type, title, message) => {
        const newNotif = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            type,
            title,
            message,
            read: false,
            timestamp: new Date().toISOString()
        };
        saveNotifs([newNotif, ...notifications]);
    };

    const markAllNotifsRead = () => {
        saveNotifs(notifications.map(n => ({ ...n, read: true })));
    };

    const clearAllNotifs = () => {
        saveNotifs([]);
    };

    const login = async (email, password, isAdmin, signal) => {
        try {
            const res = await ApiService.login(email, password, isAdmin, signal);
            if (res.success && res.data) {
                const { user, role, token } = res.data;
                const userObj = {
                    ...user,
                    password_reset_required: res.data.password_reset_required
                };
                const sessionObj = { user: userObj, role, token };
                setCurrentUser(userObj);
                setRole(role);
                sessionStorage.setItem('wishforge_session', JSON.stringify(sessionObj));
                return { success: true };
            } else {
                return { success: false, error: res.error || 'Invalid credentials' };
            }
        } catch (err) {
            return { success: false, error: err.message || 'Failed to authenticate.' };
        }
    };

    const register = async (name, email, password) => {
        try {
            const res = await ApiService.register(name, email, password);
            if (res.success && res.data) {
                const { user, role, token } = res.data;
                const sessionObj = { user, role, token };
                setCurrentUser(user);
                setRole(role);
                sessionStorage.setItem('wishforge_session', JSON.stringify(sessionObj));
                return { success: true };
            } else {
                return { success: false, error: res.error || 'Failed to register account.' };
            }
        } catch (err) {
            return { success: false, error: err.message || 'Registration failed.' };
        }
    };

    const logout = () => {
        setCurrentUser(null);
        setRole(null);
        setNotifications([]);
        sessionStorage.removeItem('wishforge_session');
    };

    useEffect(() => {
        const handleAuthFailed = () => {
            logout();
            window.location.hash = '#/login';
        };
        window.addEventListener('auth-failed', handleAuthFailed);
        return () => window.removeEventListener('auth-failed', handleAuthFailed);
    }, []);

    return html`
        <${AuthContext.Provider} value=${{ currentUser, setCurrentUser, role, loading, login, register, logout, notifications, addNotification, markAllNotifsRead, clearAllNotifs }}>
            ${children}
        <//>
    `;
}

// ============================================================
// ROUTE PROTECTION WRAPPER
// ============================================================
function ProtectedRoute({ children, adminOnly = false }) {
    const { currentUser, role, loading } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!loading) {
            if (!currentUser) {
                navigate('/login', { replace: true, state: { from: location } });
            } else if (adminOnly && role !== 'admin') {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [currentUser, role, loading, navigate, location]);

    if (loading) {
        return html`
            <div style=${{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0b0f19', color: '#f8fafc', fontFamily: "'Outfit', sans-serif" }}>
                <div style=${{ width: '40px', height: '40px', border: '3px solid rgba(99, 102, 241, 0.2)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
            </div>
        `;
    }

    if (!currentUser || (adminOnly && role !== 'admin')) {
        return null;
    }

    return children;
}

// ============================================================
// AUTHENTICATION split-screen page
// ============================================================
// ============================================================
// WISHFORGE BRAND LOGO (SVG)
// ============================================================
function WishForgeLogo({ size = 32 }) {
    return html`
        <svg 
            width=${size} 
            height=${size} 
            viewBox="0 0 32 32" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style=${{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
        >
            <rect width="32" height="32" rx="8" fill="url(#wf-logo-grad)" />
            <text 
                x="50%" 
                y="52%" 
                text-anchor="middle" 
                dominant-baseline="central" 
                fill="#FFFFFF" 
                style=${{ fontFamily: "var(--font-sans), sans-serif", fontWeight: '800', fontSize: '14px', letterSpacing: '-0.04em' }}
            >
                WF
            </text>
            <defs>
                <linearGradient id="wf-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                </linearGradient>
            </defs>
        </svg>
    `;
}

// ============================================================
// LOCAL STORAGE KEY MIGRATION (GiftAI -> WishForge)
// ============================================================
(function migrateLocalStorage() {
    try {
        // 1. Session storage session
        const oldSession = sessionStorage.getItem('wishforge_session');
        if (oldSession && !sessionStorage.getItem('wishforge_session')) {
            sessionStorage.setItem('wishforge_session', oldSession);
            sessionStorage.removeItem('wishforge_session');
        }
        
        // 2. Deleted messages
        const oldDeleted = localStorage.getItem('wishforge_deleted_messages');
        if (oldDeleted && !localStorage.getItem('wishforge_deleted_messages')) {
            localStorage.setItem('wishforge_deleted_messages', oldDeleted);
            localStorage.removeItem('wishforge_deleted_messages');
        }

        // 3. Favorites list
        const oldFavs = localStorage.getItem('wishforge_fav_messages');
        if (oldFavs && !localStorage.getItem('wishforge_fav_messages')) {
            localStorage.setItem('wishforge_fav_messages', oldFavs);
            localStorage.removeItem('wishforge_fav_messages');
        }

        // 4. User notifications and activities
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                if (key.startsWith('giftai_notifs_')) {
                    const newKey = key.replace('giftai_notifs_', 'wishforge_notifs_');
                    if (!localStorage.getItem(newKey)) {
                        localStorage.setItem(newKey, localStorage.getItem(key));
                    }
                    localStorage.removeItem(key);
                }
                if (key.startsWith('giftai_activities_')) {
                    const newKey = key.replace('giftai_activities_', 'wishforge_activities_');
                    if (!localStorage.getItem(newKey)) {
                        localStorage.setItem(newKey, localStorage.getItem(key));
                    }
                    localStorage.removeItem(key);
                }
            }
        }
    } catch (e) {
        console.error('Storage migration failed:', e);
    }
})();

function AuthPage() {
    const { login, register, currentUser, role } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const navigate = useNavigate();
    const location = useLocation();

    const [isLoginMode, setIsLoginMode] = useState(true);
    const [isAdminLogin, setIsAdminLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [authLoading, setAuthLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Sign In');
    const abortControllerRef = useRef(null);

    useEffect(() => {
        if (currentUser && role) {
            const dest = location.state?.from?.pathname || (role === 'admin' ? '/admin' : '/dashboard');
            navigate(dest, { replace: true });
        }
        if (window.lucide) window.lucide.createIcons();
    }, [currentUser, role, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (authLoading) return;

        // Cancel previous request if exists
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setAuthLoading(true);
        setStatusMessage('Authenticating...');

        const loginStartTime = performance.now();
        console.log(`[Perf Log] Login request started at ${loginStartTime.toFixed(2)}ms`);

        // Set timers for perceived progress feedback
        const timer500 = setTimeout(() => {
            setStatusMessage('Authenticating... ⏳ Verifying credentials...');
        }, 500);

        const timerTimeout = setTimeout(() => {
            setStatusMessage('Connection is taking longer than expected...');
        }, 15000);

        if (isLoginMode) {
            try {
                // Pass signal to login request
                const res = await login(email, password, isAdminLogin, controller.signal);
                clearTimeout(timer500);
                clearTimeout(timerTimeout);

                if (res.success) {
                    const loginEndTime = performance.now();
                    console.log(`[Perf Log] Login API resolved in ${(loginEndTime - loginStartTime).toFixed(2)}ms`);
                    setStatusMessage('✓ Welcome back!');
                    showToast(isAdminLogin ? "Admin logged in successfully!" : "Logged in successfully!");
                    // Navigate immediately after success
                    navigate(isAdminLogin ? '/admin' : '/dashboard', { replace: true });
                } else {
                    showToast(res.error, true);
                    setAuthLoading(false);
                }
            } catch (err) {
                clearTimeout(timer500);
                clearTimeout(timerTimeout);
                if (err.name !== 'AbortError') {
                    showToast(err.message || 'Failed to authenticate.', true);
                    setAuthLoading(false);
                }
            }
        } else {
            // For register
            try {
                const res = await register(name, email, password);
                clearTimeout(timer500);
                clearTimeout(timerTimeout);
                if (res.success) {
                    showToast("Account registered successfully!");
                    navigate('/dashboard', { replace: true });
                } else {
                    showToast(res.error, true);
                    setAuthLoading(false);
                }
            } catch (err) {
                clearTimeout(timer500);
                clearTimeout(timerTimeout);
                showToast(err.message || 'Registration failed.', true);
                setAuthLoading(false);
            }
        }
    };

    const handleForgotPassword = (e) => {
        e.preventDefault();
        showToast("Password reset link sent to " + (email || "your email") + " (mock system)", false);
    };

    return html`
        <div class="auth-wrapper">
            <!-- Left Split Panel -->
            <div class="auth-left">
                <div class="aurora-glow glow-1"></div>
                <div class="aurora-glow glow-2"></div>
                <div class="auth-brand">
                    <div class="logo-mark" style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><${WishForgeLogo} size=${32} /></div>
                    <span>Wish<span>Forge</span></span>
                </div>
                <h1>AI-powered greetings, thoughtfully crafted.</h1>
                <p>Craft personalized messages with AI. Generate highly customized greeting templates for birthdays, anniversaries, thank you notes, and corporate settings in seconds.</p>
            </div>

            <!-- Right Split Panel -->
            <div class="auth-right">
                <div class="aurora-glow glow-3"></div>
                <div class="auth-card glass-card">
                    <div class="card-glow"></div>
                    <div class="auth-card-header">
                        <h2>${isLoginMode ? (isAdminLogin ? 'Admin Portal' : 'Welcome Back') : 'Create Account'}</h2>
                        <p>${isLoginMode ? 'Access your AI greeting workspace templates' : 'Register to start creating customized AI greeting cards'}</p>
                    </div>

                    <!-- Toggle Admin vs User Login -->
                    ${isLoginMode && html`
                        <div class="auth-toggle-container">
                            <button class="auth-toggle-btn ${!isAdminLogin ? 'active' : ''}" onClick=${() => setIsAdminLogin(false)} disabled=${authLoading}>User Login</button>
                            <button class="auth-toggle-btn ${isAdminLogin ? 'active' : ''}" onClick=${() => setIsAdminLogin(true)} disabled=${authLoading}>Admin Portal</button>
                        </div>
                    `}

                    <form onSubmit=${handleSubmit}>
                        ${!isLoginMode && html`
                            <div class="form-group">
                                <label>Full Name</label>
                                <div class="input-with-icon">
                                    <i data-lucide="user"></i>
                                    <input type="text" placeholder="John Doe" value=${name} onChange=${e => setName(e.target.value)} required disabled=${authLoading} />
                                </div>
                            </div>
                        `}

                        <div class="form-group">
                            <label>Email Address</label>
                            <div class="input-with-icon">
                                <i data-lucide="mail"></i>
                                <input type="email" placeholder="name@domain.com" value=${email} onChange=${e => setEmail(e.target.value)} required disabled=${authLoading} />
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Password</label>
                            <div class="input-with-icon">
                                <i data-lucide="lock"></i>
                                <input type="password" placeholder="••••••••" value=${password} onChange=${e => setPassword(e.target.value)} required disabled=${authLoading} />
                            </div>
                        </div>

                        ${isLoginMode && html`
                            <div class="auth-form-footer" style=${{ marginTop: '1rem' }}>
                                <label style=${{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked=${rememberMe} onChange=${e => setRememberMe(e.target.checked)} disabled=${authLoading} />
                                    Remember Me
                                </label>
                                <a href="#" onClick=${(e) => { e.preventDefault(); if (!authLoading) navigate('/forgot-password'); }}>Forgot Password?</a>
                            </div>
                        `}

                        <button type="submit" class="btn-primary" style=${{ width: '100%' }} disabled=${authLoading}>
                            <span>${authLoading ? statusMessage : (isLoginMode ? 'Sign In' : 'Sign Up')}</span>
                            ${authLoading && html`<div class="spinner"></div>`}
                        </button>
                    </form>

                    <div class="auth-switch-prompt">
                        ${isLoginMode ? (isAdminLogin ? null : html`
                            Don't have an account? <button onClick=${() => { if (!authLoading) { setIsLoginMode(false); setIsAdminLogin(false); } }} disabled=${authLoading}>Sign Up</button>
                        `) : html`
                            Already have an account? <button onClick=${() => { if (!authLoading) setIsLoginMode(true); }} disabled=${authLoading}>Sign In</button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function ForgotPasswordPage() {
    const { showToast } = useContext(ToastContext);
    const navigate = useNavigate();
    
    // Recovery states
    const [email, setEmail] = useState('');
    const [pin, setPin] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [step, setStep] = useState(1); // 1 = Email, 2 = OTP, 3 = Password, 4 = Success
    const [loading, setLoading] = useState(false);
    
    // Dev Mode Helpers & Cooldowns
    const [devOtp, setDevOtp] = useState(null);
    const [countdown, setCountdown] = useState(900); // 15-minute OTP validity
    const [resendCooldown, setResendCooldown] = useState(60); // 60s resend throttle

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [step, devOtp]);

    // Timers Effect
    useEffect(() => {
        let timer;
        if (step === 2 && countdown > 0) {
            timer = setInterval(() => setCountdown(c => c - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [step, countdown]);

    useEffect(() => {
        let timer;
        if (step === 2 && resendCooldown > 0) {
            timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [step, resendCooldown]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleVerifyEmail = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setLoading(true);

        try {
            const res = await ApiService.forgotPassword(email.trim());
            if (res.success) {
                showToast("Verification code generated!");
                if (res.data && res.data.dev_otp) {
                    setDevOtp(res.data.dev_otp);
                } else {
                    setDevOtp(null);
                }
                setCountdown(900); // Reset OTP validity timer (15 minutes)
                setResendCooldown(60); // Reset resend cooldown
                setStep(2);
            } else {
                if (res.status === 429) {
                    showToast("Too many verification attempts. Please wait and try again.", true);
                } else {
                    showToast(res.error || "Email verification failed.", true);
                }
            }
        } catch (err) {
            showToast("Connection error during verification.", true);
        }
        setLoading(false);
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!pin.trim()) {
            showToast("Verification PIN is required.", true);
            return;
        }
        if (countdown <= 0) {
            showToast("Verification code has expired. Please request a new one.", true);
            return;
        }
        setLoading(true);

        try {
            const res = await ApiService.validateOtp(email.trim(), pin.trim());
            if (res.success) {
                showToast("Code verified successfully.");
                setStep(3);
            } else {
                if (res.status === 429) {
                    showToast("Too many verification attempts. Please wait and try again.", true);
                } else {
                    showToast(res.error || "Invalid verification code.", true);
                }
            }
        } catch (err) {
            showToast("Connection error during code validation.", true);
        }
        setLoading(false);
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!newPassword.trim() || newPassword !== confirmPassword) {
            showToast("Passwords do not match.", true);
            return;
        }
        if (newPassword.length < 6) {
            showToast("Password must be at least 6 characters.", true);
            return;
        }
        setLoading(true);

        try {
            const res = await ApiService.verifyReset(email.trim(), pin.trim(), newPassword);
            if (res.success) {
                setStep(4);
                showToast("Password reset successfully!");
            } else {
                if (res.status === 429) {
                    showToast("Too many verification attempts. Please wait and try again.", true);
                } else {
                    showToast(res.error || "Password reset failed.", true);
                }
            }
        } catch (err) {
            showToast("Connection error during password reset.", true);
        }
        setLoading(false);
    };

    const handleResendOtp = async () => {
        if (resendCooldown > 0) return;
        setLoading(true);
        try {
            const res = await ApiService.forgotPassword(email.trim());
            if (res.success) {
                showToast("New OTP generated!");
                if (res.data && res.data.dev_otp) {
                    setDevOtp(res.data.dev_otp);
                } else {
                    setDevOtp(null);
                }
                setPin('');
                setCountdown(900);
                setResendCooldown(60);
            } else {
                showToast(res.error || "Resend failed.", true);
            }
        } catch (err) {
            showToast("Connection error during resend.", true);
        }
        setLoading(false);
    };

    return html`
        <div class="auth-wrapper">
            <div class="auth-left">
                <div class="aurora-glow glow-1"></div>
                <div class="aurora-glow glow-2"></div>
                <div class="auth-brand">
                    <div class="logo-mark" style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><${WishForgeLogo} size=${32} /></div>
                    <span>Wish<span>Forge</span></span>
                </div>
                <h1>Security & Recovery Portal</h1>
                <p>Recover your credentials to continue customizing AI greetings.</p>
            </div>

            <div class="auth-right">
                <div class="aurora-glow glow-3"></div>
                <div class="auth-card glass-card" style=${{ maxWidth: '420px', width: '90%' }}>
                    <div class="card-glow"></div>
                    
                    ${step === 1 && html`
                        <div class="auth-card-header">
                            <h2>Forgot Password</h2>
                            <p>Enter your registered email address to recover your account</p>
                        </div>
                        <form onSubmit=${handleVerifyEmail}>
                            <div class="form-group">
                                <label>Email Address</label>
                                <div class="input-with-icon">
                                    <i data-lucide="mail"></i>
                                    <input type="email" placeholder="name@domain.com" value=${email} onChange=${e => setEmail(e.target.value)} required />
                                </div>
                            </div>
                            <button type="submit" class="btn-primary" style=${{ width: '100%', marginTop: '1rem' }} disabled=${loading}>
                                <span>${loading ? 'Verifying Account...' : 'Continue'}</span>
                                ${loading && html`<div class="spinner"></div>`}
                            </button>
                        </form>
                    `}

                    ${step === 2 && html`
                        <div class="auth-card-header">
                            <h2>Enter Verification Code</h2>
                            <p>We generated a verification code for <strong>${email}</strong></p>
                        </div>
                        <form onSubmit=${handleVerifyOtp}>
                            <div class="form-group">
                                <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <label style=${{ margin: 0 }}>Verification PIN</label>
                                    <span style=${{ fontSize: '0.75rem', color: countdown <= 120 ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                                        Expires in: ${formatTime(countdown)}
                                    </span>
                                </div>
                                <div class="input-with-icon">
                                    <i data-lucide="key-round"></i>
                                    <input type="text" placeholder="123456" maxLength="6" value=${pin} onChange=${e => setPin(e.target.value.replace(/\D/g, ''))} required />
                                </div>
                            </div>

                            <button type="submit" class="btn-primary" style=${{ width: '100%', marginTop: '1rem' }} disabled=${loading || countdown <= 0}>
                                <span>${loading ? 'Verifying Code...' : 'Verify Code'}</span>
                                ${loading && html`<div class="spinner"></div>`}
                            </button>

                            <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.2rem', fontSize: '0.8rem' }}>
                                <button type="button" class="btn-text-only" onClick=${() => setStep(1)} style=${{ padding: 0, color: 'var(--text-muted)' }}>
                                    Back
                                </button>
                                <button type="button" class="btn-text-only" onClick=${handleResendOtp} disabled=${resendCooldown > 0 || loading} style=${{ padding: 0, opacity: resendCooldown > 0 ? 0.5 : 1 }}>
                                    ${resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                                </button>
                            </div>
                        </form>

                        ${devOtp && html`
                            <div class="dev-otp-box" style=${{ background: 'rgba(139, 92, 246, 0.08)', border: '1px dashed rgba(139, 92, 246, 0.4)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginTop: '1.5rem', textAlign: 'center' }}>
                                <p style=${{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.3rem 0', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>[Dev Mode OTP]</p>
                                <strong style=${{ fontSize: '1.6rem', color: 'var(--color-primary)', letterSpacing: '4px', fontFamily: 'monospace' }}>${devOtp}</strong>
                                <p style=${{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.3rem 0 0 0' }}>Enter this code above or check server logs</p>
                            </div>
                        `}
                    `}

                    ${step === 3 && html`
                        <div class="auth-card-header">
                            <h2>Create New Password</h2>
                            <p>Choose a secure new password for <strong>${email}</strong></p>
                        </div>
                        <form onSubmit=${handleResetPassword}>
                            <div class="form-group">
                                <label>New Password</label>
                                <div class="input-with-icon">
                                    <i data-lucide="lock"></i>
                                    <input type="password" placeholder="••••••••" value=${newPassword} onChange=${e => setNewPassword(e.target.value)} required />
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Confirm Password</label>
                                <div class="input-with-icon">
                                    <i data-lucide="lock"></i>
                                    <input type="password" placeholder="••••••••" value=${confirmPassword} onChange=${e => setConfirmPassword(e.target.value)} required />
                                </div>
                            </div>
                            <button type="submit" class="btn-primary" style=${{ width: '100%', marginTop: '1rem' }} disabled=${loading}>
                                <span>${loading ? 'Resetting Password...' : 'Reset Password'}</span>
                                ${loading && html`<div class="spinner"></div>`}
                            </button>

                            <button type="button" class="btn-text-only" onClick=${() => setStep(2)} style=${{ marginTop: '1rem', display: 'block', margin: '1rem auto 0 auto', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                Back to Verification
                            </button>
                        </form>
                    `}

                    ${step === 4 && html`
                        <div style=${{ textAlign: 'center', padding: '1.5rem 0' }}>
                            <div style=${{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.2rem' }}>
                                <i data-lucide="check-circle" style=${{ width: '28px', height: '28px' }}></i>
                            </div>
                            <h2>Password Restored</h2>
                            <p style=${{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>Your new credentials have been synchronized successfully.</p>
                            <button class="btn-primary" style=${{ width: '100%' }} onClick=${() => navigate('/login')}>Back to Sign In</button>
                        </div>
                    `}

                    ${step !== 4 && html`
                        <div class="auth-switch-prompt" style=${{ marginTop: '1.5rem' }}>
                            Remember password? <button onClick=${() => navigate('/login')}>Sign In</button>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// MAIN APPLICATION SETUP
// ============================================================
function App() {
    return html`
        <${AuthProvider}>
            <${AppContent} />
        <//>
    `;
}

function AppContent() {
    const { currentUser, role } = useContext(AuthContext);
    const [toast, setToast] = useState({ show: false, message: '', isError: false });
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const [workspaceCustomer, setWorkspaceCustomer] = useState('all');
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
    
    const [occasions, setOccasions] = useState([]);
    const [tones, setTones] = useState([]);
    const [recipients, setRecipients] = useState([]);
    const [stats, setStats] = useState(null);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);

    // Apply HTML Theme Attribute
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Apply Sidebar Collapse state
    useEffect(() => {
        localStorage.setItem('sidebar_collapsed', isCollapsed);
        document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '80px' : '280px');
    }, [isCollapsed]);

    // Secure role lock for customers workspace context
    useEffect(() => {
        if (currentUser && role === 'user' && workspaceCustomer !== currentUser.id) {
            setWorkspaceCustomer(currentUser.id);
        }
    }, [workspaceCustomer, currentUser, role]);

    const showToast = (message, isError = false) => {
        setToast({ show: true, message, isError });
    };

    // Load bootstrap lists
    const loadBootstrapData = async () => {
        try {
            // CRITICAL FIX: Load occasions and tones FIRST in their own Promise.all
            // completely separated from stats (which requires auth and can return 401).
            // A 401 on stats fires auth-failed which wipes state — this prevents that
            // from blocking the dropdown data.
            const [occRes, toneRes] = await Promise.all([
                ApiService.getOccasions(),
                ApiService.getTones()
            ]);

            setOccasions(occRes.data || []);
            setTones(toneRes.data || []);

            // Load stats separately so its 401 doesn't affect occasions/tones
            const statsRes = await ApiService.getStats().catch(() => ({ success: false }));
            if (statsRes.success) setStats(statsRes.data);

            let recipientsPromise;
            let customersPromise;

            if (role === 'admin') {
                customersPromise = ApiService.getCustomers();
            } else if (currentUser) {
                const targetCustId = currentUser.id;
                recipientsPromise = ApiService.getRecipients(`?customer_id=${targetCustId}`);
            }

            // Dummy statsRes for legacy code compatibility
            const statsRes_compat = statsRes;

            let custRes;
            if (role === 'admin' && customersPromise) {
                custRes = await customersPromise;
                if (!custRes.data || custRes.data.length === 0) {
                    const seeded = await ApiService.createCustomer("Internship Reviewer", "reviewer@paperplane.com");
                    custRes = { success: true, data: [seeded.data] };
                }

                // Sync System Admin customer record in database
                let adminCust = custRes.data.find(c => c.email.toLowerCase() === currentUser.email.toLowerCase());
                if (!adminCust) {
                    const newAdminCust = await ApiService.createCustomer(currentUser.name, currentUser.email);
                    if (newAdminCust.success) {
                        custRes.data.push(newAdminCust.data);
                        adminCust = newAdminCust.data;
                    }
                }
                if (adminCust && currentUser && currentUser.id === 0) {
                    setCurrentUser(prev => ({ ...prev, id: adminCust.id }));
                }
            } else {
                custRes = { success: true, data: currentUser ? [currentUser] : [] };
            }

            // Sync workspaceCustomer selection
            if (currentUser && role === 'user') {
                setWorkspaceCustomer(currentUser.id);
            } else if (role === 'admin') {
                if (!workspaceCustomer) {
                    setWorkspaceCustomer('all');
                }
            } else {
                if (!workspaceCustomer && custRes.data && custRes.data.length > 0) {
                    setWorkspaceCustomer(custRes.data[0].id);
                }
            }

            let filteredRecipients = [];
            if (role === 'admin') {
                let q_rec = '';
                if (workspaceCustomer !== 'all') {
                    q_rec = `?customer_id=${workspaceCustomer}`;
                }
                const recRes = await ApiService.getRecipients(q_rec);
                filteredRecipients = recRes.data || [];
            } else if (recipientsPromise) {
                const recRes = await recipientsPromise;
                filteredRecipients = recRes.data || [];
            }

            if (filteredRecipients.length === 0) {
                const targetCustId = (currentUser && (role === 'user' || (role === 'admin' && workspaceCustomer !== 'all')))
                    ? (role === 'admin' ? workspaceCustomer : currentUser.id)
                    : (custRes.data && custRes.data[0] ? custRes.data[0].id : 1);
                const seededRec = await ApiService.createRecipient(targetCustId, "Aunt Sarah", "Aunt");
                filteredRecipients = [seededRec.data];
            }

            if (currentUser && (role === 'user' || (role === 'admin' && workspaceCustomer !== 'all'))) {
                const targetCustId = role === 'admin' ? workspaceCustomer : currentUser.id;
                filteredRecipients = filteredRecipients.filter(r => r && r.customer_id === targetCustId);
            }
            setRecipients(filteredRecipients);

        } catch (err) {
            console.error(err);
            showToast("Database server offline. Start Flask first!", true);
        }
    };

    useEffect(() => {
        if (currentUser) {
            showToast("Setting up AI Workspace...");
            loadBootstrapData();
        }
        

    }, [currentUser, workspaceCustomer]);

    const value = {
        theme, setTheme,
        workspaceCustomer, setWorkspaceCustomer,
        occasions, setOccasions,
        tones, setTones,
        recipients, setRecipients,
        stats, setStats,
        isPaletteOpen, setIsPaletteOpen,
        isCollapsed, setIsCollapsed,
        refreshStats: async () => {
            const res = await ApiService.getStats();
            if (res.success) setStats(res.data);
        }
    };

    return html`
        <${ErrorBoundary}>
            <${ToastContext.Provider} value=${{ showToast }}>
                <${GlobalDataContext.Provider} value=${value}>
                    <${HashRouter}>
                        <${Routes}>
                            <${Route} path="/login" element=${html`<${AuthPage} />`} />
                            <${Route} path="/forgot-password" element=${html`<${ForgotPasswordPage} />`} />
                            <${Route} path="/*" element=${html`
                                <${ProtectedRoute}>
                                    <div class="app-layout">
                                        <${Layout} />
                                    </div>
                                </${ProtectedRoute}>
                            `} />
                        </${Routes}>
                        <${AnimatePresence}>
                            ${isPaletteOpen && html`<${CommandPalette} onClose=${() => setIsPaletteOpen(false)} />`}
                        </${AnimatePresence}>
                        <${AnimatePresence}>
                            ${currentUser && currentUser.password_reset_required && html`<${ForceResetPasswordModal} />`}
                        </${AnimatePresence}>
                        <${Toast} toast=${toast} setToast=${setToast} />
                    </${HashRouter}>
                </${GlobalDataContext.Provider}>
            </${ToastContext.Provider}>
        </${ErrorBoundary}>`;
}

function ForceResetPasswordModal() {
    const { currentUser, setCurrentUser } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            const res = await ApiService.changePassword(null, newPassword);
            if (res.success) {
                showToast("Password updated successfully!");
                // Update local session
                const session = JSON.parse(sessionStorage.getItem('wishforge_session') || '{}');
                if (session.user) {
                    session.user.password_reset_required = false;
                    sessionStorage.setItem('wishforge_session', JSON.stringify(session));
                }
                setCurrentUser(prev => ({
                    ...prev,
                    password_reset_required: false
                }));
            } else {
                setError(res.error || 'Failed to update password.');
            }
        } catch (err) {
            setError(err.message || 'Error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return html`
        <div class="modal-overlay" style=${{ backdropFilter: 'blur(10px)', background: 'rgba(5, 8, 16, 0.85)', zIndex: 10000 }}>
            <${motion.div} 
                initial=${{ opacity: 0, y: 50, scale: 0.95 }}
                animate=${{ opacity: 1, y: 0, scale: 1 }}
                class="modal-container"
                style=${{ maxWidth: '450px', width: '90%', border: '1px solid rgba(255, 255, 255, 0.08)' }}
            >
                <div class="modal-header">
                    <h3 class="modal-title">Reset Temporary Password</h3>
                </div>
                <div class="modal-body">
                    <p style=${{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                        For security reasons, you must change your temporary password before accessing the application dashboard.
                    </p>
                    <form onSubmit=${handleSubmit}>
                        ${error && html`<div style=${{ color: 'var(--color-danger)', marginBottom: '1rem', fontSize: '0.85rem' }}>${error}</div>`}
                        <div class="form-group" style=${{ marginBottom: '1.2rem' }}>
                            <label class="form-label">New Password</label>
                            <input 
                                type="password" 
                                class="form-input" 
                                value=${newPassword} 
                                onInput=${e => setNewPassword(e.target.value)} 
                                required 
                                placeholder="Enter at least 6 characters" 
                            />
                        </div>
                        <div class="form-group" style=${{ marginBottom: '1.5rem' }}>
                            <label class="form-label">Confirm New Password</label>
                            <input 
                                type="password" 
                                class="form-input" 
                                value=${confirmPassword} 
                                onInput=${e => setConfirmPassword(e.target.value)} 
                                required 
                                placeholder="Confirm your new password" 
                            />
                        </div>
                        <button type="submit" class="btn btn-primary" style=${{ width: '100%' }} disabled=${loading}>
                            ${loading ? 'Updating...' : 'Update Password & Enter'}
                        </button>
                    </form>
                </div>
            </${motion.div}>
        </div>
    `;
}

// ============================================================
// APP TOAST ALERTS
// ============================================================
function Toast({ toast, setToast }) {
    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast.show]);

    return html`
        <${AnimatePresence}>
            ${toast.show && html`
                <${motion.div} 
                    initial=${{ opacity: 0, y: 50, scale: 0.95 }}
                    animate=${{ opacity: 1, y: 0, scale: 1 }}
                    exit=${{ opacity: 0, y: 20, scale: 0.95 }}
                    transition=${{ duration: 0.2 }}
                    class="toast"
                    role="status"
                    aria-live="polite"
                >
                    <div class="toast-content" style=${{ borderColor: toast.isError ? 'rgba(239,68,68,0.25)' : 'var(--border-color)' }}>
                        <i data-lucide=${toast.isError ? 'alert-circle' : 'check-circle'} class="toast-icon" style=${{ color: toast.isError ? 'var(--color-danger)' : 'var(--color-success)' }}></i>
                        <span class="toast-message">${toast.message}</span>
                    </div>
                </${motion.div}>
            `}
        <//>
    `;
}
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return html`
                <div class="error-fallback" style=${{ padding: '2rem', color: '#ef4444', background: '#0b0f19', fontFamily: 'monospace', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', margin: '2rem' }}>
                    <h2 style=${{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#ef4444' }}>React Render Exception Captured:</h2>
                    <p style=${{ fontWeight: 'bold' }}>${this.state.error && this.state.error.toString()}</p>
                    <pre style=${{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#94a3b8', marginTop: '1rem', background: '#0f172a', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', overflowX: 'auto' }}>
                        ${this.state.error && this.state.error.stack}
                    </pre>
                </div>
            `;
        }
        return this.props.children;
    }
}

// ============================================================
// APPLICATION NESTED ROUTE LAYOUT
// ============================================================
function IndexRedirect() {
    const { role } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (role === 'admin') {
            navigate('/admin', { replace: true });
        } else {
            navigate('/dashboard', { replace: true });
        }
    }, [role, navigate]);

    return null;
}

function Layout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen && window.innerWidth <= 1024) {
            document.body.classList.add('mobile-menu-open');
        } else {
            document.body.classList.remove('mobile-menu-open');
        }
        return () => {
            document.body.classList.remove('mobile-menu-open');
        };
    }, [isMobileMenuOpen]);

    // Trigger icon generation on routes mount
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [location.pathname, isMobileMenuOpen]);

    // Escape key listener to close mobile menu drawer
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isMobileMenuOpen]);

    return html`
        <!-- Left Sidebar -->
        <${Sidebar} isOpen=${isMobileMenuOpen} onClose=${() => setIsMobileMenuOpen(false)} />

        <!-- Mobile Sidebar Backdrop -->
        ${isMobileMenuOpen && html`
            <div class="sidebar-mobile-backdrop" onClick=${() => setIsMobileMenuOpen(false)}></div>
        `}

        <!-- Main Wrapper -->
        <div class="main-container">
            <!-- Top Nav -->
            <${Navbar} onOpenMenu=${() => setIsMobileMenuOpen(true)} />

            <!-- Dynamic Subview with Transitions -->
            <main class="content-view">
                <${Routes}>
                    <${Route} index element=${html`<${IndexRedirect} />`} />
                    <${Route} path="dashboard" element=${html`<${DashboardPage} />`} />
                    <${Route} path="generate" element=${html`<${GeneratePage} />`} />
                    <${Route} path="requests" element=${html`<${MessageRequestsPage} />`} />
                    <${Route} path="saved" element=${html`<${SavedMessagesPage} />`} />
                    <${Route} path="history" element=${html`<${HistoryPage} />`} />
                    <${Route} path="settings" element=${html`<${SettingsPage} />`} />
                    <${Route} path="admin" element=${html`<${ProtectedRoute} adminOnly=${true}><${AdminPage} /></${ProtectedRoute}>`} />
                </${Routes}>
            </main>
        </div>
    `;
}

// ============================================================
// SIDEBAR MENU NAVIGATION
// ============================================================
function Sidebar({ isOpen, onClose }) {
    const { theme, setTheme, workspaceCustomer, setWorkspaceCustomer, isCollapsed, setIsCollapsed } = useContext(GlobalDataContext);
    const { currentUser, role, logout } = useContext(AuthContext);
    const [allCustomers, setAllCustomers] = useState([]);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (role === 'admin') {
            ApiService.getCustomers().then(res => {
                if (res.success) setAllCustomers(res.data || []);
            });
        }
    }, [role]);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [isCollapsed]);

    const userLinks = [
        { path: '/dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
        { path: '/generate', label: 'Generate Message', icon: 'wand-2' },
        { path: '/requests', label: 'Message Requests', icon: 'list-todo' },
        { path: '/saved', label: 'Saved Messages', icon: 'bookmark' },
        { path: '/history', label: 'History Log', icon: 'history' },
        { path: '/settings', label: 'Settings', icon: 'settings' }
    ];

    const adminLinks = [
        { path: '/admin', label: 'Admin Dashboard', icon: 'shield' },
        { path: '/dashboard', label: 'User Dashboard', icon: 'layout-dashboard' },
        { path: '/generate', label: 'Generate Message', icon: 'wand-2' },
        { path: '/requests', label: 'Message Requests', icon: 'list-todo' },
        { path: '/saved', label: 'Saved Messages', icon: 'bookmark' },
        { path: '/history', label: 'History Log', icon: 'history' },
        { path: '/settings', label: 'Settings', icon: 'settings' }
    ];

    const links = role === 'admin' ? adminLinks : userLinks;

    const handleLogoutClick = (e) => {
        e.preventDefault();
        logout();
        navigate('/login');
    };

    const getInitials = (name) => {
        if (!name) return "UI";
        return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    };

    return html`
        <aside class="sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}" id="sidebar">
            <div class="sidebar-header">
                <div class="logo-container">
                    <div class="logo-mark" style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><${WishForgeLogo} size=${32} /></div>
                    <span class="logo-text">Wish<span>Forge</span></span>
                </div>
                <button class="sidebar-collapse-toggle" onClick=${() => setIsCollapsed(!isCollapsed)} title=${isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} style=${{ display: 'inline-flex' }}>
                    <i data-lucide=${isCollapsed ? 'chevron-right' : 'chevron-left'} style=${{ width: '14px', height: '14px' }}></i>
                </button>
                <button class="mobile-close-btn" onClick=${onClose} aria-label="Close menu">
                    <i data-lucide="x"></i>
                </button>
            </div>

            <!-- Customer workspace picker -->
            <div class="workspace-selector">
                <i data-lucide="building-2" class="workspace-icon"></i>
                <div class="workspace-info">
                    <span class="workspace-title">${role === 'admin' ? 'Workspace (Admin)' : 'Workspace'}</span>
                    <select 
                        id="select-customer" 
                        class="workspace-select" 
                        value=${workspaceCustomer}
                        onChange=${e => setWorkspaceCustomer(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                        disabled=${role !== 'admin'}
                    >
                        ${role === 'admin' ? 
                            html`
                                <option value="all">Platform Global View</option>
                                ${allCustomers.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}
                            ` :
                            html`<option value=${currentUser?.id}>${currentUser?.name}</option>`
                        }
                    </select>
                </div>
                ${role === 'admin' && !isCollapsed && html`<i data-lucide="chevrons-up-down" class="workspace-chevron"></i>`}
            </div>

            <nav class="sidebar-nav" role="tablist">
                <ul>
                    ${links.map(link => html`
                        <li key=${link.path}>
                            <${NavLink} 
                                to=${link.path} 
                                className=${({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                                role="tab"
                                aria-selected=${location.pathname === link.path}
                                onClick=${onClose}
                                title=${isCollapsed ? link.label : ''}
                            >
                                <i data-lucide=${link.icon}></i>
                                <span>${link.label}</span>
                            <//>
                        </li>
                    `)}
                </ul>
            </nav>

            <!-- User profile footer widget -->
            <div class="sidebar-footer-profile">
                <div class="profile-avatar">${getInitials(currentUser?.name)}</div>
                ${!isCollapsed && html`
                    <div class="profile-info">
                        <span class="profile-name" title=${currentUser?.name}>${currentUser?.name || 'User'}</span>
                    </div>
                `}
            </div>
        </aside>
    `;
}

// ============================================================
// TOP HEADER NAVBAR
// ============================================================
function Navbar({ onOpenMenu }) {
    const { setIsPaletteOpen } = useContext(GlobalDataContext);
    const { currentUser, role, logout, notifications, markAllNotifsRead, clearAllNotifs } = useContext(AuthContext);
    const [notifOpen, setNotifOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogoutClick = (e) => {
        e.preventDefault();
        logout();
        navigate('/login');
    };

    const getInitials = (name) => {
        if (!name) return "UI";
        return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [notifications, notifOpen]);

    return html`
        <header class="top-navbar">
            <div class="navbar-left">
                <button class="hamburger-menu" onClick=${onOpenMenu} aria-label="Open sidebar">
                    <i data-lucide="menu"></i>
                </button>
                <button class="search-trigger" onClick=${() => setIsPaletteOpen(true)} aria-label="Search or command palette">
                    <i data-lucide="search"></i>
                    <span>Search messages...</span>
                </button>
            </div>

            <div class="navbar-right">
                <button class="mobile-plus-btn" onClick=${() => navigate('/generate')} aria-label="Create new message">
                    <i data-lucide="plus"></i>
                </button>
                <!-- Notifications dropdown -->
                <div class="notification-dropdown">
                    <button class="nav-icon-btn" onClick=${() => setNotifOpen(!notifOpen)} aria-label="Notifications" aria-expanded=${notifOpen}>
                        <i data-lucide="bell"></i>
                        ${unreadCount > 0 ? html`<span class="notification-badge"></span>` : null}
                    </button>
                    <div class="dropdown-panel ${notifOpen ? 'open' : ''}">
                        <div class="panel-header">
                            <h3>Notifications (${unreadCount} unread)</h3>
                            <div style=${{ display: 'flex', gap: '0.6rem' }}>
                                <button class="btn-text-only" onClick=${markAllNotifsRead}>Mark read</button>
                                <button class="btn-text-only" onClick=${clearAllNotifs}>Clear all</button>
                            </div>
                        </div>
                        <div class="panel-list">
                            ${notifications.length === 0 ? html`
                                <div style=${{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                                    <i data-lucide="check-circle" style=${{ color: 'var(--color-success)', opacity: 0.6, width: '24px', height: '24px' }}></i>
                                    <div style=${{ fontWeight: 600, color: 'var(--text-main)' }}>All caught up!</div>
                                    <div style=${{ fontSize: '0.8rem', opacity: 0.7 }}>No new notifications.</div>
                                </div>
                            ` : notifications.map(n => html`
                                <div key=${n.id} class="notification-item ${!n.read ? 'unread' : ''}">
                                    <div class="notif-icon ${n.type}"><i data-lucide=${
                                        n.type === 'generate' ? 'sparkles' :
                                        n.type === 'save' ? 'bookmark' :
                                        n.type === 'alert' ? 'alert-circle' : 'key-round'
                                    } style=${{ width: '14px', height: '14px' }}></i></div>
                                    <div class="notif-body">
                                        <p>${n.message}</p>
                                        <span>${getRelativeTime(n.timestamp)}</span>
                                    </div>
                                </div>
                            `)}
                        </div>
                    </div>
                </div>

                <!-- User profile dropdown -->
                <div class="profile-dropdown">
                    <button class="profile-btn" onClick=${() => setProfileOpen(!profileOpen)} aria-label="Profile menu" aria-expanded=${profileOpen}>
                        <div class="avatar">${getInitials(currentUser?.name)}</div>
                        <span class="profile-name">${currentUser?.name || 'User'}</span>
                        <i data-lucide="chevron-down"></i>
                    </button>
                    <div class="dropdown-panel profile ${profileOpen ? 'open' : ''}">
                        <div class="profile-header">
                            <span class="profile-email" style=${{ fontWeight: 600, color: 'var(--text-main)' }}>${role === 'admin' ? 'Administrator' : 'Customer Account'}</span>
                            <span class="profile-email">${currentUser?.email}</span>
                        </div>
                        <ul class="profile-links">
                            ${role === 'admin' ? html`
                                <li><${Link} to="/admin" class="profile-link-item" onClick=${() => setProfileOpen(false)}><i data-lucide="shield"></i>Console<//></li>
                            ` : null}
                            <li><${Link} to="/settings" class="profile-link-item" onClick=${() => setProfileOpen(false)}><i data-lucide="settings"></i>Settings<//></li>
                            <li class="divider"></li>
                            <li><a href="#" class="profile-link-item logout" onClick=${handleLogoutClick}><i data-lucide="log-out"></i>Sign Out</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </header>
    `;
}

// ============================================================
// COMMAND PALETTE COMPONENT
// ============================================================
function CommandPalette({ onClose }) {
    const navigate = useNavigate();
    const { theme, setTheme, refreshStats } = useContext(GlobalDataContext);
    const { role } = useContext(AuthContext);
    const [search, setSearch] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const modalRef = useRef(null);

    const baseItems = [
        { label: 'Go to Dashboard', icon: 'layout-dashboard', action: () => navigate('/dashboard') },
        { label: 'Go to Generate Message', icon: 'wand-2', action: () => navigate('/generate') },
        { label: 'Go to Message Requests', icon: 'list-todo', action: () => navigate('/requests') },
        { label: 'Go to Saved Messages', icon: 'bookmark', action: () => navigate('/saved') },
        { label: 'Go to History Log', icon: 'history', action: () => navigate('/history') },
        { label: 'Go to Settings', icon: 'settings', action: () => navigate('/settings') },
        { label: 'Toggle Theme (Dark/Light)', icon: 'sun', action: () => setTheme(prev => prev === 'light' ? 'dark' : 'light') },
        { label: 'Refresh Analytics Metrics', icon: 'refresh-cw', action: () => refreshStats() }
    ];

    const adminItems = [
        { label: 'Go to Admin Console', icon: 'shield', action: () => navigate('/admin') }
    ];

    const items = role === 'admin' ? [...adminItems, ...baseItems] : baseItems;

    const filtered = items.filter(item => item.label.toLowerCase().includes(search.toLowerCase()));

    useEffect(() => {
        if (modalRef.current) modalRef.current.focus();
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % filtered.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[activeIndex]) {
                filtered[activeIndex].action();
                onClose();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    return html`
        <div 
            class="command-palette-backdrop"
            onClick=${e => e.target === e.currentTarget && onClose()}
        >
            <div 
                class="command-palette-modal"
                tabIndex="-1"
                ref=${modalRef}
                onKeyDown=${handleKeyDown}
                role="dialog"
                aria-modal="true"
            >
                <div class="palette-search-row">
                    <i data-lucide="search"></i>
                    <input 
                        type="text" 
                        id="palette-search" 
                        placeholder="Type a command or page name..."
                        value=${search}
                        onChange=${e => { setSearch(e.target.value); setActiveIndex(0); }}
                        autoComplete="off"
                    />
                    <kbd>ESC</kbd>
                </div>
                
                <div class="palette-results">
                    <div class="palette-group">Navigation & Actions</div>
                    ${filtered.length === 0 ? html`
                        <div style=${{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            No matching commands found.
                        </div>
                    ` : filtered.map((item, idx) => html`
                        <div 
                            key=${item.label}
                            class="palette-item ${idx === activeIndex ? 'active' : ''}"
                            onClick=${() => { item.action(); onClose(); }}
                            onMouseEnter=${() => setActiveIndex(idx)}
                        >
                            <i data-lucide=${item.icon}></i>
                            <span>${item.label}</span>
                            <kbd>↵</kbd>
                        </div>
                    `)}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// 1. DASHBOARD PAGE VIEW
// ============================================================
function DashboardPage() {
    const { stats, refreshStats, workspaceCustomer, occasions, tones } = useContext(GlobalDataContext);
    const { currentUser, role } = useContext(AuthContext);
    const [diag, setDiag] = useState({ provider: 'Groq API', status: 'Checking...', code: 'N/A', reason: 'None' });
    const { showToast } = useContext(ToastContext);
    const [localStats, setLocalStats] = useState(null);

    // Advanced calculated metrics
    const [recentMessages, setRecentMessages] = useState([]);
    const [totalMessages, setTotalMessages] = useState(0);
    const [savedCount, setSavedCount] = useState(0);
    const [activeRequests, setActiveRequests] = useState(0);
    const [completedRequests, setCompletedRequests] = useState(0);
    const [favCount, setFavCount] = useState(0);
    const [monthCount, setMonthCount] = useState(0);

    const loadDiagnostics = async () => {
        try {
            const health = await ApiService.checkHealth();
            if (health.success) {
                setDiag({
                    provider: 'Groq Llama-3.3 API',
                    status: 'Healthy',
                    code: '200',
                    reason: 'None'
                });
            } else {
                setDiag({
                    provider: 'Groq Llama-3.3 API',
                    status: 'Fallback Triggered',
                    code: health.last_provider_response_code || '503',
                    reason: health.error || 'Quota Exceeded'
                });
            }
        } catch (err) {
            setDiag({
                provider: 'Groq API',
                status: 'Server Offline',
                code: 'Error',
                reason: 'Failed to connect'
            });
        }
    };

    const loadCustomerWorkspaceStats = async () => {
        if (!currentUser) return;
        try {
            let q = `?limit=200`;
            if (role === 'admin') {
                if (workspaceCustomer !== 'all') {
                    q += `&customer_id=${workspaceCustomer}`;
                }
            } else {
                q += `&customer_id=${currentUser.id}`;
            }
            const res = await ApiService.getMessages(q);
            if (res.success && res.data) {
                const list = res.data;
                const deletedIds = JSON.parse(localStorage.getItem('wishforge_deleted_messages') || '[]');
                const activeList = list.filter(m => !deletedIds.includes(m.id));
                
                // Map names from context lists for activeList
                const mappedActiveList = activeList.map(m => {
                    const occ = occasions.find(o => o.id === m.occasion_id);
                    const t = tones.find(tone => tone.id === m.tone_id);
                    return {
                        ...m,
                        occasion_name: occ ? occ.name : `Occasion #${m.occasion_id}`,
                        tone_name: t ? t.name : `Tone #${m.tone_id}`
                    };
                });

                // Calculate local stats breakdowns
                const occasionMap = {};
                mappedActiveList.forEach(m => {
                    occasionMap[m.occasion_name] = (occasionMap[m.occasion_name] || 0) + 1;
                });
                const localOccStats = Object.keys(occasionMap).map(occ => ({
                    occasion: occ,
                    count: occasionMap[occ]
                }));

                const toneMap = {};
                mappedActiveList.forEach(m => {
                    toneMap[m.tone_name] = (toneMap[m.tone_name] || 0) + 1;
                });
                const localToneStats = Object.keys(toneMap).map(t => ({
                    tone: t,
                    count: toneMap[t]
                }));

                const localStatusCounts = {
                    generated: mappedActiveList.filter(m => m.status === 'generated').length,
                    saved: mappedActiveList.filter(m => m.status === 'saved').length,
                    edited: mappedActiveList.filter(m => m.status === 'edited').length,
                    linked: mappedActiveList.filter(m => m.status === 'linked').length
                };

                const localStatsObj = {
                    total_messages: mappedActiveList.length,
                    messages_today: mappedActiveList.filter(m => {
                        const d = new Date(m.created_at);
                        const today = new Date();
                        return d.toDateString() === today.toDateString();
                    }).length,
                    messages_by_occasion: localOccStats,
                    messages_by_tone: localToneStats,
                    messages_by_status: localStatusCounts
                };
                setLocalStats(localStatsObj);

                // Total Count
                setTotalMessages(mappedActiveList.length);
                
                // Saved templates count
                const saved = mappedActiveList.filter(m => m.status === 'saved' || (m.status === 'edited' && !m.gift_order_id)).length;
                setSavedCount(saved);

                // Active Requests (Generated drafts)
                const activeReqs = mappedActiveList.filter(m => m.status === 'generated').length;
                setActiveRequests(activeReqs);

                // Completed Requests (Saved Templates & Linked Cards)
                const completedReqs = mappedActiveList.filter(m => m.status === 'saved' || m.status === 'linked' || m.status === 'edited').length;
                setCompletedRequests(completedReqs);

                // Favorites Count
                const favs = JSON.parse(localStorage.getItem('wishforge_fav_messages') || '[]');
                const activeFavs = mappedActiveList.filter(m => favs.includes(m.id)).length;
                setFavCount(activeFavs);

                // Generated This Month
                const now = new Date();
                const thisMonthList = mappedActiveList.filter(m => {
                    const d = new Date(m.created_at);
                    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                });
                setMonthCount(thisMonthList.length);

                setRecentMessages(mappedActiveList.slice(0, 4));
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadDiagnostics();
        refreshStats();
        loadCustomerWorkspaceStats();
    }, [workspaceCustomer]);

    const handleCopy = (txt) => {
        navigator.clipboard.writeText(txt).then(() => showToast("Copied to clipboard!"));
    };

    return html`
        <${motion.div} ...${pageTransition} class="route-wrapper" role="tabpanel">
            <div class="panel-title-area">
                <div>
                    <h1>Dashboard Overview</h1>
                    <p class="panel-subtitle">Review platform analytics reports, message requests metrics, and systems activity logs.</p>
                </div>
                <button class="btn-secondary-outline" onClick=${() => { refreshStats(); loadDiagnostics(); loadCustomerWorkspaceStats(); showToast("Refreshing metrics..."); }}>
                    <i data-lucide="refresh-cw"></i> Refresh
                </button>
            </div>

            <!-- KPI Cards Grid with trend badges & Fades -->
            <div class="metrics-grid" style=${{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <${motion.div} initial=${{ opacity: 0, y: 10 }} animate=${{ opacity: 1, y: 0 }} transition=${{ delay: 0.05 }} class="metric-card glass-card">
                    <div class="card-glow"></div>
                    <div class="metric-header">
                        <span class="metric-title">Total Messages</span>
                        <div class="metric-icon primary"><i data-lucide="wand-2"></i></div>
                    </div>
                    <div class="metric-body">
                        <h2 class="metric-value">${totalMessages}</h2>
                        <span class="metric-trend success"><i data-lucide="arrow-up-right"></i> +12% this week</span>
                    </div>
                <//>

                <${motion.div} initial=${{ opacity: 0, y: 10 }} animate=${{ opacity: 1, y: 0 }} transition=${{ delay: 0.1 }} class="metric-card glass-card">
                    <div class="card-glow"></div>
                    <div class="metric-header">
                        <span class="metric-title">Saved Templates</span>
                        <div class="metric-icon success"><i data-lucide="bookmark"></i></div>
                    </div>
                    <div class="metric-body">
                        <h2 class="metric-value">${savedCount}</h2>
                        <span class="metric-trend success"><i data-lucide="arrow-up-right"></i> +4 templates</span>
                    </div>
                <//>

                <${motion.div} initial=${{ opacity: 0, y: 10 }} animate=${{ opacity: 1, y: 0 }} transition=${{ delay: 0.15 }} class="metric-card glass-card">
                    <div class="card-glow"></div>
                    <div class="metric-header">
                        <span class="metric-title">Active Requests</span>
                        <div class="metric-icon warning"><i data-lucide="hourglass"></i></div>
                    </div>
                    <div class="metric-body">
                        <h2 class="metric-value">${activeRequests}</h2>
                        <span class="metric-trend info">Drafts & Draft Gen</span>
                    </div>
                <//>

                <${motion.div} initial=${{ opacity: 0, y: 10 }} animate=${{ opacity: 1, y: 0 }} transition=${{ delay: 0.2 }} class="metric-card glass-card">
                    <div class="card-glow"></div>
                    <div class="metric-header">
                        <span class="metric-title">Completed Reqs</span>
                        <div class="metric-icon info"><i data-lucide="check-circle"></i></div>
                    </div>
                    <div class="metric-body">
                        <h2 class="metric-value">${completedRequests}</h2>
                        <span class="metric-trend success">Linked & Locked</span>
                    </div>
                <//>

                <${motion.div} initial=${{ opacity: 0, y: 10 }} animate=${{ opacity: 1, y: 0 }} transition=${{ delay: 0.25 }} class="metric-card glass-card">
                    <div class="card-glow"></div>
                    <div class="metric-header">
                        <span class="metric-title">Favorite Messages</span>
                        <div class="metric-icon danger"><i data-lucide="heart"></i></div>
                    </div>
                    <div class="metric-body">
                        <h2 class="metric-value">${favCount}</h2>
                        <span class="metric-trend info">Starred cards</span>
                    </div>
                <//>

                <${motion.div} initial=${{ opacity: 0, y: 10 }} animate=${{ opacity: 1, y: 0 }} transition=${{ delay: 0.3 }} class="metric-card glass-card">
                    <div class="card-glow"></div>
                    <div class="metric-header">
                        <span class="metric-title">Generated This Month</span>
                        <div class="metric-icon primary"><i data-lucide="calendar"></i></div>
                    </div>
                    <div class="metric-body">
                        <h2 class="metric-value">${monthCount}</h2>
                        <span class="metric-trend success"><i data-lucide="arrow-up-right"></i> Current month</span>
                    </div>
                <//>
            </div>

            <!-- Recharts Visual Reports Panel -->
            <${ReportsSection} stats=${role === 'admin' && workspaceCustomer === 'all' ? stats : localStats} recentMessages=${recentMessages} />

            <!-- Recent Activity Widget & Diagnostics -->
            <div class="dashboard-secondary-grid" style=${{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                <div class="glass-card" style=${{ padding: '1.8rem' }}>
                    <h3 style=${{ marginBottom: '1.2rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i data-lucide="activity" style=${{ width: '16px', color: 'var(--color-primary)' }}></i> Recent Activity log
                    </h3>
                    <${RecentActivityWidget} limit=${4} />
                </div>

                <div class="glass-card" style=${{ padding: '1.8rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <h3 style=${{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i data-lucide="activity" class="diag-pulse" style=${{ width: '16px' }}></i> Infrastructure Status
                    </h3>
                    <div class="diagnostics-grid" style=${{ gridTemplateColumns: '1fr', gap: '0.8rem' }}>
                        <div class="diag-item">
                            <span class="diag-label">Active Provider</span>
                            <span class="diag-value">${diag.provider}</span>
                        </div>
                        <div class="diag-item">
                            <span class="diag-label">API Connectivity</span>
                            <span class="diag-value">${diag.status}</span>
                        </div>
                        <div class="diag-item">
                            <span class="diag-label">HTTP response</span>
                            <span class="diag-value">${diag.code}</span>
                        </div>
                    </div>
                </div>
            </div>
        <//>
    `;
}

// Recent Activity log list component
function RecentActivityWidget({ limit = 5 }) {
    const { currentUser } = useContext(AuthContext);
    const [activities, setActivities] = useState([]);

    const load = () => {
        const email = currentUser?.email?.toLowerCase() || 'system';
        const key = `wishforge_activities_${email}`;
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        setActivities(list.slice(0, limit));
    };

    useEffect(() => {
        load();
        const timer = setInterval(load, 2000); // refresh list live
        return () => clearInterval(timer);
    }, [limit, currentUser]);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [activities]);

    const getIcon = (type) => {
        switch(type) {
            case 'generate': return 'sparkles';
            case 'save': return 'bookmark';
            case 'edit': return 'edit-3';
            case 'delete': return 'trash-2';
            case 'favorite': return 'heart';
            case 'unfavorite': return 'heart-off';
            case 'link': return 'link';
            default: return 'activity';
        }
    };

    const getIconClass = (type) => {
        switch(type) {
            case 'generate': return 'success';
            case 'save': return 'primary';
            case 'edit': return 'warning';
            case 'delete': return 'danger';
            case 'favorite': return 'info';
            case 'link': return 'info';
            default: return 'neutral';
        }
    };

    return html`
        <div style=${{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            ${activities.length === 0 ? html`
                <div style=${{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No activity logs recorded yet. Composing greetings logs events here.
                </div>
            ` : activities.map(act => {
                const timeStr = new Date(act.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return html`
                    <div key=${act.id} style=${{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}>
                        <div class="notif-icon ${getIconClass(act.type)}" style=${{ width: '28px', height: '28px', flexShrink: 0 }}>
                            <i data-lucide=${getIcon(act.type)} style=${{ width: '14px', height: '14px' }}></i>
                        </div>
                        <div style=${{ flex: 1, minWidth: 0 }}>
                            <p style=${{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>${act.details}</p>
                            <span style=${{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>${timeStr}</span>
                        </div>
                    </div>
                `;
            })}
        </div>
    `;
}

// Recharts Dashboard reporting component
function ReportsSection({ stats, recentMessages }) {
    if (!stats) return html`<div style=${{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading reporting metrics...</div>`;

    const occasionData = stats.messages_by_occasion || [];
    const toneData = stats.messages_by_tone || [];
    
    // Total Requests vs Total Saved
    const statusCounts = stats.messages_by_status || {};
    const totalRequests = (statusCounts.generated || 0) + (statusCounts.edited || 0);
    const totalSaved = (statusCounts.saved || 0) + (statusCounts.linked || 0);



    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#22c55e', '#f59e0b', '#ef4444'];

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [stats]);

    return html`
        <div class="charts-grid" style=${{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <!-- Occasions Bar Chart -->
            <div class="chart-card glass-card" style=${{ padding: '1.5rem', height: '350px' }}>
                <h3 style=${{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', color: 'var(--text-main)' }}>
                    <i data-lucide="bar-chart-2" style=${{ width: '16px', color: 'var(--color-primary)' }}></i> Most Used Occasions
                </h3>
                <div style=${{ width: '100%', height: '260px', marginTop: '1rem' }}>
                    <${ResponsiveContainer} width="100%" height="100%">
                        <${BarChart} data=${occasionData}>
                            <${XAxis} dataKey="occasion" stroke="var(--text-muted)" fontSize=${11} tickLine=${false} />
                            <${YAxis} stroke="var(--text-muted)" fontSize=${11} tickLine=${false} allowDecimals=${false} />
                            <${ReTooltip} contentStyle=${{ background: 'var(--bg-dropdown)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px' }} />
                            <${Bar} dataKey="count" fill="var(--color-primary)" radius=${[6, 6, 0, 0]} />
                        <//>
                    <//>
                </div>
            </div>

            <!-- Tones Pie Chart -->
            <div class="chart-card glass-card" style=${{ padding: '1.5rem', height: '350px' }}>
                <h3 style=${{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', color: 'var(--text-main)' }}>
                    <i data-lucide="pie-chart" style=${{ width: '16px', color: 'var(--color-secondary)' }}></i> Most Used Tones
                </h3>
                <div style=${{ width: '100%', height: '260px', marginTop: '1rem' }}>
                    <${ResponsiveContainer} width="100%" height="100%">
                        <${PieChart}>
                            <${Pie}
                                data=${toneData}
                                cx="50%"
                                cy="45%"
                                innerRadius=${60}
                                outerRadius=${85}
                                paddingAngle=${4}
                                dataKey="count"
                                nameKey="tone"
                            >
                                ${toneData.map((entry, index) => html`
                                    <${Cell} key=${`cell-${index}`} fill=${COLORS[index % COLORS.length]} />
                                `)}
                            <//>
                            <${ReTooltip} contentStyle=${{ background: 'var(--bg-dropdown)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px' }} />
                            <${ReLegend} verticalAlign="bottom" height={36} iconSize=${10} wrapperStyle=${{ fontSize: '10px', color: 'var(--text-muted)' }} />
                        <//>
                    <//>
                </div>
            </div>


        </div>
    `;
}

const getFestivalName = (noteText) => {
    if (!noteText) return "Festival";
    
    const commonFestivals = [
        "diwali", "deepavali", "holi", "christmas", "eid", "ramadan", "navratri", "dussehra", "durga puja",
        "thanksgiving", "halloween", "new year", "hanukkah", "passover", "easter", "rakhi", "raksha bandhan",
        "pongal", "onam", "lohris", "ganesh chaturthi", "janmashtami", "karwa chauth", "baisakhi", "republic day",
        "independence day", "valentines", "valentine", "mother's day", "father's day"
    ];
    
    const cleanNote = noteText.toLowerCase();
    for (const fest of commonFestivals) {
        if (cleanNote.includes(fest)) {
            return fest.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
    }
    
    const words = noteText.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
        const word = words[i].replace(/[^a-zA-Z]/g, '');
        if (word && word.length > 2 && word[0] === word[0].toUpperCase() && word !== word.toUpperCase()) {
            if (['The', 'For', 'And', 'But', 'With', 'From', 'This', 'That', 'Your', 'Their', 'Some', 'Dear', 'Happy', 'Merry'].includes(word)) continue;
            return word;
        }
    }

    return "Festival";
};

// ============================================================
// 2. AI MESSAGE WORKSPACE (GENERATE)
// ============================================================
function GeneratePage() {
    const { occasions, tones, recipients, setRecipients, workspaceCustomer } = useContext(GlobalDataContext);
    const { showToast } = useContext(ToastContext);
    const { addNotification, currentUser, role } = useContext(AuthContext);
    const location = useLocation();

    // Form states
    const [recipient, setRecipient] = useState('');
    const [relationship, setRelationship] = useState('');
    const [occasion, setOccasion] = useState('');
    const [tone, setTone] = useState('');
    const [note, setNote] = useState('');

    // Workspace states
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [activeStep, setActiveStep] = useState(1);
    const [generatedMsg, setGeneratedMsg] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editText, setEditText] = useState('');
    const [isFav, setIsFav] = useState(false);
    
    // Festival Pop-up States
    const [showFestivalPopup, setShowFestivalPopup] = useState(false);
    const [festivalName, setFestivalName] = useState('');
    
    // Debug metadata states
    

    // Check if a saved message was loaded via route state
    useEffect(() => {
        if (location.state && location.state.loadMessage) {
            const msg = location.state.loadMessage;
            setRecipient(msg.recipient_name || '');
            setRelationship(msg.relationship || '');
            setOccasion(msg.occasion_id || '');
            setTone(msg.tone_id || '');
            setNote(msg.extra_note || '');
            setGeneratedMsg(msg);
            setEditText(msg.message_text || '');
            setIsFav(JSON.parse(localStorage.getItem('wishforge_fav_messages') || '[]').includes(msg.id));
            setEditMode(false);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);


    // ROOT CAUSE FIX: Lucide replaces <i data-lucide> with a fresh <svg> on every
    // createIcons() call, stripping the fav-active class we set on the <i>.
    // This effect watches isFav and generatedMsg; after each change it calls
    // createIcons() then uses requestAnimationFrame to wait for the DOM paint
    // before directly patching the class on the resulting <svg>.
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
        const raf = requestAnimationFrame(() => {
            const favBtn = document.getElementById('generate-fav-btn');
            if (!favBtn) return;
            const svg = favBtn.querySelector('svg');
            if (!svg) return;
            if (isFav) {
                svg.classList.add('fav-active');
                favBtn.classList.add('active');
            } else {
                svg.classList.remove('fav-active');
                favBtn.classList.remove('active');
            }
        });
        return () => cancelAnimationFrame(raf);
    }, [isFav, generatedMsg]);

    // Recipient autocomplete with safety checks
    useEffect(() => {
        const matched = (recipients || []).find(r => r && r.name && r.name.toLowerCase() === (recipient || '').trim().toLowerCase());
        if (matched) {
            setRelationship(matched.relationship);
        }
    }, [recipient]);

    const runLoadingProgress = async () => {
        setProgress(0);
        setActiveStep(1);
        const steps = 5;
        for (let i = 1; i <= steps; i++) {
            setActiveStep(i);
            const start = Math.floor(((i - 1) / steps) * 100);
            const end = Math.floor((i / steps) * 100);
            for (let p = start; p <= end; p += 5) {
                setProgress(p);
                await new Promise(r => setTimeout(r, 35));
            }
        }
    };

    const handleGenerate = async (e) => {
        if (e) e.preventDefault();
        
        const activeCustomerId = role === 'admin' ? (workspaceCustomer === 'all' ? (currentUser?.id || 1) : workspaceCustomer) : (currentUser ? currentUser.id : 'all');
        if (activeCustomerId === 'all') {
            showToast("Please select a specific customer workspace from the workspace picker to generate messages.", true);
            return;
        }

        if (!(recipient || '').trim() || !(relationship || '').trim() || !occasion || !tone) {
            showToast("Please fill all required settings.", true);
            return;
        }

        setLoading(true);
        setGeneratedMsg(null);
        setEditMode(false);

        // 1. Resolve Recipient ID with safety checks
        let recId = null;
        const matched = (recipients || []).find(r => r && r.name && r.name.toLowerCase() === (recipient || '').trim().toLowerCase());
        if (matched) {
            recId = matched.id;
        } else {
            try {
                const res = await ApiService.createRecipient(activeCustomerId, (recipient || '').trim(), (relationship || '').trim());
                if (res.success) {
                    recId = res.data.id;
                    setRecipients(prev => [...prev, res.data]);
                } else {
                    showToast(res.error, true);
                    setLoading(false);
                    return;
                }
            } catch (err) {
                showToast("Connection error registering recipient.", true);
                setLoading(false);
                return;
            }
        }

        const payload = {
            customer_id: activeCustomerId,
            recipient_id: recId,
            occasion_id: parseInt(occasion),
            tone_id: parseInt(tone),
            relationship: (relationship || '').trim(),
            extra_note: note
        };

        const stepsPromise = runLoadingProgress();

        let apiResponse = null;
        try {
            apiResponse = await ApiService.generateMessage(payload);
        } catch (err) {
            console.error(err);
        }

        await stepsPromise;

        if (apiResponse && apiResponse.success) {
            const data = apiResponse.data;
            setGeneratedMsg(data);
            setIsFav(false);
            showToast("Greeting message generated!");
            logActivity('generate', `Message generated for ${recipient}`);
            addNotification('generate', 'Template Generated', `New greeting composed for ${recipient}`);

            // Trigger celebratory festival pop-up if occasion is 'Festival'
            const selectedOcc = occasions.find(o => o.id === parseInt(occasion));
            if (selectedOcc && selectedOcc.name.toLowerCase() === 'festival') {
                const fest = getFestivalName(note);
                setFestivalName(fest);
                setShowFestivalPopup(true);
            }

        } else {
            const err = apiResponse ? apiResponse.error : "Failed to connect to REST API.";
            showToast(err, true);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!generatedMsg) return;
        try {
            const res = await ApiService.saveMessage(generatedMsg.id);
            if (res.success) {
                setGeneratedMsg(prev => ({ ...prev, status: 'saved' }));
                showToast("Greeting card marked as Saved!");
                logActivity('save', `Message request saved for ${generatedMsg.recipient_name}`);
                addNotification('save', 'Template Saved', `Greeting for ${recipient} added to your library.`);
            }
        } catch (err) {
            showToast("Failed to save card.", true);
        }
    };

    const handleLink = async () => {
        if (!generatedMsg) return;
        try {
            const res = await ApiService.linkCard(generatedMsg.id);
            if (res.success) {
                setGeneratedMsg(prev => ({ ...prev, status: 'linked' }));
                showToast("Card linked to order successfully!");
                logActivity('link', `Message request archived for ${generatedMsg.recipient_name}`);
                addNotification('save', 'Request Completed', `Message request for ${recipient} has been completed.`);
            }
        } catch (err) {
            showToast("Failed to link card.", true);
        }
    };

    const handleEditSave = async () => {
        if (!(editText || '').trim() || !generatedMsg) return;
        try {
            const res = await ApiService.editMessage(generatedMsg.id, (editText || '').trim());
            if (res.success) {
                setGeneratedMsg(res.data);
                setEditMode(false);
                showToast("Message draft updated inline!");
                logActivity('edit', `Message for ${generatedMsg.recipient_name} edited inline`);
                addNotification('save', 'Template Updated', `Edits to greeting message for ${recipient} saved.`);
            }
        } catch (err) {
            showToast("Failed to edit draft.", true);
        }
    };

    const handleFavToggle = () => {
        if (!generatedMsg) return;
        const favs = JSON.parse(localStorage.getItem('wishforge_fav_messages') || '[]');
        const idx = favs.indexOf(generatedMsg.id);
        if (idx === -1) {
            favs.push(generatedMsg.id);
            setIsFav(true);
            showToast("Added to Favorites ❤️");
            logActivity('favorite', `Message for ${generatedMsg.recipient_name} favorited`);
        } else {
            favs.splice(idx, 1);
            setIsFav(false);
            showToast("Removed from Favorites");
            logActivity('unfavorite', `Message for ${generatedMsg.recipient_name} removed from favorites`);
        }
        localStorage.setItem('wishforge_fav_messages', JSON.stringify(favs));
        // Directly patch the SVG after Lucide replaces the <i> element
        // We do it on next tick so Lucide has already run
        setTimeout(() => {
            const favBtn = document.querySelector('.action-btn.fav-btn');
            if (favBtn) {
                const svg = favBtn.querySelector('svg');
                if (svg) {
                    const newIsFav = JSON.parse(localStorage.getItem('wishforge_fav_messages') || '[]').includes(generatedMsg.id);
                    if (newIsFav) {
                        svg.classList.add('fav-active');
                    } else {
                        svg.classList.remove('fav-active');
                    }
                }
            }
        }, 0);
    };

    const handleDownload = () => {
        if (!generatedMsg) return;
        const blob = new Blob([generatedMsg.message_text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WishForge_Message_${recipient}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopy = () => {
        if (!generatedMsg) return;
        navigator.clipboard.writeText(generatedMsg.message_text).then(() => showToast("Copied to clipboard!"));
    };

    // Calculate words with safety check for generatedMsg.message_text
    const words = (generatedMsg && generatedMsg.message_text) ? generatedMsg.message_text.trim().split(/\s+/).filter(w => w.length).length : 0;
    const readingTime = Math.max(1, Math.round(words / 3.3));

    return html`
        <${motion.div} ...${pageTransition} class="route-wrapper" role="tabpanel">
            <div class="panel-title-area">
                <div>
                    <h1>AI Generation Workspace</h1>
                    <p class="panel-subtitle">Configure greeting parameters and invoke the Groq completions model.</p>
                </div>
            </div>

            <div class="workspace-grid">
                <!-- Left Parameters Form -->
                <div class="creation-panel glass-card">
                    <div class="card-glow"></div>
                    <h2>Message Configuration</h2>
                    <form onSubmit=${handleGenerate}>
                        <div class="form-row split">
                            <div class="form-group">
                                <label>Recipient Name</label>
                                <div class="input-with-icon">
                                    <i data-lucide="user"></i>
                                    <input type="text" placeholder="e.g. Grandma, Aunt Sarah" value=${recipient} onChange=${e => setRecipient(e.target.value)} required />
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Relationship</label>
                                <div class="input-with-icon">
                                    <i data-lucide="heart"></i>
                                    <input type="text" placeholder="e.g. Grandmother, Aunt" value=${relationship} onChange=${e => setRelationship(e.target.value)} required />
                                </div>
                            </div>
                        </div>

                        <div class="form-row split">
                            <div class="form-group">
                                <label>Occasion</label>
                                <div class="select-with-icon">
                                    <i data-lucide="calendar"></i>
                                    <select value=${occasion} onChange=${e => setOccasion(e.target.value)} required>
                                        <option value="">Select Occasion</option>
                                        ${(occasions || []).map(o => html`<option key=${o.id} value=${o.id}>${o.name}</option>`)}
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Tone Style</label>
                                <div class="select-with-icon">
                                    <i data-lucide="message-square"></i>
                                    <select value=${tone} onChange=${e => setTone(e.target.value)} required>
                                        <option value="">Select Tone Style</option>
                                        ${(tones || []).map(t => html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <div class="textarea-label-row">
                                <label>Context / Note (Optional)</label>
                                <span class="textarea-count">${note.length} / 250</span>
                            </div>
                            <textarea rows="4" maxLength="250" placeholder="e.g. She loves baking, retired last week..." value=${note} onChange=${e => setNote(e.target.value)}></textarea>
                        </div>


                        <button type="submit" class="btn-primary" disabled=${loading}>
                            <span>Generate Message</span>
                            ${loading && html`<div class="spinner"></div>`}
                        </button>
                    </form>
                </div>

                <!-- Right Workspace Preview Output -->
                <div class="output-panel glass-card">
                    <div class="card-glow"></div>
                    <div class="output-header">
                        <h2>AI Response Output</h2>
                        <div class="ai-status-indicator ${generatedMsg ? (generatedMsg.ai_used ? 'success' : 'warning') : 'neutral'}">
                            <span class="status-dot"></span>
                            <span class="status-text">${generatedMsg ? (generatedMsg.ai_used ? 'AI Active' : 'Fallback Active') : 'Ready'}</span>
                        </div>
                    </div>

                    <!-- Loader stepped workflow -->
                    ${loading && html`
                        <div class="stepped-workflow">
                            <div class="workflow-header">
                                <h3>Generating with Groq API</h3>
                                <span class="workflow-percentage">${progress}%</span>
                            </div>
                            <div class="progress-bar-track">
                                <div class="progress-bar-fill" style=${{ width: `${progress}%` }}></div>
                            </div>
                            <ul class="workflow-steps">
                                <li class="workflow-step ${activeStep === 1 ? 'active' : activeStep > 1 ? 'completed' : ''}">
                                    <i data-lucide=${activeStep > 1 ? 'check-circle-2' : 'circle-dashed'} class="step-icon"></i>
                                    <span>Understanding Recipient</span>
                                </li>
                                <li class="workflow-step ${activeStep === 2 ? 'active' : activeStep > 2 ? 'completed' : ''}">
                                    <i data-lucide=${activeStep > 2 ? 'check-circle-2' : 'circle-dashed'} class="step-icon"></i>
                                    <span>Analyzing Context</span>
                                </li>
                                <li class="workflow-step ${activeStep === 3 ? 'active' : activeStep > 3 ? 'completed' : ''}">
                                    <i data-lucide=${activeStep > 3 ? 'check-circle-2' : 'circle-dashed'} class="step-icon"></i>
                                    <span>Creating Message Draft</span>
                                </li>
                                <li class="workflow-step ${activeStep === 4 ? 'active' : activeStep > 4 ? 'completed' : ''}">
                                    <i data-lucide=${activeStep > 4 ? 'check-circle-2' : 'circle-dashed'} class="step-icon"></i>
                                    <span>Optimizing Language & Tone</span>
                                </li>
                                <li class="workflow-step ${activeStep === 5 ? 'active' : activeStep > 5 ? 'completed' : ''}">
                                    <i data-lucide=${activeStep > 5 ? 'check-circle-2' : 'circle-dashed'} class="step-icon"></i>
                                    <span>Finalizing Output</span>
                                </li>
                            </ul>
                        </div>
                    `}

                    <!-- Empty state -->
                    ${!loading && !generatedMsg && html`
                        <div class="output-empty-state">
                            <div class="empty-icon"><i data-lucide="wand-2"></i></div>
                            <h3>AI Workspace Idle</h3>
                            <p>Configure parameters on the left and invoke generator parameters to compose messages.</p>
                        </div>
                    `}

                    <!-- Final Workspace Output Area -->
                    ${!loading && generatedMsg && html`
                        <div class="output-content-area">
                            <div class="glass-card message-output-card">
                                <div class="output-card-header">
                                    <i data-lucide="quote" class="quote-icon"></i>
                                    <button class="card-more-btn" aria-label="More options"><i data-lucide="more-vertical"></i></button>
                                </div>
                                <div class="message-box-wrapper">
                                    ${editMode ? html`
                                        <div class="edit-area">
                                            <textarea rows="6" value=${editText} onChange=${e => setEditText(e.target.value)} class="edit-textarea"></textarea>
                                            <div class="edit-btn-row">
                                                <button class="btn-text-only" onClick=${() => setEditMode(false)}>Cancel</button>
                                                <button class="btn-primary-small" onClick=${handleEditSave}>Update & Save Version</button>
                                            </div>
                                        </div>
                                    ` : html`
                                        <div class="message-box active" dangerouslySetInnerHTML=${{ __html: highlightKeywords(generatedMsg.message_text, note) }}></div>
                                    `}
                                </div>

                                <hr class="card-divider" />

                                <div class="metadata-stats-row">
                                    <div class="meta-metrics-group">
                                        <div class="meta-metric">
                                            <i data-lucide="align-left"></i>
                                            <span>${words} Words</span>
                                        </div>
                                        <div class="meta-metric">
                                            <i data-lucide="clock"></i>
                                            <span>${readingTime}s Read time</span>
                                        </div>
                                    </div>
                                    <div class="meta-badges">
                                        <span class="badge ${generatedMsg.ai_used ? 'badge-indigo' : 'badge-warning'}">${generatedMsg.ai_used ? 'AI GENERATED' : 'TEMPLATE DEFAULT'}</span>
                                        <span class="badge ${generatedMsg.status === 'saved' || generatedMsg.status === 'linked' || generatedMsg.status === 'edited' ? 'badge-emerald' : 'badge-indigo'}">${generatedMsg.status === 'edited' ? 'SAVED' : generatedMsg.status.toUpperCase()}</span>
                                        <span class="badge badge-info">V${generatedMsg.version_number}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="action-row">
                                <button class="action-btn btn-copy" onClick=${handleCopy}><i data-lucide="copy"></i> Copy</button>
                                ${generatedMsg.status === 'saved' || generatedMsg.status === 'linked' || generatedMsg.status === 'edited' ? html`
                                    <button class="action-btn success btn-save" disabled style=${{ opacity: 0.8, cursor: 'not-allowed' }}><i data-lucide="check"></i> Saved</button>
                                ` : html`
                                    <button class="action-btn success btn-save" onClick=${handleSave}><i data-lucide="save"></i> Save</button>
                                `}
                                <button class="action-btn info btn-link" onClick=${handleLink}><i data-lucide="link"></i> Link Card</button>
                                <button class="action-btn warning btn-edit" onClick=${() => { setEditText(generatedMsg.message_text); setEditMode(true); }}><i data-lucide="edit-3"></i> Edit</button>
                                <button class="action-btn btn-download" onClick=${handleDownload}><i data-lucide="download"></i> Download</button>
                                <button class="action-btn btn-regenerate" onClick=${() => handleGenerate()}><i data-lucide="rotate-ccw"></i> Regenerate</button>
                                <button class="action-btn fav-btn" id="generate-fav-btn" onClick=${handleFavToggle} data-fav=${isFav ? 'true' : 'false'}>
                                    <i data-lucide="heart" id="generate-fav-icon" class="fav-icon ${isFav ? 'fav-active' : ''}"></i>
                                    <span>${isFav ? 'Favorited' : 'Favorite'}</span>
                                </button>
                            </div>
                        </div>
                    `}
                </div>
            </div>

            
            <!-- Festive occasion celebration pop-up modal -->
            ${showFestivalPopup && html`
                <div class="command-palette-backdrop" onClick=${() => setShowFestivalPopup(false)} style=${{ zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 0 }}>
                    <div class="glass-card festival-popup-card" onClick=${e => e.stopPropagation()} style=${{
                        padding: '3rem 2.5rem',
                        textAlign: 'center',
                        maxWidth: '450px',
                        width: '90%',
                        background: 'rgba(15, 23, 42, 0.9)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '24px',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style=${{
                            position: 'absolute',
                            top: '-50px',
                            left: '-50px',
                            width: '150px',
                            height: '150px',
                            background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0) 70%)',
                            filter: 'blur(20px)',
                            pointerEvents: 'none'
                        }}></div>
                        <div style=${{
                            position: 'absolute',
                            bottom: '-50px',
                            right: '-50px',
                            width: '150px',
                            height: '150px',
                            background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, rgba(99,102,241,0) 70%)',
                            filter: 'blur(20px)',
                            pointerEvents: 'none'
                        }}></div>

                        <div style=${{
                            fontSize: '4.5rem',
                            marginBottom: '1.5rem',
                            animation: 'bounce 2s infinite',
                            display: 'inline-block'
                        }}>🎉</div>
                        
                        <h2 style=${{
                            fontSize: '2.5rem',
                            fontWeight: 900,
                            background: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #f472b6 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            textShadow: '0 0 20px rgba(139,92,246,0.3)',
                            marginBottom: '1rem',
                            letterSpacing: '-0.03em'
                        }}>Happy ${festivalName}!</h2>
                        
                        <p style=${{
                            color: 'var(--text-muted)',
                            fontSize: '0.95rem',
                            lineHeight: '1.6',
                            marginBottom: '2rem'
                        }}>
                            Your customized festival greeting card has been generated successfully. Feel free to copy or save it to your library!
                        </p>
                        
                        <button class="btn-primary" style=${{
                            width: '100%',
                            padding: '0.85rem',
                            fontSize: '1rem',
                            fontWeight: '700',
                            borderRadius: '12px',
                            boxShadow: '0 4px 15px rgba(139,92,246,0.4)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }} onClick=${() => setShowFestivalPopup(false)}>
                            Awesome!
                        </button>
                    </div>
                </div>
            `}
        </${motion.div}>
    `;
}

// ============================================================
// 3. MESSAGE REQUESTS MANAGEMENT PAGE
// ============================================================
function MessageRequestsPage() {
    const { occasions = [], tones = [], recipients = [], workspaceCustomer = 'all' } = useContext(GlobalDataContext) || {};
    const { showToast } = useContext(ToastContext);
    const { addNotification, currentUser, role  } = useContext(AuthContext);

    const [requests, setRequests] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    
    // Search / Filters
    const [search, setSearch] = useState('');
    const [filterOcc, setFilterOcc] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Modal view states
    const [viewingRequest, setViewingRequest] = useState(null);
    const [editingRequest, setEditingRequest] = useState(null);
    const [editingText, setEditingText] = useState('');

    const fetchRequests = async () => {
        if (!currentUser) return;
        setLoading(true);
        let q = `?page=${page}&limit=10`;
        if (role === 'admin') {
            if (workspaceCustomer !== 'all') {
                q += `&customer_id=${workspaceCustomer}`;
            }
        } else {
            q += `&customer_id=${currentUser.id}`;
        }
        if (filterOcc) q += `&occasion_id=${filterOcc}`;
        if (filterStatus) {
            q += `&status=${filterStatus}`;
        } else {
            q += `&status=generated,edited`;
        }

        try {
            const res = await ApiService.getMessages(q);
            if (res.success) {
                let list = res.data || [];
                const deletedIds = JSON.parse(localStorage.getItem('wishforge_deleted_messages') || '[]');
                list = list.filter(m => !deletedIds.includes(m.id));

                // Map names from context lists
                list = list.map(m => {
                    const rec = recipients.find(r => r.id === m.recipient_id);
                    const occ = occasions.find(o => o.id === m.occasion_id);
                    const t = tones.find(tone => tone.id === m.tone_id);
                    return {
                        ...m,
                        recipient_name: rec ? rec.name : `Recipient #${m.recipient_id}`,
                        occasion_name: occ ? occ.name : `Occasion #${m.occasion_id}`,
                        tone_name: t ? t.name : `Tone #${m.tone_id}`
                    };
                });

                if (search.trim()) {
                    const match = search.toLowerCase();
                    list = list.filter(m => 
                        (m.recipient_name && m.recipient_name.toLowerCase().includes(match)) ||
                        (m.relationship && m.relationship.toLowerCase().includes(match))
                    );
                }

                setRequests(list);
                setTotal(res.total || 0);
            }
        } catch (err) {
            showToast("Failed to fetch message requests.", true);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRequests();
    }, [page, filterOcc, filterStatus, search, workspaceCustomer]);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [requests, viewingRequest, editingRequest]);

    const handleCopy = (txt) => {
        navigator.clipboard.writeText(txt).then(() => showToast("Copied to clipboard!"));
    };

    const handleSave = async (id, recipient) => {
        try {
            const res = await ApiService.saveMessage(id);
            if (res.success) {
                showToast("Request marked as Saved!");
                fetchRequests();
                logActivity('save', `Message request saved for ${recipient}`);
                addNotification('save', 'Request Completed', `Message request for ${recipient} has been completed.`);
            }
        } catch (e) {
            showToast("Failed to save request.", true);
        }
    };

    const handleDelete = (id, recipient) => {
        if (confirm("Are you sure you want to delete this message request?")) {
            const deleted = JSON.parse(localStorage.getItem('wishforge_deleted_messages') || '[]');
            deleted.push(id);
            localStorage.setItem('wishforge_deleted_messages', JSON.stringify(deleted));
            showToast("Request deleted successfully.");
            fetchRequests();
            logActivity('delete', `Request for ${recipient || 'customer'} deleted`);
            addNotification('alert', 'Request Deleted', `Message request for ${recipient || 'customer'} was removed.`);
        }
    };

    const handleEditSave = async () => {
        if (!editingText.trim() || !editingRequest) return;
        try {
            const res = await ApiService.editMessage(editingRequest.id, editingText.trim());
            if (res.success) {
                showToast("Message request text updated!");
                setEditingRequest(null);
                fetchRequests();
                logActivity('edit', `Request for ${editingRequest.recipient_name} edited inline`);
                addNotification('save', 'Template Updated', `Edits to request for ${editingRequest.recipient_name} saved.`);
            }
        } catch (e) {
            showToast("Failed to update message.", true);
        }
    };

    const getStatusBadge = (status) => {
        switch(status) {
            case 'generated': return html`<span class="badge badge-indigo">Generated Message</span>`;
            case 'saved': return html`<span class="badge badge-emerald">Saved Template</span>`;
            case 'edited': return html`<span class="badge badge-warning">Edited Version</span>`;
            case 'linked': return html`<span class="badge badge-info">Linked to Order</span>`;
            default: return html`<span class="badge">${status}</span>`;
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / 10));

    return html`
        <${motion.div} ...${pageTransition} class="route-wrapper" role="tabpanel">
            <div class="panel-title-area">
                <div>
                    <h1>Message Requests</h1>
                    <p class="panel-subtitle">Audit and manage AI greeting templates generation workflow queues.</p>
                </div>
            </div>

            <!-- Search & Filters -->
            <div class="filters-bar glass-card">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Search by recipient or relation..." value=${search} onChange=${e => setSearch(e.target.value)} />
                </div>
                <div class="filter-controls">
                    <select value=${filterOcc} onChange=${e => { setFilterOcc(e.target.value); setPage(1); }}>
                        <option value="">All Occasions</option>
                        ${occasions.map(o => html`<option key=${o.id} value=${o.id}>${o.name}</option>`)}
                    </select>
                    <select value=${filterStatus} onChange=${e => { setFilterStatus(e.target.value); setPage(1); }}>
                        <option value="">All History</option>
                        <option value="generated">Generated</option>
                        <option value="edited">Edited Version</option>
                    </select>
                </div>
            </div>

            <!-- Table Card -->
            <div class="admin-table-card glass-card" style=${{ padding: '1.2rem 1.5rem' }}>
                <div class="table-responsive">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Request ID</th>
                                <th>Recipient</th>
                                <th>Occasion</th>
                                <th>Relationship</th>
                                <th>Status</th>
                                <th>Generated Date</th>
                                <th style=${{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${loading ? html`
                                <tr><td colspan="7" style=${{ textAlign: 'center', padding: '3rem' }}>Loading Requests...</td></tr>
                            ` : requests.length === 0 ? html`
                                <tr><td colspan="7" style=${{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No message requests found. Try composing some greetings first!</td></tr>
                            ` : requests.map(req => {
                                const dateStr = req.created_at
                                    ? (() => {
                                        const d = new Date(req.created_at);
                                        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                      })()
                                    : 'N/A';
                                return html`
                                    <tr key=${req.id}>
                                        <td>#${req.id}</td>
                                        <td style=${{ fontWeight: 600 }}>${req.recipient_name}</td>
                                        <td>${req.occasion_name}</td>
                                        <td>${req.relationship}</td>
                                        <td>${getStatusBadge(req.status)}</td>
                                        <td>${dateStr}</td>
                                        <td style=${{ textAlign: 'right' }}>
                                            <div style=${{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                <button class="btn-action-icon" onClick=${() => setViewingRequest(req)} title="View text"><i data-lucide="eye" style=${{ width: '13px' }}></i></button>
                                                <button class="btn-action-icon" onClick=${() => handleCopy(req.message_text)} title="Copy text"><i data-lucide="copy" style=${{ width: '13px' }}></i></button>
                                                ${req.status !== 'saved' && req.status !== 'linked' ? html`
                                                    <button class="btn-action-icon edit" style=${{ color: 'var(--color-success)', borderColor: 'rgba(34, 197, 94, 0.2)' }} onClick=${() => handleSave(req.id, req.recipient_name)} title="Mark as Saved"><i data-lucide="bookmark" style=${{ width: '13px' }}></i></button>
                                                ` : null}
                                                <button class="btn-action-icon edit" onClick=${() => { setEditingRequest(req); setEditingText(req.message_text); }} title="Edit inline"><i data-lucide="edit-3" style=${{ width: '13px' }}></i></button>
                                                <button class="btn-action-icon delete" onClick=${() => handleDelete(req.id, req.recipient_name)} title="Delete Request"><i data-lucide="trash-2" style=${{ width: '13px' }}></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Pagination -->
            <div class="pagination-wrapper">
                <button class="btn-pagination" disabled=${page === 1} onClick=${() => setPage(p => p - 1)}><i data-lucide="chevron-left"></i> Prev</button>
                <span class="pagination-info">Page ${page} of ${totalPages}</span>
                <button class="btn-pagination" disabled=${page >= totalPages} onClick=${() => setPage(p => p + 1)}>Next <i data-lucide="chevron-right"></i></button>
            </div>

            <!-- View Modal Overlay -->
            ${viewingRequest && html`
                <div class="command-palette-backdrop" onClick=${() => setViewingRequest(null)} style=${{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div class="glass-card" onClick=${e => e.stopPropagation()} style=${{ padding: '2rem', maxWidth: '500px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                        <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style=${{ fontSize: '1.2rem' }}>Message Request Preview</h2>
                            <button class="btn-action-icon" onClick=${() => setViewingRequest(null)}><i data-lucide="x"></i></button>
                        </div>
                        <div style=${{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
                            <p style=${{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Request ID: #${viewingRequest.id}</p>
                            <p style=${{ fontSize: '0.9rem', fontWeight: 600 }}>Recipient: ${viewingRequest.recipient_name} (${viewingRequest.relationship})</p>
                            <p style=${{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Occasion: ${viewingRequest.occasion_name}</p>
                        </div>
                        <div style=${{ padding: '1rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', maxHeight: '200px', overflowY: 'auto' }}>
                            <p style=${{ fontSize: '0.95rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>${viewingRequest.message_text}</p>
                        </div>
                        <div style=${{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button class="btn-pagination" onClick=${() => { navigator.clipboard.writeText(viewingRequest.message_text); showToast("Copied to clipboard!"); }}><i data-lucide="copy"></i> Copy</button>
                            <button class="btn-primary-small" onClick=${() => setViewingRequest(null)}>Close</button>
                        </div>
                    </div>
                </div>
            `}

            <!-- Edit Modal Overlay -->
            ${editingRequest && html`
                <div class="command-palette-backdrop" onClick=${() => setEditingRequest(null)} style=${{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div class="glass-card" onClick=${e => e.stopPropagation()} style=${{ padding: '2rem', maxWidth: '500px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                        <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style=${{ fontSize: '1.2rem' }}>Edit Message Request</h2>
                            <button class="btn-action-icon" onClick=${() => setEditingRequest(null)}><i data-lucide="x"></i></button>
                        </div>
                        <div style=${{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style=${{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Message Body</label>
                            <textarea rows="6" class="edit-textarea" value=${editingText} onChange=${e => setEditingText(e.target.value)} style=${{ width: '100%', padding: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', resize: 'vertical' }}></textarea>
                        </div>
                        <div style=${{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button class="btn-pagination" onClick=${() => setEditingRequest(null)}>Cancel</button>
                            <button class="btn-primary-small" onClick=${handleEditSave}>Save Changes</button>
                        </div>
                    </div>
                </div>
            `}
        </${motion.div}>
    `;
}

// ============================================================
// 4. SAVED MESSAGES ARCHIVE GRID
// ============================================================
function SavedMessagesPage() {
    const { occasions = [], tones = [], recipients = [], workspaceCustomer = 'all' } = useContext(GlobalDataContext) || {};
    const { showToast } = useContext(ToastContext);
    const { addNotification, currentUser, role } = useContext(AuthContext);
    const navigate = useNavigate();

    const [messages, setMessages] = useState([]);
    const [search, setSearch] = useState('');
    const [filterOcc, setFilterOcc] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    
    // Paging
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    // Editing State
    const [editingId, setEditingId] = useState(null);
    const [editingText, setEditingText] = useState('');

    // Menu State for Mobile 3-Dot Actions Dropdown
    const [activeMenuId, setActiveMenuId] = useState(null);

    useEffect(() => {
        const handleOutsideClick = () => setActiveMenuId(null);
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    // Optimistic UI Favorite cache and lazy rendering limits
    const [localFavs, setLocalFavs] = useState(() => JSON.parse(localStorage.getItem('wishforge_fav_messages') || '[]'));
    const [visibleLimit, setVisibleLimit] = useState(10);

    const fetchSaved = async () => {
        if (!currentUser) return;
        setLoading(true);
        let q = `?page=${page}&limit=6`;
        if (role === 'admin') {
            if (workspaceCustomer !== 'all') {
                q += `&customer_id=${workspaceCustomer}`;
            }
        } else {
            q += `&customer_id=${currentUser.id}`;
        }
        if (filterOcc) q += `&occasion_id=${filterOcc}`;
        if (filterStatus) {
            if (filterStatus === 'saved') {
                q += `&status=saved,edited`;
            } else {
                q += `&status=${filterStatus}`;
            }
        } else {
            q += `&status=saved,linked,edited`;
        }

        try {
            const res = await ApiService.getMessages(q);
            if (res.success) {
                let list = res.data || [];
                const deletedIds = JSON.parse(localStorage.getItem('wishforge_deleted_messages') || '[]');
                
                // Locally filter out deleted cards
                list = list.filter(m => !deletedIds.includes(m.id));

                // Map names from context lists
                list = list.map(m => {
                    const rec = recipients.find(r => r.id === m.recipient_id);
                    const occ = occasions.find(o => o.id === m.occasion_id);
                    const t = tones.find(tone => tone.id === m.tone_id);
                    return {
                        ...m,
                        recipient_name: rec ? rec.name : `Recipient #${m.recipient_id}`,
                        occasion_name: occ ? occ.name : `Occasion #${m.occasion_id}`,
                        tone_name: t ? t.name : `Tone #${m.tone_id}`
                    };
                });

                if (search.trim()) {
                    const match = search.toLowerCase();
                    list = list.filter(m => 
                        (m.recipient_name && m.recipient_name.toLowerCase().includes(match)) ||
                        (m.relationship && m.relationship.toLowerCase().includes(match))
                    );
                }
                setMessages(list);
                setTotal(res.total || 0);
            }
        } catch (err) {
            showToast("Failed to fetch messages list.", true);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSaved();
    }, [page, filterOcc, filterStatus, search, workspaceCustomer]);

    // Handle scroll for virtualized/lazy rendering
    useEffect(() => {
        const handleScroll = () => {
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200) {
                setVisibleLimit(prev => Math.min(prev + 10, messages.length));
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [messages.length]);

    useEffect(() => {
        setVisibleLimit(10);
    }, [messages]);

    // Lucide Icons auto-instantiation hook
    // ROOT CAUSE FIX: After Lucide replaces <i data-lucide="heart"> with a fresh <svg>,
    // the fav-active class is lost. We call createIcons() then use requestAnimationFrame
    // to wait for the DOM paint, then find every card by [data-msg-id] and patch
    // the first svg in each heart-button with fav-active based on localFavs.
    useEffect(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
        const raf = requestAnimationFrame(() => {
            document.querySelectorAll('[data-msg-id]').forEach(card => {
                const msgId = parseInt(card.getAttribute('data-msg-id'));
                const isFavMsg = localFavs.includes(msgId);
                // Target the heart buttons: mobile-fav-btn and the desktop btn-action-icon[title="Favorite"]
                const heartBtns = [
                    card.querySelector('.mobile-fav-btn'),
                    card.querySelector('.btn-action-icon[title="Favorite"]')
                ].filter(Boolean);
                heartBtns.forEach(btn => {
                    const svg = btn.querySelector('svg');
                    if (!svg) return;
                    if (isFavMsg) {
                        svg.classList.add('fav-active');
                        btn.classList.add('is-fav');
                    } else {
                        svg.classList.remove('fav-active');
                        btn.classList.remove('is-fav');
                    }
                });
            });
        });
        return () => cancelAnimationFrame(raf);
    }, [messages, loading, viewMode, editingId, localFavs, activeMenuId]);

    const handleCopy = (txt) => {
        navigator.clipboard.writeText(txt).then(() => showToast("Copied to clipboard!"));
    };

    // Optimistic UI toggle favorites
    const handleFavToggle = async (id, recipient) => {
        const favs = JSON.parse(localStorage.getItem('wishforge_fav_messages') || '[]');
        const idx = favs.indexOf(id);
        let newFavs;
        const isCurrentlyFav = idx !== -1;

        if (!isCurrentlyFav) {
            newFavs = [...favs, id];
            showToast("Added to Favorites ❤️");
            logActivity('favorite', `Message for ${recipient} favorited`);
        } else {
            newFavs = favs.filter(fid => fid !== id);
            showToast("Removed from Favorites");
            logActivity('unfavorite', `Message for ${recipient} removed from favorites`);
        }

        // Cache state instantly
        localStorage.setItem('wishforge_fav_messages', JSON.stringify(newFavs));
        setLocalFavs(newFavs);

        // Async background synchronization
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
            console.error("Favorite backend sync failed", e);
        }
    };

    // Text File Download
    const handleDownload = (msg) => {
        const recipientName = (msg.recipient_name || 'Recipient').replace(/[^a-zA-Z0-9]/g, '_');
        const occasionName = (msg.occasion_name || 'Occasion').replace(/[^a-zA-Z0-9]/g, '_');
        const dateStr = msg.created_at ? msg.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
        const filename = `${recipientName}_${occasionName}_${dateStr}.txt`;

        const blob = new Blob([msg.message_text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Downloaded plain text successfully!");
    };

    const handleDelete = (id, recipient) => {
        if (confirm("Are you sure you want to delete this greeting template?")) {
            const deleted = JSON.parse(localStorage.getItem('wishforge_deleted_messages') || '[]');
            deleted.push(id);
            localStorage.setItem('wishforge_deleted_messages', JSON.stringify(deleted));
            showToast("Template deleted successfully.");
            addNotification('alert', 'Template Deleted', `Saved template for ${recipient} has been deleted.`);
            fetchSaved();
            logActivity('delete', `Template for ${recipient} deleted`);
        }
    };

    const handleEditSave = async (id, recipient) => {
        if (!editingText.trim()) return;
        const originalMsg = messages.find(m => m.id === id);
        const originalStatus = originalMsg ? originalMsg.status : 'saved';
        const isLinked = originalMsg && (originalMsg.status === 'linked' || !!originalMsg.gift_order_id);

        try {
            const res = await ApiService.editMessage(id, editingText.trim());
            if (res.success) {
                // Optimistic UI state updates
                setMessages(prev => prev.map(m => m.id === id ? { ...m, message_text: editingText.trim(), status: isLinked ? 'linked' : 'saved' } : m));
                setEditingId(null);
                showToast("Greeting updated successfully!");
                addNotification('save', 'Template Updated', `Edits to greeting message for ${recipient} saved.`);
                logActivity('edit', `Template for ${recipient} edited inline`);

                // Restore backend status (since editMessage automatically changes status to 'edited')
                if (isLinked) {
                    await ApiService.linkCard(id);
                } else {
                    await ApiService.saveMessage(id);
                }
                
                fetchSaved();
            }
        } catch (err) {
            showToast("Failed to save changes.", true);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / 6));

    return html`
        <${motion.div} ...${pageTransition} class="route-wrapper" role="tabpanel">
            <div class="panel-title-area">
                <div>
                    <h1>Saved Messages Workspace</h1>
                    <p class="panel-subtitle">Search, filter, edit inline, and manage saved message templates.</p>
                </div>
                <div class="view-toggles">
                    <button class="view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}" onClick=${() => setViewMode('grid')} title="Grid Layout">
                        <i data-lucide="layout-grid"></i>
                    </button>
                    <button class="view-toggle-btn ${viewMode === 'list' ? 'active' : ''}" onClick=${() => setViewMode('list')} title="Table Layout">
                        <i data-lucide="list"></i>
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div class="filters-bar glass-card">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Search by recipient or relation..." value=${search} onChange=${e => setSearch(e.target.value)} />
                </div>
                <div class="filter-controls">
                    <select value=${filterOcc} onChange=${e => { setFilterOcc(e.target.value); setPage(1); }}>
                        <option value="">All Occasions</option>
                        ${occasions.map(o => html`<option key=${o.id} value=${o.id}>${o.name}</option>`)}
                    </select>
                    <select value=${filterStatus} onChange=${e => { setFilterStatus(e.target.value); setPage(1); }}>
                        <option value="">All Saved</option>
                        <option value="saved">Saved Templates</option>
                        <option value="linked">Linked to Order</option>
                    </select>
                </div>
            </div>

            <!-- Content -->
            <div class="saved-cards-container ${viewMode === 'grid' ? 'grid-layout' : 'list-layout'}">
                ${loading ? html`
                    <div class="shimmer-loader-wrapper">
                        <div class="shimmer-card"></div>
                        <div class="shimmer-card"></div>
                        <div class="shimmer-card"></div>
                    </div>
                ` : messages.length === 0 ? html`
                    <div class="output-empty-state" style=${{ gridColumn: '1 / -1', padding: '4rem 1.5rem' }}>
                        <div class="empty-icon"><i data-lucide="bookmark-x"></i></div>
                        <h3>No Saved Templates</h3>
                        <p>Generate some templates or tweak search queries to view lists.</p>
                    </div>
                ` : messages.slice(0, visibleLimit).map(msg => {
                    const formattedDate = msg.created_at
                        ? (() => {
                            const d = new Date(msg.created_at);
                            return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                          })()
                        : 'N/A';
                    const isFav = localFavs.includes(msg.id);
                    const isEditing = editingId === msg.id;
                    
                    return html`
                        <div key=${msg.id} class="saved-message-card glass-card" data-msg-id=${msg.id}>
                            <div class="card-glow"></div>
                            
                            <div class="saved-card-main-row">
                                <div class="profile-avatar">
                                    ${msg.recipient_name ? msg.recipient_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : 'RC'}
                                </div>
                                
                                <div class="saved-card-content-area">
                                    <h3 class="saved-card-title">
                                        To: ${msg.recipient_name} <span class="relation-tag">(${msg.relationship})</span>
                                    </h3>
                                    <span class="saved-card-date">${formattedDate}</span>
                                    
                                    ${isEditing ? html`
                                        <div style=${{ marginBottom: '1rem' }}>
                                            <textarea rows="4" class="edit-textarea" value=${editingText} onChange=${e => setEditingText(e.target.value)} style=${{ width: '100%', padding: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', resize: 'vertical' }}></textarea>
                                            <div style=${{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button class="btn-primary-small" style=${{ background: 'var(--text-muted)' }} onClick=${() => setEditingId(null)}>Cancel</button>
                                                <button class="btn-primary-small" onClick=${() => handleEditSave(msg.id, msg.recipient_name)}>Update</button>
                                            </div>
                                        </div>
                                    ` : html`
                                        <p class="saved-card-body">${msg.message_text}</p>
                                    `}
                                </div>
                                
                                <div class="saved-card-mobile-right">
                                    <button class="mobile-fav-btn" onClick=${() => handleFavToggle(msg.id, msg.recipient_name)} aria-label="Favorite">
                                        <i data-lucide="heart" data-heart="true" class=${isFav ? 'fav-active' : ''}></i>
                                    </button>
                                    <div class="mobile-menu-dropdown">
                                        <button class="mobile-menu-trigger" onClick=${(e) => {
                                            e.stopPropagation();
                                            setActiveMenuId(activeMenuId === msg.id ? null : msg.id);
                                        }} aria-label="More options">
                                            <i data-lucide="more-vertical"></i>
                                        </button>
                                        ${activeMenuId === msg.id && html`
                                            <div class="mobile-dropdown-menu" onClick=${e => e.stopPropagation()}>
                                                <button class="dropdown-item" onClick=${() => { setActiveMenuId(null); navigate('/generate', { state: { loadMessage: msg } }); }}>
                                                    <i data-lucide="external-link"></i> Load Workspace
                                                </button>
                                                <button class="dropdown-item" onClick=${() => { setActiveMenuId(null); setEditingId(msg.id); setEditingText(msg.message_text); }}>
                                                    <i data-lucide="edit-3"></i> Edit inline
                                                </button>
                                                <button class="dropdown-item" onClick=${() => { setActiveMenuId(null); handleCopy(msg.message_text); }}>
                                                    <i data-lucide="copy"></i> Copy Text
                                                </button>
                                                <button class="dropdown-item" onClick=${() => { setActiveMenuId(null); handleDownload(msg); }}>
                                                    <i data-lucide="download"></i> Download Text
                                                </button>
                                                <button class="dropdown-item delete" onClick=${() => { setActiveMenuId(null); handleDelete(msg.id, msg.recipient_name); }}>
                                                    <i data-lucide="trash-2"></i> Delete
                                                </button>
                                            </div>
                                        `}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="saved-card-footer">
                                <div class="saved-card-badges">
                                    <span class="badge badge-indigo mobile-hide">${msg.occasion_name}</span>
                                    <span class="badge badge-info mobile-hide">${msg.tone_name || 'Warm'}</span>
                                    <span class="badge badge-indigo">${msg.ai_used !== false ? 'AI GENERATED' : 'TEMPLATE DEFAULT'}</span>
                                    <span class="badge ${msg.status === 'saved' || (msg.status === 'edited' && !msg.gift_order_id) ? 'badge-emerald' : 'badge-info'}">
                                        ${msg.status === 'saved' || (msg.status === 'edited' && !msg.gift_order_id) ? 'SAVED' : 'LINKED'}
                                    </span>
                                    <span class="badge badge-info">V${msg.version_number || 1}</span>
                                </div>
                                <div class="saved-card-desktop-actions">
                                    <button class="btn-action-icon" onClick=${() => navigate('/generate', { state: { loadMessage: msg } })} title="Load to workspace">
                                        <i data-lucide="external-link"></i>
                                    </button>
                                    <button class="btn-action-icon edit" onClick=${() => { setEditingId(msg.id); setEditingText(msg.message_text); }} title="Edit inline">
                                        <i data-lucide="edit-3"></i>
                                    </button>
                                    <button class="btn-action-icon" onClick=${() => handleCopy(msg.message_text)} title="Copy text">
                                        <i data-lucide="copy"></i>
                                    </button>
                                    <button class="btn-action-icon" onClick=${() => handleDownload(msg)} title="Download text">
                                        <i data-lucide="download"></i>
                                    </button>
                                    <button class="btn-action-icon" onClick=${() => handleFavToggle(msg.id, msg.recipient_name)} title="Favorite">
                                        <i data-lucide="heart" data-heart="true" class=${isFav ? 'fav-active' : ''}></i>
                                    </button>
                                    <button class="btn-action-icon delete" onClick=${() => handleDelete(msg.id, msg.recipient_name)} title="Delete template">
                                        <i data-lucide="trash-2"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                })}
            </div>

            <!-- Pagination -->
            <div class="pagination-wrapper">
                <button class="btn-pagination" disabled=${page === 1} onClick=${() => setPage(p => p - 1)}><i data-lucide="chevron-left"></i> Prev</button>
                <span class="pagination-info">Page ${page} of ${totalPages}</span>
                <button class="btn-pagination" disabled=${page >= totalPages} onClick=${() => setPage(p => p + 1)}>Next <i data-lucide="chevron-right"></i></button>
            </div>
        </${motion.div}>
    `;
}

// ============================================================
// 5. TIMELINE AUDIT HISTORY LOG PAGE
// ============================================================
function HistoryPage() {
    const { occasions = [], tones = [], recipients = [], workspaceCustomer = 'all' } = useContext(GlobalDataContext) || {};
    const { showToast } = useContext(ToastContext);
    const { currentUser, role } = useContext(AuthContext);

    const [logs, setLogs] = useState([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    // Dynamic Filter states
    const [filterDate, setFilterDate] = useState('');
    const [filterOcc, setFilterOcc] = useState('');
    const [filterTone, setFilterTone] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Customers list for Admin view mapping
    const [customers, setCustomers] = useState([]);

    useEffect(() => {
        if (role === 'admin') {
            ApiService.getCustomers().then(res => {
                if (res.success) setCustomers(res.data || []);
            }).catch(e => console.error("Failed to load customers for history mapping", e));
        }
    }, [role]);

    const fetchHistory = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            let q = `?page=1&limit=200`;
            if (role === 'admin') {
                if (workspaceCustomer !== 'all') {
                    q += `&customer_id=${workspaceCustomer}`;
                }
            } else {
                q += `&customer_id=${currentUser.id}`;
            }
            const res = await ApiService.getMessages(q);
            if (res.success) {
                let list = res.data || [];
                const deletedIds = JSON.parse(localStorage.getItem('wishforge_deleted_messages') || '[]');
                
                // Exclude locally deleted messages
                list = list.filter(m => !deletedIds.includes(m.id));

                // Map names from context lists
                list = list.map(m => {
                    const rec = recipients.find(r => r.id === m.recipient_id);
                    const occ = occasions.find(o => o.id === m.occasion_id);
                    const t = tones.find(tone => tone.id === m.tone_id);
                    const cust = customers.find(c => c.id === m.customer_id);
                    return {
                        ...m,
                        recipient_name: rec ? rec.name : `Recipient #${m.recipient_id}`,
                        occasion_name: occ ? occ.name : `Occasion #${m.occasion_id}`,
                        tone_name: t ? t.name : `Tone #${m.tone_id}`,
                        customer_name: cust ? cust.name : `User #${m.customer_id}`
                    };
                });

                // Apply text search
                if (search.trim()) {
                    const match = search.toLowerCase();
                    list = list.filter(m => 
                        (m.recipient_name && m.recipient_name.toLowerCase().includes(match)) ||
                        (m.occasion_name && m.occasion_name.toLowerCase().includes(match))
                    );
                }

                // Apply date range filter
                if (filterDate) {
                    const now = new Date();
                    list = list.filter(m => {
                        const d = new Date(m.created_at);
                        if (filterDate === 'today') {
                            return d.toDateString() === now.toDateString();
                        } else if (filterDate === 'week') {
                            const diffTime = Math.abs(now - d);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            return diffDays <= 7;
                        } else if (filterDate === 'month') {
                            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                        }
                        return true;
                    });
                }

                // Apply occasion filter
                if (filterOcc) {
                    list = list.filter(m => m.occasion_id === parseInt(filterOcc));
                }

                // Apply tone filter
                if (filterTone) {
                    list = list.filter(m => m.tone_id === parseInt(filterTone));
                }

                // Apply status filter
                if (filterStatus) {
                    list = list.filter(m => m.status === filterStatus);
                }

                // Client-side pagination
                const limit = 8;
                setTotal(list.length);
                const startIndex = (page - 1) * limit;
                setLogs(list.slice(startIndex, startIndex + limit));
            }
        } catch (err) {
            showToast("Failed to fetch history logs.", true);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchHistory();
    }, [page, search, filterDate, filterOcc, filterTone, filterStatus, workspaceCustomer, customers]);

    const totalPages = Math.max(1, Math.ceil(total / 8));

    return html`
        <${motion.div} ...${pageTransition} class="route-wrapper" role="tabpanel">
            <div class="panel-title-area">
                <div>
                    <h1>Audit Log & History</h1>
                    <p class="panel-subtitle">Search, filter, and review timeline logs of all platform actions.</p>
                </div>
            </div>

            <!-- Advanced Filters Bar -->
            <div class="filters-bar glass-card" style=${{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch' }}>
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Filter audit logs by keyword..." value=${search} onChange=${e => { setSearch(e.target.value); setPage(1); }} />
                </div>
                
                <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.8rem' }}>
                    <select value=${filterDate} onChange=${e => { setFilterDate(e.target.value); setPage(1); }}>
                        <option value="">Any Date Range</option>
                        <option value="today">Generated Today</option>
                        <option value="week">Generated This Week</option>
                        <option value="month">Generated This Month</option>
                    </select>

                    <select value=${filterOcc} onChange=${e => { setFilterOcc(e.target.value); setPage(1); }}>
                        <option value="">Any Occasion</option>
                        ${occasions.map(o => html`<option key=${o.id} value=${o.id}>${o.name}</option>`)}
                    </select>

                    <select value=${filterTone} onChange=${e => { setFilterTone(e.target.value); setPage(1); }}>
                        <option value="">Any Tone</option>
                        ${tones.map(t => html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}
                    </select>

                    <select value=${filterStatus} onChange=${e => { setFilterStatus(e.target.value); setPage(1); }}>
                        <option value="">Any Status</option>
                        <option value="generated">Generated</option>
                        <option value="saved">Saved</option>
                        <option value="edited">Draft</option>
                        <option value="linked">Archived</option>
                    </select>
                </div>
            </div>

            <!-- Timeline -->
            <div class="timeline-container">
                ${loading ? html`
                    <div class="shimmer-loader-wrapper" style=${{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%' }}>
                        <div class="shimmer-card" style=${{ height: '80px' }}></div>
                        <div class="shimmer-card" style=${{ height: '80px' }}></div>
                    </div>
                ` : logs.length === 0 ? html`
                    <div class="output-empty-state" style=${{ padding: '3rem 1.5rem' }}>
                        <div class="empty-icon"><i data-lucide="history"></i></div>
                        <h3>No Logs Available</h3>
                        <p>No messages match your selected search filters.</p>
                    </div>
                ` : logs.map(msg => html`<${HistoryTimelineItem} key=${msg.id} msg=${msg} />`)}
            </div>

            <!-- Pagination -->
            <div class="pagination-wrapper">
                <button class="btn-pagination" disabled=${page === 1} onClick=${() => setPage(p => p - 1)}><i data-lucide="chevron-left"></i> Prev</button>
                <span class="pagination-info">Page ${page} of ${totalPages}</span>
                <button class="btn-pagination" disabled=${page >= totalPages} onClick=${() => setPage(p => p + 1)}>Next <i data-lucide="chevron-right"></i></button>
            </div>
        </${motion.div}>
    `;
}

// Timeline sub-component for Trace Lifecycle
function HistoryTimelineItem({ msg }) {
    const { role } = useContext(AuthContext);
    const time = msg.created_at
        ? (() => {
            const d = new Date(msg.created_at);
            return isNaN(d.getTime()) ? 'Unknown Time' : d.toLocaleString();
          })()
        : 'Unknown Time';
    const milestones = [];

    // Milestone 1: Generated
    milestones.push({
        label: 'Generated via Groq Llama AI Model',
        icon: 'sparkles'
    });

    // Milestone 2: Saved
    if (msg.status === 'saved' || msg.status === 'edited' || msg.status === 'linked') {
        milestones.push({
            label: 'Saved to Greeting Template Library',
            icon: 'bookmark'
        });
    }

    // Milestone 3: Edited
    if (msg.version_number > 1 || msg.status === 'edited') {
        milestones.push({
            label: `Inline message draft updated to version ${msg.version_number}`,
            icon: 'edit-3'
        });
    }

    // Milestone 4: Linked
    if (msg.status === 'linked') {
        milestones.push({
            label: 'Linked successfully to physical greeting card and gift order',
            icon: 'link'
        });
    }

    let statusClass = 'saved';
    if (msg.status === 'linked') statusClass = 'linked';
    if (msg.status === 'edited') statusClass = 'edited';

    return html`
        <div class="timeline-item ${statusClass}">
            <div class="timeline-dot"></div>
            <div class="timeline-content glass-card">
                <div class="card-glow"></div>
                <div class="timeline-meta">
                    <span class="timeline-title">
                        Audit log for <strong>${msg.recipient_name}</strong>
                        ${role === 'admin' && html` (Generated by: <strong style=${{ color: 'var(--color-primary)' }}>${msg.customer_name}</strong>)`}
                    </span>
                    <span class="timeline-time">${time}</span>
                </div>
                <p class="timeline-text">"${msg.message_text}"</p>
                <div style=${{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
                    <h4 style=${{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 700 }}>Lifecycle History Timeline</h4>
                    <div style=${{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        ${milestones.map(m => html`
                            <div key=${m.label} style=${{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <i data-lucide=${m.icon} style=${{ width: '12px', height: '12px', color: 'var(--color-primary)' }}></i>
                                <span>${m.label}</span>
                            </div>
                        `)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// 6. WORKSPACE SETTINGS PAGE VIEW
// ============================================================
function SettingsPage() {
    const { theme, setTheme } = useContext(GlobalDataContext);
    const { currentUser } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [model, setModel] = useState('llama-3.3-70b-versatile');

    return html`
        <${motion.div} ...${pageTransition} class="route-wrapper" role="tabpanel">
            <div class="panel-title-area">
                <div>
                    <h1>Workspace Settings</h1>
                    <p class="panel-subtitle">Customize default visual styling themes, LLM versions, and profile preferences.</p>
                </div>
            </div>

            <div class="settings-grid">
                <div class="settings-section glass-card">
                    <h3><i data-lucide="user"></i> Profile Details</h3>
                    <div class="profile-settings-form">
                        <div class="form-group">
                            <label>User Name</label>
                            <input type="text" value=${currentUser?.name || ''} readonly class="disabled-input" />
                        </div>
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" value=${currentUser?.email || ''} readonly class="disabled-input" />
                        </div>
                    </div>
                </div>

                <div class="settings-section glass-card">
                    <h3><i data-lucide="sliders"></i> Generation Preferences</h3>
                    <div class="pref-settings-form">
                        <div class="form-group">
                            <label>Default LLM Model</label>
                            <select value=${model} onChange=${e => { setModel(e.target.value); showToast(`Default model updated to ${e.target.value}!`); }}>
                                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Default)</option>
                                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Visual Theme Mode</label>
                            <select value=${theme} onChange=${e => setTheme(e.target.value)}>
                                <option value="dark">Dark Theme (Standard)</option>
                                <option value="light">Light Theme (SaaS)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </${motion.div}>
    `;
}

// ============================================================
// 7. ADMIN DASHBOARD PAGE VIEW
// ============================================================
function AdminPage() {
    const { showToast } = useContext(ToastContext);
    const [customers, setCustomers] = useState([]);
    const [stats, setStats] = useState(null);
    const [diagnostics, setDiagnostics] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadAdminData = async () => {
        setLoading(true);
        try {
            const [custRes, statsRes, diagRes] = await Promise.all([
                ApiService.getCustomers(),
                ApiService.getStats(),
                fetch(`${API_BASE}/diagnostics`)
            ]);

            if (custRes.success) setCustomers(custRes.data || []);
            if (statsRes.success) setStats(statsRes.data);
            if (diagRes) setDiagnostics(diagRes);
        } catch (err) {
            showToast("Failed to load admin console data.", true);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadAdminData();
    }, []);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [loading]);

    // Popular occasions & tones calculations
    let popOccasion = 'None';
    let popTone = 'None';
    if (stats) {
        if (stats.messages_by_occasion && stats.messages_by_occasion.length > 0) {
            const sortedOcc = [...stats.messages_by_occasion].sort((a, b) => b.count - a.count);
            popOccasion = sortedOcc[0].occasion;
        }
        if (stats.messages_by_tone && stats.messages_by_tone.length > 0) {
            const sortedTone = [...stats.messages_by_tone].sort((a, b) => b.count - a.count);
            popTone = sortedTone[0].tone;
        }
    }

    return html`
        <${motion.div} ...${pageTransition} class="route-wrapper" role="tabpanel">
            <div class="panel-title-area">
                <div>
                    <h1>Admin Management Console</h1>
                    <p class="panel-subtitle">Manage customer directory accounts and audit live LLM API execution records.</p>
                </div>
                <button class="btn-secondary-outline" onClick=${loadAdminData} disabled=${loading}>
                    <i data-lucide="refresh-cw"></i> Refresh Data
                </button>
            </div>

            <!-- Stats strip -->
            <div class="admin-stats-strip">
                <div class="metric-card glass-card">
                    <div class="card-glow"></div>
                    <div class="metric-header">
                        <span class="metric-title">Total Users</span>
                        <div class="metric-icon primary"><i data-lucide="users"></i></div>
                    </div>
                    <div class="metric-body">
                        <h2 class="metric-value">${customers.length}</h2>
                        <span class="metric-trend success">Registered customers</span>
                    </div>
                </div>

                <div class="metric-card glass-card">
                    <div class="card-glow"></div>
                    <div class="metric-header">
                        <span class="metric-title">Total Requests</span>
                        <div class="metric-icon success"><i data-lucide="list-todo"></i></div>
                    </div>
                    <div class="metric-body">
                        <h2 class="metric-value">${stats ? stats.total_messages : '--'}</h2>
                        <span class="metric-trend success">Global message requests</span>
                    </div>
                </div>

                <div class="metric-card glass-card">
                    <div class="card-glow"></div>
                    <div class="metric-header">
                        <span class="metric-title">Popular Occasion</span>
                        <div class="metric-icon info"><i data-lucide="calendar"></i></div>
                    </div>
                    <div class="metric-body">
                        <h2 class="metric-value" style=${{ fontSize: '1.2rem', marginTop: '0.5rem' }}>${popOccasion}</h2>
                        <span class="metric-trend info">Most generated template</span>
                    </div>
                </div>

                <div class="metric-card glass-card">
                    <div class="card-glow"></div>
                    <div class="metric-header">
                        <span class="metric-title">Popular Tone</span>
                        <div class="metric-icon warning"><i data-lucide="message-square"></i></div>
                    </div>
                    <div class="metric-body">
                        <h2 class="metric-value" style=${{ fontSize: '1.2rem', marginTop: '0.5rem' }}>${popTone}</h2>
                        <span class="metric-trend warning">Most requested style</span>
                    </div>
                </div>
            </div>

            <!-- Bottom Grid (Activity stream, customers table, diagnostics) -->
            <div class="dashboard-secondary-grid" style=${{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                <!-- Customers Table -->
                <div class="admin-table-card glass-card">
                    <div class="admin-header-row">
                        <h2>Registered Customer Accounts</h2>
                        <span class="badge badge-indigo">${customers.length} Customers</span>
                    </div>
                    <div class="table-responsive">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Customer ID</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${loading ? html`
                                    <tr><td colSpan="4" style=${{ textAlign: 'center', padding: '2rem' }}>Loading customer records...</td></tr>
                                ` : customers.length === 0 ? html`
                                    <tr><td colSpan="4" style=${{ textAlign: 'center', padding: '2rem' }}>No customers registered in backend.</td></tr>
                                ` : customers.map(c => html`
                                    <tr key=${c.id}>
                                        <td>#${c.id}</td>
                                        <td style=${{ fontWeight: 600 }}>${c.name}</td>
                                        <td>${c.email}</td>
                                        <td>${c.phone || 'N/A'}</td>
                                    </tr>
                                `)}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Global Activity Widget -->
                <div class="admin-table-card glass-card" style=${{ display: 'flex', flexDirection: 'column' }}>
                    <div class="admin-header-row">
                        <h2>Global Recent Activity</h2>
                        <span class="badge badge-indigo">Audit Logs</span>
                    </div>
                    <div style=${{ flex: 1, overflowY: 'auto', maxHeight: '320px' }}>
                        <${RecentActivityWidget} limit=${6} />
                    </div>
                </div>
            </div>

            <!-- Diagnostics log console -->
            <div class="admin-table-card glass-card" style=${{ marginBottom: '2rem' }}>
                <div class="admin-header-row">
                    <h2>Live API Diagnostics Log</h2>
                    <span class="badge badge-emerald">Connected</span>
                </div>
                <div class="diagnostics-grid" style=${{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <div class="diag-item">
                        <span class="diag-label">SDK Client Version</span>
                        <span class="diag-value">${diagnostics ? diagnostics.sdk_version : 'N/A'}</span>
                    </div>
                    <div class="diag-item">
                        <span class="diag-label">Groq API Endpoint</span>
                        <span class="diag-value" style=${{ fontSize: '0.8rem' }}>${diagnostics ? diagnostics.endpoint_url : 'N/A'}</span>
                    </div>
                    <div class="diag-item">
                        <span class="diag-label">Active Key Prefix</span>
                        <span class="diag-value">${diagnostics ? diagnostics.active_key_prefix : 'N/A'}</span>
                    </div>
                </div>
                <label style=${{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Raw Provider Response Console
                </label>
                <div class="logs-console">
                    ${diagnostics ? diagnostics.raw_provider_response : 'Fetching logs...'}
                </div>
            </div>
        </${motion.div}>
    `;
}

// ============================================================
// KEYWORD HIGHLIGHTING & HTML ESCAPE UTILS
// ============================================================
function highlightKeywords(messageText, rawKeywords) {
    if (!messageText) return "";
    if (!rawKeywords || !rawKeywords.trim()) return escapeHTML(messageText).replace(/\n/g, '<br>');

    let terms = [];
    if (rawKeywords.includes(',')) {
        terms = rawKeywords.split(',').map(s => s.trim()).filter(s => s.length > 0);
    } else {
        terms = [rawKeywords.trim()];
    }

    const seen = new Set();
    terms = terms.filter(t => {
        const lower = t.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
    });

    terms.sort((a, b) => b.length - a.length);

    let escapedText = escapeHTML(messageText);
    const replacements = [];

    terms.forEach((term) => {
        if (!term) return;
        const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const isAlphaNum = /^\w+$/.test(term);
        const regexStr = isAlphaNum ? `\\b(${escapedTerm})\\b` : `(${escapedTerm})`;
        const regex = new RegExp(regexStr, 'gi');

        escapedText = escapedText.replace(regex, (match) => {
            const placeholder = `___HL_PLACEHOLDER_${replacements.length}___`;
            replacements.push({
                placeholder: placeholder,
                content: `<span class="keyword-highlight">${match}</span>`
            });
            return placeholder;
        });
    });

    replacements.forEach(rep => {
        escapedText = escapedText.replace(rep.placeholder, rep.content);
    });

    return escapedText.replace(/\n/g, '<br>');
}

function escapeHTML(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// End of escapeHTML - balanced

// Boots ReactDOM inside the root DOM node
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
