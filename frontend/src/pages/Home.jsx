import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, Mail, BookOpen, CreditCard, Award, User, Users, Briefcase, AlertCircle, CheckCircle, ArrowRight, ArrowLeft, ChevronRight, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';
import '../styles/Home.css';
import Footer from '../components/Footer';
import getApiBaseUrl from '../utils/apiConfig';
const Home = () => {
  const [showModal, setShowModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'assistant', content: 'Hello! I am the Scaler AI assistant. How can I help you today?' }]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [viewArticle, setViewArticle] = useState(null);
  const [viewCategory, setViewCategory] = useState(null);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [liveArticles, setLiveArticles] = useState([]);
  const [popularTopics, setPopularTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        if (!event.target.closest('.popular-searches')) {
          setIsSearchFocused(false);
          setTimeout(() => setSearchQuery(''), 150);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [escalationStep, setEscalationStep] = useState('guidance'); // 'guidance', 'form', 'success'
  const [escalationData, setEscalationData] = useState({ ticketId: '', email: '', description: '' });
  const [escalationErrors, setEscalationErrors] = useState({ ticketId: '', email: '', description: '' });
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chatInputRef = useRef(null);
  const chatTriggerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && showEscalationModal) {
        setShowEscalationModal(false);
        resetEscalationForm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showEscalationModal]);

  const openChatModal = () => {
    chatTriggerRef.current = document.activeElement;
    setShowModal(true);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && showModal) {
        // Check if there's unsaved input
        if (chatInput.trim()) {
          if (window.confirm('You have unsaved message. Are you sure you want to close the chat?')) {
            setShowModal(false);
            setChatInput('');
            // Restore focus to the trigger element
            if (chatTriggerRef.current) {
              chatTriggerRef.current.focus();
            }
          }
        } else {
          setShowModal(false);
          // Restore focus to the trigger element
          if (chatTriggerRef.current) {
            chatTriggerRef.current.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, chatInput]);

  // Auto-focus chat input when modal opens
  useEffect(() => {
    if (showModal && chatInputRef.current) {
      setTimeout(() => {
        chatInputRef.current.focus();
      }, 100);
    }
  }, [showModal]);

  const handleEscalationSubmit = (e) => {
    e.preventDefault();
    let errors = { ticketId: '', email: '', description: '' };
    let hasError = false;

    if (!escalationData.ticketId.trim()) {
      errors.ticketId = 'Support Ticket ID is required';
      hasError = true;
    }
    if (!escalationData.email.trim()) {
      errors.email = 'Please enter a valid email ID';
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(escalationData.email)) {
      errors.email = 'Please enter a valid email ID';
      hasError = true;
    }
    if (!escalationData.description.trim()) {
      errors.description = 'Issue Description is required';
      hasError = true;
    }

    if (hasError) {
      setEscalationErrors(errors);
      return;
    }

    setEscalationErrors({ ticketId: '', email: '', description: '' });
    setIsSubmitting(true);
    
    // Mock submission API delay
    setTimeout(() => {
      setEscalationStep('success');
    }, 1500);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [];
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    files.forEach(file => {
      if (file.size > maxSize) {
        alert(`File ${file.name} exceeds 5MB limit`);
        return;
      }
      if (!allowedTypes.includes(file.type)) {
        alert(`File ${file.name} is not a supported format`);
        return;
      }
      validFiles.push(file);
    });

    setAttachedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetEscalationForm = () => {
    setEscalationStep('guidance');
    setEscalationData({ ticketId: '', email: '', description: '' });
    setEscalationErrors({ ticketId: '', email: '', description: '' });
    setAttachedFiles([]);
    setIsSubmitting(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    const validFiles = [];
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    files.forEach(file => {
      if (file.size > maxSize) {
        alert(`File ${file.name} exceeds 5MB limit`);
        return;
      }
      if (!allowedTypes.includes(file.type)) {
        alert(`File ${file.name} is not a supported format`);
        return;
      }
      validFiles.push(file);
    });

    setAttachedFiles(prev => [...prev, ...validFiles]);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get the API base URL
        const API_BASE_URL = getApiBaseUrl();
        
        // Fetch articles and popular topics in parallel
        const [articlesRes, topicsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/articles`),
          fetch(`${API_BASE_URL}/api/popular-topics`)
        ]);
        
        console.log('Articles response status:', articlesRes.status);
        console.log('Topics response status:', topicsRes.status);
        
        if (!articlesRes.ok || !topicsRes.ok) {
          console.error('API Response errors:', {
            articles: await articlesRes.text(),
            topics: await topicsRes.text()
          });
          throw new Error(`Failed to fetch data. Articles: ${articlesRes.status}, Topics: ${topicsRes.status}`);
        }
        
        const articlesData = await articlesRes.json();
        const topicsData = await topicsRes.json();
        
        // Process articles
        const published = articlesData.filter(a => a.status === 'published');
        setLiveArticles(published);
        
        const counts = {};
        published.forEach(a => counts[a.category] = (counts[a.category] || 0) + 1);
        setCategoryCounts(counts);
        
        // Set popular topics
        setPopularTopics(topicsData);
        
      } catch (err) {
        console.error('Failed to fetch data:', err);
        console.error('Attempted API URL:', getApiBaseUrl());
        setError('Unable to load help content. Please refresh the page.');
        // Set fallback category counts to show static cards
        setCategoryCounts({
          'Course & Curriculum': 0,
          'Billing & Payments': 0,
          'Certificates': 0,
          'Account & Login': 0,
          'Mentorship': 0,
          'Placements': 0
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Set up real-time polling every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getCategoryColors = (title) => {
    const colors = {
      'Course & Curriculum': { iconColor: '#8B5CF6', bgColor: 'from-purple-50 to-purple-100' },
      'Billing & Payments': { iconColor: '#EC4899', bgColor: 'from-pink-50 to-rose-100' },
      'Certificates': { iconColor: '#10B981', bgColor: 'from-emerald-50 to-green-100' },
      'Account & Login': { iconColor: '#F59E0B', bgColor: 'from-orange-50 to-amber-100' },
      'Mentorship': { iconColor: '#0EA5E9', bgColor: 'from-blue-50 to-cyan-100' },
      'Placements': { iconColor: '#6366F1', bgColor: 'from-indigo-50 to-purple-100' },
      'Account & Access': { iconColor: '#F59E0B', bgColor: 'from-orange-50 to-amber-100' },
      'Career & Placements': { iconColor: '#6366F1', bgColor: 'from-indigo-50 to-purple-100' },
      'Certifications': { iconColor: '#10B981', bgColor: 'from-emerald-50 to-green-100' }
    };
    return colors[title] || { iconColor: '#6B7280', bgColor: 'from-gray-50 to-gray-100' };
  };

  const predefinedTopics = [
    { id: 'Course & Curriculum', icon: <BookOpen />, title: "Course & Curriculum", desc: "Syllabus, modules, schedule, content queries" },
    { id: 'Billing & Payments', icon: <CreditCard />, title: "Billing & Payments", desc: "EMI, refunds, invoices, payment issues" },
    { id: 'Certificates', icon: <Award />, title: "Certificates", desc: "Completion certificates, downloads" },
    { id: 'Account & Login', icon: <User />, title: "Account & Login", desc: "Password reset, profile, access issues" },
    { id: 'Mentorship', icon: <Users />, title: "Mentorship", desc: "Mentor sessions, scheduling, feedback" },
    { id: 'Placements', icon: <Briefcase />, title: "Placements", desc: "Job referrals, mock interviews, career support" }
  ];

  const formatDate = (dateString) => {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  let topics = predefinedTopics.map(t => ({ ...t, count: categoryCounts[t.id] || 0 }));
  Object.keys(categoryCounts).forEach(cat => {
    if (!topics.find(t => t.title === cat)) {
      topics.push({ icon: <BookOpen />, title: cat, desc: `Explore articles in ${cat}`, count: categoryCounts[cat] || 0 });
    }
  });
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { role: 'user', content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setIsTyping(true);

    try {
      // Use the same API base URL configuration
      const API_BASE_URL = getApiBaseUrl();
      
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      const data = await res.json();
      
      if (res.ok) {
        setChatMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      } else {
        setChatMessages([...newMessages, { role: 'assistant', content: `API Logic Error: ${data.error}` }]);
      }
    } catch (err) {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Connection failed. Please ensure the backend server is running correctly.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="home-container">
      <header className="header sticky-header">
        <div className="header-left">
          <a href="/" className="premium-logo" aria-label="Scaler Homepage">
            <svg className="scaler-official-logo" viewBox="0 0 1324 280" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1147.8 228.928C1147.58 228.163 1147.43 227.38 1147.35 226.588C1147.35 195.638 1147.35 164.685 1147.35 133.728C1147.35 132.188 1147.27 130.638 1147.35 129.107C1147.48 127.177 1148.36 125.377 1149.81 124.096C1156.13 117.876 1162.49 111.695 1168.78 105.436C1181.25 92.9706 1193.71 80.4789 1206.15 67.9611C1210.83 63.2881 1215.52 58.6475 1220.23 54.0395C1220.93 53.4591 1221.68 52.9374 1222.46 52.4796H1323.1C1323.4 53.2759 1323.6 54.1037 1323.7 54.9461C1323.7 86.3121 1323.7 117.671 1323.7 149.024C1323.74 149.682 1323.84 150.334 1324 150.974V154.065C1322.96 155.235 1321.97 156.463 1320.87 157.574C1316.55 161.929 1312.22 166.264 1307.87 170.58C1302.33 176.049 1296.72 181.45 1291.21 186.938C1278.13 199.976 1265.07 213.024 1252.02 226.081C1251.05 227.114 1249.84 228.031 1248.75 229.006L1147.8 228.928ZM1249.37 217.901L1250.1 218.418C1252.18 216.127 1254.17 213.739 1256.34 211.545C1265.13 202.738 1273.95 193.964 1282.79 185.223C1283.28 184.772 1283.66 184.221 1283.91 183.608C1284.15 182.995 1284.27 182.335 1284.23 181.674C1284.19 152.992 1284.19 124.314 1284.23 95.6386C1284.23 95.3267 1284.23 95.0147 1284.23 94.6637C1284.29 93.2599 1283.87 92.6164 1282.22 92.6164C1253.22 92.6749 1224.22 92.6749 1195.22 92.6164C1194.55 92.5983 1193.89 92.7219 1193.27 92.979C1192.66 93.2362 1192.1 93.621 1191.65 94.108C1181.29 104.507 1170.93 114.867 1160.57 125.188C1160.23 125.529 1159.92 125.909 1159.35 126.553H1249.4L1249.37 217.901ZM1219.15 177.394V159.592C1219.15 157.067 1219.05 156.96 1216.57 156.96H1181.12C1180.65 156.96 1180.14 157.019 1179.72 156.96C1178.26 156.96 1177.77 157.662 1177.77 159.076C1177.81 171.255 1177.81 183.429 1177.77 195.596C1177.77 197.136 1178.41 197.789 1179.86 197.76C1181.66 197.76 1183.46 197.623 1185.26 197.623C1195.9 197.623 1206.53 197.623 1217.16 197.623C1219.11 197.623 1219.11 197.623 1219.11 195.615C1219.11 189.532 1219.11 183.445 1219.11 177.355" fill="#3B5BDB"></path>
              <path d="M52.9678 99.3528C52.9678 107.503 58.2908 112.095 90.0142 117.778H90.0337C153.305 129.136 165.979 148.166 165.979 175.2C165.979 191.725 158.014 230.185 84.272 230.185C56.4483 230.185 8.5902 222.941 0.430245 174.459L0.0402832 172.139H44.9541L45.4026 173.504C50.6476 189.288 63.8185 196.327 88.1132 196.327C116.707 196.327 120.012 186.655 120.012 179.383C120.012 169.292 113.548 163.073 78.2374 157.077C15.8337 146.402 7.23508 124.934 7.23508 103.33C7.23508 71.1293 36.4627 50.3151 81.708 50.3151C149.142 50.3151 158.228 89.5745 159.427 101.605L159.642 103.789H114.855L114.436 102.346C111.881 93.3669 105.837 84.2027 80.4407 84.2027C67.9034 84.2027 52.9678 86.8252 52.9678 99.3528Z" fill="#17181c"></path>
              <path fillRule="evenodd" clipRule="evenodd" d="M500.332 228.927H551.115L484.841 52.411H425.732L359.176 228.927H408.808L422.291 189.083H487.132L500.332 228.927ZM454.716 86.3864L477.958 157.759H431.474L454.716 86.3864Z" fill="#17181c"></path>
              <path d="M622.556 193.353H717.521V228.927H573.206V52.411H622.556V193.353Z" fill="#17181c"></path>
              <path d="M740.578 52.411V228.927H887.779V193.353H789.918V157.252H881.705V123.813H789.918V87.9755H888.042V52.411H740.578Z" fill="#17181c"></path>
              <path fillRule="evenodd" clipRule="evenodd" d="M1001.27 52.411C1023.84 52.411 1041.39 57.357 1053.91 67.2491C1066.44 77.1411 1072.7 90.2926 1072.7 106.703C1072.7 124.713 1066.48 138.443 1054.05 147.893C1048.56 152.064 1042.09 155.315 1034.62 157.645L1083.96 228.927H1029.44L989.014 164.476H959.405V228.927H910.913V52.411H1001.27ZM994.443 131.846C1004 131.846 1011.18 130.062 1015.96 126.494C1020.74 122.926 1023.13 117.219 1023.13 109.375C1023.13 101.712 1020.74 96.0965 1015.96 92.5283C1011.18 88.9602 1004 87.1761 994.443 87.1761H959.444V131.846H994.443Z" fill="#17181c"></path>
              <path d="M223.079 141.04C223.079 170.55 243.542 190.808 270.294 190.808C289.967 190.808 305.117 177.647 311.415 157.174H353.706C346.434 208.513 313.024 229.171 270.294 229.171C216.196 229.171 179.013 193.168 179.013 141.04C179.013 88.7067 216.196 52.8985 270.294 52.8985C303.284 52.8985 336.704 65.504 349.505 102.755L309.826 116.199C302.787 99.0602 288.485 91.261 270.294 91.261C243.542 91.261 223.079 111.529 223.079 141.04Z" fill="#17181c"></path>
            </svg>
          </a>
        </div>
        <div className="header-right">
          <a href="#" className="header-help-cta">
            <span className="help-emoji">👋</span> Need help?
          </a>
        </div>
      </header>

      <section className="hero-section">
        <h1>How can we help you today?</h1>
        <p className="hero-subtext">Search our knowledge base or browse topics below</p>
        
        <div className="search-wrapper" ref={searchRef}>
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            placeholder="Search for help articles, FAQs..." 
            className="main-search-input"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setIsSearchFocused(true); }}
            onFocus={() => setIsSearchFocused(true)}
          />
          {searchQuery && isSearchFocused && (
            <div className="search-results-dropdown">
              {liveArticles.filter(a => a.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase())).length > 0 ? (
                liveArticles.filter(a => a.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase())).slice(0, 5).map(a => (
                   <div key={a.id} className="search-result-item" onClick={() => { setViewArticle(a); setSearchQuery(''); setIsSearchFocused(false); }}>
                     <div className="result-info">
                       <h4>{a.title}</h4>
                       <span className="result-date">Updated: {formatDate(a.updated_at)}</span>
                     </div>
                     <span className="cat-badge">{a.category}</span>
                   </div>
                ))
              ) : searchQuery === debouncedSearchQuery ? (
                <div className="search-result-item no-results">No articles found across live database</div>
              ) : null}
            </div>
          )}
        </div>
        
        {/* Dynamic Popular Topics */}
        {popularTopics.length > 0 && (
          <div className="popular-searches">
            <span>Popular:</span>
            {popularTopics.map((topic) => (
              <div 
                key={topic.id} 
                className="search-chip" 
                onClick={() => { 
                  setSearchQuery(topic.label); 
                  setIsSearchFocused(true); 
                }}
              >
                {topic.label}
              </div>
            ))}
          </div>
        )}
        
        {/* Loading State */}
        {isLoading && (
          <div className="popular-searches loading-skeleton">
            <span>Popular:</span>
            <div className="skeleton-chip"></div>
            <div className="skeleton-chip"></div>
            <div className="skeleton-chip"></div>
            <div className="skeleton-chip"></div>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div className="error-state">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => window.location.reload()} className="retry-btn">Retry</button>
          </div>
        )}


      </section>

      <main className="main-content">
        <div className="section-header">
          <h2 className="section-title">Browse by Topic</h2>
          <p className="section-subtitle">Choose a category to find the right answers faster</p>
        </div>
        <div className="topics-grid">
          {topics.map((topic, idx) => {
            const colors = getCategoryColors(topic.title);
            return (
              <div key={idx} className="topic-card enhanced-gradient" onClick={() => setViewCategory(topic.title)}>
                {/* Popular badge for Certificates */}
                {topic.title === 'Certificates' && (
                  <span className="popular-badge">⭐ Popular</span>
                )}
                
                {/* Layer 1: Full card pastel blob */}
                <div className={`topic-card-bg ${colors.bgColor}`}></div>
                
                {/* Layer 2: Icon glow halo */}
                <div className="topic-icon-glow"></div>
                
                {/* Layer 3: Icon pill with gradient */}
                <div className="topic-icon-wrapper-gradient" style={{ background: `linear-gradient(135deg, ${colors.iconColor}, ${colors.iconColor}dd)` }}>
                  <div className="topic-icon-inner">
                    {topic.icon}
                  </div>
                </div>
                
                <div className="topic-info">
                  <h3>{topic.title}</h3>
                  <p>{topic.desc}</p>
                  <div className="topic-meta">
                    <span className="article-count-badge">{topic.count || 0} {topic.count === 1 ? 'article' : 'articles'}</span>
                    <ArrowRight className="topic-arrow" size={20} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <section className="personal-assistance-section">
          <div className="cosmic-bg"></div>
          <div className="max-w-4xl mx-auto">
            <div className="section-header">
              <h2 className="section-title">Need Personal Assistance?</h2>
              <p className="section-subtitle">Choose the best way to get in touch with our expert support team</p>
            </div>
            <div className="assistance-cards-grid">
              {/* Chat with Dev Card */}
              <div className="assistance-card chat-card">
                <div className="card-accent-bar blue"></div>
                <span className="recommended-badge-new">RECOMMENDED</span>
                <div className="assistance-icon-wrapper blue">
                  <MessageCircle size={24} />
                </div>
                <h3>Still need help?</h3>
                <p className="dev-availability">Dev is available 24×7, 7 days a week to handle most of your queries.</p>
                <p className="support-availability">
                  For additional support, our support team is available from 7 AM to 11 PM IST, 7 days a week.
                </p>
                <button className="assistance-cta-btn blue" onClick={openChatModal}>
                  <MessageCircle size={20} />
                  Chat with Dev
                </button>
              </div>

              {/* Raise an Escalation Card */}
              <div className="assistance-card escalation-card">
                <div className="card-accent-bar amber"></div>
                <div className="assistance-icon-wrapper amber">
                  <Mail size={24} />
                </div>
                <h3>Not satisfied with the resolution?</h3>
                <p>Not resolved? Raise an escalation after 24 hours.</p>
                <p className="availability-text">
                  <Clock size={16} className="inline-clock" />
                  Mon–Fri, 11 AM – 8 PM IST
                </p>
                <div className="warning-box">
                  ⚠️ Reach out to support first. Escalate only after 24 hours if unsatisfied.
                </div>
                <button className="assistance-cta-btn amber" onClick={() => { setShowEscalationModal(true); setEscalationStep('guidance'); }}>
                  <Mail size={20} />
                  Raise an Escalation
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Existing Chatbot Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => {
              if (chatInput.trim()) {
                if (window.confirm('You have unsaved message. Are you sure you want to close the chat?')) {
                  setShowModal(false);
                  setChatInput('');
                  if (chatTriggerRef.current) {
                    chatTriggerRef.current.focus();
                  }
                }
              } else {
                setShowModal(false);
                if (chatTriggerRef.current) {
                  chatTriggerRef.current.focus();
                }
              }
            }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Chat Support</h3>
            <p style={{marginBottom: '1rem', color: '#64748b'}}>Powered by OpenAI Contextual Logic.</p>
            <div className="chat-interface">
              <div className="chat-messages">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`msg ${msg.role === 'assistant' ? 'bot' : 'user'}`}>
                    {msg.content}
                  </div>
                ))}
                {isTyping && <div className="msg bot typing">Thinking...</div>}
              </div>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '1rem' }}>
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  className="chat-input" 
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={isTyping}
                />
                <button type="submit" disabled={isTyping || !chatInput.trim()} className="chat-send-btn">Send</button>
              </form>
            </div>
            <button className="close-btn" style={{marginTop: '1.5rem'}} onClick={() => {
              if (chatInput.trim()) {
                if (window.confirm('You have unsaved message. Are you sure you want to close the chat?')) {
                  setShowModal(false);
                  setChatInput('');
                  if (chatTriggerRef.current) {
                    chatTriggerRef.current.focus();
                  }
                }
              } else {
                setShowModal(false);
                if (chatTriggerRef.current) {
                  chatTriggerRef.current.focus();
                }
              }
            }}>Close Chat</button>
          </div>
        </div>
      )}

      {/* Enhanced Unified Category/Article Modal */}
      {(viewCategory || viewArticle) && (
        <div className="modal-overlay" onClick={() => { setViewCategory(null); setViewArticle(null); }}>
          <div className="category-modal" onClick={e => e.stopPropagation()}>
            
            {viewArticle ? (
              <div className="article-interior-view">
                <div className="article-modal-nav">
                  <button className="back-link" onClick={() => setViewArticle(null)}>
                    <ArrowLeft size={16} /> Back
                  </button>
                </div>
                <div className="article-viewer-content">
                  <span className="preview-cat-muted">{viewArticle.category}</span>
                  <h2>{viewArticle.title}</h2>
                  <p className="preview-meta">Last updated: {formatDate(viewArticle.updated_at)}</p>
                  <div className="preview-body">{viewArticle.content}</div>
                  
                  <div className="helpful-row">
                    <span>Was this helpful?</span>
                    <div className="helpful-actions">
                      <button><ThumbsUp size={16}/></button>
                      <button><ThumbsDown size={16}/></button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="category-interior-view">
                <div className="modal-header enhanced-mh">
                  <button className="back-link" onClick={() => setViewCategory(null)}>
                    <ArrowLeft size={16} /> Back to topics
                  </button>
                </div>
                <div className="modal-header-title">
                  <h2>{viewCategory} Articles</h2>
                </div>
                <div className="category-articles-list">
                  {liveArticles.filter(a => a.category === viewCategory).length > 0 ? (
                    liveArticles.filter(a => a.category === viewCategory).map(article => (
                      <div key={article.id} className="category-article-item enhanced-li" onClick={() => setViewArticle(article)}>
                        <div className="cat-article-info">
                          <h4>{article.title}</h4>
                          <span className="result-date">Updated: {formatDate(article.updated_at)}</span>
                        </div>
                        <ChevronRight className="article-chevron" size={20} />
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">📄</div>
                      <h3>Nothing here yet</h3>
                      <p>Articles for this topic are coming soon. Try searching or explore another category.</p>
                      <button className="secondary-btn" onClick={() => setViewCategory(null)}>Browse other topics</button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* Escalation Modal Flow */}
      {showEscalationModal && (
        <div className="modal-overlay" onClick={() => { setShowEscalationModal(false); resetEscalationForm(); }}>
          <div className="modal-content escalation-modal" onClick={e => e.stopPropagation()}>
            
            {escalationStep === 'guidance' && (
              <>
                <div className="esc-header">
                  <AlertCircle size={28} color="#2563eb" />
                  <h2>Before you raise an escalation</h2>
                </div>
                <div className="esc-guidance-box">
                  <p>Please ensure the following criteria are met before proceeding:</p>
                  <ul>
                    <li>You have already reached out to the support team.</li>
                    <li>Your issue is unresolved for <strong>more than 24 hours</strong> or you received an unsatisfactory response.</li>
                    <li>You have your <strong>support ticket ID</strong> ready (you can refer to your email to find the ticket ID).</li>
                  </ul>
                </div>
                <div className="esc-actions">
                  <button className="secondary-btn" onClick={() => { setShowEscalationModal(false); resetEscalationForm(); }}>Go Back</button>
                  <button className="primary-btn" onClick={() => setEscalationStep('form')}>Continue to Escalation</button>
                </div>
              </>
            )}

            {escalationStep === 'form' && (
              <>
                <div className="esc-header">
                  <h2>Escalation Form</h2>
                  <p>Provide your details to escalate the issue.</p>
                </div>
                <div className="esc-form-container">
                  <form className="esc-form" onSubmit={handleEscalationSubmit}>
                    <div className="form-group">
                      <label>Support Ticket ID <span className="required-asterisk">*</span></label>
                      <input 
                        type="text" 
                        placeholder="Enter your ticket ID" 
                        className={escalationErrors.ticketId ? 'input-error' : ''}
                        value={escalationData.ticketId}
                        onChange={(e) => {
                          setEscalationData({...escalationData, ticketId: e.target.value});
                          if (escalationErrors.ticketId) setEscalationErrors({...escalationErrors, ticketId: ''});
                        }}
                      />
                      {escalationErrors.ticketId && <span className="field-error">{escalationErrors.ticketId}</span>}
                    </div>
                    <div className="form-group">
                      <label>Email ID <span className="required-asterisk">*</span></label>
                      <input 
                        type="email" 
                        placeholder="Enter your email ID" 
                        className={escalationErrors.email ? 'input-error' : ''}
                        value={escalationData.email}
                        onChange={(e) => {
                          setEscalationData({...escalationData, email: e.target.value});
                          if (escalationErrors.email) setEscalationErrors({...escalationErrors, email: ''});
                        }}
                      />
                      {escalationErrors.email && <span className="field-error">{escalationErrors.email}</span>}
                    </div>
                    <div className="form-group full-width">
                      <label>Issue Description <span className="required-asterisk">*</span></label>
                      <textarea 
                        placeholder="Describe your issue in detail" 
                        rows="3"
                        className={escalationErrors.description ? 'input-error' : ''}
                        value={escalationData.description}
                        onChange={(e) => {
                          setEscalationData({...escalationData, description: e.target.value});
                          if (escalationErrors.description) setEscalationErrors({...escalationErrors, description: ''});
                        }}
                      ></textarea>
                      {escalationErrors.description && <span className="field-error">{escalationErrors.description}</span>}
                    </div>
                    <div className="form-group full-width">
                      <label>Attach Files (Optional)</label>
                      <div className="file-upload-container">
                        <input 
                          type="file" 
                          id="file-upload" 
                          multiple
                          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="file-upload" className="file-upload-label" onDragOver={handleDragOver} onDrop={handleDrop}>
                          <div className="file-upload-icon">📎</div>
                          <span>Choose files or drag and drop</span>
                          <small>JPG, PNG, PDF, DOC, DOCX (Max 5MB per file)</small>
                        </label>
                      </div>
                      {attachedFiles.length > 0 && (
                        <div className="attached-files-list">
                          {attachedFiles.map((file, index) => (
                            <div key={index} className="attached-file-item">
                              <span className="file-name">{file.name}</span>
                              <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                              <button 
                                type="button" 
                                className="remove-file-btn"
                                onClick={() => removeFile(index)}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </form>
                </div>
                <div className="esc-actions">
                  <button type="button" className="secondary-btn" onClick={() => setEscalationStep('guidance')}>Back</button>
                  <button type="submit" className="primary-btn" disabled={isSubmitting} onClick={handleEscalationSubmit}>
                    {isSubmitting ? (
                      <>
                        <span className="loading-spinner"></span>
                        Submitting...
                      </>
                    ) : (
                      'Submit Escalation'
                    )}
                  </button>
                </div>
              </>
            )}

            {escalationStep === 'success' && (
              <div className="esc-success-box">
                <CheckCircle size={48} color="#10b981" />
                <h2>Escalation Submitted</h2>
                <p>Your escalation (Ref: ESC-{Math.floor(Math.random() * 10000) + 1000}) has been submitted successfully.</p>
                <p className="esc-timeline">Our team will review your case and respond within 24 hours.</p>
                <button className="primary-btn full-width" onClick={() => { 
                  setShowEscalationModal(false); 
                  resetEscalationForm();
                }}>Done</button>
              </div>
            )}
            
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Home;
