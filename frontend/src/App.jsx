import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const getAvatarChar = (name) => {
  if (!name) return '';
  // Strip any leading plus and whitespace
  const clean = name.replace(/^\+/, '').trim();
  // Get first character or default to silhouette icon
  return clean.charAt(0).toUpperCase() || '';
};

const sanitizePhone = (phone) => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
};

const PRESET_ANSWERS = [
  {
    label: "Cost & Plans",
    title: "What does it cost to be on Homemade?",
    text: "You can choose a yearly commission-only plan (10%, 12%, or 14%) or a monthly plan that combines a small base fee (€25/€35/€45) with a lower commission (5%/6%/7%). Yearly is the default."
  },
  {
    label: "No Answer Followup",
    title: "We tried calling but no response",
    text: "Hey, we have been trying to contact you regarding your Homemade application but you were not available. Please let us know when is a good time to reach you or if you prefer to chat here!"
  },
  {
    label: "Commission",
    title: "What's the commission based on?",
    text: "Commission is taken from the gross order value, which includes delivery fees and VAT."
  },
  {
    label: "Cancel Order",
    title: "What happens if I cancel an order?",
    text: "Within the first 10 minutes — no fee, but contact the customer. After 10 minutes — a €15 handling fee, and we ask you to make it right (e.g. a free meal next order). 3+ cancellations in 3 months triggers a support call and may pause orders."
  },
  {
    label: "KVK & NVWA",
    title: "Do I need KVK / NVWA / HACCP?",
    text: "Yes — KVK + NVWA registration and HACCP compliance are mandatory. We also recommend at least €1,000,000 liability insurance."
  },
  {
    label: "Contract Term",
    title: "How long is the contract?",
    text: "Yearly plans run for 12 months from signing. Monthly plans renew each month with 30 days' notice."
  },
  {
    label: "Switch Plans",
    title: "Can I switch plans?",
    text: "Yes — you can upgrade any time. Pro and Pro Plus can also downgrade."
  },
  {
    label: "Tia Onboarding",
    title: "Can I get help during onboarding?",
    text: "Yes — book a call with Tia, our onboarding specialist: https://calendly.com/homemademeals-info/launch-assistance"
  },
  {
    label: "Kitchen Check",
    title: "How does the kitchen check work?",
    text: "Upload 2 kitchen photos + 1 fridge photo. Our AI scores Hygiene, Fridge Safety, and Storage. 70+ passes; 55–69 conditional; <55 fail. Re-check monthly."
  },
  {
    label: "Safety Quiz",
    title: "What food-safety quiz score do I need?",
    text: "80% or higher. You'll watch 5 short training videos first."
  },
  {
    label: "Online Status",
    title: "What does 'Online' mean on the storefront?",
    text: "You're Online (green) only when you're accepting orders AND within your opening hours. Otherwise you're Offline (gray)."
  }
];

export default function App() {
  const [tenantId, setTenantId] = useState(localStorage.getItem('whatsapp_tenant_id') || 'default');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('agent_auth_token'));
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [status, setStatus] = useState('INITIALIZING');
  const [qrText, setQrText] = useState('');
  const [syncPercent, setSyncPercent] = useState(0);
  const [syncMsg, setSyncMsg] = useState('');
  const [tenantsList, setTenantsList] = useState([{ id: 'default', name: 'default' }]);
  const [isCreatingNewTenant, setIsCreatingNewTenant] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');

  const apiFetch = async (url, options = {}) => {
    const token = localStorage.getItem("agent_auth_token");
    const headers = { ...options.headers };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 && url !== "/api/auth/login") {
      setIsAuthenticated(false);
      localStorage.removeItem("agent_auth_token");
    }
    return res;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        localStorage.setItem('agent_auth_token', data.token);
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setAuthError('Network error connecting to authentication server.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', backgroundImage: 'radial-gradient(circle at center, #111b21 0%, #0b141a 100%)' }}>
        <div style={{
          background: 'rgba(28, 28, 30, 0.4)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '2.5rem',
          width: '100%',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <div className="avatar" style={{ background: 'linear-gradient(135deg, #00a884 0%, #128c7e 100%)', width: '64px', height: '64px', fontSize: '1.5rem', fontWeight: 700, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
              WA
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Agent CRM Login</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Authenticate to access tenant management</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', textAlign: 'center' }}>
                {authError}
              </div>
            )}
            
            <input 
              type="email" 
              placeholder="Admin Email" 
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-green)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
            
            <input 
              type="password" 
              placeholder="Master Password" 
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-green)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
            
            <button 
              type="submit" 
              disabled={isAuthenticating}
              style={{
                marginTop: '0.5rem',
                padding: '0.85rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--accent-green)',
                color: 'white',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: isAuthenticating ? 'not-allowed' : 'pointer',
                opacity: isAuthenticating ? 0.7 : 1,
                transition: 'opacity 0.2s ease'
              }}
            >
              {isAuthenticating ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [inputText, setInputText] = useState('');
  
  const [activeTab, setActiveTab] = useState('chats');
  const [cateringLeads, setCateringLeads] = useState([]);
  const [loadingCaterings, setLoadingCaterings] = useState(false);
  const [cateringSearchTerm, setCateringSearchTerm] = useState('');

  const loadCateringLeads = async () => {
    setLoadingCaterings(true);
    try {
      const res = await apiFetch('/api/crm/catering-leads');
      const data = await res.json();
      if (res.ok && data.success) {
        setCateringLeads(data.leads);
      }
    } catch (e) {
      console.error('Error fetching catering leads:', e);
    } finally {
      setLoadingCaterings(false);
    }
  };
  
  const [showSettings, setShowSettings] = useState(false);
  const [crmContext, setCrmContext] = useState(null);
  const [crmType, setCrmType] = useState(''); // 'chef' or 'catering'
  const [loadingCrm, setLoadingCrm] = useState(false);
  const [crmError, setCrmError] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [brainConfig, setBrainConfig] = useState({
    welcomeMessage: { enabled: false, template: '' },
    autoReply: { enabled: false, rules: [] },
    aiAgent: { enabled: false, provider: 'gemini', apiKey: '', systemPrompt: '' },
    webhook: { enabled: false, url: '' },
    emailNotification: { enabled: false, apiKey: '', fromEmail: '', toEmail: '', subject: '' }
  });

  const [showCampaigns, setShowCampaigns] = useState(false);
  const [campaignProfiles, setCampaignProfiles] = useState([]);
  const [selectedCampaignProfiles, setSelectedCampaignProfiles] = useState(new Set());
  const [campaignMessage, setCampaignMessage] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatMessage, setNewChatMessage] = useState('');
  const [isSendingNewChat, setIsSendingNewChat] = useState(false);

  const loadCampaignProfiles = async () => {
    try {
      const res = await apiFetch('/api/crm/profiles');
      const data = await res.json();
      if (res.ok && data.success) {
        setCampaignProfiles(data.profiles);
      }
    } catch (e) {
      console.error('Error fetching campaign profiles:', e);
    }
  };

  const handleSendCampaign = async (e) => {
    e.preventDefault();
    if (selectedCampaignProfiles.size === 0 || !campaignMessage.trim()) return;
    
    setIsSendingCampaign(true);
    const phones = Array.from(selectedCampaignProfiles);
    
    try {
      const res = await apiFetch(`/api/${tenantId}/campaign/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones, message: campaignMessage.trim() })
      });
      if (res.ok) {
        alert(`Successfully queued ${phones.length} messages! They will be sent with human-like delays.`);
        setShowCampaigns(false);
        setCampaignMessage('');
        setSelectedCampaignProfiles(new Set());
      } else {
        alert('Failed to queue campaign. Ensure tenant is READY.');
      }
    } catch (e) {
      console.error('Error sending campaign:', e);
      alert('Error sending campaign.');
    }
    setIsSendingCampaign(false);
  };

  const handleSendNewChat = async (e) => {
    e.preventDefault();
    if (!newChatPhone.trim() || !newChatMessage.trim()) return;

    setIsSendingNewChat(true);
    try {
      const res = await apiFetch(`/api/${tenantId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newChatPhone.trim(), message: newChatMessage.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Message queued successfully! It will be sent shortly.');
        setShowNewChat(false);
        setNewChatPhone('');
        setNewChatMessage('');
        loadChats();
      } else {
        alert('Failed to send: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error starting new chat:', err);
      alert('Network error starting new chat.');
    } finally {
      setIsSendingNewChat(false);
    }
  };

  const messagesEndRef = useRef(null);
  const activeChatRef = useRef(null);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Fetch list of known tenants from backend consolidated store
  const loadTenants = async () => {
    try {
      const res = await apiFetch('/api/tenants');
      const data = await res.json();
      if (res.ok && data.success) {
        setTenantsList(data.tenants);
      }
    } catch (e) {
      console.error('Error fetching tenants list:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadTenants();
    }
  }, [isAuthenticated]);

  // Load Brain Config
  const loadBrainConfig = async () => {
    try {
      const res = await apiFetch(`/api/${tenantId}/config`);
      const data = await res.json();
      if (res.ok && data.success) {
        setBrainConfig(data.config);
      }
    } catch (e) {
      console.error('Error fetching brain config:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadBrainConfig();
    }
  }, [tenantId, isAuthenticated]);

  const saveBrainConfig = async (newConfig) => {
    try {
      const res = await apiFetch(`/api/${tenantId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBrainConfig(newConfig);
        setShowSettings(false);
        loadTenants();
      } else {
        alert('Error saving configuration: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Error saving brain config:', e);
      alert('Network error saving configuration');
    }
  };

  // Fetch Chats once Ready
  const loadChats = async () => {
    try {
      const res = await apiFetch(`/api/${tenantId}/chats`);
      const data = await res.json();
      if (res.ok && data.success) {
        setChats(data.chats);
      } else if (data.status) {
        setStatus(data.status);
      }
    } catch (e) {
      console.error('Error fetching chats:', e);
    }
  };

  // Auto-refresh chats list periodically once client is ready
  useEffect(() => {
    if (status !== 'READY') return;
    
    loadChats(); // Initial load

    const interval = setInterval(loadChats, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [status, tenantId]);

  // Fetch history and response suggestions when active chat changes
  useEffect(() => {
    setMessages([]); // Clear previous messages immediately to avoid layout flash
    if (!activeChat) {
      setSuggestion('');
      setCrmContext(null);
      setCrmType('');
      return;
    }

    const fetchHistory = async () => {
      try {
        const res = await apiFetch(`/api/${tenantId}/history/jid/${encodeURIComponent(activeChat.id)}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setMessages(data.messages);
        }
      } catch (e) {
        console.error('Error fetching messages:', e);
      }
    };

    const fetchSuggestion = async () => {
      if (!activeChat.unanswered) {
        setSuggestion('');
        return;
      }
      setLoadingSuggestion(true);
      try {
        const res = await apiFetch(`/api/${tenantId}/suggest-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jid: activeChat.id })
        });
        const data = await res.json();
        if (res.ok && data.success && data.needed) {
          setSuggestion(data.suggestedMessage);
        } else {
          setSuggestion('');
        }
      } catch (e) {
        console.error('Error fetching suggestion:', e);
        setSuggestion('');
      } finally {
        setLoadingSuggestion(false);
      }
    };

    const fetchCrm = async () => {
      setLoadingCrm(true);
      setCrmError('');
      try {
        const res = await apiFetch(`/api/${tenantId}/crm-context/${encodeURIComponent(activeChat.id)}`);
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.context) {
            setCrmContext(data.context);
            setCrmType(data.type || 'chef');
          } else {
            setCrmContext(null);
            setCrmType('');
            setCrmError('Contact not found in CRM database.');
          }
        } else {
          setCrmContext(null);
          setCrmType('');
          setCrmError(data.error || 'Failed to fetch CRM profile.');
        }
      } catch (e) {
        setCrmContext(null);
        setCrmType('');
        setCrmError('Network error fetching CRM profile.');
      } finally {
        setLoadingCrm(false);
      }
    };

    fetchHistory();
    fetchSuggestion();
    fetchCrm();
  }, [activeChat, tenantId]);

  // Auto-scroll messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Connect/Initialize session trigger
  const initializeSession = async () => {
    try {
      setStatus('INITIALIZING');
      const res = await apiFetch(`/api/${tenantId}/initialize`, { method: 'POST' });
      if (!res.ok) {
        console.error('Failed to initialize session');
      }
    } catch (e) {
      console.error('Error starting session:', e);
    }
  };

  // Disconnect/Logout session trigger
  const logoutSession = async () => {
    if (!window.confirm(`Are you sure you want to disconnect WhatsApp and log out for tenant "${tenantId}"? This will delete local authentication directories.`)) {
      return;
    }
    try {
      setStatus('INITIALIZING');
      const res = await apiFetch(`/api/${tenantId}/logout`, { method: 'POST' });
      if (res.ok) {
        setChats([]);
        setActiveChat(null);
        setMessages([]);
        setQrText('');
        setStatus('INITIALIZING');
      } else {
        alert('Failed to log out session');
      }
    } catch (e) {
      console.error('Error logging out session:', e);
    }
  };

  // SSE Event stream
  useEffect(() => {
    if (!isAuthenticated) return;

    const eventSource = new EventSource(`/events?tenantId=${encodeURIComponent(tenantId)}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'status') {
        setStatus(data.status);
        if (data.status === 'READY') {
          loadChats();
        }
      }
      else if (data.type === 'qr') {
        setQrText(data.qr);
        setStatus('QR_READY');
      }
      else if (data.type === 'sync') {
        setSyncPercent(data.percent);
        setSyncMsg(data.message);
        setStatus('SYNCING');
      }
      else if (data.type === 'log') {
        const messageFrom = data.phone;
        const isSentByMe = data.logType === 'OUTGOING';
        
        // 1. Read current active chat from ref to avoid stale closure without rebuilding EventSource
        const currentActiveChat = activeChatRef.current;
        if (currentActiveChat && currentActiveChat.id.includes(messageFrom)) {
          setMessages(prev => {
            if (isSentByMe) {
              const optIndex = prev.findIndex(m => m.fromMe && m.sending && m.body === data.body);
              if (optIndex !== -1) {
                const updated = [...prev];
                updated[optIndex] = {
                  ...updated[optIndex],
                  sending: false,
                  timestamp: Math.floor(data.timestamp / 1000)
                };
                return updated;
              }
            }
            return [...prev, {
              body: data.body,
              fromMe: isSentByMe,
              timestamp: Math.floor(data.timestamp / 1000),
              sending: false
            }];
          });
        }

        // 2. Refresh active chat last message in the sidebar
        setChats(prevChats => {
          const newChats = prevChats.map(c => {
            if (c.id.includes(messageFrom)) {
              return {
                ...c,
                lastMessage: data.body,
                timestamp: Math.floor(data.timestamp / 1000)
              };
            }
            return c;
          });
          // Sort again
          return [...newChats].sort((a, b) => b.timestamp - a.timestamp);
        });
      }
    };

    eventSource.onerror = () => {
      setStatus('OFFLINE');
    };

    // Clean up active states on tenant switch
    localStorage.setItem('whatsapp_tenant_id', tenantId);
    setChats([]);
    setActiveChat(null);
    setMessages([]);
    setQrText('');
    setStatus('DISCONNECTED');

    return () => {
      eventSource.close();
    };
  }, [tenantId, isAuthenticated]);

  // Render QR Code modal dynamically
  useEffect(() => {
    if ((status === 'AWAITING_QR_SCAN' || status === 'QR_READY') && qrText) {
      const container = document.getElementById('qr-modal-container');
      if (container) {
        container.innerHTML = '';
        new window.QRCode(container, {
          text: qrText,
          width: 220,
          height: 220,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.H
        });
      }
    }
  }, [status, qrText]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const msgBody = inputText.trim();
    setInputText('');

    // Optimistically append outgoing message locally
    setMessages(prev => [...prev, {
      body: msgBody,
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
      sending: true
    }]);

    try {
      const res = await apiFetch(`/api/${tenantId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: activeChat.id, message: msgBody })
      });
      
      if (!res.ok) {
        console.error('Failed to send message');
      }
    } catch (err) {
      console.error('Error manual send:', err);
    }
  };

  const filteredChats = chats.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.includes(searchTerm)
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app-container">
      {/* Status Loading Overlays */}
      {status === 'INITIALIZING' && (
        <div className="loading-screen" style={{ background: 'radial-gradient(circle at center, #111b21 0%, #0b141a 100%)', backdropFilter: 'blur(10px)' }}>
          <div className="avatar" style={{width: '60px', height: '60px', fontSize: '1.8rem', animation: 'pulse 2s infinite', background: 'linear-gradient(135deg, #00a884 0%, #128c7e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>🤖</div>
          <h2 style={{fontFamily: 'Outfit', color: '#fff', marginTop: '1rem'}}>Initializing Agent Client</h2>
          <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem'}}>Starting browser context for tenant: "{tenantId}"...</p>
          <div style={{width: '200px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden'}}>
            <div style={{width: '30%', animation: 'loadingBar 1.5s ease-in-out infinite alternate', background: 'var(--accent-green)', height: '100%', borderRadius: '4px'}}></div>
          </div>
          <style>{`
            @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.8; } }
            @keyframes loadingBar { 0% { transform: translateX(-100%); } 100% { transform: translateX(330%); } }
          `}</style>
        </div>
      )}

      {status === 'AUTHENTICATED' && (
        <div className="loading-screen">
          <div className="avatar" style={{width: '60px', height: '60px', fontSize: '1.8rem'}}>✅</div>
          <h2 style={{fontFamily: 'Outfit'}}>Logged In Successfully</h2>
          <p style={{color: 'var(--text-muted)'}}>{syncMsg || 'Syncing chats and contact profiles...'}</p>
          <div className="sync-bar-bg">
            <div className="sync-bar-progress" style={{width: `${syncPercent || 20}%`}}></div>
          </div>
        </div>
      )}

      {(status === 'AWAITING_QR_SCAN' || status === 'QR_READY') && (
        <div className="overlay">
          <div className="qr-modal" style={{ position: 'relative' }}>
            <button 
              onClick={() => {/* Just close visually - do NOT logout the session */
                document.querySelector('.overlay') && document.querySelector('.overlay').remove();
              }} 
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
              title="Dismiss (session stays active)"
            >
              ✕
            </button>
            <h2>Link WhatsApp (Tenant: {tenantId})</h2>
            <p>Scan this QR code using WhatsApp on your mobile phone to register this session.</p>
            <div className="qr-box" id="qr-modal-container"></div>
            <div className="status-badge" style={{marginTop: '1rem', justifyContent: 'center'}}>
              <div className="status-dot"></div>
              <span>Awaiting Scan</span>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="sidebar">
        {/* Top Header & Navigation Dashboard */}
        {/* Top Header - Ultra Minimal */}
        <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--panel-bg)', minHeight: 'auto', height: 'auto' }}>
          {/* Row 1: Agent Identity & Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="avatar" style={{ background: 'linear-gradient(135deg, #00a884 0%, #128c7e 100%)', width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', borderRadius: '50%', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                WA
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.2px' }}>{brainConfig?.profileName || 'WhatsApp Agent'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className={`status-dot ${status === 'READY' ? 'ready' : ''}`}></div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.5px' }}>{status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--panel-bg)' }}>
          <button 
            onClick={() => setActiveTab('chats')} 
            style={{ 
              flex: 1, 
              padding: '0.75rem', 
              border: 'none', 
              borderBottom: activeTab === 'chats' ? '2.5px solid var(--accent-green)' : '2.5px solid transparent', 
              background: 'none', 
              color: activeTab === 'chats' ? 'var(--text-main)' : 'var(--text-muted)', 
              fontWeight: activeTab === 'chats' ? 700 : 500, 
              fontSize: '0.85rem', 
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            💬 Chats
          </button>
          <button 
            onClick={() => {
              setActiveTab('caterings');
              loadCateringLeads();
            }} 
            style={{ 
              flex: 1, 
              padding: '0.75rem', 
              border: 'none', 
              borderBottom: activeTab === 'caterings' ? '2.5px solid var(--accent-green)' : '2.5px solid transparent', 
              background: 'none', 
              color: activeTab === 'caterings' ? 'var(--text-main)' : 'var(--text-muted)', 
              fontWeight: activeTab === 'caterings' ? 700 : 500, 
              fontSize: '0.85rem', 
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            🍽️ Catering Leads
          </button>
        </div>

        {activeTab === 'chats' ? (
          <>
            {/* Search */}
            <div className="search-container">
              <div className="search-box">
                <span></span>
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Search or start new chat" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Chat List */}
            <div className="chat-list">
              {filteredChats.map(chat => (
                <div 
                  key={chat.id} 
                  className={`chat-item ${activeChat && activeChat.id === chat.id ? 'active' : ''}`}
                  onClick={() => setActiveChat(chat)}
                >
                  <div className="avatar">{getAvatarChar(chat.name)}</div>
                  <div className="chat-item-info">
                    <div className="chat-item-header">
                      <span className="chat-name">{chat.name}</span>
                      <span className="chat-time">{formatTime(chat.timestamp)}</span>
                    </div>
                    <div className="chat-item-body">
                      <span className="chat-last-message">{chat.lastMessage || 'No messages yet'}</span>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                        {chat.unanswered && (
                          <span 
                            style={{ 
                              fontSize: '0.62rem', 
                              fontWeight: '700', 
                              color: '#53bdeb', 
                              border: '1px solid #53bdeb', 
                              borderRadius: '4px', 
                              padding: '1px 5px', 
                              textTransform: 'uppercase', 
                              letterSpacing: '0.3px' 
                            }}
                            title="Unanswered - needs action"
                          >
                            Needs Action
                          </span>
                        )}
                        {chat.unreadCount > 0 && <span className="unread-count">{chat.unreadCount}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredChats.length === 0 && (
                <div className="placeholder-text" style={{marginTop: '2rem', textAlign: 'center', color: 'var(--text-muted)'}}>No chats found.</div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Catering Search */}
            <div className="search-container">
              <div className="search-box">
                <span></span>
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Search catering leads..." 
                  value={cateringSearchTerm}
                  onChange={(e) => setCateringSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Catering Leads List */}
            <div className="chat-list">
              {loadingCaterings ? (
                <div className="placeholder-text" style={{marginTop: '2rem', textAlign: 'center', color: 'var(--text-muted)'}}>Loading leads...</div>
              ) : (
                (() => {
                  const filteredCaterings = cateringLeads.filter(lead => 
                    (lead.customer_name || '').toLowerCase().includes(cateringSearchTerm.toLowerCase()) ||
                    (lead.phone || '').includes(cateringSearchTerm)
                  );
                  return (
                    <>
                      {filteredCaterings.map(lead => {
                        const jid = `${sanitizePhone(lead.phone)}@c.us`;
                        const isSelected = activeChat && activeChat.id === jid && activeChat.isCateringLead;
                        return (
                          <div 
                            key={lead.id} 
                            className={`chat-item ${isSelected ? 'active' : ''}`}
                            onClick={() => setActiveChat({
                              id: jid,
                              name: lead.customer_name || 'Customer',
                              lastMessage: lead.event_title || '',
                              timestamp: Math.floor(new Date(lead.created_at).getTime() / 1000),
                              unreadCount: 0,
                              unanswered: false,
                              isCateringLead: true,
                              cateringDetails: lead
                            })}
                          >
                            <div className="avatar" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
                              {getAvatarChar(lead.customer_name || 'C')}
                            </div>
                            <div className="chat-item-info">
                              <div className="chat-item-header">
                                <span className="chat-name">{lead.customer_name || 'Customer'}</span>
                                <span className="chat-time" style={{ fontSize: '0.7rem' }}>
                                  {new Date(lead.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <div className="chat-item-body">
                                <span className="chat-last-message">{lead.event_title || lead.phone || 'No event title'}</span>
                                <span style={{ 
                                  fontSize: '0.6rem', 
                                  fontWeight: '700', 
                                  color: lead.status === 'new' ? '#10b981' : 'var(--text-muted)', 
                                  border: `1px solid ${lead.status === 'new' ? '#10b981' : 'var(--border-color)'}`, 
                                  borderRadius: '4px', 
                                  padding: '1px 5px', 
                                  textTransform: 'uppercase' 
                                }}>
                                  {lead.status || 'NEW'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {filteredCaterings.length === 0 && (
                        <div className="placeholder-text" style={{marginTop: '2rem', textAlign: 'center', color: 'var(--text-muted)'}}>No catering leads found.</div>
                      )}
                    </>
                  );
                })()
              )}
            </div>
          </>
        )}

        {/* Bottom Menu / Footer - Emulating Mobile Tab Bar */}
        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--panel-bg)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
            {!isCreatingNewTenant ? (
              <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
                <select
                  value={tenantId}
                  onChange={(e) => {
                    if (e.target.value === 'CREATE_NEW') {
                      setIsCreatingNewTenant(true);
                      setNewTenantName('');
                    } else {
                      setTenantId(e.target.value);
                      setActiveChat(null);
                      setMessages([]);
                      setCrmContext(null);
                      setCrmType('');
                      setChats([]);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-chat)',
                    color: 'var(--text-main)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {tenantsList.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                  ))}
                  <option value="CREATE_NEW">➕ Create New Tenant...</option>
                </select>
                
                {status !== 'READY' && status !== 'QR_READY' && status !== 'SYNCING' && status !== 'AUTHENTICATED' && (
                  <button 
                    onClick={initializeSession}
                    style={{
                      padding: '0.6rem 1rem',
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--accent-green)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                  >
                    Connect
                  </button>
                )}
                {(status === 'READY' || status === 'QR_READY' || status === 'SYNCING') && (
                  <button 
                    onClick={logoutSession}
                    style={{
                      padding: '0.6rem 1rem',
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                  >
                    Logout
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
                <input 
                  type="text" 
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="New Account Name..." 
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-chat)',
                    color: 'var(--text-main)'
                  }}
                />
                <button
                  onClick={() => {
                    if (newTenantName.trim()) {
                      const rawName = newTenantName.trim();
                      const name = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
                      if (!tenantsList.some(t => t.id === name)) {
                        setTenantsList(prev => [...prev, { id: name, name: rawName }]);
                      }
                      setTenantId(name);
                      setActiveChat(null);
                      setMessages([]);
                      setCrmContext(null);
                      setCrmType('');
                      setChats([]);
                      setIsCreatingNewTenant(false);
                      setStatus('INITIALIZING');
                      apiFetch(`/api/${name}/initialize`, { method: 'POST' }).catch(console.error);
                    }
                  }}
                  style={{
                    padding: '0.6rem 1rem',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--accent-green)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Add
                </button>
                <button
                  onClick={() => setIsCreatingNewTenant(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%', marginBottom: '0.5rem' }}>
            <button onClick={loadChats} style={{ background: 'var(--active-chat)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', padding: '10px 0', color: 'var(--text-main)', fontWeight: 600, textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} title="Force Refresh Chats">Refresh Chats</button>
            <button onClick={() => setShowNewChat(true)} style={{ background: 'var(--active-chat)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', padding: '10px 0', color: 'var(--text-main)', fontWeight: 600, textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} title="Start New Chat">New Chat</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%' }}>
            <button onClick={() => { setShowCampaigns(true); loadCampaignProfiles(); }} style={{ background: 'var(--active-chat)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', padding: '10px 0', color: 'var(--text-main)', fontWeight: 600, textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} title="Batch Campaign Manager">Campaigns</button>
            <button onClick={() => setShowSettings(true)} style={{ background: 'var(--active-chat)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', padding: '10px 0', color: 'var(--text-main)', fontWeight: 600, textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} title="Agent Brain Settings">Settings</button>
          </div>
        </div>

      </div>

      {/* Active Chat Window */}
      <div className="chat-window">
        {activeChat ? (
          <React.Fragment>
            <div className="chat-header">
              <div className="chat-header-info">
                <div className="avatar">{getAvatarChar(activeChat.name)}</div>
                <div>
                  <div className="chat-header-name">{activeChat.name}</div>
                  <div className="chat-header-status">{activeChat.id}</div>
                </div>
              </div>
            </div>

            <div className="messages-container">
              {messages.map((msg, index) => (
                <div key={index} className={`message-row ${msg.fromMe ? 'sent' : 'received'}`}>
                  <div className={`bubble ${msg.fromMe ? 'sent' : 'received'}`}>
                    {msg.body && <div className="bubble-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</div>}
                    {msg.hasMedia && msg.mediaData && (
                      <div className="message-media" style={{ marginTop: msg.body ? '0.4rem' : '0', maxWidth: '100%', borderRadius: '4px', overflow: 'hidden' }}>
                        <img 
                          src={`data:${msg.mimeType || 'image/jpeg'};base64,${msg.mediaData}`} 
                          alt="Attachment" 
                          style={{ maxWidth: '280px', maxHeight: '280px', display: 'block', borderRadius: '4px', cursor: 'pointer' }}
                          onClick={() => {
                            const w = window.open();
                            w.document.write(`<img src="data:${msg.mimeType || 'image/jpeg'};base64,${msg.mediaData}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                          }}
                        />
                      </div>
                    )}
                    <div className="bubble-meta">
                      <span>{formatTime(msg.timestamp)}</span>
                      {msg.fromMe && (
                        <span 
                          className="bubble-ticks" 
                          style={{ 
                            marginLeft: '4px', 
                            color: msg.sending ? 'var(--text-muted)' : '#34d399',
                            fontWeight: 'bold',
                            fontSize: '0.85rem'
                          }}
                        >
                          {msg.sending ? '✓' : '✓✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {loadingSuggestion && (
              <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'var(--hover-chat)', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                🤖 Analyzing history and generating draft suggestion...
              </div>
            )}

            {suggestion && !loadingSuggestion && (
              <div className="ai-suggestion-box" style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: 'var(--hover-chat)',
                borderTop: '1px solid var(--border-color)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                    🤖 AI Suggested Draft
                  </span>
                  <button 
                    onClick={() => setSuggestion('')} 
                    style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem'}}
                  >
                    Dismiss
                  </button>
                </div>
                <p style={{fontSize: '0.85rem', color: 'var(--text-main)', margin: 0, fontStyle: 'italic', lineHeight: 1.4}}>
                  "{suggestion}"
                </p>
                <div style={{display: 'flex', gap: '0.5rem', marginTop: '0.25rem'}}>
                  <button 
                    type="button"
                    onClick={() => {
                      setInputText(suggestion);
                      setSuggestion('');
                    }}
                    style={{
                      backgroundColor: 'var(--accent-green)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.3rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Use Draft
                  </button>
                  <button 
                    type="button"
                    onClick={async () => {
                      const msgText = suggestion;
                      setInputText('');
                      setSuggestion('');
                      setMessages(prev => [...prev, {
                        body: msgText,
                        fromMe: true,
                        timestamp: Math.floor(Date.now() / 1000)
                      }]);
                      await apiFetch(`/api/${tenantId}/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jid: activeChat.id, message: msgText })
                      });
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      color: 'var(--accent-blue)',
                      border: '1px solid var(--accent-blue)',
                      borderRadius: '4px',
                      padding: '0.3rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Send Instantly
                  </button>
                </div>
              </div>
            )}

            {/* Quick Preset Answers */}
            <div className="preset-answers-section" style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: 'var(--hover-chat)',
              borderTop: '1px solid var(--border-color)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  ⚡ QUICK ANSWERS (FAQ REFERENCE)
                </span>
              </div>
              <div style={{
                display: 'flex',
                gap: '0.4rem',
                overflowX: 'auto',
                paddingBottom: '0.2rem',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }} className="no-scrollbar">
                {(brainConfig?.autoReply?.rules && brainConfig.autoReply.rules.length > 0
                  ? brainConfig.autoReply.rules.map(r => ({
                      label: r.trigger.split(',')[0] || 'Quick Reply',
                      title: r.trigger,
                      text: r.response
                    }))
                  : PRESET_ANSWERS
                ).map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    title={preset.title}
                    onClick={() => setInputText(preset.text)}
                    style={{
                      flexShrink: 0,
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      borderRadius: '16px',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-sans)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--accent-green)';
                      e.currentTarget.style.color = '#ffffff';
                      e.currentTarget.style.borderColor = 'var(--accent-green)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-main)';
                      e.currentTarget.style.color = 'var(--text-main)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <form className="input-bar" onSubmit={handleSendMessage}>
              <span style={{cursor: 'pointer', fontSize: '1.25rem'}}>😊</span>
              <div className="input-form">
                <input 
                  type="text" 
                  className="chat-input" 
                  placeholder="Type a message" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </div>
              <button type="submit" style={{background: 'none', border: 'none'}}>
                <span className="send-icon">➤</span>
              </button>
            </form>
          </React.Fragment>
        ) : (
          <div className="placeholder-screen">
            <div className="placeholder-icon">💬</div>
            <h2 className="placeholder-title">WhatsApp Automation Agent</h2>
            <p className="placeholder-desc">
              Select any chat in the sidebar to review message logs or send manual overrides. All manual outgoing messages adhere to the queue delay limits.
            </p>
          </div>
        )}
      </div>

      {/* Right Sidebar: CRM Context */}
      {activeChat && (() => {
        const isCatering = activeChat?.isCateringLead || crmType === 'catering';
        const cateringData = activeChat?.isCateringLead ? activeChat.cateringDetails : (crmType === 'catering' ? crmContext : null);
        const customerName = activeChat?.isCateringLead ? activeChat.name : (crmType === 'catering' ? crmContext?.customer_name : '');
        const displayJid = activeChat.id ? activeChat.id.split('@')[0] : '';

        return (
          <div className="crm-sidebar" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem', 
            color: 'var(--text-main)',
            background: 'linear-gradient(180deg, var(--panel-bg) 0%, var(--bg-dark) 100%)',
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            padding: '1.25rem',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{isCatering ? '🍽️' : '📊'}</span>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                {isCatering ? 'Catering Lead Context' : 'Chef CRM Context'}
              </h3>
            </div>
            
            {isCatering ? (
              <React.Fragment>
                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '1rem', 
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)'
                }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--accent-blue)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>📋</span> Lead Details
                  </h4>
                  <div style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#fff', fontWeight: 500 }}>
                    {customerName || 'Unnamed Lead'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div>📞 {displayJid}</div>
                    {cateringData?.city && <div>📍 {cateringData.city}</div>}
                    {cateringData?.created_at && <div>📅 Created: {new Date(cateringData.created_at).toLocaleDateString()}</div>}
                    {cateringData?.status && (
                      <div style={{ marginTop: '0.2rem' }}>
                        Status: <span style={{ fontWeight: 600, color: 'var(--accent-blue)', background: 'rgba(83, 189, 235, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', textTransform: 'uppercase' }}>{cateringData.status}</span>
                      </div>
                    )}
                  </div>
                </div>

                {cateringData && (
                  <div style={{ 
                    background: 'rgba(255,255,255,0.03)', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    padding: '1rem', 
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    maxHeight: '450px',
                    overflowY: 'auto'
                  }}>
                    <h4 style={{ margin: '0', color: 'var(--accent-blue)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🍽️ Questionnaire
                    </h4>
                    
                    {cateringData.metadata && Object.entries(cateringData.metadata).map(([key, value]) => {
                      if (!value || typeof value === 'object') return null;
                      const displayKey = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                      return (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{displayKey}</span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', wordBreak: 'break-word' }}>{String(value)}</span>
                        </div>
                      );
                    })}
                    
                    {cateringData.raw_text && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Message / Raw Text</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                          {cateringData.raw_text}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            ) : loadingCrm ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center', 
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px',
                border: '1px dashed rgba(255,255,255,0.1)',
                padding: '2rem 1rem'
              }}>
                <div className="sync-bar-progress" style={{ width: '40px', height: '40px', borderRadius: '50%', animation: 'spin 1s linear infinite', border: '3px solid transparent', borderTopColor: 'var(--accent-blue)', borderRightColor: 'var(--accent-blue)', background: 'transparent' }}></div>
                <div style={{ fontWeight: 600, color: '#fff', marginTop: '1rem' }}>Fetching Profile...</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Searching CRM database</div>
              </div>
            ) : crmError ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center', 
                background: 'rgba(239, 68, 68, 0.05)',
                borderRadius: '12px',
                border: '1px dashed rgba(239, 68, 68, 0.2)',
                padding: '2rem 1rem'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.8 }}>⚠️</div>
                <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '0.5rem' }}>Lookup Failed</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{crmError}</div>
              </div>
            ) : crmContext ? (
              <React.Fragment>
                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '1rem', 
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)'
                }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--accent-blue)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🧑‍🍳</span> Core Profile
                  </h4>
                  <div style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#fff', fontWeight: 500 }}>{crmContext.chef_name || <span style={{color: 'var(--text-muted)', fontStyle: 'italic'}}>Unnamed Chef</span>}</div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(83, 189, 235, 0.1)', color: 'var(--accent-blue)', border: '1px solid rgba(83, 189, 235, 0.2)' }}>
                      {crmContext.plan ? crmContext.plan.toUpperCase() : 'NO PLAN'}
                    </span>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      📍 {crmContext.city || 'No City'}
                    </span>
                  </div>
                  
                  {crmContext.business_name && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>🏢</span> {crmContext.business_name}
                    </div>
                  )}
                </div>

                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '1rem', 
                  borderRadius: '12px',
                  marginTop: '1rem',
                  backdropFilter: 'blur(10px)'
                }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: '#10b981', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>📋</span> Compliance Status
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Food Safety (NVWA)</span>
                      <span style={{ fontWeight: 600, color: crmContext.food_safety_status === 'passed' ? '#10b981' : (crmContext.food_safety_status ? '#f59e0b' : 'var(--text-muted)') }}>
                        {crmContext.food_safety_status ? crmContext.food_safety_status.toUpperCase() : 'PENDING'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>KVK Registration</span>
                      <span style={{ fontWeight: 600, color: crmContext.kvk_status === 'approved' ? '#10b981' : (crmContext.kvk_status ? '#f59e0b' : 'var(--text-muted)') }}>
                        {crmContext.kvk_status ? crmContext.kvk_status.toUpperCase() : 'PENDING'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Kitchen Check (AI)</span>
                      <span style={{ fontWeight: 600, color: crmContext.chef_verification?.[0]?.kitchen_status === 'approved' ? '#10b981' : 'var(--text-muted)' }}>
                        {crmContext.chef_verification?.[0]?.kitchen_status ? crmContext.chef_verification[0].kitchen_status.toUpperCase() : 'NOT SUBMITTED'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '1rem', 
                  borderRadius: '12px',
                  marginTop: '1rem',
                  backdropFilter: 'blur(10px)'
                }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: '#f59e0b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🚀</span> Onboarding Progress
                  </h4>
                  
                  {crmContext.chef_onboarding_steps && crmContext.chef_onboarding_steps.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {crmContext.chef_onboarding_steps.map((step, idx) => (
                        <div key={idx} style={{ 
                          fontSize: '0.85rem', 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          gap: '0.5rem',
                          padding: '0.4rem',
                          background: step.is_completed ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                          borderRadius: '6px'
                        }}>
                          <span style={{ marginTop: '2px' }}>{step.is_completed ? '✅' : '⏳'}</span>
                          <span style={{ color: step.is_completed ? '#fff' : 'var(--text-muted)' }}>{step.step_name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      No onboarding steps recorded yet.
                    </div>
                  )}
                </div>
              </React.Fragment>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center', 
                color: 'var(--text-muted)', 
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                padding: '2rem 1rem'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🕵️‍♂️</div>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>No CRM Profile Found</div>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>This WhatsApp number is not registered as an active Chef or Catering Lead in the database.</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Settings Modal */}
      {showSettings && (
        <div className="overlay" style={{ zIndex: 1200 }}>
          <div className="qr-modal" style={{ maxWidth: '600px', width: '90%', textAlign: 'left', display: 'block', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>⚙️ Agent Brain Settings</h2>
              <button 
                onClick={() => setShowSettings(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}
              >
                ×
              </button>
            </div>

            {/* Config Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              saveBrainConfig(brainConfig);
            }}>
              
              {/* Profile Identity Name */}
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.2rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--accent-green)', marginBottom: '0.4rem' }}> Profile Identity</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.6rem' }}>
                  Give this WhatsApp session / tenant ID a friendly nickname (e.g., "Main Sales Line", "Adomas Account") so you can switch easily.
                </span>
                <input 
                  type="text"
                  className="chat-input"
                  style={{ backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.45rem 0.75rem', width: '100%', fontSize: '0.9rem' }}
                  placeholder="e.g. Sales Phone 2, Client Support..."
                  value={brainConfig.profileName || ''}
                  onChange={(e) => setBrainConfig({
                    ...brainConfig,
                    profileName: e.target.value
                  })}
                />
              </div>

              {/* Catering Leads Auto Welcome */}
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.2rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--accent-blue)', marginBottom: '0.4rem' }}>✉️ Catering Leads Auto Welcome</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                  <input 
                    type="checkbox" 
                    checked={brainConfig.cateringWelcomeEnabled || false}
                    onChange={(e) => setBrainConfig({
                      ...brainConfig,
                      cateringWelcomeEnabled: e.target.checked
                    })}
                  />
                  <span>Send automatic welcome message from this WhatsApp profile</span>
                </label>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginLeft: '1.5rem' }}>
                  When checked, this account will greet new signups in the <code>booking_submissions</code> table (via Supabase Realtime / Polling).
                </span>
                {brainConfig.cateringWelcomeEnabled && (
                  <div style={{ marginLeft: '1.5rem', marginTop: '0.8rem' }}>
                    <textarea 
                      className="chat-input"
                      style={{ backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.6rem', width: '100%', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical' }}
                      value={brainConfig.cateringWelcomeMessage || ''}
                      onChange={(e) => setBrainConfig({ ...brainConfig, cateringWelcomeMessage: e.target.value })}
                      placeholder="Enter welcome message. Use {Name} to insert lead's name."
                    />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Use <code>{`{Name}`}</code> to dynamically insert the lead's first name.</div>
                  </div>
                )}
              </div>

              {/* CRM No Answer Auto-Followup */}
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.2rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--accent-green)', marginBottom: '0.4rem' }}>☎️ CRM "No Answer" Followup</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                  <input 
                    type="checkbox" 
                    checked={brainConfig.noAnswerFollowupEnabled || false}
                    onChange={(e) => setBrainConfig({
                      ...brainConfig,
                      noAnswerFollowupEnabled: e.target.checked
                    })}
                  />
                  <span>Automatically send WhatsApp followups when CRM status changes</span>
                </label>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginLeft: '1.5rem' }}>
                  When checked, this account will instantly dispatch a "Hey, we missed you" message if an admin marks a lead as <code>no_answer</code> in the CRM layer.
                </span>
                {brainConfig.noAnswerFollowupEnabled && (
                  <div style={{ marginLeft: '1.5rem', marginTop: '0.8rem' }}>
                    <textarea 
                      className="chat-input"
                      style={{ backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.6rem', width: '100%', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical' }}
                      value={brainConfig.noAnswerFollowupMessage || ''}
                      onChange={(e) => setBrainConfig({ ...brainConfig, noAnswerFollowupMessage: e.target.value })}
                      placeholder="Enter no-answer followup message. Use {Name} to insert chef's name."
                    />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Use <code>{`{Name}`}</code> to dynamically insert the chef's first name.</div>
                  </div>
                )}
              </div>

              {/* Catering No Answer Auto-Followup */}
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.2rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--accent-green)', marginBottom: '0.4rem' }}>🍽️ Catering "No Answer" Followup</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                  <input 
                    type="checkbox" 
                    checked={brainConfig.cateringNoAnswerFollowupEnabled || false}
                    onChange={(e) => setBrainConfig({
                      ...brainConfig,
                      cateringNoAnswerFollowupEnabled: e.target.checked
                    })}
                  />
                  <span>Automatically send WhatsApp followups when Catering Lead status changes</span>
                </label>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginLeft: '1.5rem' }}>
                  When checked, this account will instantly dispatch a followup message if an admin marks a catering lead as <code>no_answer</code> in the CRM.
                </span>
                {brainConfig.cateringNoAnswerFollowupEnabled && (
                  <div style={{ marginLeft: '1.5rem', marginTop: '0.8rem' }}>
                    <textarea 
                      className="chat-input"
                      style={{ backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.6rem', width: '100%', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical' }}
                      value={brainConfig.cateringNoAnswerFollowupMessage || ''}
                      onChange={(e) => setBrainConfig({ ...brainConfig, cateringNoAnswerFollowupMessage: e.target.value })}
                      placeholder="Enter catering no-answer followup message. Use {Name} to insert lead's name."
                    />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Use <code>{`{Name}`}</code> to dynamically insert the lead's first name.</div>
                  </div>
                )}
              </div>

              {/* SendGrid Email Alerts */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>SendGrid Email Alerts</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    checked={brainConfig.emailNotification?.enabled || false}
                    onChange={(e) => setBrainConfig({
                      ...brainConfig,
                      emailNotification: { ...brainConfig.emailNotification, enabled: e.target.checked }
                    })}
                  />
                  <span>Email me when important messages require human response</span>
                </label>
                {(brainConfig.emailNotification?.enabled) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                      📧 Email parameters (sender, recipient, and SendGrid API key) are loaded securely from the backend `.env` configuration.
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Subject Line</label>
                      <input 
                        type="text"
                        className="chat-input"
                        style={{ backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem 0.75rem', width: '100%', fontSize: '0.85rem' }}
                        placeholder="⚠️ Urgent: WhatsApp Action Required"
                        value={brainConfig.emailNotification?.subject || ''}
                        onChange={(e) => setBrainConfig({
                          ...brainConfig,
                          emailNotification: { ...brainConfig.emailNotification, subject: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Welcome Message */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>Welcome Message Bot</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    checked={brainConfig.welcomeMessage?.enabled || false}
                    onChange={(e) => setBrainConfig({
                      ...brainConfig,
                      welcomeMessage: { ...brainConfig.welcomeMessage, enabled: e.target.checked }
                    })}
                  />
                  <span>Send auto-welcome message on first contact</span>
                </label>
                {(brainConfig.welcomeMessage?.enabled) && (
                  <textarea 
                    className="chat-input"
                    style={{ backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', minHeight: '60px', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }}
                    placeholder="Type welcome message template..."
                    value={brainConfig.welcomeMessage?.template || ''}
                    onChange={(e) => setBrainConfig({
                      ...brainConfig,
                      welcomeMessage: { ...brainConfig.welcomeMessage, template: e.target.value }
                    })}
                    required
                  />
                )}
              </div>

              {/* Keyword Auto Replies */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--accent-blue)', margin: 0 }}>Keyword Auto-Replies</h3>
                  <button 
                    type="button"
                    onClick={() => {
                      const rules = [...(brainConfig.autoReply?.rules || [])];
                      rules.push({ trigger: '', response: '' });
                      setBrainConfig({ ...brainConfig, autoReply: { ...brainConfig.autoReply, rules } });
                    }}
                    style={{ backgroundColor: 'transparent', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    + Add Rule
                  </button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  <input 
                    type="checkbox" 
                    checked={brainConfig.autoReply?.enabled || false}
                    onChange={(e) => setBrainConfig({
                      ...brainConfig,
                      autoReply: { ...brainConfig.autoReply, enabled: e.target.checked }
                    })}
                  />
                  <span>Enable keyword-triggered replies</span>
                </label>

                {(brainConfig.autoReply?.enabled) && (brainConfig.autoReply?.rules || []).map((rule, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      className="chat-input"
                      placeholder="Keyword"
                      style={{ flex: 1, backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                      value={rule.trigger}
                      onChange={(e) => {
                        const rules = [...brainConfig.autoReply.rules];
                        rules[idx].trigger = e.target.value;
                        setBrainConfig({ ...brainConfig, autoReply: { ...brainConfig.autoReply, rules } });
                      }}
                      required
                    />
                    <input 
                      type="text" 
                      className="chat-input"
                      placeholder="Auto Reply Text"
                      style={{ flex: 2, backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                      value={rule.response}
                      onChange={(e) => {
                        const rules = [...brainConfig.autoReply.rules];
                        rules[idx].response = e.target.value;
                        setBrainConfig({ ...brainConfig, autoReply: { ...brainConfig.autoReply, rules } });
                      }}
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        const rules = brainConfig.autoReply.rules.filter((_, rIdx) => rIdx !== idx);
                        setBrainConfig({ ...brainConfig, autoReply: { ...brainConfig.autoReply, rules } });
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* AI Agent Settings */}
              <div style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>AI Agent Auto-Responder</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  <input 
                    type="checkbox" 
                    checked={brainConfig.aiAgent?.enabled || false}
                    onChange={(e) => setBrainConfig({
                      ...brainConfig,
                      aiAgent: { ...brainConfig.aiAgent, enabled: e.target.checked }
                    })}
                  />
                  <span>Enable fully automated AI agent auto-responder (DMs only)</span>
                </label>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Provider</label>
                    <select
                      style={{ backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', padding: '0.4rem 0.5rem', width: '100%', fontSize: '0.9rem' }}
                      value={brainConfig.aiAgent?.provider || 'gemini'}
                      onChange={(e) => setBrainConfig({
                        ...brainConfig,
                        aiAgent: { ...brainConfig.aiAgent, provider: e.target.value }
                      })}
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, paddingTop: '1.2rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    🔑 API Key is loaded securely from the server's `.env` configuration.
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>System Instructions Prompt</label>
                  <textarea 
                    className="chat-input"
                    style={{ backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', minHeight: '85px', fontFamily: 'inherit', fontSize: '0.85rem', resize: 'vertical' }}
                    placeholder="Give the AI a persona, instructions and policies..."
                    value={brainConfig.aiAgent?.systemPrompt || ''}
                    onChange={(e) => setBrainConfig({
                      ...brainConfig,
                      aiAgent: { ...brainConfig.aiAgent, systemPrompt: e.target.value }
                    })}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem' }}>
                <button 
                  type="button"
                  onClick={() => setShowSettings(false)}
                  style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ backgroundColor: 'var(--accent-green)', border: 'none', color: '#ffffff', borderRadius: '6px', padding: '0.5rem 1.5rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* New Chat Modal */}
      {showNewChat && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: 'var(--bg-chat)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '90%', maxWidth: '450px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>Start New Chat</h2>
              <button onClick={() => setShowNewChat(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSendNewChat}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. +31612345678" 
                    value={newChatPhone}
                    onChange={(e) => setNewChatPhone(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>First Message</label>
                  <textarea 
                    placeholder="Type your initial message..." 
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    required
                    rows={4}
                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowNewChat(false)} 
                  style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSendingNewChat}
                  style={{ backgroundColor: 'var(--accent-green)', border: 'none', color: '#ffffff', borderRadius: '6px', padding: '0.5rem 1.5rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600, opacity: isSendingNewChat ? 0.6 : 1 }}
                >
                  {isSendingNewChat ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Batch Campaign Manager Modal */}
      {showCampaigns && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: 'var(--bg-chat)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Batch Campaign Manager <span style={{ fontSize: '0.8rem', background: 'var(--hover-chat)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>{tenantId}</span>
              </h2>
              <button onClick={() => setShowCampaigns(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Filter Target Audience</h3>
                <select 
                  style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', marginBottom: '1rem' }}
                  value={campaignFilter}
                  onChange={(e) => {
                    setCampaignFilter(e.target.value);
                    setSelectedCampaignProfiles(new Set()); // Reset selection on filter change
                  }}
                >
                  <option value="all">All Profiles</option>
                  <option value="amsterdam">Location: Amsterdam</option>
                  <option value="delivery">Has Delivery (Service Type)</option>
                  <option value="no_delivery">No Delivery</option>
                  <option value="amsterdam_delivery">Amsterdam & Has Delivery</option>
                </select>

                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--app-bg)' }}>
                  {(() => {
                    const filteredProfiles = campaignProfiles.filter(p => {
                      const isAmsterdam = p.city?.toLowerCase().includes('amsterdam');
                      const hasDelivery = p.service_type === 'delivery' || p.service_type === 'both' || p.service_type === 'takeaway_delivery';
                      
                      if (campaignFilter === 'amsterdam') return isAmsterdam;
                      if (campaignFilter === 'delivery') return hasDelivery;
                      if (campaignFilter === 'no_delivery') return !hasDelivery;
                      if (campaignFilter === 'amsterdam_delivery') return isAmsterdam && hasDelivery;
                      return true;
                    });
                    
                    const allSelected = filteredProfiles.length > 0 && filteredProfiles.every(p => selectedCampaignProfiles.has(p.contact_phone));
                    
                    return (
                      <>
                        {filteredProfiles.length > 0 && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderBottom: '2px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                            <input 
                              type="checkbox" 
                              checked={allSelected}
                              onChange={(e) => {
                                const next = new Set(selectedCampaignProfiles);
                                if (e.target.checked) {
                                  filteredProfiles.forEach(p => next.add(p.contact_phone));
                                } else {
                                  filteredProfiles.forEach(p => next.delete(p.contact_phone));
                                }
                                setSelectedCampaignProfiles(next);
                              }}
                            />
                            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>Select All ({filteredProfiles.length})</span>
                          </label>
                        )}
                        {filteredProfiles.map((profile, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedCampaignProfiles.has(profile.contact_phone)}
                          onChange={(e) => {
                            const next = new Set(selectedCampaignProfiles);
                            if (e.target.checked) next.add(profile.contact_phone);
                            else next.delete(profile.contact_phone);
                            setSelectedCampaignProfiles(next);
                          }}
                        />
                        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{profile.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{profile.contact_phone} • {profile.city}</span>
                        </div>
                      </label>
                  ))}
                  {filteredProfiles.length === 0 && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No profiles found.</div>
                  )}
                      </>
                    );
                  })()}
                </div>
                
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--accent-blue)' }}>
                  {selectedCampaignProfiles.size} selected
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Campaign Message</h3>
                <textarea 
                  className="chat-input"
                  style={{ flex: 1, backgroundColor: 'var(--hover-chat)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem', color: 'var(--text-main)', fontSize: '0.9rem', resize: 'none', marginBottom: '1rem' }}
                  placeholder="Type the message to broadcast..."
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                />
                <button 
                  onClick={handleSendCampaign}
                  disabled={isSendingCampaign || selectedCampaignProfiles.size === 0 || !campaignMessage.trim()}
                  style={{ backgroundColor: 'var(--accent-green)', border: 'none', color: 'white', padding: '0.75rem', borderRadius: '6px', fontWeight: 600, cursor: (isSendingCampaign || selectedCampaignProfiles.size === 0 || !campaignMessage.trim()) ? 'not-allowed' : 'pointer', opacity: (isSendingCampaign || selectedCampaignProfiles.size === 0 || !campaignMessage.trim()) ? 0.5 : 1 }}
                >
                  {isSendingCampaign ? 'Queueing Campaign...' : `Send to ${selectedCampaignProfiles.size} Chefs`}
                </button>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                  Messages will be sent with a 5-15 second random delay to simulate human typing and prevent WhatsApp bans.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
